import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // This tells Payload to bake these specific fields into the secure cookie JWT
    // @ts-ignore - typegen doesn't include custom JWT fields
    saveToJWT: ['role', 'departments'],
  },
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
    hidden: ({ user }) => (user as any)?.role !== 'admin',
  },
  access: {
    // Only global admins can see the full list of users or create new accounts
    read: ({ req: { user: u } }) => {
      const user = u as any
      if (user?.role === 'admin') return true
      if (user?.role === 'basic') return true
      return false
    },
    create: ({ req: { user: u } }) => (u as any)?.role === 'admin',
    update: ({ req: { user: u } }) => (u as any)?.role === 'admin',
    delete: ({ req: { user: u } }) => (u as any)?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'basic',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Basic Volunteer', value: 'basic' },
      ],
    },
    {
      name: 'departments',
      type: 'relationship',
      relationTo: 'departments',
      hasMany: true,
      required: true,
      admin: {
        position: 'sidebar',
        condition: (data, siblingData, { user }) => (user as any)?.role === 'admin',
      },
    },
  ],
}

