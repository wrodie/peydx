export type DeviceStatus = 'online' | 'stale' | 'offline'

export const STATUS_COLORS: Record<DeviceStatus, string> = {
  online: '#22c55e',
  stale: '#f59e0b',
  offline: '#6b7280',
}

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  online: 'Online',
  stale: 'Stale',
  offline: 'Offline',
}

export function computeStatus(lastHeartbeat: string | null | undefined): DeviceStatus {
  if (!lastHeartbeat) return 'offline'
  const diff = Date.now() - new Date(lastHeartbeat).getTime()
  if (diff < 3 * 60 * 1000) return 'online'
  if (diff < 10 * 60 * 1000) return 'stale'
  return 'offline'
}
