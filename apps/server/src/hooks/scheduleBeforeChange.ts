import type { CollectionBeforeChangeHook } from 'payload'
import { timeOfDayMinutes, dateOnly, DAY_NAMES } from '../collections/schedule-utils'

const ONE_HOUR = 60 * 60 * 1000

export const scheduleBeforeChange: CollectionBeforeChangeHook = async ({ data, req, originalDoc, operation }) => {
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

      const untilA = data.untilDate || null
      const untilB = entry.untilDate || null

      if (isOneOff || entryIsOneOff) {
        if (isOneOff) {
          const dateA = dateOnly(data.startTime)
          const dateATs = new Date(dateA).getTime()
          if (untilB && dateATs > new Date(untilB).getTime()) continue
          if (!entryIsOneOff) {
            const dayName = DAY_NAMES[new Date(dateA).getUTCDay()]
            if (!entryDaysOfWeek.includes(dayName)) continue
          }
        }
        if (entryIsOneOff) {
          const dateB = dateOnly(entry.startTime)
          const dateBTs = new Date(dateB).getTime()
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
}
