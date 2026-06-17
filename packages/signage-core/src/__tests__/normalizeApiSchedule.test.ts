import { describe, it, expect } from 'vitest'
import { normalizeApiSchedule } from '../normalizeApiSchedule'
import type { NormalizeApiScheduleOptions } from '../normalizeApiSchedule'

describe('normalizeApiSchedule', () => {
  const baseApiData = {
    docs: [
      {
        id: 1,
        program: {
          id: 10,
          title: 'Morning Service',
          loop: false,
          folder: { department: { name: 'Worship' } },
          slides: [
            { blockType: 'imageBlock', advanceMode: 'timed', image: { id: 1, url: '/media/img1.jpg' } },
          ],
        },
        startTime: '2025-06-15T09:00:00.000Z',
        endTime: '2025-06-15T10:00:00.000Z',
        daysOfWeek: ['mon'],
        startDate: '2025-01-01',
        untilDate: '2025-12-31',
        devices: [{ id: 1 }],
      },
    ],
  }

  const baseProgramsData = {
    docs: [
      {
        id: 20,
        title: 'On Demand',
        loop: true,
        folder: { department: { name: 'Youth' } },
        slides: [],
        availableFrom: '2025-06-01T00:00:00.000Z',
        availableUntil: '2025-12-31T00:00:00.000Z',
        availableDevices: [{ id: 1 }],
      },
    ],
  }

  it('transforms raw API data into ResolvedSchedule', () => {
    const result = normalizeApiSchedule(baseApiData, baseProgramsData)
    expect(result.schedule).toHaveLength(1)
    expect(result.schedule[0].programId).toBe(10)
    expect(result.schedule[0].scheduleType).toBe('autoplay')
    expect(result.schedule[0].daysOfWeek).toEqual(['mon'])
    expect(result.schedule[0].program.title).toBe('Morning Service')
    expect(result.schedule[0].program.department).toBe('Worship')
    expect(result.schedule[0].program.slides).toHaveLength(1)
  })

  it('filters availability by deviceId', () => {
    const programsData = {
      docs: [
        { ...baseProgramsData.docs[0], availableDevices: [{ id: 2 }] },
      ],
    }
    const result = normalizeApiSchedule({ docs: [] }, programsData, { deviceId: 1 })
    expect(result.availability).toHaveLength(0)
  })

  it('includes availability matching deviceId', () => {
    const result = normalizeApiSchedule({ docs: [] }, baseProgramsData, { deviceId: 1 })
    expect(result.availability).toHaveLength(1)
    expect(result.availability[0].programId).toBe(20)
    expect(result.availability[0].scheduleType).toBe('availability')
  })

  it('resolves media URLs via custom resolver', () => {
    const resolveMediaUrl = (url: string) => url.replace('/media/', '/local-media/')
    const result = normalizeApiSchedule(baseApiData, undefined, { resolveMediaUrl })
    expect(result.schedule[0].program.slides[0].image?.url).toBe('/local-media/img1.jpg')
  })

  it('handles empty schedule data gracefully', () => {
    const result = normalizeApiSchedule({ docs: [] }, undefined)
    expect(result.schedule).toEqual([])
    expect(result.availability).toEqual([])
  })

  it('prefers fullHD URL for images', () => {
    const apiData = {
      docs: [
        {
          program: {
            id: 1,
            title: 'Test',
            loop: false,
            slides: [
              {
                blockType: 'imageBlock',
                advanceMode: 'timed',
                image: {
                  id: 1,
                  url: '/media/img.jpg',
                  sizes: { fullHD: { url: '/media/img_fullHD.webp' } },
                },
              },
            ],
          },
          startTime: '2025-06-15T09:00:00.000Z',
          daysOfWeek: ['mon'],
        },
      ],
    }
    const result = normalizeApiSchedule(apiData)
    expect(result.schedule[0].program.slides[0].image?.url).toBe('/media/img_fullHD.webp')
  })

  it('passes through YouTube slides unchanged', () => {
    const apiData = {
      docs: [
        {
          program: {
            id: 1,
            title: 'Test',
            loop: false,
            slides: [
              { blockType: 'youtubeBlock', advanceMode: 'onEnd', youtubeId: 'abc123' },
            ],
          },
          startTime: '2025-06-15T09:00:00.000Z',
          daysOfWeek: ['mon'],
        },
      ],
    }
    const result = normalizeApiSchedule(apiData)
    expect(result.schedule[0].program.slides[0]).toMatchObject({ blockType: 'youtubeBlock', youtubeId: 'abc123' })
  })

  it('passes through audio slides via normalizeSlide', () => {
    const apiData = {
      docs: [
        {
          program: {
            id: 1,
            title: 'Test',
            loop: false,
            slides: [
              { blockType: 'audioBlock', advanceMode: 'onEnd', audio: { id: 1, url: '/media/song.mp3' } },
            ],
          },
          startTime: '2025-06-15T09:00:00.000Z',
          daysOfWeek: ['mon'],
        },
      ],
    }
    const result = normalizeApiSchedule(apiData)
    expect(result.schedule[0].program.slides[0]).toMatchObject({ blockType: 'audioBlock' })
  })

  it('sets deviceName and defaultBackground from options', () => {
    const result = normalizeApiSchedule(
      { docs: [] },
      undefined,
      { deviceName: 'Lobby TV', defaultBackgroundUrl: '/bg.jpg' },
    )
    expect(result.deviceName).toBe('Lobby TV')
    expect(result.defaultBackground).toBe('/bg.jpg')
  })

  it('defaults deviceName and defaultBackground to null', () => {
    const result = normalizeApiSchedule({ docs: [] })
    expect(result.deviceName).toBeNull()
    expect(result.defaultBackground).toBeNull()
  })
})
