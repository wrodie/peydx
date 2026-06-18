import { describe, it, expect } from 'vitest'
import { buildScheduleJson } from '../../sync-utils.js'

/**
 * Contract test: schedule.json shape
 *
 * The shape of schedule.json is the critical contract between the sync agent
 * and the player. These tests validate that the output matches what the
 * PlayerController expects.
 */
describe('schedule.json contract', () => {
  const validScheduleItems = [
    {
      program: {
        id: 1,
        title: 'Morning Service',
        loop: false,
        folder: { department: { name: 'Worship' } },
        slides: [
          {
            blockType: 'imageBlock',
            image: { filename: 'slide1.jpg', url: '/media/slide1.jpg' },
          },
        ],
      },
      startTime: '2024-01-15T09:00:00Z',
      endTime: '2024-01-15T10:00:00Z',
      daysOfWeek: ['mon'],
      untilDate: '2024-12-31T00:00:00Z',
    },
  ]

  const validAvailabilityItems = [
    {
      program: {
        id: 5,
        title: 'On Demand',
        loop: false,
        folder: { department: { name: 'Youth' } },
        slides: [],
      },
      startDate: '2024-01-15T00:00:00Z',
      endDate: '2024-02-15T00:00:00Z',
    },
  ]

  const output = buildScheduleJson(validScheduleItems, validAvailabilityItems, '/bg.jpg', 'TV-1', false)

  it('contains required top-level fields', () => {
    expect(output).toHaveProperty('lastUpdated')
    expect(output).toHaveProperty('schedule')
    expect(output).toHaveProperty('availability')
    expect(output).toHaveProperty('defaultBackground')
    expect(output).toHaveProperty('deviceName')
    expect(output).toHaveProperty('hideProgramList')
  })

  it('each schedule entry has required fields', () => {
    const entry = output.schedule[0]
    expect(entry).toHaveProperty('programId')
    expect(entry).toHaveProperty('scheduleType')
    expect(entry).toHaveProperty('startTime')
    expect(entry).toHaveProperty('endTime')
    expect(entry).toHaveProperty('daysOfWeek')
    expect(entry).toHaveProperty('program')
    expect(entry).not.toHaveProperty('startDate')
  })

  it('each availability entry has required fields', () => {
    const entry = output.availability[0]
    expect(entry).toHaveProperty('programId')
    expect(entry).toHaveProperty('scheduleType')
    expect(entry).toHaveProperty('startDate')
    expect(entry).toHaveProperty('program')
  })

  it('each program object has required fields', () => {
    const program = output.schedule[0].program
    expect(program).toHaveProperty('id')
    expect(program).toHaveProperty('title')
    expect(program).toHaveProperty('slides')
  })

  it('each slide has required fields', () => {
    const slide = output.schedule[0].program.slides[0]
    // After resolveSlideMedia, image becomes an object with url
    expect(slide.image).toBeDefined()
    expect(slide.image.url).toBeDefined()
  })

  it('scheduleType values are correct for each entry type', () => {
    expect(output.schedule[0].scheduleType).toBe('autoplay')
    expect(output.availability[0].scheduleType).toBe('availability')
  })

  it('lastUpdated is a valid ISO timestamp', () => {
    expect(() => new Date(output.lastUpdated)).not.toThrow()
    const d = new Date(output.lastUpdated)
    expect(d.toISOString()).toBe(output.lastUpdated)
  })
})
