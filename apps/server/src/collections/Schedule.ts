import type { CollectionConfig } from 'payload'
import { getIO } from '../websocket/io'
import { scheduleBeforeChange } from '../hooks/scheduleBeforeChange'

export const Schedule: CollectionConfig = {
  slug: 'schedule',
  admin: {
    useAsTitle: 'program',
    defaultColumns: ['program', 'devices', 'startTime', 'endTime'],
  },
  timestamps: true,
  access: {
    read: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.collection === 'devices') {
        return true
      }
      if (user.role === 'basic') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { department: { in: deptIds } }
      }
      return false
    },
    create: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'basic') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { department: { in: deptIds } }
      }
      return false
    },
    update: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'basic') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { department: { in: deptIds } }
      }
      return false
    },
    delete: ({ req: { user: u } }) => (u as any)?.role === 'admin',
  },
  hooks: {
    beforeChange: [scheduleBeforeChange],
    afterChange: [
      async ({ doc }) => {
        const io = getIO()
        if (!io) return

        const deviceIds: number[] = Array.isArray(doc.devices)
          ? doc.devices.map((d: any) => typeof d === 'object' ? d.id : d)
          : []

        for (const deviceId of deviceIds) {
          io.to(`device:${deviceId}`).emit('schedule:update', {} as any)
        }
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        const io = getIO()
        if (!io) return

        const deviceIds: number[] = Array.isArray(doc.devices)
          ? doc.devices.map((d: any) => typeof d === 'object' ? d.id : d)
          : []

        for (const deviceId of deviceIds) {
          io.to(`device:${deviceId}`).emit('schedule:update', {} as any)
        }
      },
    ],
  },
  fields: [
    {
      name: 'program',
      type: 'relationship',
      relationTo: 'programs',
      required: true,
      filterOptions: ({ user: u }) => {
        const user = u as any
        if (user?.role === 'admin') return true
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { 'folder.department': { in: deptIds } }
      },
    },
    {
      name: 'devices',
      type: 'relationship',
      relationTo: 'devices',
      hasMany: true,
      required: true,
      filterOptions: ({ user: u }) => {
        const user = u as any
        if (!user) return false
        if (user.role === 'admin') return true
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { departments: { in: deptIds } }
      },
    },
    {
      name: 'daysOfWeek',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Monday', value: 'mon' },
        { label: 'Tuesday', value: 'tue' },
        { label: 'Wednesday', value: 'wed' },
        { label: 'Thursday', value: 'thu' },
        { label: 'Friday', value: 'fri' },
        { label: 'Saturday', value: 'sat' },
        { label: 'Sunday', value: 'sun' },
      ],
      admin: {
        description: 'Leave empty for a one-off event. Select days for weekly recurrence.',
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
        description: 'For a one-off event, select the exact date and time. For recurring, the date sets the first occurrence (time-of-day is used each week).',
      },
    },
    {
      name: 'endTime',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          timeIntervals: 15,
        },
        description: 'Defaults to 1 hour after start time.',
      },
    },
    {
      name: 'startDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
        description: 'Schedule becomes active on this date. Leave blank to use the startTime date.',
      },
    },
    {
      name: 'untilDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
        description: 'Schedule ends on this date. Leave blank for indefinite recurrence.',
      },
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      admin: { hidden: true },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { hidden: true },
    },
  ],
}
