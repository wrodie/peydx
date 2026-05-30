import type { CollectionConfig } from 'payload'
import { DEPARTMENTS } from '../constants/departments'
import { cleanupMediaReferences } from '../hooks/cleanupMediaReferences'
import { getIO } from '../websocket/io'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['filename', 'name', 'department', 'filesize', 'updatedAt'],
    listSearchableFields: ['name', 'filename'],
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
    beforeDelete: [cleanupMediaReferences],
    beforeChange: [
      ({ data, req }) => {
        if (!data.name && req.file?.name) {
          data.name = req.file.name.replace(/\.[^.]+$/, '')
        }
        if (req.user && (req.user as any).role !== 'admin') {
          data.department = (req.user as any).department
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') return

        const io = getIO()
        if (!io) return

        // Find all programs that reference this media
        const programs = await req.payload.find({
          collection: 'programs',
          depth: 0,
          pagination: false,
          where: {
            or: [
              { 'slides.image': { equals: doc.id } },
              { 'slides.video': { equals: doc.id } },
            ],
          },
        })

        if (programs.docs.length === 0) return

        // For each program, find devices and notify
        for (const program of programs.docs) {
          const schedules = await req.payload.find({
            collection: 'schedule',
            depth: 0,
            pagination: false,
            where: { program: { equals: program.id } },
          })

          const deviceIds = new Set<number>()
          for (const s of schedules.docs) {
            for (const dId of s.devices as number[]) {
              deviceIds.add(typeof dId === 'object' ? (dId as any).id : dId)
            }
          }

          for (const deviceId of deviceIds) {
            io.to(`device:${deviceId}`).emit('media:update', {
              mediaId: doc.id,
              url: doc.url || '',
              sizes: doc.sizes,
            })
          }
        }
      },
    ],
  },
  access: {
    read: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return true;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { department: { equals: user.department } };
      if (user.collection === 'devices') return { department: { in: user.departments } };
      return true;
    },
    update: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { department: { equals: user.department } };
      return false;
    },
    delete: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { department: { equals: user.department } };
      return false;
    },
    create: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { department: { equals: user.department } };
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
      },
    },
    {
      name: 'department',
      type: 'select',
      required: true,
      options: DEPARTMENTS as any,
      admin: {
        condition: (_, __, { user }) => (user as any)?.role === 'admin',
      },
    },
  ],
}