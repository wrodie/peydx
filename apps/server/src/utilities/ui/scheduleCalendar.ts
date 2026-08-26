export type SchedulePriority = 'normal' | 'high' | 'override'

export const PRIORITY_COLORS: Record<SchedulePriority, string> = {
  normal: '#3b82f6',
  high: '#f59e0b',
  override: '#ef4444',
}

const DAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

export interface LaneInfo {
  lane: number
  laneCount: number
}

export function dayToColumn(day: string): number {
  const idx = DAY_ORDER.indexOf(String(day).toLowerCase())
  return idx < 0 ? 0 : idx
}

export function dayColumnLabel(dayIndex: number): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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

export function weekdaySunIndex(value: Date | string, tz: string): number {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return 0
  const w = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', weekday: 'short' })
    .format(d)
    .toLowerCase()
  return dayToColumn(w)
}

export function toTzDate(value: Date | string): Date {
  if (value instanceof Date) return value
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export function weekRangeAround(value: Date | string, tz: string): { start: string; end: string } {
  const d = toTzDate(value)
  const dow = weekdaySunIndex(d, tz)
  const sunday = new Date(d)
  sunday.setDate(sunday.getDate() - dow)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  return { start: dateStrInTz(sunday, tz), end: dateStrInTz(saturday, tz) }
}

export function addDays(dateStr: string, days: number, tz: string): string {
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  d.setDate(d.getDate() + days)
  return dateStrInTz(d, tz)
}

export function formatWeekLabel(start: string, end: string): string {
  const [sy, sm, sd] = String(start).slice(0, 10).split('-').map(Number)
  const [ey, em, ed] = String(end).slice(0, 10).split('-').map(Number)
  if (!sy || !ey || !sm || !em) return ''
  const sameYear = sy === ey
  const sPart = `${MONTH_LABELS[sm - 1]} ${sd}`
  const yearPart = sameYear ? '' : `, ${sy}`
  return `${sPart}${yearPart} – ${MONTH_LABELS[em - 1]} ${ed}, ${ey}`
}

export function formatTimeHHMM(minutes: number): string {
  const m = Math.round(minutes)
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function weekDates(weekStart: string, tz: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i, tz))
}

export function formatDayHeader(dateStr: string, tz: string, locale: string): string {
  const raw = String(dateStr).slice(0, 10)
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return ''
  try {
    return new Intl.DateTimeFormat(locale || 'en', {
      timeZone: tz || 'UTC',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(y, m - 1, d, 12))
  } catch {
    return raw
  }
}

export function computeLanes(
  blocks: { id: string; deviceId: number; dayIndex: number; startMin: number; endMin: number }[],
): Map<string, LaneInfo> {
  const result = new Map<string, LaneInfo>()
  const groups = new Map<string, typeof blocks>()

  for (const block of blocks) {
    const key = `${block.deviceId}|${block.dayIndex}`
    const bucket = groups.get(key) || []
    bucket.push(block)
    groups.set(key, bucket)
  }

  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
    const laneEnds: number[] = []
    const laneOf = new Map<string, number>()

    for (const block of bucket) {
      let lane = laneEnds.findIndex((end) => end <= block.startMin)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(block.endMin)
      } else {
        laneEnds[lane] = Math.max(laneEnds[lane], block.endMin)
      }
      laneOf.set(block.id, lane)
    }

    const laneCount = laneEnds.length
    for (const block of bucket) {
      result.set(block.id, { lane: laneOf.get(block.id) ?? 0, laneCount })
    }
  }

  return result
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
        const dayIndex = weekdaySunIndex(schedule.startTime, tz)
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