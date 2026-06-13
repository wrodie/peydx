import type { CollectionConfig } from 'payload'

export const Integrations: CollectionConfig = {
  slug: 'integrations',
  auth: {
    useAPIKey: true,
    disableLocalStrategy: true,
  },
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
    hidden: ({ user }) => user?.role !== 'admin',
  },
  access: {
    read: ({ req: { user } }) => (user as any)?.role === 'admin',
    create: ({ req: { user } }) => (user as any)?.role === 'admin',
    update: ({ req: { user } }) => (user as any)?.role === 'admin',
    delete: ({ req: { user } }) => (user as any)?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Descriptive name (e.g. "Home Assistant")' },
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          timeIntervals: 60,
        },
        description: 'After this date, the API key will stop working.',
      },
    },
    {
      name: 'departments',
      type: 'relationship',
      relationTo: 'departments',
      hasMany: true,
      admin: {
        description: 'Leave empty for access to all departments. Select departments to restrict access.',
      },
    },
  ],
}
