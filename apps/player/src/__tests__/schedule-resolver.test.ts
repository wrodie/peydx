import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeApiSchedule } from 'signage-core'
import { resolveScheduleState } from 'signage-core'
import type { ResolvedSchedule, ScheduleEntry } from 'signage-core'

describe('normalizeApiSchedule', () => {
  const baseApiData = {
    docs: [
      {
        id: 1,
        program: {
          id: 101,
          title: 'Morning Service',
          loop: false,
          slides: [
            { blockType: 'imageBlock', advanceMode: 'timed', duration: 5, image: { id: 1, url: '/media/img1.jpg', alt: 'Slide 1' } },
            { blockType: 'videoBlock', advanceMode: 'onEnd', video: { id: 2, url: '/media/vid1.mp4' } },
          ],
          folder: { department: { name: 'Worship' } },
        },
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T10:00:00Z',
        daysOfWeek: [],
        startDate: null,
        untilDate: null,
      },
    ],
  }

  it('transforms basic raw API data into ResolvedSchedule', () => {
    const result = normalizeApiSchedule(baseApiData)
    expect(result.schedule).toHaveLength(1)
    expect(result.schedule[0].programId).toBe(101)
    expect(result.schedule[0].scheduleType).toBe('autoplay')
    expect(result.schedule[0].program.title).toBe('Morning Service')
    expect(result.schedule[0].program.slides).toHaveLength(2)
  })


  it('extracts availability from programs data', () => {
    const programsData = {
      docs: [
        {
          id: 201,
          title: 'On Demand',
          availableFrom: '2024-01-15T00:00:00Z',
          availableUntil: '2024-01-20T00:00:00Z',
          availableDevices: [{ id: 5 }],
          slides: [],
          folder: { department: { name: 'Youth' } },
        },
      ],
    }
    const result = normalizeApiSchedule(baseApiData, programsData)
    expect(result.availability).toHaveLength(1)
    expect(result.availability[0].scheduleType).toBe('availability')
    expect(result.availability[0].programId).toBe(201)
  })

  it('filters availability by deviceId when provided', () => {
    const programsData = {
      docs: [
        {
          id: 201,
          title: 'On Demand',
          availableFrom: '2024-01-15T00:00:00Z',
          availableDevices: [{ id: 5 }],
          slides: [],
        },
        {
          id: 202,
          title: 'Other',
          availableFrom: '2024-01-15T00:00:00Z',
          availableDevices: [{ id: 10 }],
          slides: [],
        },
      ],
    }
    const result = normalizeApiSchedule(baseApiData, programsData, { deviceId: 5 })
    expect(result.availability).toHaveLength(1)
    expect(result.availability[0].programId).toBe(201)
  })

  it('handles empty schedule data', () => {
    const result = normalizeApiSchedule({ docs: [] })
    expect(result.schedule).toHaveLength(0)
    expect(result.availability).toHaveLength(0)
  })

  it('sets deviceName when provided', () => {
    const result = normalizeApiSchedule(baseApiData, undefined, { deviceName: 'Lobby TV' })
    expect(result.deviceName).toBe('Lobby TV')
  })

  it('normalizeSlide handles image with sizes.fullHD', () => {
    const data = {
      docs: [
        {
          id: 1,
          program: {
            id: 101,
            title: 'Test',
            loop: false,
            slides: [
              {
                blockType: 'imageBlock',
                advanceMode: 'timed',
                duration: 5,
                image: {
                  id: 1,
                  url: '/media/img1.jpg',
                  sizes: { fullHD: { url: '/media/img1_fullHD.jpg' } },
                  alt: 'Test',
                },
              },
            ],
          },
          startTime: '2024-01-15T09:00:00Z',
          daysOfWeek: [],
        },
      ],
    }
    const result = normalizeApiSchedule(data)
    expect(result.schedule[0].program.slides[0].image.url).toBe('/media/img1_fullHD.jpg')
  })

  it('handles youtube slide', () => {
    const data = {
      docs: [
        {
          id: 1,
          program: {
            id: 101, title: 'Test', loop: false,
            slides: [{ blockType: 'youtubeBlock', advanceMode: 'onEnd', youtubeId: 'abc123' }],
          },
          startTime: '2024-01-15T09:00:00Z',
          daysOfWeek: [],
        },
      ],
    }
    const result = normalizeApiSchedule(data)
    expect(result.schedule[0].program.slides[0].youtubeId).toBe('abc123')
  })

  it('handles audio slide', () => {
    const data = {
      docs: [
        {
          id: 1,
          program: {
            id: 101, title: 'Test', loop: false,
            slides: [{
              blockType: 'audioBlock', advanceMode: 'onEnd',
              audio: { id: 1, url: '/media/song.mp3', alt: 'Song' },
            }],
          },
          startTime: '2024-01-15T09:00:00Z',
          daysOfWeek: [],
        },
      ],
    }
    const result = normalizeApiSchedule(data)
    expect(result.schedule[0].program.slides[0].audio.url).toBe('/media/song.mp3')
  })
})

describe('resolveScheduleState', () => {
  function makeEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
    const base: ScheduleEntry = {
      programId: 1,
      scheduleType: 'autoplay',
      startTime: '2024-01-15T12:00:00Z',
      endTime: '2024-01-15T13:00:00Z',
      daysOfWeek: ['mon'],
      startDate: '2024-01-01T00:00:00Z',
      untilDate: '2024-12-31T00:00:00Z',
      program: { id: 1, title: 'Test', slides: [] },
    }
    return { ...base, ...overrides }
  }

  function today12to13(overrides: Partial<ScheduleEntry> = {}): ResolvedSchedule {
    const now = new Date()
    const day = now.toISOString().split('T')[0]
    const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    return {
      lastUpdated: now.toISOString(),
      schedule: [makeEntry({
        startTime: `${day}T12:00:00Z`,
        endTime: `${day}T13:00:00Z`,
        daysOfWeek: [DAY_NAMES[now.getUTCDay()]],
        ...overrides,
      })],
      availability: [],
    }
  }

  it('returns active schedule for current time window', () => {
    const now = new Date()
    const day = now.toISOString().split('T')[0]
    const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const todayDay = DAY_NAMES[now.getUTCDay()]
    // Set start/end times that bracket the current UTC time
    const startHour = String(Math.max(0, now.getUTCHours() - 1)).padStart(2, '0')
    const endHour = String(Math.min(23, now.getUTCHours() + 1)).padStart(2, '0')
    const schedule: ResolvedSchedule = {
      lastUpdated: now.toISOString(),
      schedule: [{
        programId: 1,
        scheduleType: 'autoplay',
        startTime: `${day}T${startHour}:00:00Z`,
        endTime: `${day}T${endHour}:00:00Z`,
        daysOfWeek: [todayDay],
        startDate: undefined,
        untilDate: undefined,
        program: { id: 1, title: 'Test', slides: [] },
      }],
      availability: [],
    }
    const result = resolveScheduleState(schedule.schedule, schedule.availability)
    expect(result.activeAutoPlay).toBeDefined()
    expect(result.activeAutoPlay!.programId).toBe(1)
  })

  it('returns null when no schedule data', () => {
    const result = resolveScheduleState([], [])
    expect(result.activeAutoPlay).toBeNull()
    expect(result.availablePrograms).toEqual([])
  })

  it('returns null for wrong day of week', () => {
    const now = new Date()
    const day = now.toISOString().split('T')[0]
    const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const todayDay = DAY_NAMES[now.getUTCDay()]
    const wrongDay = DAY_NAMES[(now.getUTCDay() + 1) % 7]
    const schedule: ResolvedSchedule = {
      lastUpdated: now.toISOString(),
      schedule: [makeEntry({
        startTime: `${day}T12:00:00Z`,
        endTime: `${day}T13:00:00Z`,
        daysOfWeek: [wrongDay],
      })],
      availability: [],
    }
    const result = resolveScheduleState(schedule.schedule, schedule.availability)
    expect(result.activeAutoPlay).toBeNull()
  })

  it('returns null for one-off event on a different date', () => {
    const now = new Date()
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const futureDay = future.toISOString().split('T')[0]
    const schedule: ResolvedSchedule = {
      lastUpdated: now.toISOString(),
      schedule: [makeEntry({
        startTime: `${futureDay}T12:00:00Z`,
        endTime: `${futureDay}T13:00:00Z`,
        daysOfWeek: [],
      })],
      availability: [],
    }
    const result = resolveScheduleState(schedule.schedule, schedule.availability)
    expect(result.activeAutoPlay).toBeNull()
  })

  it('filters by startDate range', () => {
    const now = new Date()
    const day = now.toISOString().split('T')[0]
    const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const futureDay = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const schedule: ResolvedSchedule = {
      lastUpdated: now.toISOString(),
      schedule: [makeEntry({
        startTime: `${day}T12:00:00Z`,
        endTime: `${day}T13:00:00Z`,
        daysOfWeek: [DAY_NAMES[now.getUTCDay()]],
        startDate: futureDay,
      })],
      availability: [],
    }
    const result = resolveScheduleState(schedule.schedule, schedule.availability)
    expect(result.activeAutoPlay).toBeNull()
  })

  it('filters by untilDate range', () => {
    const now = new Date()
    const day = now.toISOString().split('T')[0]
    const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const pastDay = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const schedule: ResolvedSchedule = {
      lastUpdated: now.toISOString(),
      schedule: [makeEntry({
        startTime: `${day}T12:00:00Z`,
        endTime: `${day}T13:00:00Z`,
        daysOfWeek: [DAY_NAMES[now.getUTCDay()]],
        untilDate: pastDay,
      })],
      availability: [],
    }
    const result = resolveScheduleState(schedule.schedule, schedule.availability)
    expect(result.activeAutoPlay).toBeNull()
  })

  it('returns null when before start time', () => {
    const now = new Date()
    const day = now.toISOString().split('T')[0]
    const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    // Set start time 2 hours in the future
    const future = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const hours = String(future.getUTCHours()).padStart(2, '0')
    const mins = String(future.getUTCMinutes()).padStart(2, '0')
    const schedule: ResolvedSchedule = {
      lastUpdated: now.toISOString(),
      schedule: [makeEntry({
        startTime: `${day}T${hours}:${mins}:00Z`,
        endTime: `${day}T23:59:00Z`,
        daysOfWeek: [DAY_NAMES[now.getUTCDay()]],
        startDate: undefined,
        untilDate: undefined,
      })],
      availability: [],
    }
    const result = resolveScheduleState(schedule.schedule, schedule.availability)
    expect(result.activeAutoPlay).toBeNull()
  })

  it('returns null when after end time', () => {
    const now = new Date()
    const day = now.toISOString().split('T')[0]
    const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    // Set end time 2 hours in the past
    const past = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const hours = String(past.getUTCHours()).padStart(2, '0')
    const mins = String(past.getUTCMinutes()).padStart(2, '0')
    const schedule: ResolvedSchedule = {
      lastUpdated: now.toISOString(),
      schedule: [makeEntry({
        startTime: `${day}T00:00:00Z`,
        endTime: `${day}T${hours}:${mins}:00Z`,
        daysOfWeek: [DAY_NAMES[now.getUTCDay()]],
        startDate: undefined,
        untilDate: undefined,
      })],
      availability: [],
    }
    const result = resolveScheduleState(schedule.schedule, schedule.availability)
    expect(result.activeAutoPlay).toBeNull()
  })

  it('availability includes programs with grace period', () => {
    const now = new Date()
    const day = now.toISOString().split('T')[0]
    const schedule: ResolvedSchedule = {
      lastUpdated: now.toISOString(),
      schedule: [],
      availability: [
        {
          programId: 10,
          scheduleType: 'availability',
          startDate: day,
          endDate: day,
          program: { id: 10, title: 'On Demand', slides: [] },
        },
      ],
    }
    const result = resolveScheduleState(schedule.schedule, schedule.availability)
    expect(result.availablePrograms).toHaveLength(1)
    expect(result.availablePrograms[0].programId).toBe(10)
  })
})

describe('resolveActiveProgram (via resolveScheduleState)', () => {
  it('returns the program from active schedule entry', () => {
    const now = new Date()
    const day = now.toISOString().split('T')[0]
    const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const schedule: ResolvedSchedule = {
      lastUpdated: now.toISOString(),
      schedule: [
        {
          programId: 42,
          scheduleType: 'autoplay',
          startTime: `${day}T00:00:00Z`,
          endTime: `${day}T23:59:59Z`,
          daysOfWeek: [DAY_NAMES[now.getUTCDay()]],
          program: { id: 42, title: 'Active Program', slides: [] },
        },
      ],
      availability: [],
    }
    const result = resolveScheduleState(schedule.schedule, schedule.availability)
    expect(result.activeAutoPlay).toBeDefined()
    expect(result.activeAutoPlay!.programId).toBe(42)
    expect(result.activeAutoPlay!.program.title).toBe('Active Program')
  })

  it('returns null when no active schedule', () => {
    const result = resolveScheduleState([], [])
    expect(result.activeAutoPlay).toBeNull()
  })
})
