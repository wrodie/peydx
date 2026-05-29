import type { CollectionConfig } from 'payload'
import { DEPARTMENTS } from '../constants/departments'

export const Devices: CollectionConfig = {
  slug: 'devices',
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
    hidden: ({ user }) => user?.role !== 'admin',
  },
  auth: {
    useAPIKey: true,
    disableLocalStrategy: true,
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return { departments: { contains: user.department } };
    },
    update: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return { departments: { contains: user.department } };
    },
    create: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'deviceId',
      type: 'text',
      required: true,
      unique: true,
      admin: { readOnly: true },
      hooks: {
        beforeValidate: [
          ({ value, operation }) => {
            if (operation === 'create' && !value) {
              return 'DEV-' + crypto.randomUUID().slice(0, 8).toUpperCase()
            }
            return value
          },
        ],
      },
    },
    {
      name: 'departments',
      type: 'select',
      hasMany: true,
      required: true,
      options: DEPARTMENTS,
    },
    {
      name: 'lastHeartbeat',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'currentProgram',
      type: 'relationship',
      relationTo: 'programs',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'offline',
      options: [
        { label: 'Online', value: 'online' },
        { label: 'Offline', value: 'offline' },
        { label: 'Stale', value: 'stale' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
}
