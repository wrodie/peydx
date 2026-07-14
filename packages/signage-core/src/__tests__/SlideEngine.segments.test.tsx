import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import React, { createRef } from 'react'
import { render, act } from '@testing-library/react'
import { SlideEngine } from '../SlideEngine'
import type { SlideEngineHandle } from '../SlideEngine'
import type { Program } from '../types'

describe('SlideEngine segments', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function makeProgram(slides: any[]): Program {
    return { id: 1, title: 'Test Program', slides }
  }

  it('renders segment child slides within flattened program', () => {
    const prog = makeProgram([{
      blockType: 'segmentBlock',
      id: 'seg1',
      name: 'Intro',
      loop: true,
      advanceMode: 'slides',
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed', image: { id: 1, url: '/img1.jpg' } },
        { blockType: 'imageBlock', advanceMode: 'timed', image: { id: 2, url: '/img2.jpg' } },
      ],
    }])
    const { container } = render(<SlideEngine program={prog} />)
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders mixed top-level and segment slides', () => {
    const prog = makeProgram([
      { blockType: 'imageBlock', advanceMode: 'timed', image: { id: 1, url: '/img1.jpg' } },
      {
        blockType: 'segmentBlock',
        id: 'seg1',
        advanceMode: 'slides',
        slides: [
          { blockType: 'imageBlock', advanceMode: 'timed', image: { id: 2, url: '/img2.jpg' } },
        ],
      },
    ])
    const { container } = render(<SlideEngine program={prog} />)
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('handles empty segment gracefully', () => {
    const prog = makeProgram([{
      blockType: 'segmentBlock',
      id: 'seg1',
      advanceMode: 'slides',
      slides: [],
    }])
    render(<SlideEngine program={prog} />)
  })

  it('handles segment with video slide', () => {
    const prog = makeProgram([{
      blockType: 'segmentBlock',
      id: 'seg1',
      advanceMode: 'slides',
      slides: [
        { blockType: 'videoBlock', advanceMode: 'onEnd', video: { id: 1, url: '/vid.mp4' } },
      ],
    }])
    const { container } = render(<SlideEngine program={prog} />)
    expect(container.querySelector('video')).toBeTruthy()
  })

  function makeSegment(
    id: string,
    advanceMode: 'slides' | 'timed' | 'manual',
    duration?: number,
    slideAdvanceMode: 'timed' | 'manual' = 'manual',
  ): any {
    return {
      blockType: 'segmentBlock',
      id,
      name: `Segment ${id}`,
      advanceMode,
      duration,
      loop: false,
      slides: [
        {
          blockType: 'imageBlock',
          advanceMode: slideAdvanceMode,
          duration: 5,
          image: { id: 1, url: `/img-${id}.jpg`, alt: `${id}-slide` },
        },
      ],
    }
  }

  it('manual segment: user-triggered next advances past segment', () => {
    vi.useFakeTimers()
    const ref = createRef<SlideEngineHandle>()
    const prog = makeProgram([
      makeSegment('seg1', 'manual'),
      { blockType: 'imageBlock', advanceMode: 'manual', image: { id: 2, url: '/img2.jpg', alt: 'after-seg' } },
    ])

    render(<SlideEngine ref={ref} program={prog} />)

    act(() => { ref.current?.nextSlide() })

    const afterImg = document.querySelector('img[alt="after-seg"]')
    expect(afterImg).toBeTruthy()
  })

  it('manual segment: auto-advance does not advance past segment', () => {
    vi.useFakeTimers()
    const ref = createRef<SlideEngineHandle>()
    const prog = makeProgram([
      makeSegment('seg1', 'manual', undefined, 'timed'),
      { blockType: 'imageBlock', advanceMode: 'manual', image: { id: 2, url: '/img2.jpg', alt: 'after-seg' } },
    ])

    render(<SlideEngine ref={ref} program={prog} />)

    act(() => { vi.advanceTimersByTime(6000) })

    expect(ref.current?.getCurrentIndex()).toBe(0)
  })

  it('manual segment at end: user-triggered next calls onProgramEnd', () => {
    vi.useFakeTimers()
    const onEnd = vi.fn()
    const ref = createRef<SlideEngineHandle>()
    const prog = makeProgram([makeSegment('seg1', 'manual')])

    render(<SlideEngine ref={ref} program={prog} onProgramEnd={onEnd} />)

    act(() => { ref.current?.nextSlide() })

    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('timed segment: segment timer advances past segment', () => {
    vi.useFakeTimers()
    const prog = makeProgram([
      makeSegment('seg1', 'timed', 3),
      { blockType: 'imageBlock', advanceMode: 'manual', image: { id: 2, url: '/img2.jpg', alt: 'after-seg' } },
    ])

    render(<SlideEngine program={prog} />)

    act(() => { vi.advanceTimersByTime(3 * 60 * 1000 + 100) })

    const afterImg = document.querySelector('img[alt="after-seg"]')
    expect(afterImg).toBeTruthy()
  })

  it('timed segment at end: segment timer calls onProgramEnd', () => {
    vi.useFakeTimers()
    const onEnd = vi.fn()
    const prog = makeProgram([makeSegment('seg1', 'timed', 2)])

    render(<SlideEngine program={prog} onProgramEnd={onEnd} />)

    act(() => { vi.advanceTimersByTime(2 * 60 * 1000 + 100) })

    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('timed segment at end: slide timer does not call onProgramEnd prematurely', () => {
    vi.useFakeTimers()
    const onEnd = vi.fn()
    const prog = makeProgram([makeSegment('seg1', 'timed', 5, 'timed')])

    render(<SlideEngine program={prog} onProgramEnd={onEnd} />)

    act(() => { vi.advanceTimersByTime(6000) })

    expect(onEnd).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(5 * 60 * 1000) })

    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('timed segment: user can advance past with keyboard before timer', () => {
    vi.useFakeTimers()
    const onEnd = vi.fn()
    const ref = createRef<SlideEngineHandle>()
    const prog = makeProgram([makeSegment('seg1', 'timed', 5)])

    render(<SlideEngine ref={ref} program={prog} onProgramEnd={onEnd} />)

    act(() => { ref.current?.nextSlide() })

    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
