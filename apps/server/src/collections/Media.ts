import type { CollectionConfig } from 'payload'
import { cleanupMediaReferences } from '../hooks/cleanupMediaReferences'
import { mediaNameAutoFill } from '../hooks/mediaNameAutoFill'
import { mediaFolderAutoAssign } from '../hooks/mediaFolderAutoAssign'
import { mediaAfterCreate } from '../hooks/mediaAfterCreate'
import { mediaAfterUpdate } from '../hooks/mediaAfterUpdate'
import { mediaAfterRead } from '../hooks/mediaAfterRead'
import { verifyMediaToken } from '../utilities/mediaToken'
import { getIO } from '../websocket/io'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'filesize', 'duration', 'updatedAt'],
    listSearchableFields: ['name', 'filename'],
    components: {
      views: {
        list: {
          Component: '/components/ListWithSidebar#ListWithSidebar',
        },
      },
    },
  },
  upload: {
    staticDir: 'media',
    // We force WebP for maximum sync efficiency
    formatOptions: {
      format: 'webp',
      options: { quality: 80 },
    },
    imageSizes: [
      {
        name: 'fullHD',
        width: 1920,
        height: 1080,
        position: 'centre',
      },
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        fit: 'contain',
        background: 'transparent',
      },
    ],
    adminThumbnail: 'thumbnail',
  },
  hooks: {
    beforeDelete: [
      cleanupMediaReferences,
    ],
    beforeChange: [mediaNameAutoFill, mediaFolderAutoAssign],
    afterChange: [
      mediaAfterCreate,
      mediaAfterUpdate,
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const io = getIO()
        if (!io) return

        const affectedProgramIds: number[] = (req as any).context?.affectedProgramIds || []
        if (affectedProgramIds.length === 0) return

        const deviceIds = new Set<number>()
        for (const programId of affectedProgramIds) {
          const schedules = await req.payload.find({
            collection: 'schedule',
            depth: 0,
            pagination: false,
            where: { program: { equals: programId } },
          })
          for (const s of schedules.docs) {
            for (const dId of s.devices as number[]) {
              deviceIds.add(typeof dId === 'object' ? (dId as any).id : dId)
            }
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
    afterRead: [mediaAfterRead],
  },
  access: {
    read: async ({ req: { user: u, query, payload }, data }) => {
      const user = u as any
      if (!user) {
        if ((query as any)?.mediaToken) {
          if (
            data?.filename &&
            verifyMediaToken((query as any).mediaToken, data.filename, payload.config.secret)
          ) {
            return true
          }
          return false
        }
        if ((query as any)?.token) {
          try {
            const device = await payload.find({
              collection: 'devices',
              where: { browserToken: { equals: (query as any).token } },
              depth: 0,
              limit: 1,
              overrideAccess: true,
            })
            if (device.docs?.[0]?.deviceType === 'browser') {
              const deptIds = (device.docs[0].departments || []).map((d: any) =>
                typeof d === 'object' ? d.id : d,
              )
              return { 'folder.department': { in: deptIds } }
            }
          } catch {}
        }
        return false
      }
      if (user.collection === 'devices') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      if (user.role === 'admin') return true;
      const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
      return { 'folder.department': { in: deptIds } }
    },
    update: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      return false;
    },
    delete: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      return false;
    },
    create: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return true;
      return false;
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: false,
      label: 'Display Name',
      admin: {
        description: 'Name shown on screens for this media item.',
        components: {
          Cell: '/components/NameWithThumbnailCell#NameWithThumbnailCell',
        },
      },
    },
    {
      name: 'folder',
      type: 'relationship',
      relationTo: 'folders',
      required: false,
      filterOptions: {
        type: { equals: 'media' },
      },
      admin: {
        position: 'sidebar',
        condition: (data) => !!data?.id,
      },
    },
    {
      name: 'filesize',
      type: 'number',
      admin: {
        components: {
          Cell: '/components/FormattedFilesizeCell#FormattedFilesizeCell',
        },
      },
    },
    {
      name: 'duration',
      type: 'number',
      label: 'Duration',
      admin: {
        position: 'sidebar',
        readOnly: true,
        components: {
          Cell: '/components/DurationCell#DurationCell',
        },
      },
    },
  ],
}