import type { CollectionConfig } from 'payload'
import { getIO } from '../websocket/io'

const ONE_HOUR = 60 * 60 * 1000

export const Schedule: CollectionConfig = {
  slug: 'schedule',
  admin: {
    useAsTitle: 'program',
    defaultColumns: ['program', 'devices', 'startTime', 'endTime'],
  },
  timestamps: true,
  access: {
    read: async ({ req: { user: u, query, payload } }) => {
      const user = u as any
      if (!user) {
        if ((query as any)?.token && (query as any)?.where?.devices?.contains) {
          try {
            const device = await payload.findByID({
              collection: 'devices',
              id: parseInt((query as any).where.devices.contains as string, 10),
              depth: 0,
            })
            if (device?.browserToken === (query as any).token && device?.deviceType === 'browser') {
              return { devices: { contains: (query as any).where.devices.contains } } as any
            }
          } catch { return false }
        }
        return false
      }
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
      return true
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
          // Infer department from the selected program's folder department
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

        const scheduleType = data.scheduleType || 'autoplay'

        if (scheduleType === 'availability') {
          if (data.startTime) {
            const d = new Date(data.startTime)
            data.startTime = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString()
          }
          return data
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
                { scheduleType: { equals: 'autoplay' } },
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
    afterChange: [
      async ({ doc, req }) => {
        const io = getIO()
        if (!io) return

        const deviceIds: number[] = Array.isArray(doc.devices)
          ? doc.devices.map((d: any) => typeof d === 'object' ? d.id : d)
          : []

        if (deviceIds.length === 0) return

        // Build a schedule payload for each affected device
        for (const deviceId of deviceIds) {
          const scheduleForDevice = await req.payload.find({
            collection: 'schedule',
            depth: 2,
            where: {
              and: [
                { devices: { contains: deviceId } },
                { 'program.status': { equals: 'approved' } },
              ],
            },
            sort: 'startTime',
          })

          io.to(`device:${deviceId}`).emit('schedule:update', { scheduleData: scheduleForDevice })
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const io = getIO()
        if (!io) return

        const deviceIds: number[] = Array.isArray(doc.devices)
          ? doc.devices.map((d: any) => typeof d === 'object' ? d.id : d)
          : []

        for (const deviceId of deviceIds) {
          const scheduleForDevice = await req.payload.find({
            collection: 'schedule',
            depth: 2,
            where: {
              and: [
                { devices: { contains: deviceId } },
                { 'program.status': { equals: 'approved' } },
              ],
            },
            sort: 'startTime',
          })

          io.to(`device:${deviceId}`).emit('schedule:update', { scheduleData: scheduleForDevice })
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
      name: 'scheduleType',
      type: 'select',
      required: true,
      defaultValue: 'autoplay',
      options: [
        { label: 'Auto-Play', value: 'autoplay' },
        { label: 'Availability', value: 'availability' },
      ],
      admin: {
        description: 'Auto-Play starts automatically at the scheduled time. Availability makes the program selectable on the device for that date.',
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
        description: 'For Auto-Play, select date and time. For Availability, select the date (time is ignored — sets to midnight UTC).',
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
        description: 'Defaults to 1 hour after start time. Required for Auto-Play, optional for Availability.',
        condition: ({ siblingData }: { siblingData?: { scheduleType?: string } }) =>
          siblingData?.scheduleType !== 'availability',
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
