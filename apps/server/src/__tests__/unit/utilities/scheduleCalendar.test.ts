import { describe, it, expect } from 'vitest'
import {
  dayToColumn,
  dayColumnLabel,
  timeToMinutes,
  priorityColor,
  positionFor,
  heightFor,
  detectOverlaps,
  buildBlocks,
  weekdaySunIndex,
  computeLanes,
  weekRangeAround,
  addDays,
  formatWeekLabel,
  formatTimeHHMM,
  weekDates,
  formatDayHeader,
  PRIORITY_COLORS,
} from '../../../utilities/ui/scheduleCalendar'

describe('dayToColumn / dayColumnLabel', () => {
  it('maps days to Sun-first column indexes', () => {
    expect(dayToColumn('sun')).toBe(0)
    expect(dayToColumn('mon')).toBe(1)
    expect(dayToColumn('wed')).toBe(3)
    expect(dayToColumn('sat')).toBe(6)
    expect(dayToColumn('invalid')).toBe(0)
  })

  it('labels columns', () => {
    expect(dayColumnLabel(0)).toBe('Sun')
    expect(dayColumnLabel(1)).toBe('Mon')
    expect(dayColumnLabel(6)).toBe('Sat')
  })
})

describe('timeToMinutes', () => {
  it('converts ISO time-of-day to minutes in the given timezone', () => {
    expect(timeToMinutes('2024-01-01T06:00:00.000Z', 'UTC')).toBe(360)
    expect(timeToMinutes('2024-01-01T22:30:00.000Z', 'UTC')).toBe(1350)
  })

  it('returns null for missing or invalid input', () => {
    expect(timeToMinutes(null, 'UTC')).toBeNull()
    expect(timeToMinutes(undefined, 'UTC')).toBeNull()
    expect(timeToMinutes('not-a-date', 'UTC')).toBeNull()
  })
})

describe('priorityColor', () => {
  it('returns canonical priority colors', () => {
    expect(priorityColor('normal')).toBe(PRIORITY_COLORS.normal)
    expect(priorityColor('high')).toBe(PRIORITY_COLORS.high)
    expect(priorityColor('override')).toBe(PRIORITY_COLORS.override)
    expect(priorityColor(undefined)).toBe(PRIORITY_COLORS.normal)
  })
})

describe('positionFor / heightFor', () => {
  it('positions blocks relative to the range start hour', () => {
    expect(positionFor(360, 6)).toBe(0)
    expect(positionFor(420, 6)).toBe(60)
    expect(heightFor(360, 420)).toBe(60)
    expect(heightFor(360, 360)).toBe(12)
  })
})

describe('detectOverlaps', () => {
  it('detects overlapping blocks of the same priority on the same device+day', () => {
    const overlaps = detectOverlaps([
      { id: 'a', deviceId: 1, dayIndex: 0, priority: 'normal', startMin: 360, endMin: 480 },
      { id: 'b', deviceId: 1, dayIndex: 0, priority: 'normal', startMin: 420, endMin: 540 },
      { id: 'c', deviceId: 1, dayIndex: 0, priority: 'normal', startMin: 600, endMin: 660 },
    ])
    expect(overlaps.has('a')).toBe(true)
    expect(overlaps.has('b')).toBe(true)
    expect(overlaps.has('c')).toBe(false)
  })

  it('does not flag different priorities as overlapping', () => {
    const overlaps = detectOverlaps([
      { id: 'a', deviceId: 1, dayIndex: 0, priority: 'normal', startMin: 360, endMin: 480 },
      { id: 'b', deviceId: 1, dayIndex: 0, priority: 'override', startMin: 420, endMin: 540 },
    ])
    expect(overlaps.size).toBe(0)
  })

  it('does not flag different devices as overlapping', () => {
    const overlaps = detectOverlaps([
      { id: 'a', deviceId: 1, dayIndex: 0, priority: 'normal', startMin: 360, endMin: 480 },
      { id: 'b', deviceId: 2, dayIndex: 0, priority: 'normal', startMin: 420, endMin: 540 },
    ])
    expect(overlaps.size).toBe(0)
  })
})

describe('buildBlocks', () => {
  const baseSchedule = {
    id: 1,
    priority: 'normal',
    program: { id: 10, title: 'Worship' },
    devices: [{ id: 1, name: 'Foyer' }],
    startTime: '2024-01-01T09:00:00.000Z',
    endTime: '2024-01-01T10:00:00.000Z',
  }

  it('groups recurring schedules onto their day-of-week columns', () => {
    const { blocks, oneOffs } = buildBlocks(
      [{ ...baseSchedule, daysOfWeek: ['mon', 'wed'] }],
      null,
      'UTC',
      '2024-01-01',
      '2024-01-07',
    )
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.dayIndex).sort()).toEqual([1, 3])
    expect(blocks.every((b) => b.isRecurring)).toBe(true)
    expect(oneOffs).toHaveLength(0)
  })

  it('keeps one-off schedules in the current week on the grid', () => {
    const { blocks, oneOffs } = buildBlocks(
      [{ ...baseSchedule, daysOfWeek: [] }],
      null,
      'UTC',
      '2024-01-01',
      '2024-01-07',
    )
    expect(blocks).toHaveLength(1)
    expect(blocks[0].isRecurring).toBe(false)
    expect(oneOffs).toHaveLength(0)
  })

  it('moves one-off schedules outside the week to oneOffs', () => {
    const { blocks, oneOffs } = buildBlocks(
      [{ ...baseSchedule, daysOfWeek: [], startTime: '2024-02-01T09:00:00.000Z' }],
      null,
      'UTC',
      '2024-01-01',
      '2024-01-07',
    )
    expect(blocks).toHaveLength(0)
    expect(oneOffs).toHaveLength(1)
  })

  it('filters blocks to the selected devices', () => {
    const schedules = [
      { ...baseSchedule, id: 1, devices: [{ id: 1, name: 'Foyer' }], daysOfWeek: ['mon'] },
      { ...baseSchedule, id: 2, devices: [{ id: 2, name: 'Lobby' }], daysOfWeek: ['mon'] },
    ]
    const { blocks } = buildBlocks(schedules, new Set([1]), 'UTC', '2024-01-01', '2024-01-07')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].deviceId).toBe(1)
  })
})

describe('weekdaySunIndex', () => {
  it('maps dates to Sun-first weekday indexes', () => {
    // 2024-01-01 was a Monday
    expect(weekdaySunIndex('2024-01-01T12:00:00.000Z', 'UTC')).toBe(1)
    // 2024-01-07 was a Sunday
    expect(weekdaySunIndex('2024-01-07T12:00:00.000Z', 'UTC')).toBe(0)
    // 2024-01-06 was a Saturday
    expect(weekdaySunIndex('2024-01-06T12:00:00.000Z', 'UTC')).toBe(6)
  })
})

describe('computeLanes', () => {
  it('gives different lanes to overlapping blocks of different priorities', () => {
    const lanes = computeLanes([
      { id: 'a', deviceId: 1, dayIndex: 0, startMin: 360, endMin: 480 },
      { id: 'b', deviceId: 1, dayIndex: 0, startMin: 420, endMin: 540 },
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, laneCount: 2 })
    expect(lanes.get('b')).toEqual({ lane: 1, laneCount: 2 })
  })

  it('shares lane 0 for non-overlapping blocks', () => {
    const lanes = computeLanes([
      { id: 'a', deviceId: 1, dayIndex: 0, startMin: 360, endMin: 420 },
      { id: 'b', deviceId: 1, dayIndex: 0, startMin: 480, endMin: 540 },
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, laneCount: 1 })
    expect(lanes.get('b')).toEqual({ lane: 0, laneCount: 1 })
  })

  it('reuses a lane once a previous event has ended', () => {
    const lanes = computeLanes([
      { id: 'a', deviceId: 1, dayIndex: 0, startMin: 300, endMin: 600 },
      { id: 'b', deviceId: 1, dayIndex: 0, startMin: 360, endMin: 420 },
      { id: 'c', deviceId: 1, dayIndex: 0, startMin: 480, endMin: 540 },
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, laneCount: 2 })
    expect(lanes.get('b')).toEqual({ lane: 1, laneCount: 2 })
    expect(lanes.get('c')).toEqual({ lane: 1, laneCount: 2 })
  })

  it('creates a third lane for triple overlap', () => {
    const lanes = computeLanes([
      { id: 'a', deviceId: 1, dayIndex: 0, startMin: 300, endMin: 600 },
      { id: 'b', deviceId: 1, dayIndex: 0, startMin: 360, endMin: 420 },
      { id: 'c', deviceId: 1, dayIndex: 0, startMin: 400, endMin: 520 },
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, laneCount: 3 })
    expect(lanes.get('b')).toEqual({ lane: 1, laneCount: 3 })
    expect(lanes.get('c')).toEqual({ lane: 2, laneCount: 3 })
  })

  it('does not collide across devices or days', () => {
    const lanes = computeLanes([
      { id: 'a', deviceId: 1, dayIndex: 0, startMin: 360, endMin: 480 },
      { id: 'b', deviceId: 2, dayIndex: 0, startMin: 360, endMin: 480 },
      { id: 'c', deviceId: 1, dayIndex: 1, startMin: 360, endMin: 480 },
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, laneCount: 1 })
    expect(lanes.get('b')).toEqual({ lane: 0, laneCount: 1 })
    expect(lanes.get('c')).toEqual({ lane: 0, laneCount: 1 })
  })
})

describe('weekRangeAround / addDays', () => {
  it('anchors weeks on the containing Sunday', () => {
    // 2024-11-06 was a Wednesday; the Sunday of that week is 2024-11-03
    expect(weekRangeAround('2024-11-06', 'UTC')).toEqual({ start: '2024-11-03', end: '2024-11-09' })
  })

  it('returns the same week when given its Sunday', () => {
    expect(weekRangeAround('2024-11-03', 'UTC')).toEqual({ start: '2024-11-03', end: '2024-11-09' })
  })

  it('spans month and year boundaries', () => {
    // 2025-01-01 (Wed) → week of 2024-12-29 … 2025-01-04
    expect(weekRangeAround('2025-01-01T12:00:00.000Z', 'UTC')).toEqual({
      start: '2024-12-29',
      end: '2025-01-04',
    })
  })

  it('shifts by whole weeks with addDays', () => {
    expect(addDays('2024-11-03', 7, 'UTC')).toBe('2024-11-10')
    expect(addDays('2024-11-03', -7, 'UTC')).toBe('2024-10-27')
    expect(addDays('2024-12-29', 7, 'UTC')).toBe('2025-01-05')
  })
})

describe('formatWeekLabel', () => {
  it('formats a week within a single year', () => {
    expect(formatWeekLabel('2024-11-03', '2024-11-09')).toBe('Nov 3 – Nov 9, 2024')
  })

  it('shows the year on both ends when the week crosses years', () => {
    expect(formatWeekLabel('2024-12-29', '2025-01-04')).toBe('Dec 29, 2024 – Jan 4, 2025')
  })
})

describe('formatTimeHHMM', () => {
  it('pads single-digit hours and minutes with leading zeros', () => {
    expect(formatTimeHHMM(0)).toBe('00:00')
    expect(formatTimeHHMM(360)).toBe('06:00')
    expect(formatTimeHHMM(510)).toBe('08:30')
    expect(formatTimeHHMM(5)).toBe('00:05')
    expect(formatTimeHHMM(1435)).toBe('23:55')
  })
})

describe('weekDates', () => {
  it('returns Sun-first dates for the given week', () => {
    expect(weekDates('2024-11-03', 'UTC')).toEqual([
      '2024-11-03',
      '2024-11-04',
      '2024-11-05',
      '2024-11-06',
      '2024-11-07',
      '2024-11-08',
      '2024-11-09',
    ])
  })

  it('wraps across a year boundary', () => {
    expect(weekDates('2024-12-29', 'UTC')[6]).toBe('2025-01-04')
  })
})

describe('formatDayHeader', () => {
  it('formats with the given locale', () => {
    expect(formatDayHeader('2026-08-23', 'UTC', 'en-US')).toBe('Sun, Aug 23, 2026')
  })

  it('localizes month and weekday names', () => {
    const fr = formatDayHeader('2026-08-23', 'UTC', 'fr')
    expect(fr).toContain('août')
    expect(fr).toContain('23')
    expect(fr).toContain('2026')
  })

  it('respects the time zone so the day stays correct', () => {
    // 23/Aug/2026 12:00 local formatted in UTC+14 still renders the same calendar day
    const nz = formatDayHeader('2026-08-23', 'Pacific/Auckland', 'en-NZ')
    expect(nz).toContain('23')
    expect(nz).toContain('2026')
  })

  it('returns an empty string for invalid input', () => {
    expect(formatDayHeader('', 'UTC', 'en-US')).toBe('')
    expect(formatDayHeader('not-a-date', 'UTC', 'en-US')).toBe('')
  })
})
