import type { CollectionConfig } from 'payload'
import { folderBeforeChange } from '../hooks/folderBeforeChange'
import { folderBeforeDelete } from '../hooks/folderBeforeDelete'

export const Folders: CollectionConfig = {
  slug: 'folders',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'department', 'order', 'parent'],
    group: 'Admin',
    hidden: ({ user }) => (user as any)?.role !== 'admin',
  },
  access: {
    read: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return { department: { exists: false } }
      if (user.role === 'admin') return true
      if (user.role === 'standard' || user.role === 'manager') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { department: { in: deptIds } }
      }
      if (user.collection === 'devices') {
        const deptIds = (user.departments || []).map((d: any) =>
          typeof d === 'object' ? d.id : d
        )
        return { department: { in: deptIds } }
      }
      return { department: { exists: false } }
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
        return { department: { in: deptIds } }
      }
      return false
    },
    delete: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'standard' || user.role === 'manager') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { department: { in: deptIds } }
      }
      return false
    },
  },
  hooks: {
    beforeChange: [folderBeforeChange],
    beforeDelete: [folderBeforeDelete],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'folders',
      required: false,
      filterOptions: ({ data }) => {
        const filters: any = {}
        if (data?.type) {
          filters.type = { equals: data.type }
        }
        if (data?.department) {
          const deptId =
            typeof data.department === 'object'
              ? data.department.id
              : data.department
          filters.department = { equals: deptId }
        }
        return filters
      },
      admin: {
        description: 'Parent folder. Leave empty to create a top-level folder.',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Media', value: 'media' },
        { label: 'Programs', value: 'programs' },
      ],
      admin: {
        description: 'Which collection this folder belongs to.',
      },
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      required: false,
      admin: {
        condition: (_, __, { user }) => (user as any)?.role === 'admin',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Sort order within sibling folders (lower = first).',
      },
    },
  ],
}
