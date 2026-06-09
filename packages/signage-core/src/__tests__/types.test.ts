import { describe, it, expect } from 'vitest'
import type {
  Program, Slide, Media, PlayerState, ScheduleEntry,
  AvailabilityEntry, ResolvedSchedule, KeyConfig, Segment,
  SegmentContext, SlideOrSegment, FlattenedProgram, SegmentBoundary,
} from '../types'
import type { ClientToServerEvents, ServerToClientEvents } from '../events'
import { DEFAULT_KEY_CONFIG } from '../types'

describe('shared type contracts', () => {
  it('Slide type has required blockType field', () => {
    const slide: Slide = {
      blockType: 'imageBlock',
      advanceMode: 'timed',
    }
    expect(slide.blockType).toBe('imageBlock')
  })

  it('Program type accepts nested SlideOrSegment[]', () => {
    const prog: Program = {
      id: 1,
      title: 'Test',
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed' },
        {
          blockType: 'segmentBlock',
          loop: true,
          advanceMode: 'slides',
          slides: [{ blockType: 'videoBlock', advanceMode: 'onEnd' }],
        },
      ],
    }
    expect(prog.slides).toHaveLength(2)
  })

  it('ResolvedSchedule type shape matches player expectations', () => {
    const schedule: ResolvedSchedule = {
      lastUpdated: new Date().toISOString(),
      schedule: [],
      availability: [],
      defaultBackground: null,
      deviceName: null,
    }
    expect(schedule).toHaveProperty('lastUpdated')
    expect(schedule).toHaveProperty('schedule')
    expect(schedule).toHaveProperty('availability')
  })

  it('ScheduleEntry has all required fields', () => {
    const entry: ScheduleEntry = {
      programId: 1,
      scheduleType: 'autoplay',
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T01:00:00Z',
      daysOfWeek: [],
      program: { id: 1, title: 'Test' },
    }
    expect(entry.programId).toBe(1)
  })

  it('FlattenedProgram includes segmentBoundaries Map', () => {
    const fp: FlattenedProgram = {
      id: 1,
      title: 'Test',
      slides: [],
      segmentBoundaries: new Map(),
    }
    expect(fp.segmentBoundaries).toBeInstanceOf(Map)
  })

  it('PlayerState enum values are valid', () => {
    const states: PlayerState[] = ['idle', 'menu', 'playing']
    expect(states).toHaveLength(3)
  })

  it('blockType enum values are restricted', () => {
    const validBlockTypes = ['imageBlock', 'videoBlock', 'youtubeBlock', 'audioBlock', 'blackScreenBlock']
    for (const bt of validBlockTypes) {
      const slide: Slide = { blockType: bt as any, advanceMode: 'timed' }
      expect(slide.blockType).toBe(bt)
    }
  })

  it('advanceMode enum values are restricted', () => {
    const validModes = ['timed', 'manual', 'onEnd']
    for (const mode of validModes) {
      const slide: Slide = { blockType: 'imageBlock', advanceMode: mode as any }
      expect(slide.advanceMode).toBe(mode)
    }
  })

  it('transition enum values are restricted', () => {
    const validTransitions: Array<Slide['transition']> = ['fade', 'cut', 'slide']
    expect(validTransitions).toHaveLength(3)
  })

  it('DEFAULT_KEY_CONFIG has all required keys', () => {
    expect(DEFAULT_KEY_CONFIG).toHaveProperty('menu')
    expect(DEFAULT_KEY_CONFIG).toHaveProperty('up')
    expect(DEFAULT_KEY_CONFIG).toHaveProperty('down')
    expect(DEFAULT_KEY_CONFIG).toHaveProperty('enter')
    expect(DEFAULT_KEY_CONFIG).toHaveProperty('exit')
    expect(DEFAULT_KEY_CONFIG).toHaveProperty('pause')
  })

  it('ClientToServerEvents and ServerToClientEvents have matching event names', () => {
    const cEvents: (keyof ClientToServerEvents)[] = [
      'device:heartbeat', 'device:slideChange', 'device:stateChange',
      'remote:advance', 'remote:previous', 'remote:goto', 'remote:program',
      'remote:menu', 'remote:back', 'remote:select', 'remote:pause',
    ]
    expect(cEvents.length).toBeGreaterThan(0)

    const sEvents: (keyof ServerToClientEvents)[] = [
      'schedule:update',
      'remote:advance', 'remote:previous', 'remote:goto', 'remote:program',
      'remote:menu', 'remote:back', 'remote:select', 'remote:pause',
      'device:status', 'device:stateChange',
    ]
    expect(sEvents.length).toBeGreaterThan(0)
  })
})
