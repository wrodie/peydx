import type { CollectionConfig } from 'payload'

export const Departments: CollectionConfig = {
  slug: 'departments',
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
    hidden: ({ user }) => (user as any)?.role !== 'admin',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => (user as any)?.role === 'admin',
    update: ({ req: { user } }) => (user as any)?.role === 'admin',
    delete: ({ req: { user } }) => (user as any)?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
