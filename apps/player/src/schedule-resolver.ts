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

export function resolveScheduleState(scheduleData: ResolvedSchedule): ResolvedScheduleState {
  const now = new Date()
  const schedule = scheduleData.schedule

  const availablePrograms = schedule.filter((e) => {
    if (e.scheduleType !== 'availability') return false
    if (!e.startTime) return false
    const start = new Date(e.startTime)
    const end = e.endTime ? new Date(e.endTime) : null
    if (start > now) return false
    // 24-hour grace period past end time
    if (end && now > new Date(end.getTime() + 24 * 60 * 60 * 1000)) return false
    return true
  })

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

  return { activeAutoPlay, availablePrograms }
}

export function resolveActiveProgram(scheduleData: ResolvedSchedule): Program | null {
  const { activeAutoPlay } = resolveScheduleState(scheduleData)
  return activeAutoPlay?.program ?? null
}
