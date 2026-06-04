import type { CollectionConfig } from 'payload'
import { cleanupMediaReferences } from '../hooks/cleanupMediaReferences'
import { getIO } from '../websocket/io'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['filename', 'name', 'filesize', 'updatedAt'],
    listSearchableFields: ['name', 'filename'],
    components: {
      beforeListTable: ['/components/FolderTree#FolderTree'],
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
    beforeChange: [
      async ({ data, req }) => {
        if (!data.name && req.file?.name) {
          data.name = req.file.name.replace(/\.[^.]+$/, '')
        }
        if (!data.folder && req.user) {
          const user = req.user as any
          // 1. Try current-folder preference
          const prefs = await req.payload.find({
            collection: 'payload-preferences',
            depth: 0,
            pagination: false,
            where: {
              and: [
                { key: { equals: 'current-folder' } },
                { 'user.value': { equals: req.user.id } },
              ],
            },
          })
          const prefValue = (prefs.docs?.[0]?.value as any)?.value as number | null
          if (prefValue) {
            data.folder = prefValue
          } else if (user.role !== 'admin' && user.department) {
            // 2. Fall back to department's root folder for non-admin users
            const deptId =
              typeof user.department === 'object'
                ? user.department.id
                : user.department
            const rootFolder = await req.payload.find({
              collection: 'folders',
              depth: 0,
              limit: 1,
              pagination: false,
              where: {
                department: { equals: deptId },
                parent: { exists: false },
              },
            })
            if (rootFolder.docs?.[0]) {
              data.folder = rootFolder.docs[0].id
            }
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        if (!doc.mimeType?.startsWith('video/')) return
        if (!doc.filename) return

        const thumbFilename = doc.filename.replace(/\.[^.]+$/, '_thumb.webp')
        const inputPath = path.resolve(process.cwd(), 'media', doc.filename)
        const outputPath = path.resolve(process.cwd(), 'media', thumbFilename)

        try {
          await execAsync(`ffmpeg -ss 2 -i "${inputPath}" -vframes 1 -vf "scale=400:300" "${outputPath}"`)
        } catch (err) {
          console.error(`Failed to generate video thumbnail for ${doc.filename}:`, err)
        }
      },
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
    afterRead: [
      ({ doc }) => {
        if (doc.mimeType?.startsWith('video/') && doc.filename) {
          const thumbFilename = doc.filename.replace(/\.[^.]+$/, '_thumb.webp')
          const thumbPath = path.resolve(process.cwd(), 'media', thumbFilename)
          if (fs.existsSync(thumbPath)) {
            const thumbUrl = `/api/media/file/${encodeURIComponent(thumbFilename)}`
            doc.thumbnailURL = thumbUrl
            doc.sizes = {
              ...doc.sizes,
              thumbnail: {
                url: thumbUrl,
              },
            }
          }
        }
        return doc
      },
    ],
  },
  access: {
    read: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return true;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { 'folder.department': { equals: user.department } };
      if (user.collection === 'devices') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      return true;
    },
    update: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { 'folder.department': { equals: user.department } };
      return false;
    },
    delete: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { 'folder.department': { equals: user.department } };
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
  ],
}