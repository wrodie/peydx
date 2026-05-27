import type { CollectionConfig } from 'payload'
import { DEPARTMENTS } from '../constants/departments'

export const Devices: CollectionConfig = {
  slug: 'devices',
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
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
    },
    {
      name: 'departments',
      type: 'select',
      hasMany: true,
      required: true,
      options: DEPARTMENTS,
    },
    {
      name: 'schedule',
      type: 'array',
      validate: (value) => {
        if (!value || value.length <= 1) return true;

        // Check for duplicate start times within the local array
        const startTimes = value.map(item => new Date(item.startTime).getTime());
        const hasOverlap = startTimes.some((time, index) => startTimes.indexOf(time) !== index);

        if (hasOverlap) {
          return 'Two programs cannot start at the exact same time on this device.';
        }
        return true;
      },
      fields: [
        {
          name: 'program',
          type: 'relationship',
          relationTo: 'programs',
          required: true,
          filterOptions: ({ user }) => {
            if (user?.role === 'admin') return true;
            return { department: { equals: user?.department } };
          },
        },
        {
          name: 'startTime',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
              timeIntervals: 15, // 15-minute increments for cleaner scheduling
            },
          },
        },
      ],
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