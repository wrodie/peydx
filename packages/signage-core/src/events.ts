// Client → Server events (from devices and admin UI)
export interface ClientToServerEvents {
  'device:heartbeat': (data: { programId: number | null; slideIndex: number }, callback?: (ack: { ok: boolean }) => void) => void
  'device:slideChange': (data: { slideIndex: number }) => void
  'device:stateChange': (data: { state: 'idle' | 'menu' | 'playing'; programId?: number; menuIndex?: number }) => void
  'remote:advance': (data: { id: number }) => void
  'remote:previous': (data: { id: number }) => void
  'remote:goto': (data: { id: number; slideIndex: number }) => void
  'remote:program': (data: { id: number; programId: number }) => void
  'remote:menu': (data: { id: number }) => void
  'remote:back': (data: { id: number }) => void
  'remote:select': (data: { id: number }) => void
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
  'device:status': (data: { id: number; slideIndex: number; programId: number | null; status: string }) => void
  'device:stateChange': (data: { id: number; state: 'idle' | 'menu' | 'playing'; programId?: number }) => void
}

// Inter-server events (for emitting from hooks)
export interface SocketEventData {
  'schedule:update': { targetDeviceIds: number[]; scheduleData: unknown }
  'program:update': { targetDeviceIds: number[]; program: unknown }
  'media:update': { targetDeviceIds: number[]; mediaId: number; url: string; sizes?: unknown }
  'device:status': { id: number; slideIndex: number; programId: number | null; status: string }
  'remote:menu': { targetDeviceIds: number[] }
  'remote:back': { targetDeviceIds: number[] }
  'remote:select': { targetDeviceIds: number[] }
}
