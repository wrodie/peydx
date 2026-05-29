import type { CollectionConfig } from 'payload'
import { DEPARTMENTS } from '../constants/departments'

const ONE_HOUR = 60 * 60 * 1000

export const Schedule: CollectionConfig = {
  slug: 'schedule',
  admin: {
    useAsTitle: 'program',
    defaultColumns: ['program', 'devices', 'startTime', 'endTime'],
  },
  timestamps: true,
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.collection === 'devices') {
        return { department: { in: user.departments } }
      }
      return { department: { equals: user.department } }
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return true
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { department: { equals: user.department } }
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc, operation }) => {
        if (!data.department && req.user?.department) {
          data.department = req.user.department
        }
        if (!data.createdBy && req.user?.id) {
          data.createdBy = req.user.id
        }

        const startTime = data.startTime || originalDoc?.startTime
        if (!data.endTime && startTime) {
          const start = new Date(startTime)
          data.endTime = new Date(start.getTime() + ONE_HOUR).toISOString()
        }

        if (req.user && req.user.role !== 'admin' && data.program) {
          const programId = typeof data.program === 'object' && data.program !== null
            ? (data.program as any).id
            : data.program
          try {
            const program = await req.payload.findByID({
              collection: 'programs',
              id: programId,
              depth: 0,
            })
            if (program.department !== req.user.department) {
              throw new Error('You can only schedule programs from your own department.')
            }
          } catch (err: any) {
            if (err.message?.includes('only schedule programs')) throw err
          }
        }

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
            const startB = new Date(entry.startTime).getTime()
            if (isNaN(startB)) continue
            const endB = new Date(entry.endTime || entry.startTime).getTime()
            if (isNaN(endB)) continue
            if (startA < endB && endA > startB) {
              throw new Error('This entry overlaps with an existing schedule on one of the selected devices.')
            }
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'program',
      type: 'relationship',
      relationTo: 'programs',
      required: true,
      filterOptions: ({ user }) => {
        if (user?.role === 'admin') return true
        return { department: { equals: user?.department } }
      },
    },
    {
      name: 'devices',
      type: 'relationship',
      relationTo: 'devices',
      hasMany: true,
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false
        if (user.role === 'admin') return true
        return { departments: { contains: user.department } }
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
      name: 'endTime',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          timeIntervals: 15,
        },
        description: 'Defaults to 1 hour after start time.',
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
}
