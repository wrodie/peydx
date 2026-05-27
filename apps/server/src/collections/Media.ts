import type { CollectionConfig } from 'payload'
import { DEPARTMENTS } from '../constants/departments'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'department', 'filesize', 'updatedAt'],
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
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (!data.name && req.file?.name) {
          data.name = req.file.name.replace(/\.[^.]+$/, '')
        }
        return data
      },
    ],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { department: { equals: user.department } };
      if (user.collection === 'devices') return { department: { in: user.departments } };
      return false;
    },
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true;
      return { department: { equals: user?.department } };
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true;
      return { department: { equals: user?.department } };
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
      options: DEPARTMENTS,
    },
  ],
}