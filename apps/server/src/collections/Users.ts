import type { CollectionConfig } from 'payload'
import { DEPARTMENTS } from '../constants/departments'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // This tells Payload to bake these specific fields into the secure cookie JWT
    saveToJWT: ['role', 'department'],
  },
  admin: {
    useAsTitle: 'name',
  },
  access: {
    // Only global admins can see the full list of users or create new accounts
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'basic') return true
      return false
    },
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      access: {
        read: ({ req: { user } }) => user?.role === 'admin',
      },
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
      name: 'department',
      type: 'select',
      required: true,
      options: DEPARTMENTS,
      admin: {
        // Keeps the layout clean by putting assignment fields on the right-hand panel
        position: 'sidebar',
        // Visually blocks non-admins from changing their own department privileges
        condition: (data, siblingData, { user }) => user?.role === 'admin',
      },
    },
  ],
}

