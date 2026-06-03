import type { CollectionConfig } from 'payload'
import { ImageBlock, VideoBlock, YoutubeBlock } from '../blocks/SlideBlocks'
import { BlackScreenBlock } from '../blocks/BlackScreenBlock'
import { autoCreateSlides } from '../hooks/autoCreateSlides'
import { getIO } from '../websocket/io'

export const Programs: CollectionConfig = {
  slug: 'programs',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'department', 'updatedAt', 'createdBy'],
  },
  // Automatically manages 'createdAt' and 'updatedAt' fields
  timestamps: true,
  
  // Logical Separation: Users only see programs matching their department
  access: {
    read: async ({ req: { user: u, query, payload } }) => {
      const user = u as any
      if (!user) {
        if (query?.token) {
          try {
            const device = await payload.find({
              collection: 'devices',
              where: { browserToken: { equals: query.token } },
              depth: 0,
              limit: 1,
            })
            if (device.docs?.[0]?.deviceType === 'browser') {
              const deptIds = (device.docs[0].departments || []).map((d: any) =>
                typeof d === 'object' ? d.id : d
              )
              return { department: { in: deptIds } }
            }
          } catch { return false }
        }
        return false
      }
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { department: { equals: user.department } };
      if (user.collection === 'devices') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { department: { in: deptIds } }
      }
      return false;
    },
    update: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      return {
        department: { equals: user.department }
      }
    },
    delete: ({ req: { user: u } }) => (u as any)?.role === 'admin',
  },

  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data.slides && Array.isArray(data.slides)) {
          data.slides = data.slides.filter((s: any) => s.id !== 'auto-end')
        }
        return data
      },
    ],
    beforeChange: [
      async (args) => {
        const { req, data } = args
        const user = req.user as any
        if (args.context?.preventSync) return data
        if (user && user.role !== 'admin') {
          data.department = user.department
        }
        await autoCreateSlides(args)
        if (user && !data.createdBy) {
          data.createdBy = user.id
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') return

        const io = getIO()
        if (!io) return

        // Find all devices currently running this program via schedule
        const schedules = await req.payload.find({
          collection: 'schedule',
          depth: 0,
          pagination: false,
          where: {
            program: { equals: doc.id },
          },
        })

        const deviceIds = new Set<number>()
        for (const schedule of schedules.docs) {
          for (const deviceId of schedule.devices as number[]) {
            deviceIds.add(typeof deviceId === 'object' ? (deviceId as any).id : deviceId)
          }
        }

        // Also find devices where currentProgram === this program
        const devices = await req.payload.find({
          collection: 'devices',
          depth: 0,
          pagination: false,
          where: {
            currentProgram: { equals: doc.id },
          },
        })
        for (const device of devices.docs) {
          deviceIds.add(device.id)
        }

        if (deviceIds.size === 0) return

        // Fetch full program with slides populated
        const fullProgram = await req.payload.findByID({
          collection: 'programs',
          id: doc.id,
          depth: 2,
        })

        for (const deviceId of deviceIds) {
          io.to(`device:${deviceId}`).emit('program:update', { program: fullProgram })
        }
      },
    ],
    afterRead: [
      ({ doc, req }) => {
        if ((doc as any).autoBlackEndSlide
          && !(doc as any).loop
          && doc.slides
          && Array.isArray(doc.slides)
          && doc.slides.length > 0
          && doc.slides[doc.slides.length - 1]?.blockType !== 'blackScreenBlock'
          && !doc.slides.some((s: any) => s.id === 'auto-end')
        ) {
          // Suppress auto-end in admin edit view so it doesn't clutter the slides list
          if (req?.url?.includes('/admin/')) return doc
          doc.slides = [...doc.slides, {
            id: 'auto-end',
            blockType: 'blackScreenBlock',
            advanceMode: 'manual',
            transition: 'fade',
            duration: null,
          }]
        }
        return doc
      },
    ],
  },

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Brief overview for other users.',
      },
    },
    {
      name: 'slides',
      type: 'blocks',
      blocks: [ImageBlock, VideoBlock, YoutubeBlock, BlackScreenBlock],
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      required: true,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) => (user as any)?.role === 'admin',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Approved / Ready', value: 'approved' },
      ],
      admin: {
        position: 'sidebar',
      }
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        position: 'sidebar',
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
      name: 'durationMinutes',
      type: 'number',
      required: true,
      defaultValue: 5,
      min: 1,
      max: 480,
      admin: {
        position: 'sidebar',
        description: 'Estimated runtime in minutes. Used for schedule conflict detection.',
      },
    },
    {
      name: 'loop',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'When enabled, program loops continuously. When disabled, a black end slide is appended.',
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
      name: 'previewLink',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/components/PreviewLink#PreviewLink',
        },
      },
    },
  ],
}

