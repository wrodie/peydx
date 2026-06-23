export const deviceStateStore = new Map<number, {
  state: string
  programId: number | null
  slideIndex: number
  paused?: boolean
  clientVersion?: string
}>()

export function getDeviceState(id: number) {
  return deviceStateStore.get(id) ?? null
}

export function getAllDeviceStates() {
  return Array.from(deviceStateStore.entries()).map(([id, state]) => ({ id, ...state }))
}
