interface ScheduleEntry {
  programId: number
  startTime: string
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
      if (!activeEntry || new Date(entry.startTime) > new Date(activeEntry.startTime)) {
        activeEntry = entry
      }
    }
  }
  return activeEntry?.program ?? null
}
