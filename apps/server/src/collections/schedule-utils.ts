export function timeOfDayMinutes(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export function dateOnly(iso: string): string {
  return new Date(iso).toISOString().split('T')[0]
}

export function dateRangesOverlap(
  sdA: string | null,
  untilA: string | null,
  sdB: string | null,
  untilB: string | null
): boolean {
  const sa = sdA ? new Date(sdA).getTime() : 0
  const sb = sdB ? new Date(sdB).getTime() : 0
  const ea = untilA ? new Date(untilA).getTime() : Infinity
  const eb = untilB ? new Date(untilB).getTime() : Infinity
  return sa <= eb && sb <= ea
}

export const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
