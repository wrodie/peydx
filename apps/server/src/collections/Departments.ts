import type { CollectionConfig } from 'payload'
import { departmentCreateFolders } from '../hooks/departmentCreateFolders'

export const Departments: CollectionConfig = {
  slug: 'departments',
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
    hidden: ({ user }) => (user as any)?.role !== 'admin',
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => (user as any)?.role === 'admin',
    update: ({ req: { user } }) => (user as any)?.role === 'admin',
    delete: ({ req: { user } }) => (user as any)?.role === 'admin',
  },
  hooks: {
    afterChange: [departmentCreateFolders],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
