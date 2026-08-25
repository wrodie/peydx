import { flattenProgram } from 'signage-core'
import type { DeviceStatus } from './useDeviceStatus'

export function normalizeDevice(doc: any): DeviceStatus {
  const currentProgram = doc.currentProgram && typeof doc.currentProgram === 'object' ? doc.currentProgram : null
  return {
    id: doc.id,
    name: doc.name || '(unnamed)',
    deviceType: doc.deviceType || 'hardware',
    departments: doc.departments || [],
    status: doc.status || 'offline',
    lastHeartbeat: doc.lastHeartbeat || null,
    currentProgramId: doc.currentProgram
      ? typeof doc.currentProgram === 'object'
        ? doc.currentProgram.id
        : doc.currentProgram
      : null,
    currentProgram,
    currentSlideIndex: doc.currentSlideIndex ?? null,
    clientVersion: doc.clientVersion || null,
  }
}

export function applyStatusPatch(
  devices: DeviceStatus[],
  data: { id: number; status?: string; programId?: number; slideIndex?: number; clientVersion?: string },
): DeviceStatus[] {
  return devices.map((d) =>
    d.id === data.id
      ? {
          ...d,
          status: data.status ?? d.status,
          lastHeartbeat: data.status === 'online' ? new Date().toISOString() : d.lastHeartbeat,
          currentProgramId: data.programId ?? d.currentProgramId,
          currentSlideIndex: data.slideIndex ?? d.currentSlideIndex,
          clientVersion: data.clientVersion ?? d.clientVersion,
        }
      : d,
  )
}

export function applyStateChangePatch(
  devices: DeviceStatus[],
  data: { id: number; programId?: number; slideIndex?: number },
): DeviceStatus[] {
  return devices.map((d) =>
    d.id === data.id
      ? {
          ...d,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          currentProgramId: data.programId ?? d.currentProgramId,
          currentSlideIndex: data.slideIndex ?? d.currentSlideIndex ?? 0,
        }
      : d,
  )
}

export function slideCount(program: any): number {
  if (!program) return 0
  try {
    return flattenProgram(program).slides.length
  } catch {
    return 0
  }
}
