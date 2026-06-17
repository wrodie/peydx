import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveScheduleState } from '../PlayerController'
import type { ScheduleEntry, AvailabilityEntry } from '../types'

function makeScheduleEntry(overrides: any = {}): ScheduleEntry {
  return {
    programId: 1,
    scheduleType: 'autoplay',
    startTime: '2025-06-16T09:30:00.000Z',
    endTime: '2025-06-16T11:00:00.000Z',
    daysOfWeek: [],
    startDate: null,
    untilDate: null,
    program: { id: 1, title: 'Test Program', slides: [] },
    ...overrides,
  }
}

function makeAvailability(overrides: any = {}): AvailabilityEntry {
  return {
    programId: 10,
    scheduleType: 'availability',
    startDate: '2025-01-01',
    endDate: null,
    program: { id: 10, title: 'Available Program', slides: [] },
    ...overrides,
  }
}

describe('resolveScheduleState', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns active schedule when time is within window', () => {
    const now = new Date('2025-06-16T10:00:00Z')
    vi.setSystemTime(now)

    const scheduleEntries = [makeScheduleEntry()]
    const result = resolveScheduleState(scheduleEntries, [])
    expect(result.activeAutoPlay).toBeTruthy()
    expect(result.activeAutoPlay!.programId).toBe(1)
  })

  it('returns no active schedule when outside time window', () => {
    const now = new Date('2025-06-16T12:00:00Z')
    vi.setSystemTime(now)

    const scheduleEntries = [makeScheduleEntry()]
    const result = resolveScheduleState(scheduleEntries, [])
    expect(result.activeAutoPlay).toBeNull()
  })

  it('returns no active schedule when wrong day of week', () => {
    const now = new Date('2025-06-17T10:00:00Z')
    vi.setSystemTime(now)

    const scheduleEntries = [makeScheduleEntry({
      daysOfWeek: ['mon'],
      startTime: '2025-06-16T09:00:00.000Z',
    })]
    const result = resolveScheduleState(scheduleEntries, [])
    expect(result.activeAutoPlay).toBeNull()
  })

  it('picks active schedule with latest startTime when multiple match', () => {
    const now = new Date('2025-06-16T10:00:00Z')
    vi.setSystemTime(now)

    const scheduleEntries = [
      makeScheduleEntry({ programId: 1, startTime: '2025-06-16T09:00:00.000Z', endTime: '2025-06-16T11:00:00.000Z' }),
      makeScheduleEntry({ programId: 2, startTime: '2025-06-16T09:30:00.000Z', endTime: '2025-06-16T11:00:00.000Z' }),
    ]
    const result = resolveScheduleState(scheduleEntries, [])
    expect(result.activeAutoPlay!.programId).toBe(2)
  })

  it('filters availability by date range', () => {
    const now = new Date('2025-06-16T10:00:00Z')
    vi.setSystemTime(now)

    const availability = [makeAvailability({ startDate: '2025-07-01' })]
    const result = resolveScheduleState([], availability)
    expect(result.availablePrograms).toHaveLength(0)
  })

  it('includes availability within date range', () => {
    const now = new Date('2025-06-16T10:00:00Z')
    vi.setSystemTime(now)

    const availability = [makeAvailability()]
    const result = resolveScheduleState([], availability)
    expect(result.availablePrograms).toHaveLength(1)
  })

  it('excludes availability past endDate with 24h grace', () => {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const pastDate = twoDaysAgo.toISOString().split('T')[0]

    const now = new Date(pastDate + 'T00:00:00Z')
    now.setDate(now.getDate() + 3)
    vi.setSystemTime(now)

    const availability = [makeAvailability({ endDate: pastDate })]
    const result = resolveScheduleState([], availability)
    expect(result.availablePrograms).toHaveLength(0)
  })

  it('returns empty state with no entries', () => {
    const result = resolveScheduleState([], [])
    expect(result.activeAutoPlay).toBeNull()
    expect(result.availablePrograms).toEqual([])
  })
})
