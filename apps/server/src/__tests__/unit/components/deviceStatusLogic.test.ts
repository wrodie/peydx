import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  normalizeDevice,
  applyStatusPatch,
  applyStateChangePatch,
  slideCount,
  attachProgram,
} from '../../../components/deviceStatus/deviceStatusLogic'

describe('normalizeDevice', () => {
  it('normalizes a device doc with an object currentProgram', () => {
    const doc = {
      id: 1,
      name: 'Foyer',
      deviceType: 'hardware',
      departments: [{ id: 2, name: 'Youth' }],
      status: 'online',
      lastHeartbeat: '2024-01-01T00:00:00.000Z',
      currentProgram: { id: 10, title: 'Worship', slides: [] },
      currentSlideIndex: 3,
      clientVersion: '1.2.3',
    }
    const result = normalizeDevice(doc)
    expect(result.id).toBe(1)
    expect(result.currentProgramId).toBe(10)
    expect(result.currentProgram.title).toBe('Worship')
    expect(result.departments).toHaveLength(1)
  })
})

describe('applyStatusPatch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('updates the matching device with status and programId', () => {
    const devices = [
      { id: 1, name: 'A', deviceType: 'hardware', departments: [], status: null, lastHeartbeat: null, currentProgramId: null, currentProgram: null, currentSlideIndex: null, clientVersion: null },
      { id: 2, name: 'B', deviceType: 'hardware', departments: [], status: null, lastHeartbeat: null, currentProgramId: null, currentProgram: null, currentSlideIndex: null, clientVersion: null },
    ]
    const result = applyStatusPatch(devices as any, { id: 1, status: 'online', programId: 5, slideIndex: 2 })
    expect(result[0].status).toBe('online')
    expect(result[0].currentProgramId).toBe(5)
    expect(result[0].currentSlideIndex).toBe(2)
    expect(result[0].lastHeartbeat).toBe('2024-01-01T12:00:00.000Z')
    expect(result[1].status).toBeNull()
  })
})

describe('applyStateChangePatch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('marks the device online and updates program/slide', () => {
    const devices = [
      { id: 1, name: 'A', deviceType: 'hardware', departments: [], status: null, lastHeartbeat: null, currentProgramId: null, currentProgram: null, currentSlideIndex: null, clientVersion: null },
    ]
    const result = applyStateChangePatch(devices as any, { id: 1, programId: 7, slideIndex: 1 })
    expect(result[0].status).toBe('online')
    expect(result[0].currentProgramId).toBe(7)
    expect(result[0].currentSlideIndex).toBe(1)
  })
})

describe('slideCount', () => {
  it('counts flattened slides, expanding segments', () => {
    const program = {
      id: 1,
      title: 'P',
      slides: [
        { blockType: 'segmentBlock', id: 'seg1', loop: false, advanceMode: 'slides', slides: [
          { blockType: 'imageBlock', advanceMode: 'timed' },
          { blockType: 'imageBlock', advanceMode: 'timed' },
          { blockType: 'imageBlock', advanceMode: 'timed' },
        ]},
      ],
    }
    expect(slideCount(program)).toBe(3)
  })

  it('returns 0 for empty or missing program', () => {
    expect(slideCount(null)).toBe(0)
    expect(slideCount({ id: 1, title: 'P', slides: [] })).toBe(0)
  })
})

describe('attachProgram', () => {
  const base = (id: number) => ({
    id,
    name: `D${id}`,
    deviceType: 'hardware',
    departments: [],
    status: null,
    lastHeartbeat: null,
    currentProgramId: null,
    currentProgram: null,
    currentSlideIndex: null,
    clientVersion: null,
  })

  it('attaches a program doc and its id to the matching device', () => {
    const devices = [base(1), base(2)]
    const program = { id: 10, title: 'Worship', slides: [] }
    const result = attachProgram(devices as any, 1, program)
    expect(result[0].currentProgram).toBe(program)
    expect(result[0].currentProgramId).toBe(10)
    expect(result[1].currentProgram).toBeNull()
  })

  it('leaves devices unchanged when program is null', () => {
    const devices = [base(1)]
    const result = attachProgram(devices as any, 1, null)
    expect(result).toEqual(devices)
    expect(result[0].currentProgram).toBeNull()
  })
})
