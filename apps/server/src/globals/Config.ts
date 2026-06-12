import type { GlobalConfig } from 'payload'

export const Config: GlobalConfig = {
  slug: 'settings',
  label: 'Settings',
  admin: {
    group: 'Admin',
    components: {
      elements: {
        afterEdit: ['/components/UpdateButton#UpdateButton'],
      },
    },
  },
  access: {
    read: ({ req: { user } }) => (user as any)?.role === 'admin',
    update: ({ req: { user } }) => (user as any)?.role === 'admin',
  },
  fields: [
    {
      name: 'clientVersion',
      type: 'text',
      label: 'Client Version',
      defaultValue: 'v0.1.0',
      required: true,
    },
  ],
}
