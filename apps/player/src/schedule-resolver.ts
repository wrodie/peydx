import type { ScheduleEntry, AvailabilityEntry, ResolvedSchedule, Program } from 'signage-core'

function normalizeSlide(slide: any): any {
  const result: any = {
    blockType: slide.blockType,
    advanceMode: slide.advanceMode,
    duration: slide.duration,
    transition: slide.transition,
    id: slide.id,
  }

  if (slide.blockType === 'imageBlock' && slide.image) {
    result.image = {
      id: slide.image.id,
      url: slide.image.sizes?.fullHD?.url || slide.image.url,
      alt: slide.image.alt,
    }
  }
  if (slide.blockType === 'videoBlock' && slide.video) {
    result.video = {
      id: slide.video.id,
      url: slide.video.url,
      alt: slide.video.alt,
    }
  }
  if (slide.blockType === 'audioBlock' && slide.audio) {
    result.audio = {
      id: slide.audio.id,
      url: slide.audio.url,
      alt: slide.audio.alt,
    }
  }
  if (slide.blockType === 'youtubeBlock') {
    result.youtubeId = slide.youtubeId
  }

  return result
}

function mapProgram(entry: any): Program {
  return {
    id: entry.program?.id || entry.id,
    title: entry.program?.title || entry.title,
    loop: entry.program?.loop ?? entry.loop,
    department: entry.folder?.department?.name || entry.program?.folder?.department?.name || null,
    slides: ((entry.program?.slides || entry.slides || [])).map(normalizeSlide),
  }
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function extractAvailabilityFromPrograms(
  programsData: any,
  deviceId?: string | number | null,
): AvailabilityEntry[] {
  const programs = programsData?.docs || []
  const result: AvailabilityEntry[] = []

  for (const program of programs) {
    if (!program.availableFrom) continue

    if (deviceId) {
      const deviceIds: number[] = (program.availableDevices || []).map((d: any) =>
        typeof d === 'object' ? d.id : d
      )
      if (!deviceIds.includes(Number(deviceId))) continue
    }

    result.push({
      programId: program.id,
      scheduleType: 'availability',
      startDate: program.availableFrom,
      endDate: program.availableUntil || null,
      program: mapProgram({ ...program, program: undefined }),
    })
  }

  return result
}

export function normalizeApiSchedule(
  apiData: any,
  programsData?: any,
  deviceName?: string | null,
  deviceId?: string | number | null,
): ResolvedSchedule {
  const scheduleDocs = apiData?.docs || []

  return {
    lastUpdated: new Date().toISOString(),
    schedule: scheduleDocs
      .filter((entry: any) => entry.program?.status === 'approved')
      .map((entry: any) => ({
        programId: entry.program?.id,
        scheduleType: 'autoplay' as const,
        startTime: entry.startTime,
        endTime: entry.endTime,
        daysOfWeek: entry.daysOfWeek || [],
        startDate: entry.startDate,
        untilDate: entry.untilDate,
        program: mapProgram(entry),
      })),
    availability: extractAvailabilityFromPrograms(programsData, deviceId),
    deviceName: deviceName || null,
  }
}

export interface ResolvedScheduleState {
  activeAutoPlay: ScheduleEntry | null
  availablePrograms: AvailabilityEntry[]
}

function stripTime(iso: string): string {
  return new Date(iso).toISOString().split('T')[0]
}

function timeOfDayMinutes(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export function resolveScheduleState(scheduleData: ResolvedSchedule): ResolvedScheduleState {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const todayDayName = DAY_NAMES[now.getUTCDay()]

  const availablePrograms = scheduleData.availability.filter((e) => {
    if (!e.startDate) return false
    const start = new Date(e.startDate)
    const end = e.endDate ? new Date(e.endDate) : null
    const todayDate = new Date(today)
    if (start > todayDate) return false
    if (end) {
      const endPlusGrace = new Date(end.getTime() + 24 * 60 * 60 * 1000)
      if (now > endPlusGrace) return false
    }
    return true
  })

  let activeAutoPlay: ScheduleEntry | null = null
  for (const entry of scheduleData.schedule) {
    if (!entry.startTime) continue

    const daysOfWeek: string[] = entry.daysOfWeek || []
    const isRecurring = daysOfWeek.length > 0

    if (isRecurring) {
      if (!daysOfWeek.includes(todayDayName)) continue
    } else {
      if (stripTime(entry.startTime) !== today) continue
    }

    if (entry.startDate && new Date(entry.startDate).toISOString().split('T')[0] > today) continue
    if (entry.untilDate && new Date(entry.untilDate).toISOString().split('T')[0] < today) continue

    const startMin = timeOfDayMinutes(entry.startTime)
    const endMin = entry.endTime ? timeOfDayMinutes(entry.endTime) : startMin + 60
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()

    if (nowMin < startMin || nowMin >= endMin) continue

    if (!activeAutoPlay || new Date(entry.startTime) > new Date(activeAutoPlay.startTime)) {
      activeAutoPlay = entry
    }
  }

  return { activeAutoPlay, availablePrograms }
}

export function resolveActiveProgram(scheduleData: ResolvedSchedule): Program | null {
  const { activeAutoPlay } = resolveScheduleState(scheduleData)
  return activeAutoPlay?.program ?? null
}
