// Client → Server events (from devices and admin UI)
export interface ClientToServerEvents {
  'device:heartbeat': (data: { programId: number | null; slideIndex: number }, callback?: (ack: { ok: boolean }) => void) => void
  'device:slideChange': (data: { slideIndex: number }) => void
  'device:stateChange': (data: { state: 'idle' | 'menu' | 'playing'; programId?: number; menuIndex?: number }) => void
  'remote:advance': (data: { deviceId: string }) => void
  'remote:previous': (data: { deviceId: string }) => void
  'remote:goto': (data: { deviceId: string; slideIndex: number }) => void
  'remote:program': (data: { deviceId: string; programId: number }) => void
  'remote:menu': (data: { deviceId: string }) => void
  'remote:back': (data: { deviceId: string }) => void
  'remote:select': (data: { deviceId: string }) => void
}

// Server → Client events (to devices and admin UI)
export interface ServerToClientEvents {
  'schedule:update': (data: { scheduleData: unknown }) => void
  'program:update': (data: { program: unknown }) => void
  'media:update': (data: { mediaId: number; url: string; sizes?: unknown }) => void
  'remote:advance': () => void
  'remote:previous': () => void
  'remote:goto': (data: { slideIndex: number }) => void
  'remote:program': (data: { program: unknown; slideIndex: number }) => void
  'remote:menu': () => void
  'remote:back': () => void
  'remote:select': () => void
  'device:status': (data: { deviceId: string; slideIndex: number; programId: number | null; status: string }) => void
  'device:stateChange': (data: { deviceId: string; state: 'idle' | 'menu' | 'playing'; programId?: number }) => void
}

// Inter-server events (for emitting from hooks)
export interface SocketEventData {
  'schedule:update': { targetDeviceIds: number[]; scheduleData: unknown }
  'program:update': { targetDeviceIds: number[]; program: unknown }
  'media:update': { targetDeviceIds: number[]; mediaId: number; url: string; sizes?: unknown }
  'device:status': { deviceId: string; slideIndex: number; programId: number | null; status: string }
  'remote:menu': { targetDeviceIds: number[] }
  'remote:back': { targetDeviceIds: number[] }
  'remote:select': { targetDeviceIds: number[] }
}
