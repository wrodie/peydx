import { describe, it, expect, vi, beforeEach } from 'vitest'

const { filterActiveSchedule, filterAvailability } = require('../../../sync/schedule-filter.js')

function makeScheduleItem(overrides: any = {}) {
  return {
    id: 1,
    program: { id: 1, title: 'Test Program' },
    startTime: '2025-06-16T09:00:00.000Z',
    endTime: '2025-06-16T10:00:00.000Z',
    daysOfWeek: ['mon'],
    untilDate: null,
    devices: [1],
    ...overrides,
  }
}

function makeProgram(overrides: any = {}) {
  return {
    id: 5,
    title: 'On Demand',
    availableFrom: '2025-06-01T00:00:00.000Z',
    availableUntil: null,
    availableDevices: [1],
    slides: [],
    ...overrides,
  }
}

describe('filterActiveSchedule', () => {
  const timeZone = 'America/Chicago'
  const now = new Date('2025-06-16T14:00:00Z')
  const todayStr = '2025-06-16'
  const dayName = 'mon'

  it('recurring schedule matching current day of week is included', () => {
    const items = [makeScheduleItem({ daysOfWeek: ['mon'] })]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(1)
  })

  it('recurring schedule not matching day of week is excluded', () => {
    const items = [makeScheduleItem({ daysOfWeek: ['tue'] })]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(0)
  })

  it('one-off schedule matching exact date is included', () => {
    const items = [makeScheduleItem({
      daysOfWeek: [],
      startTime: '2025-06-16T09:00:00.000Z',
    })]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(1)
  })

  it('one-off schedule not matching date is excluded', () => {
    const items = [makeScheduleItem({
      daysOfWeek: [],
      startTime: '2025-06-15T09:00:00.000Z',
    })]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(0)
  })

  it('untilDate passed is excluded', () => {
    const items = [makeScheduleItem({ untilDate: '2025-06-01' })]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(0)
  })

  it('untilDate in future is included', () => {
    const items = [makeScheduleItem({ untilDate: '2025-12-31' })]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(1)
  })

  it('schedule starting far in future is excluded (past the current window)', () => {
    const items = [makeScheduleItem({
      startTime: '2025-06-28T09:00:00.000Z',
    })]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(0)
  })

  it('schedule ended more than 6 hours ago is excluded', () => {
    const items = [makeScheduleItem({
      startTime: '2025-06-16T00:00:00.000Z',
      endTime: '2025-06-16T01:00:00.000Z',
    })]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(0)
  })

  it('schedule ended within grace window is included', () => {
    const recent = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const startTime = new Date(recent.getTime() - 60 * 60 * 1000).toISOString()
    const endTime = recent.toISOString()
    const items = [makeScheduleItem({
      startTime,
      endTime,
      daysOfWeek: [],
    })]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(1)
  })

  it('empty item list returns empty array', () => {
    const result = filterActiveSchedule([], timeZone, todayStr, dayName, now)
    expect(result).toEqual([])
  })

  it('item without startTime is excluded', () => {
    const items = [{ id: 1 }]
    const result = filterActiveSchedule(items, timeZone, todayStr, dayName, now)
    expect(result).toHaveLength(0)
  })
})

describe('filterAvailability', () => {
  const timeZone = 'America/Chicago'
  const todayStr = '2025-06-16'

  it('program with matching availableDevices and date range is included', () => {
    const programs = [makeProgram()]
    const result = filterAvailability(programs, 1, timeZone, todayStr)
    expect(result).toHaveLength(1)
    expect(result[0].program.id).toBe(5)
    expect(result[0].startDate).toBe('2025-06-01T00:00:00.000Z')
  })

  it('program without availableFrom is excluded', () => {
    const programs = [makeProgram({ availableFrom: null })]
    const result = filterAvailability(programs, 1, timeZone, todayStr)
    expect(result).toHaveLength(0)
  })

  it('program not available on this device is excluded', () => {
    const programs = [makeProgram({ availableDevices: [2, 3] })]
    const result = filterAvailability(programs, 1, timeZone, todayStr)
    expect(result).toHaveLength(0)
  })

  it('program with availableFrom in future is excluded', () => {
    const programs = [makeProgram({ availableFrom: '2025-07-01T00:00:00.000Z' })]
    const result = filterAvailability(programs, 1, timeZone, todayStr)
    expect(result).toHaveLength(0)
  })

  it('program with availableUntil in past is excluded', () => {
    const programs = [makeProgram({ availableUntil: '2025-01-01T00:00:00.000Z' })]
    const result = filterAvailability(programs, 1, timeZone, todayStr)
    expect(result).toHaveLength(0)
  })

  it('handles device IDs as objects', () => {
    const programs = [makeProgram({ availableDevices: [{ id: 1 }, { id: 2 }] })]
    const result = filterAvailability(programs, 1, timeZone, todayStr)
    expect(result).toHaveLength(1)
  })

  it('empty programs list returns empty array', () => {
    const result = filterAvailability([], 1, timeZone, todayStr)
    expect(result).toEqual([])
  })
})
