import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use require-style imports for CommonJS modules
const { sanitizeFilename, resolveSlideMedia, buildScheduleJson, writeScheduleAtomically } = require('../../../sync/sync-utils.js')

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

describe('sanitizeFilename', () => {
  it('replaces spaces with underscores', () => {
    expect(sanitizeFilename('my file.jpg')).toBe('my_file.jpg')
  })

  it('strips special characters', () => {
    expect(sanitizeFilename('café deli.png')).toBe('caf_deli.png')
  })

  it('preserves alphanumeric, dots, and hyphens', () => {
    expect(sanitizeFilename('photo-2024.final.jpg')).toBe('photo-2024.final.jpg')
  })

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('')
  })

  it('collapses multiple spaces', () => {
    expect(sanitizeFilename('a  b.jpg')).toBe('a_b.jpg')
  })

  it('strips unicode', () => {
    expect(sanitizeFilename('日本語.jpg')).toBe('.jpg')
  })
})

describe('resolveSlideMedia', () => {
  it('rewrites image slide URL to local-media path', () => {
    const slide = {
      blockType: 'imageBlock',
      image: { id: 1, filename: 'photo.jpg', url: 'https://cms/media/photo.jpg' },
    }
    const result = resolveSlideMedia(slide)
    expect(result.image.url).toBe('/local-media/photo.jpg')
  })

  it('uses sizes.fullHD filename when available for images', () => {
    const slide = {
      blockType: 'imageBlock',
      image: {
        id: 1,
        filename: 'photo.jpg',
        url: 'https://cms/media/photo.jpg',
        sizes: { fullHD: { filename: 'photo_fullHD.webp' } },
      },
    }
    const result = resolveSlideMedia(slide)
    expect(result.image.url).toBe('/local-media/photo_fullHD.webp')
  })

  it('falls back to filename when sizes.fullHD is absent', () => {
    const slide = {
      blockType: 'imageBlock',
      image: { id: 1, filename: 'photo.jpg', url: 'https://cms/media/photo.jpg' },
    }
    const result = resolveSlideMedia(slide)
    expect(result.image.url).toBe('/local-media/photo.jpg')
  })

  it('rewrites video slide URL', () => {
    const slide = {
      blockType: 'videoBlock',
      video: { id: 1, filename: 'clip.mp4', url: 'https://cms/media/clip.mp4' },
    }
    const result = resolveSlideMedia(slide)
    expect(result.video.url).toBe('/local-media/clip.mp4')
  })

  it('rewrites audio slide URL', () => {
    const slide = {
      blockType: 'audioBlock',
      audio: { id: 1, filename: 'song.mp3', url: 'https://cms/media/song.mp3' },
    }
    const result = resolveSlideMedia(slide)
    expect(result.audio.url).toBe('/local-media/song.mp3')
  })

  it('leaves youtube slide unchanged', () => {
    const slide = {
      blockType: 'youtubeBlock',
      youtubeId: 'abc123',
    }
    const result = resolveSlideMedia(slide)
    expect(result.youtubeId).toBe('abc123')
  })

  it('processes segment child slides recursively', () => {
    const slide = {
      blockType: 'segmentBlock',
      slides: [
        { blockType: 'imageBlock', image: { filename: 'inner.jpg', url: '/media/inner.jpg' } },
      ],
      backgroundAudio: { filename: 'bg.mp3', url: '/media/bg.mp3' },
    }
    const result = resolveSlideMedia(slide)
    expect(result.slides[0].image.url).toBe('/local-media/inner.jpg')
    expect(result.backgroundAudio.url).toBe('/local-media/bg.mp3')
  })

  it('handles segment without backgroundAudio', () => {
    const slide = {
      blockType: 'segmentBlock',
      slides: [],
    }
    const result = resolveSlideMedia(slide)
    expect(result.backgroundAudio).toBeUndefined()
  })
})

describe('buildScheduleJson', () => {
  it('constructs the schedule.json shape from schedule and availability items', () => {
    const scheduleItems = [
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
        startDate: '2024-01-01T00:00:00Z',
        untilDate: '2024-12-31T00:00:00Z',
      },
    ]

    const availabilityItems = [
      {
        program: {
          id: 5,
          title: 'On Demand',
          loop: true,
          folder: { department: { name: 'Youth' } },
          slides: [],
        },
        startDate: '2024-01-15T00:00:00Z',
        endDate: '2024-02-15T00:00:00Z',
      },
    ]

    const result = buildScheduleJson(scheduleItems, availabilityItems, '/local-media/bg.jpg', 'Lobby TV')

    expect(result.lastUpdated).toBeTruthy()
    expect(result.schedule).toHaveLength(1)
    expect(result.schedule[0].programId).toBe(1)
    expect(result.schedule[0].program.title).toBe('Morning Service')
    expect(result.schedule[0].program.department).toBe('Worship')
    expect(result.schedule[0].daysOfWeek).toEqual(['mon'])
    expect(result.schedule[0].program.slides[0].image.url).toBe('/local-media/slide1.jpg')

    expect(result.availability).toHaveLength(1)
    expect(result.availability[0].programId).toBe(5)
    expect(result.availability[0].scheduleType).toBe('availability')
    expect(result.availability[0].program.title).toBe('On Demand')
    expect(result.availability[0].program.department).toBe('Youth')

    expect(result.defaultBackground).toBe('/local-media/bg.jpg')
    expect(result.deviceName).toBe('Lobby TV')
  })

  it('handles empty input', () => {
    const result = buildScheduleJson([], [], null, null)
    expect(result.schedule).toEqual([])
    expect(result.availability).toEqual([])
    expect(result.defaultBackground).toBeNull()
    expect(result.deviceName).toBeNull()
  })
})

describe('writeScheduleAtomically', () => {
  function makeTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'peydx-test-'))
  }

  it('writes file when nothing exists', () => {
    const tmpDir = makeTmpDir()
    const filePath = path.join(tmpDir, 'test.json')
    const result = writeScheduleAtomically({ test: 'data' }, filePath)
    expect(result).toBe(true)
    expect(fs.existsSync(filePath)).toBe(true)
    expect(JSON.parse(fs.readFileSync(filePath, 'utf-8')).test).toBe('data')
  })

  it('skips write when content is identical (ignoring lastUpdated)', () => {
    const tmpDir = makeTmpDir()
    const filePath = path.join(tmpDir, 'test.json')
    writeScheduleAtomically({ lastUpdated: '2024-01-01T00:00:00Z', test: 'data' }, filePath)

    const result = writeScheduleAtomically({ lastUpdated: '2024-06-01T00:00:00Z', test: 'data' }, filePath)
    expect(result).toBe(false)
    expect(JSON.parse(fs.readFileSync(filePath, 'utf-8')).lastUpdated).toBe('2024-01-01T00:00:00Z')
  })

  it('writes when content changed', () => {
    const tmpDir = makeTmpDir()
    const filePath = path.join(tmpDir, 'test.json')
    writeScheduleAtomically({ lastUpdated: '2024-01-01T00:00:00Z', test: 'old' }, filePath)

    const result = writeScheduleAtomically({ lastUpdated: '2024-06-01T00:00:00Z', test: 'new' }, filePath)
    expect(result).toBe(true)
    expect(JSON.parse(fs.readFileSync(filePath, 'utf-8')).test).toBe('new')
  })

  it('creates directory if it does not exist', () => {
    const tmpDir = makeTmpDir()
    const nestedPath = path.join(tmpDir, 'nested', 'test.json')
    writeScheduleAtomically({ test: 'data' }, nestedPath)
    expect(fs.existsSync(nestedPath)).toBe(true)
    expect(JSON.parse(fs.readFileSync(nestedPath, 'utf-8')).test).toBe('data')
  })

  it('atomically writes using .tmp rename (no stale .tmp file left)', () => {
    const tmpDir = makeTmpDir()
    const filePath = path.join(tmpDir, 'atomic.json')
    writeScheduleAtomically({ test: 'data' }, filePath)
    expect(fs.existsSync(filePath + '.tmp')).toBe(false)
    expect(fs.existsSync(filePath)).toBe(true)
  })
})
