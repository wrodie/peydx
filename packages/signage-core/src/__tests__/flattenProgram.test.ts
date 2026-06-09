import { describe, it, expect } from 'vitest'
import { flattenProgram } from '../flattenProgram'
import type { Program, Slide, SlideOrSegment, Segment } from '../types'

describe('flattenProgram', () => {
  it('returns empty slides array and empty boundaries map for program with no slides', () => {
    const program: Program = { id: 1, title: 'Empty', slides: [] }
    const result = flattenProgram(program)
    expect(result.slides).toEqual([])
    expect(result.segmentBoundaries.size).toBe(0)
  })

  it('returns empty slides for undefined slides', () => {
    const program: Program = { id: 1, title: 'No Slides Field' }
    const result = flattenProgram(program)
    expect(result.slides).toEqual([])
    expect(result.segmentBoundaries.size).toBe(0)
  })

  it('passes regular slides through unchanged', () => {
    const slides: SlideOrSegment[] = [
      { blockType: 'imageBlock', advanceMode: 'timed', duration: 5 },
      { blockType: 'videoBlock', advanceMode: 'onEnd' },
    ]
    const program: Program = { id: 1, title: 'Regular', slides }
    const result = flattenProgram(program)
    expect(result.slides).toHaveLength(2)
    expect(result.slides[0].blockType).toBe('imageBlock')
    expect(result.slides[1].blockType).toBe('videoBlock')
    expect(result.segmentBoundaries.size).toBe(0)
  })

  it('expands a single segment, injects segmentContext, records boundaries', () => {
    const seg: Segment = {
      blockType: 'segmentBlock',
      name: 'Intro',
      loop: true,
      advanceMode: 'slides',
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed' },
        { blockType: 'videoBlock', advanceMode: 'onEnd' },
      ],
      id: 'seg1',
    }
    const program: Program = { id: 1, title: 'With Segment', slides: [seg] }
    const result = flattenProgram(program)

    expect(result.slides).toHaveLength(2)
    expect(result.slides[0].segmentContext).toBeDefined()
    expect(result.slides[0].segmentContext!.segmentId).toBe('seg1')
    expect(result.slides[0].segmentContext!.index).toBe(0)
    expect(result.slides[0].segmentContext!.total).toBe(2)
    expect(result.slides[0].segmentContext!.loop).toBe(true)
    expect(result.slides[0].segmentContext!.advanceMode).toBe('slides')
    expect(result.slides[1].segmentContext!.index).toBe(1)

    expect(result.segmentBoundaries.size).toBe(2)
    expect(result.segmentBoundaries.get(0)!.segmentId).toBe('seg1')
    expect(result.segmentBoundaries.get(0)!.startIndex).toBe(0)
    expect(result.segmentBoundaries.get(0)!.endIndex).toBe(1)
    expect(result.segmentBoundaries.get(0)!.totalSlides).toBe(2)
  })

  it('handles multiple independent segments with correct indices', () => {
    const segA: Segment = {
      blockType: 'segmentBlock',
      name: 'A',
      loop: false,
      advanceMode: 'slides',
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed' },
      ],
      id: 'segA',
    }
    const segB: Segment = {
      blockType: 'segmentBlock',
      name: 'B',
      loop: false,
      advanceMode: 'slides',
      slides: [
        { blockType: 'videoBlock', advanceMode: 'onEnd' },
        { blockType: 'imageBlock', advanceMode: 'timed' },
      ],
      id: 'segB',
    }
    const program: Program = { id: 1, title: 'Two Segments', slides: [segA, segB] }
    const result = flattenProgram(program)

    expect(result.slides).toHaveLength(3)
    expect(result.slides[0].segmentContext!.segmentId).toBe('segA')
    expect(result.slides[1].segmentContext!.segmentId).toBe('segB')
    expect(result.slides[2].segmentContext!.segmentId).toBe('segB')
    expect(result.slides[1].segmentContext!.index).toBe(0)
    expect(result.slides[2].segmentContext!.index).toBe(1)

    expect(result.segmentBoundaries.get(0)!.endIndex).toBe(0)
    expect(result.segmentBoundaries.get(1)!.startIndex).toBe(1)
    expect(result.segmentBoundaries.get(1)!.endIndex).toBe(2)
  })

  it('interleaves regular slides and segments correctly', () => {
    const items: SlideOrSegment[] = [
      { blockType: 'blackScreenBlock', advanceMode: 'manual' } as Slide,
      {
        blockType: 'segmentBlock',
        loop: false,
        advanceMode: 'slides',
        slides: [{ blockType: 'imageBlock', advanceMode: 'timed' }],
      } as Segment,
      { blockType: 'audioBlock', advanceMode: 'onEnd' } as Slide,
    ]
    const program: Program = { id: 1, title: 'Mixed', slides: items }
    const result = flattenProgram(program)

    expect(result.slides).toHaveLength(3)
    expect(result.slides[0].blockType).toBe('blackScreenBlock')
    expect(result.slides[0].segmentContext).toBeUndefined()
    expect(result.slides[1].blockType).toBe('imageBlock')
    expect(result.slides[1].segmentContext).toBeDefined()
    expect(result.slides[2].blockType).toBe('audioBlock')
    expect(result.slides[2].segmentContext).toBeUndefined()
  })

  it('resolves segment backgroundAudio as an object', () => {
    const bg = { id: 5, filename: 'bg.mp3', url: '/media/bg.mp3' }
    const seg: Segment = {
      blockType: 'segmentBlock',
      backgroundAudio: bg,
      loop: false,
      advanceMode: 'slides',
      slides: [{ blockType: 'imageBlock', advanceMode: 'timed' }],
      id: 'bgaud',
    }
    const program: Program = { id: 1, title: 'BG Audio', slides: [seg] }
    const result = flattenProgram(program)

    expect(result.segmentBoundaries.get(0)!.backgroundAudio).toEqual(bg)
    expect(result.slides[0].segmentContext!.backgroundAudio).toEqual(bg)
  })

  it('passes null for backgroundAudio as number/ID', () => {
    const seg: Segment = {
      blockType: 'segmentBlock',
      backgroundAudio: 7,
      loop: false,
      advanceMode: 'slides',
      slides: [{ blockType: 'imageBlock', advanceMode: 'timed' }],
    }
    const program: Program = { id: 1, title: 'BG Audio ID', slides: [seg] }
    const result = flattenProgram(program)
    expect(result.segmentBoundaries.get(0)!.backgroundAudio).toBeNull()
  })

  it('generates fallback ID for segment without id', () => {
    const seg: Segment = {
      blockType: 'segmentBlock',
      loop: false,
      advanceMode: 'slides',
      slides: [{ blockType: 'imageBlock', advanceMode: 'timed' }],
    }
    const program: Program = { id: 1, title: 'No ID Segment', slides: [seg] }
    const result = flattenProgram(program)
    expect(result.slides[0].segmentContext!.segmentId).toBe('seg-0')
  })

  it('does not create boundary entries for empty segment', () => {
    const seg: Segment = {
      blockType: 'segmentBlock',
      loop: false,
      advanceMode: 'slides',
      slides: [],
      id: 'empty',
    }
    const program: Program = { id: 1, title: 'Empty Seg', slides: [seg] }
    const result = flattenProgram(program)
    expect(result.slides).toHaveLength(0)
    expect(result.segmentBoundaries.size).toBe(0)
  })

  it('boundary map has correct startIndex and endIndex', () => {
    const seg: Segment = {
      blockType: 'segmentBlock',
      loop: false,
      advanceMode: 'slides',
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed' },
        { blockType: 'imageBlock', advanceMode: 'timed' },
        { blockType: 'imageBlock', advanceMode: 'timed' },
      ],
      id: 'triple',
    }
    const program: Program = { id: 1, title: 'Three', slides: [seg] }
    const result = flattenProgram(program)
    expect(result.segmentBoundaries.get(0)!.startIndex).toBe(0)
    expect(result.segmentBoundaries.get(0)!.endIndex).toBe(2)
    expect(result.segmentBoundaries.get(2)!.startIndex).toBe(0)
    expect(result.segmentBoundaries.get(2)!.endIndex).toBe(2)
  })

  it('segment defaults loop to false and advanceMode to slides', () => {
    const seg: Segment = {
      blockType: 'segmentBlock',
      loop: undefined as any,
      advanceMode: undefined as any,
      slides: [{ blockType: 'imageBlock', advanceMode: 'timed' }],
    }
    const program: Program = { id: 1, title: 'Defaults', slides: [seg] }
    const result = flattenProgram(program)
    expect(result.segmentBoundaries.get(0)!.loop).toBe(false)
    expect(result.segmentBoundaries.get(0)!.advanceMode).toBe('slides')
  })

  it('preserves program metadata', () => {
    const program: Program = {
      id: 42,
      title: 'Full Program',
      loop: true,
      autoBlackEndSlide: false,
      department: 'Worship',
      slides: [{ blockType: 'blackScreenBlock', advanceMode: 'manual' }],
    }
    const result = flattenProgram(program)
    expect(result.id).toBe(42)
    expect(result.title).toBe('Full Program')
    expect(result.loop).toBe(true)
    expect(result.autoBlackEndSlide).toBe(false)
    expect(result.department).toBe('Worship')
  })
})
