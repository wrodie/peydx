import type { ResolvedSchedule, Program } from './types'
import { normalizeSlide } from './normalizeSlide'

export interface NormalizeApiScheduleOptions {
  deviceId?: string | number | null
  defaultBackgroundUrl?: string | null
  deviceName?: string | null
  hideProgramList?: boolean
  resolveMediaUrl?: (url: string) => string
  timezone?: string | null
}

function mapProgram(entry: any, resolveUrl: (url: string) => string): Program {
  return {
    id: entry.program?.id || entry.id,
    title: entry.program?.title || entry.title,
    loop: entry.program?.loop ?? entry.loop,
    department:
      entry.folder?.department?.name ||
      entry.program?.folder?.department?.name ||
      null,
    slides: ((entry.program?.slides || entry.slides || []) as any[]).map((s) =>
      normalizeSlide(s, resolveUrl),
    ),
  }
}

export function normalizeApiSchedule(
  apiData: any,
  programsData?: any,
  options: NormalizeApiScheduleOptions = {},
): ResolvedSchedule {
  const { deviceId, defaultBackgroundUrl, deviceName, hideProgramList, resolveMediaUrl, timezone } = options
  const resolveUrl = resolveMediaUrl ?? ((url: string) => url)

  const scheduleDocs = apiData?.docs || []

  const programs = programsData?.docs || []
  const availability = []
  for (const program of programs) {
    if (!program.availableFrom) continue
    if (deviceId) {
      const deviceIds = (program.availableDevices || []).map((d: any) =>
        typeof d === 'object' ? d.id : d,
      )
      if (!deviceIds.includes(Number(deviceId))) continue
    }
    availability.push({
      programId: program.id,
      scheduleType: 'availability' as const,
      startDate: program.availableFrom,
      endDate: program.availableUntil || null,
      program: mapProgram({ ...program, program: undefined }, resolveUrl),
    })
  }

  return {
    lastUpdated: new Date().toISOString(),
    timezone: timezone || 'UTC',
    schedule: scheduleDocs.map((entry: any) => ({
      programId: entry.program?.id,
      scheduleType: 'autoplay' as const,
      startTime: entry.startTime,
      endTime: entry.endTime,
      daysOfWeek: entry.daysOfWeek || [],
      untilDate: entry.untilDate,
      program: mapProgram(entry, resolveUrl),
    })),
    availability,
    defaultBackground: defaultBackgroundUrl || null,
    deviceName: deviceName || null,
    hideProgramList: hideProgramList || false,
  }
}
