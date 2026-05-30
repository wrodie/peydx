interface ScheduleEntry {
  programId: number
  startTime: string
  endTime?: string
  program: {
    id: number
    title: string
    slides: any[]
  }
}

interface ResolvedSchedule {
  deviceId: string
  lastUpdated: string
  schedule: ScheduleEntry[]
}

export function resolveActiveProgram(scheduleData: ResolvedSchedule): ScheduleEntry['program'] | null {
  const now = new Date()
  const entries = scheduleData.schedule

  let activeEntry: ScheduleEntry | null = null
  for (const entry of entries) {
    const start = new Date(entry.startTime)
    if (start <= now) {
      const end = entry.endTime ? new Date(entry.endTime) : null
      if (!end || now < end) {
        if (!activeEntry || new Date(entry.startTime) > new Date(activeEntry.startTime)) {
          activeEntry = entry
        }
      }
    }
  }
  return activeEntry?.program ?? null
}

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
    deviceId: '',
    lastUpdated: new Date().toISOString(),
    schedule: (apiData.docs || []).map((entry: any) => ({
      programId: entry.program?.id,
      startTime: entry.startTime,
      endTime: entry.endTime,
      program: {
        id: entry.program?.id,
        title: entry.program?.title,
        slides: (entry.program?.slides || []).map(normalizeSlide),
      },
    })),
  }
}
