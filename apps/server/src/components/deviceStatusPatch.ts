export function buildDeviceStatusPatch(data: { status: string }): { lastHeartbeat?: string } {
  if (data.status === 'online') {
    return { lastHeartbeat: new Date().toISOString() }
  }
  return {}
}
