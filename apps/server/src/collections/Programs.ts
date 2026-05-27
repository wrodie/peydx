import type { CollectionConfig } from 'payload'
import { ImageBlock, VideoBlock } from '../blocks/SlideBlocks'
import { autoCreateSlides } from '../hooks/autoCreateSlides'
import { DEPARTMENTS } from '../constants/departments'

export const Programs: CollectionConfig = {
  slug: 'programs',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'department', 'updatedAt', 'createdBy'],
    group: 'Content Management',
  },
  // Automatically manages 'createdAt' and 'updatedAt' fields
  timestamps: true,
  
  // Logical Separation: Users only see programs matching their department
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === 'admin') return true; // Admins see all
      return {
        department: { equals: user.department }
      }
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
    afterChange: [async (args) => {
      if (args.context?.preventSync) return args.doc
      return autoCreateSlides(args)
    }],
    beforeChange: [
      ({ req, data }) => {
        // Tag the creator on the first save
        if (req.user && !data.createdBy) {
          data.createdBy = req.user.id;
        }
        return data;
      },
    ],
  },

  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General Info',
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
              name: 'department',
              type: 'select',
              required: true,
              options: DEPARTMENTS,
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
            }
          ],
        },
        {
          label: 'Slideshow Builder',
          fields: [
            {
              name: 'slides',
              type: 'blocks',
              blocks: [ImageBlock, VideoBlock],
            },
          ],
        },
      ],
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
  ],
}

