import type { GlobalConfig } from 'payload'

export const Config: GlobalConfig = {
  slug: 'settings',
  label: 'Settings',
  admin: {
    group: 'Admin',
  },
  access: {
    read: ({ req: { user } }) => (user as any)?.role === 'admin',
    update: ({ req: { user } }) => (user as any)?.role === 'admin',
  },
  fields: [
    {
      name: 'updateSection',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/UpdateButton#UpdateButton',
        },
      },
    },
  ],
}
