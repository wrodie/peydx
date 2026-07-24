import type { CollectionConfig } from 'payload'
import { slidesBeforeChange } from '../hooks/slidesBeforeChange'
import { slidesFolderAutoAssign } from '../hooks/slidesFolderAutoAssign'

export const Slides: CollectionConfig = {
  slug: 'slides',
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'folder', 'updatedAt'],
  },
  access: {
    read: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'standard' || user.role === 'manager') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      if (user.collection === 'devices') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      return false
    },
    create: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'standard' || user.role === 'manager') return true
      return false
    },
    update: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'standard' || user.role === 'manager') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      return false
    },
    delete: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'standard' || user.role === 'manager') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      }
      return false
    },
  },
  hooks: {
    beforeChange: [slidesBeforeChange, slidesFolderAutoAssign],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'designJson',
      type: 'json',
      required: true,
      admin: {
        components: {
          Field: '/components/slides/SlidesEditorView#SlidesEditorView',
        },
      },
    },
    {
      name: 'width',
      type: 'number',
      defaultValue: 1920,
      admin: { hidden: true },
    },
    {
      name: 'height',
      type: 'number',
      defaultValue: 1080,
      admin: { hidden: true },
    },
    {
      name: 'render',
      type: 'relationship',
      relationTo: 'media',
      hasMany: false,
      admin: { hidden: true },
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
        components: {
          Field: '/components/FolderSelectField#FolderSelectField',
        },
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', readOnly: true, hidden: true },
    },
  ],
}
