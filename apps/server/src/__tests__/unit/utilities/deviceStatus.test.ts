import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeStatus, STATUS_COLORS, STATUS_LABELS } from '../../../utilities/ui/deviceStatus'

describe('computeStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns offline for missing heartbeat', () => {
    expect(computeStatus(null)).toBe('offline')
    expect(computeStatus(undefined)).toBe('offline')
  })

  it('returns online for heartbeats within 3 minutes', () => {
    expect(computeStatus(new Date('2024-01-01T11:59:00.000Z').toISOString())).toBe('online')
  })

  it('returns stale for heartbeats between 3 and 10 minutes', () => {
    expect(computeStatus(new Date('2024-01-01T11:55:00.000Z').toISOString())).toBe('stale')
  })

  it('returns offline for heartbeats older than 10 minutes', () => {
    expect(computeStatus(new Date('2024-01-01T11:00:00.000Z').toISOString())).toBe('offline')
  })
})

describe('STATUS_COLORS / STATUS_LABELS', () => {
  it('uses the canonical status colors', () => {
    expect(STATUS_COLORS).toEqual({
      online: '#22c55e',
      stale: '#f59e0b',
      offline: '#6b7280',
    })
  })

  it('maps labels for all statuses', () => {
    expect(STATUS_LABELS).toEqual({
      online: 'Online',
      stale: 'Stale',
      offline: 'Offline',
    })
  })
})
