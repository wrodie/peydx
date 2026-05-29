import type { CollectionConfig } from 'payload'
import { ImageBlock, VideoBlock, YoutubeBlock } from '../blocks/SlideBlocks'
import { autoCreateSlides } from '../hooks/autoCreateSlides'
import { DEPARTMENTS } from '../constants/departments'

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
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'basic') return { department: { equals: user.department } };
      if (user.collection === 'devices') return { department: { in: user.departments } };
      return false;
    },
    update: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return {
        department: { equals: user.department }
      }
    },
    delete: ({ req: { user } }) => user?.role === 'admin', // Only admins can delete
  },

  hooks: {
    beforeChange: [
      async (args) => {
        const { req, data } = args
        if (args.context?.preventSync) return data
        if (req.user && req.user.role !== 'admin') {
          data.department = req.user.department
        }
        await autoCreateSlides(args)
        if (req.user && !data.createdBy) {
          data.createdBy = req.user.id
        }
        return data
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
      blocks: [ImageBlock, VideoBlock, YoutubeBlock],
    },
    {
      name: 'department',
      type: 'select',
      required: true,
      options: DEPARTMENTS,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) => user?.role === 'admin',
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

