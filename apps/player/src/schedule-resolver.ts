import type { ScheduleEntry, ResolvedSchedule, Program } from 'signage-core'

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
  if (slide.blockType === 'youtubeBlock') {
    result.youtubeId = slide.youtubeId
  }

  return result
}

export function normalizeApiSchedule(apiData: any): ResolvedSchedule {
  return {
    lastUpdated: new Date().toISOString(),
    schedule: (apiData.docs || []).map((entry: any) => ({
      programId: entry.program?.id,
      scheduleType: entry.scheduleType || 'autoplay',
      startTime: entry.startTime,
      endTime: entry.endTime,
      program: {
        id: entry.program?.id,
        title: entry.program?.title,
        loop: entry.program?.loop,
        slides: (entry.program?.slides || []).map(normalizeSlide),
      },
    })),
  }
}

export interface ResolvedScheduleState {
  activeAutoPlay: ScheduleEntry | null
  availablePrograms: ScheduleEntry[]
}

function getTodayStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function resolveScheduleState(scheduleData: ResolvedSchedule): ResolvedScheduleState {
  const now = new Date()
  const today = getTodayStr()
  const schedule = scheduleData.schedule

  const todayAvailability = schedule.filter(
    (e) => e.scheduleType === 'availability' && e.startTime.startsWith(today),
  )

  let activeAutoPlay: ScheduleEntry | null = null
  for (const entry of schedule) {
    if (entry.scheduleType !== 'autoplay') continue
    const start = new Date(entry.startTime)
    const end = entry.endTime ? new Date(entry.endTime) : null
    if (start <= now && (!end || now < end)) {
      if (!activeAutoPlay || new Date(entry.startTime) > new Date(activeAutoPlay.startTime)) {
        activeAutoPlay = entry
      }
    }
  }

  return { activeAutoPlay, availablePrograms: todayAvailability }
}

export function resolveActiveProgram(scheduleData: ResolvedSchedule): Program | null {
  const { activeAutoPlay } = resolveScheduleState(scheduleData)
  return activeAutoPlay?.program ?? null
}
