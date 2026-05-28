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
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (!data.schedule) return data
        const items = Array.isArray(data.schedule) ? data.schedule : []
        for (const entry of items) {
          if (!entry.department && req.user?.department) {
            entry.department = req.user.department
          }
          if (!entry.createdBy && req.user?.id) {
            entry.createdBy = req.user.id
          }
          if (!entry.durationMinutes && entry.program) {
            const programId = typeof entry.program === 'object' && entry.program !== null
              ? (entry.program as any).id
              : entry.program
            try {
              const program = await req.payload.findByID({
                collection: 'programs',
                id: programId,
                depth: 0,
              })
              entry.durationMinutes = program.durationMinutes || 30
            } catch {}
          }
        }
        return data
      },
    ],
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
      admin: {
        components: {
          Field: '/components/ScheduleCalendar#ScheduleCalendar',
        },
      },
      validate: (value) => {
        if (!value || !Array.isArray(value) || value.length <= 1) return true

        for (let i = 0; i < value.length; i++) {
          const entry = value[i] as any
          const startA = new Date(entry.startTime).getTime()
          if (isNaN(startA)) continue

          const durA = (entry.durationMinutes || 30) * 60 * 1000
          const endA = startA + durA

          for (let j = i + 1; j < value.length; j++) {
            const other = value[j] as any
            const startB = new Date(other.startTime).getTime()
            if (isNaN(startB)) continue

            const durB = (other.durationMinutes || 30) * 60 * 1000
            const endB = startB + durB

            if (startA < endB && endA > startB) {
              return 'Two programs overlap in time. Please adjust start times or durations.'
            }
          }
        }
        return true
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
              timeIntervals: 15,
            },
          },
        },
        {
          name: 'durationMinutes',
          type: 'number',
          min: 1,
          max: 480,
          admin: {
            readOnly: true,
            description: 'Auto-filled from program duration.',
          },
        },
        {
          name: 'department',
          type: 'select',
          options: DEPARTMENTS,
          admin: { hidden: true },
        },
        {
          name: 'createdBy',
          type: 'relationship',
          relationTo: 'users',
          admin: { hidden: true },
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
