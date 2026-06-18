import { describe, it, expect } from 'vitest'
import { timeOfDayMinutes, dateOnly, DAY_NAMES } from '../../../collections/schedule-utils'

describe('timeOfDayMinutes', () => {
  it('returns 0 for midnight UTC', () => {
    expect(timeOfDayMinutes('2024-01-01T00:00:00Z')).toBe(0)
  })

  it('returns correct minutes for 09:00 UTC', () => {
    expect(timeOfDayMinutes('2024-01-01T09:00:00Z')).toBe(540)
  })

  it('returns correct minutes for 23:59 UTC', () => {
    expect(timeOfDayMinutes('2024-01-01T23:59:00Z')).toBe(1439)
  })

  it('handles non-UTC times', () => {
    const iso = new Date('2024-01-01T12:30:00+05:00').toISOString()
    const result = timeOfDayMinutes(iso)
    expect(typeof result).toBe('number')
  })
})

describe('dateOnly', () => {
  it('extracts YYYY-MM-DD from ISO string', () => {
    expect(dateOnly('2024-01-15T10:30:00Z')).toBe('2024-01-15')
  })

  it('handles different dates', () => {
    expect(dateOnly('2024-12-31T23:59:59Z')).toBe('2024-12-31')
  })

  it('handles non-UTC times', () => {
    const iso = new Date('2024-06-15T23:00:00Z').toISOString()
    expect(dateOnly(iso)).toBe('2024-06-15')
  })
})

describe('dateRangesOverlap', () => {
  it('returns true for overlapping ranges', () => {
    expect(dateRangesOverlap(
      '2024-01-01T00:00:00Z', '2024-01-10T00:00:00Z',
      '2024-01-05T00:00:00Z', '2024-01-15T00:00:00Z'
    )).toBe(true)
  })

  it('returns false for disjoint ranges (A ends before B starts)', () => {
    expect(dateRangesOverlap(
      '2024-01-01T00:00:00Z', '2024-01-05T00:00:00Z',
      '2024-01-10T00:00:00Z', '2024-01-15T00:00:00Z'
    )).toBe(false)
  })

  it('returns false for disjoint ranges (B ends before A starts)', () => {
    expect(dateRangesOverlap(
      '2024-01-10T00:00:00Z', '2024-01-15T00:00:00Z',
      '2024-01-01T00:00:00Z', '2024-01-05T00:00:00Z'
    )).toBe(false)
  })

  it('handles null untilDate as unbounded end (Infinity)', () => {
    expect(dateRangesOverlap(
      '2024-01-05T00:00:00Z', null,
      '2024-01-01T00:00:00Z', '2024-01-10T00:00:00Z'
    )).toBe(true)
  })

  it('both null start and until dates always overlap', () => {
    expect(dateRangesOverlap(null, null, null, null)).toBe(true)
  })

  it('adjacent boundaries touch (start of B equals end of A)', () => {
    expect(dateRangesOverlap(
      '2024-01-01T00:00:00Z', '2024-01-05T00:00:00Z',
      '2024-01-05T00:00:00Z', '2024-01-10T00:00:00Z'
    )).toBe(true)
  })
})

describe('DAY_NAMES', () => {
  it('contains all 7 days starting with Sunday', () => {
    expect(DAY_NAMES).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
  })
})
