export function timeOfDayMinutes(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export function dateOnly(iso: string): string {
  return new Date(iso).toISOString().split('T')[0]
}

export const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
