import type { CollectionConfig } from 'payload'
import { getIO } from '../websocket/io'
import { timeOfDayMinutes, dateOnly, dateRangesOverlap, DAY_NAMES } from './schedule-utils'

const ONE_HOUR = 60 * 60 * 1000

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
    beforeChange: [
      async ({ data, req, originalDoc, operation }) => {
        const user = req.user as any
        if (!data.department && data.program) {
          const programId = typeof data.program === 'object' && data.program !== null
            ? (data.program as any).id
            : data.program
          try {
            const program = await req.payload.findByID({
              collection: 'programs',
              id: programId,
              depth: 1,
            })
            const programDept = (program as any).folder?.department
            if (programDept) {
              data.department = typeof programDept === 'object' ? programDept.id : programDept
            }
          } catch {}
        }
        if (!data.createdBy && user?.id) {
          data.createdBy = user.id
        }

        const startTime = data.startTime || originalDoc?.startTime
        if (!data.endTime && startTime) {
          const start = new Date(startTime)
          data.endTime = new Date(start.getTime() + ONE_HOUR).toISOString()
        }

        if (user && user.role !== 'admin' && data.program) {
          const programId = typeof data.program === 'object' && data.program !== null
            ? (data.program as any).id
            : data.program
          try {
            const program = await req.payload.findByID({
              collection: 'programs',
              id: programId,
              depth: 1,
            })
            const programDept =
              (program as any).folder
                ? typeof (program as any).folder.department === 'object'
                  ? (program as any).folder.department.id
                  : (program as any).folder.department
                : undefined
            const userDeptIds = (user.departments || []).map((d: any) =>
              typeof d === 'object' ? d.id : d
            )
            if (!userDeptIds.includes(programDept)) {
              throw new Error('You can only schedule programs from your own department.')
            }
          } catch (err: any) {
            if (err.message?.includes('only schedule programs')) throw err
          }
        }

        const daysOfWeek: string[] = Array.isArray(data.daysOfWeek) ? data.daysOfWeek : []
        const isOneOff = daysOfWeek.length === 0

        const startA = new Date(data.startTime).getTime()
        if (isNaN(startA)) return data
        const endA = new Date(data.endTime || data.startTime).getTime()
        if (isNaN(endA)) return data

        const deviceIds = (Array.isArray(data.devices) ? data.devices : [])
          .map((d: any) => (typeof d === 'object' && d !== null ? d.id : d))
          .filter(Boolean)
        const currentId = operation === 'update' ? originalDoc?.id : undefined

        for (const deviceId of deviceIds) {
          const existing = await req.payload.find({
            collection: 'schedule',
            depth: 0,
            pagination: false,
            where: {
              and: [
                { devices: { contains: deviceId } },
                ...(currentId ? [{ id: { not_equals: currentId } }] : []),
              ],
            },
          })

          for (const entry of existing.docs) {
            const entryDaysOfWeek: string[] = Array.isArray(entry.daysOfWeek) ? entry.daysOfWeek : []
            const entryIsOneOff = entryDaysOfWeek.length === 0

            const daysIntersect =
              isOneOff || entryIsOneOff ||
              daysOfWeek.some((d: string) => entryDaysOfWeek.includes(d))
            if (!daysIntersect) continue

            const startB = new Date(entry.startTime).getTime()
            if (isNaN(startB)) continue
            const endB = new Date(entry.endTime || entry.startTime).getTime()
            if (isNaN(endB)) continue

            const startMinA = timeOfDayMinutes(data.startTime)
            const endMinA = timeOfDayMinutes(data.endTime || data.startTime)
            const startMinB = timeOfDayMinutes(entry.startTime)
            const endMinB = timeOfDayMinutes(entry.endTime || entry.startTime)
            const timesOverlap = startMinA < endMinB && endMinA > startMinB
            if (!timesOverlap) continue

            const sdA = data.startDate || null
            const untilA = data.untilDate || null
            const sdB = entry.startDate || null
            const untilB = entry.untilDate || null
            const datesOverlap = dateRangesOverlap(sdA, untilA, sdB, untilB)
            if (!datesOverlap) continue

            if (isOneOff || entryIsOneOff) {
              if (isOneOff) {
                const dateA = dateOnly(data.startTime)
                const dateATs = new Date(dateA).getTime()
                if (sdB && dateATs < new Date(sdB).getTime()) continue
                if (untilB && dateATs > new Date(untilB).getTime()) continue
                if (!entryIsOneOff) {
                  const dayName = DAY_NAMES[new Date(dateA).getUTCDay()]
                  if (!entryDaysOfWeek.includes(dayName)) continue
                }
              }
              if (entryIsOneOff) {
                const dateB = dateOnly(entry.startTime)
                const dateBTs = new Date(dateB).getTime()
                if (sdA && dateBTs < new Date(sdA).getTime()) continue
                if (untilA && dateBTs > new Date(untilA).getTime()) continue
                if (!isOneOff) {
                  const dayName = DAY_NAMES[new Date(dateB).getUTCDay()]
                  if (!daysOfWeek.includes(dayName)) continue
                }
              }
            }

            throw new Error('This entry overlaps with an existing schedule on one of the selected devices.')
          }
        }
        return data
      },
    ],
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
