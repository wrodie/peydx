export type SchedulePriority = 'normal' | 'high' | 'override'

export const PRIORITY_COLORS: Record<SchedulePriority, string> = {
  normal: '#3b82f6',
  high: '#f59e0b',
  override: '#ef4444',
}

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export interface CalendarBlock {
  id: string
  deviceId: number
  dayIndex: number
  startMin: number
  endMin: number
  priority: SchedulePriority
  isRecurring: boolean
  scheduleId: number | string
  title: string
  deviceName: string
  oneOffDate?: string | null
}

export interface GroupedSchedule {
  blocks: CalendarBlock[]
  oneOffs: CalendarBlock[]
}

export function dayToColumn(day: string): number {
  const idx = DAY_ORDER.indexOf(String(day).toLowerCase())
  return idx < 0 ? 0 : idx
}

export function dayColumnLabel(dayIndex: number): string {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return labels[dayIndex] || ''
}

export function timeToMinutes(iso: string | null | undefined, tz: string): number | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value)
  return hour * 60 + minute
}

export function priorityColor(priority: string | null | undefined): string {
  return PRIORITY_COLORS[(priority as SchedulePriority) || 'normal'] || PRIORITY_COLORS.normal
}

export function positionFor(minutes: number, startHour: number): number {
  return minutes - startHour * 60
}

export function heightFor(startMin: number, endMin: number): number {
  return Math.max(endMin - startMin, 12)
}

export interface OverlapInput {
  id: string
  deviceId: number
  dayIndex: number
  priority: SchedulePriority
  startMin: number
  endMin: number
}

export function detectOverlaps(blocks: OverlapInput[]): Set<string> {
  const overlaps = new Set<string>()

  const buckets = new Map<string, OverlapInput[]>()
  for (const block of blocks) {
    const key = `${block.deviceId}|${block.dayIndex}|${block.priority}`
    const bucket = buckets.get(key) || []
    bucket.push(block)
    buckets.set(key, bucket)
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.startMin - b.startMin)
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        if (bucket[j].startMin < bucket[i].endMin) {
          overlaps.add(bucket[i].id)
          overlaps.add(bucket[j].id)
        }
      }
    }
  }

  return overlaps
}

export function dateStrInTz(value: Date | string, tz: string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC' }).format(d)
}

export function weekdayMonIndex(value: Date | string, tz: string): number {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return 0
  const w = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', weekday: 'short' })
    .format(d)
    .toLowerCase()
  const sunIndex = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(w)
  return (sunIndex - 1 + 7) % 7
}

export function buildBlocks(
  schedules: any[],
  selectedDeviceIds: Set<number> | null,
  tz: string,
  weekStartStr: string,
  weekEndStr: string,
): GroupedSchedule {
  const blocks: CalendarBlock[] = []
  const oneOffs: CalendarBlock[] = []

  for (const schedule of schedules) {
    if (!schedule?.id) continue
    const priority = (schedule.priority as SchedulePriority) || 'normal'
    const deviceRefs = Array.isArray(schedule.devices) ? schedule.devices : []
    const programTitle = schedule.program?.title
      ? schedule.program.title
      : schedule.program
        ? `Program ${schedule.program.id ?? schedule.program}`
        : 'Program'

    for (const deviceRef of deviceRefs) {
      const deviceId = typeof deviceRef === 'object' ? deviceRef.id : deviceRef
      const deviceName = typeof deviceRef === 'object' ? deviceRef.name : `Device ${deviceId}`
      if (selectedDeviceIds && !selectedDeviceIds.has(deviceId)) continue

      const startMin = timeToMinutes(schedule.startTime, tz)
      if (startMin == null) continue
      const endMinRaw = timeToMinutes(schedule.endTime, tz) ?? startMin + 60
      const endMin = endMinRaw > startMin ? endMinRaw : startMin + 60

      const daysOfWeek = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : []
      const isRecurring = daysOfWeek.length > 0

      if (isRecurring) {
        for (const day of daysOfWeek) {
          blocks.push({
            id: `sched-${schedule.id}-${deviceId}-${day}`,
            deviceId,
            dayIndex: dayToColumn(day),
            startMin,
            endMin,
            priority,
            isRecurring: true,
            scheduleId: schedule.id,
            title: programTitle,
            deviceName,
          })
        }
      } else {
        const dateStr = dateStrInTz(schedule.startTime, tz)
        const dayIndex = weekdayMonIndex(schedule.startTime, tz)
        const block: CalendarBlock = {
          id: `sched-${schedule.id}-${deviceId}-oneoff`,
          deviceId,
          dayIndex,
          startMin,
          endMin,
          priority,
          isRecurring: false,
          scheduleId: schedule.id,
          title: programTitle,
          deviceName,
          oneOffDate: dateStr,
        }
        if (dateStr && weekStartStr && weekEndStr && dateStr >= weekStartStr && dateStr <= weekEndStr) {
          blocks.push(block)
        } else {
          oneOffs.push(block)
        }
      }
    }
  }

  return { blocks, oneOffs }
}
