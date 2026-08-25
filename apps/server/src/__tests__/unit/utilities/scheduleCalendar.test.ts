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
  weekdayMonIndex,
  PRIORITY_COLORS,
} from '../../../utilities/ui/scheduleCalendar'

describe('dayToColumn / dayColumnLabel', () => {
  it('maps days to Mon-first column indexes', () => {
    expect(dayToColumn('mon')).toBe(0)
    expect(dayToColumn('sun')).toBe(6)
    expect(dayToColumn('wed')).toBe(2)
    expect(dayToColumn('invalid')).toBe(0)
  })

  it('labels columns', () => {
    expect(dayColumnLabel(0)).toBe('Mon')
    expect(dayColumnLabel(6)).toBe('Sun')
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
    expect(blocks.map((b) => b.dayIndex).sort()).toEqual([0, 2])
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

describe('weekdayMonIndex', () => {
  it('maps dates to Mon-first weekday indexes', () => {
    // 2024-01-01 was a Monday
    expect(weekdayMonIndex('2024-01-01T12:00:00.000Z', 'UTC')).toBe(0)
    // 2024-01-07 was a Sunday
    expect(weekdayMonIndex('2024-01-07T12:00:00.000Z', 'UTC')).toBe(6)
  })
})
