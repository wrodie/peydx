import type { CollectionConfig } from 'payload'
import { ImageBlock, VideoBlock, YoutubeBlock, AudioBlock } from '../blocks/SlideBlocks'
import { BlackScreenBlock } from '../blocks/BlackScreenBlock'
import { SegmentBlock } from '../blocks/SegmentBlock'
import { autoCreateSlides } from '../hooks/autoCreateSlides'
import { moveSlides } from '../hooks/moveSlides'
import { programBeforeValidate } from '../hooks/programBeforeValidate'
import { programAutoEndSlide } from '../hooks/programAutoEndSlide'
import { getIO } from '../websocket/io'

const notifyDebounce = new Map<number, ReturnType<typeof setTimeout>>()

function debouncedNotify(io: ReturnType<typeof getIO>, programId: number, fn: () => void) {
  if (notifyDebounce.has(programId)) {
    clearTimeout(notifyDebounce.get(programId)!)
  }
  notifyDebounce.set(programId, setTimeout(() => {
    notifyDebounce.delete(programId)
    fn()
  }, 2000))
}

export const Programs: CollectionConfig = {
  slug: 'programs',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt', 'createdBy'],
    baseFilter: async ({ req }) => {
      if (!req.user) return null
      try {
        const prefs = await req.payload.find({
          collection: 'payload-preferences',
          depth: 0,
          pagination: false,
          where: {
            and: [
              { key: { equals: 'current-folder-programs' } },
              { 'user.value': { equals: req.user.id } },
            ],
          },
        })
        const folderId = (prefs.docs?.[0]?.value as any)?.value as number | null | undefined
        if (folderId == null) return null
        return { folder: { equals: folderId } }
      } catch {
        return null
      }
    },
    components: {
      views: {
        list: {
          Component: '/components/ListWithSidebar#ListWithSidebar',
        },
      },
    },
  },
  // Automatically manages 'createdAt' and 'updatedAt' fields
  timestamps: true,
  
  // Logical Separation: Users only see programs matching their department
  access: {
    read: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true;
      if (user.role === 'standard' || user.role === 'manager') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      if (user.collection === 'devices') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      return false;
    },
    update: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      return {
        'folder.department': { in: (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d) }
      }
    },
    delete: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      return {
        'folder.department': { in: (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d) }
      }
    },
  },

  hooks: {
    beforeValidate: [programBeforeValidate],
    beforeChange: [
      async (args) => {
        const { req, data } = args
        const user = req.user as any
        if (args.context?.preventSync) return data
        if (!data.folder && req.user) {
          // 1. Try current-folder preference
          const prefs = await req.payload.find({
            collection: 'payload-preferences',
            depth: 0,
            pagination: false,
            where: {
              and: [
                { key: { equals: 'current-folder-programs' } },
                { 'user.value': { equals: req.user.id } },
              ],
            },
          })
          const prefValue = (prefs.docs?.[0]?.value as any)?.value as number | null
          if (prefValue) {
            data.folder = prefValue
          } else if (user && user.role !== 'admin' && user.departments) {
            // 2. Fall back to first department's root folder
            const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
            if (deptIds.length > 0) {
              const rootFolder = await req.payload.find({
                collection: 'folders',
                depth: 0,
                limit: 1,
                pagination: false,
                where: {
                  department: { equals: deptIds[0] },
                  parent: { exists: false },
                },
              })
              if (rootFolder.docs?.[0]) {
                data.folder = rootFolder.docs[0].id
              }
            }
          }
        }
        await autoCreateSlides(args)
        await moveSlides(args)
        if (user && !data.createdBy) {
          data.createdBy = user.id
        }
        return data
      },
    ],
    afterChange: [
      async (args) => {
        if (args.context?.preventSync) return
        const { doc, req } = args

        const io = getIO()
        if (!io) return

        debouncedNotify(io, doc.id, async () => {
          const deviceIds = new Set<number>()

          const schedules = await req.payload.find({
            collection: 'schedule',
            depth: 0,
            pagination: false,
            where: { program: { equals: doc.id } },
          })
          for (const schedule of schedules.docs) {
            for (const deviceId of schedule.devices as number[]) {
              deviceIds.add(typeof deviceId === 'object' ? (deviceId as any).id : deviceId)
            }
          }

          if (doc.availableDevices) {
            for (const deviceId of doc.availableDevices as number[]) {
              deviceIds.add(typeof deviceId === 'object' ? (deviceId as any).id : deviceId)
            }
          }

          const devices = await req.payload.find({
            collection: 'devices',
            depth: 0,
            pagination: false,
            where: { currentProgram: { equals: doc.id } },
          })
          for (const device of devices.docs) {
            deviceIds.add(device.id)
          }

          for (const deviceId of deviceIds) {
            io.to(`device:${deviceId}`).emit('schedule:update', {} as any)
          }

          if (deviceIds.size === 0) {
            try {
              const program = await req.payload.findByID({
                collection: 'programs',
                id: doc.id,
                depth: 1,
              })
              const deptId = (program as any)?.folder?.department
              if (deptId) {
                const deptIdNum = typeof deptId === 'object' ? deptId.id : deptId
                io.to(`department:${deptIdNum}`).emit('schedule:update', {} as any)
              }
            } catch {
              // Program not yet visible in this transaction — skip department fallback
            }
          }
        })
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const io = getIO()
        if (!io) return

        const deviceIds = new Set<number>()

        // Devices from schedules that used this program
        const schedules = await req.payload.find({
          collection: 'schedule',
          depth: 0,
          pagination: false,
          where: { program: { equals: doc.id } },
        })
        for (const schedule of schedules.docs) {
          for (const deviceId of schedule.devices as number[]) {
            deviceIds.add(typeof deviceId === 'object' ? (deviceId as any).id : deviceId)
          }
        }

        // Devices from availableDevices
        if (doc.availableDevices) {
          for (const deviceId of doc.availableDevices as number[]) {
            deviceIds.add(typeof deviceId === 'object' ? (deviceId as any).id : deviceId)
          }
        }

        for (const deviceId of deviceIds) {
          io.to(`device:${deviceId}`).emit('schedule:update', {} as any)
        }

        // Department fallback
        if (deviceIds.size === 0) {
          const deptId = (doc as any)?.folder?.department
          if (deptId) {
            const deptIdNum = typeof deptId === 'object' ? deptId.id : deptId
            io.to(`department:${deptIdNum}`).emit('schedule:update', {} as any)
          }
        }
      },
    ],
    afterRead: [programAutoEndSlide],
  },

  fields: [
    {
      name: 'previewLink',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/components/PreviewLink#PreviewLink',
        },
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        hidden: true,
        description: 'Brief overview for other users.',
      },
    },
    {
      name: 'slides',
      type: 'blocks',
      blocks: [ImageBlock, VideoBlock, YoutubeBlock, AudioBlock, BlackScreenBlock, SegmentBlock],
      admin: {
        components: {
          Field: '/components/program-edit/ProgramTimelineField#ProgramTimelineField',
        },
      },
    },
    {
      name: 'folder',
      type: 'relationship',
      relationTo: 'folders',
      required: false,
      filterOptions: {
        type: { equals: 'programs' },
      },
      admin: {
        position: 'sidebar',
        condition: (data) => !!data?.id,
      },
    },
    {
      name: 'bulkMedia',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description: 'Drop files here to auto-generate slides.',
      },
    },
    {
      name: 'loop',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'When enabled, program loops continuously. When disabled, the program ends after the last slide.',
      },
    },
    {
      name: 'autoBlackEndSlide',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Automatically adds a black screen at the end of the program.',
      },
    },
    {
      name: 'availableFrom',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayOnly',
        },
        description: 'Program becomes available for manual selection on this date.',
      },
    },
    {
      name: 'availableUntil',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayOnly',
        },
        description: 'Leave blank for indefinite availability.',
      },
    },
    {
      name: 'availableDevices',
      type: 'relationship',
      relationTo: 'devices',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description: 'Devices that can manually select this program.',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
  ],
}

