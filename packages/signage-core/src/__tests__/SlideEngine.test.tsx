import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, act, cleanup } from '@testing-library/react'
import { SlideEngine } from '../SlideEngine'
import type { Program } from '../types'

// Mock YouTube IFrame API
const mockYT = {
  Player: vi.fn(),
}
;(window as any).YT = mockYT
;(window as any).onYouTubeIframeAPIReady = null

describe('SlideEngine', () => {
  beforeEach(() => {
    cleanup()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    cleanup()
  })

  const baseProgram: Program = {
    id: 1,
    title: 'Test Program',
    slides: [
      {
        blockType: 'imageBlock',
        advanceMode: 'timed',
        duration: 5,
        image: { id: 1, url: 'https://example.com/image.jpg', alt: 'Slide 1' },
        transition: 'fade',
      },
    ],
  }

  it('renders an image slide', () => {
    const { container } = render(<SlideEngine program={baseProgram} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toContain('image.jpg')
  })

  it('renders a video slide', () => {
    const prog: Program = {
      ...baseProgram,
      slides: [{
        blockType: 'videoBlock',
        advanceMode: 'onEnd',
        video: { id: 1, url: 'https://example.com/video.mp4' },
      }],
    }
    const { container } = render(<SlideEngine program={prog} />)
    const video = container.querySelector('video')
    expect(video).toBeTruthy()
    expect(video?.getAttribute('autoplay')).not.toBeNull()
  })

  it('renders a black screen slide', () => {
    const prog: Program = {
      ...baseProgram,
      slides: [{
        blockType: 'blackScreenBlock',
        advanceMode: 'manual',
      }],
    }
    const { container } = render(<SlideEngine program={prog} />)
    const blackDiv = container.querySelector('[style*="background"]') || container.firstChild
    expect(blackDiv).toBeTruthy()
  })

  it('renders a youtube slide', () => {
    // Set up the YouTube API callback
    const prog: Program = {
      ...baseProgram,
      slides: [{
        blockType: 'youtubeBlock',
        advanceMode: 'onEnd',
        youtubeId: 'dQw4w9WgXcQ',
      }],
    }
    const { container } = render(<SlideEngine program={prog} />)
    expect(container.querySelector('.slide-youtube-embed')).toBeTruthy()
  })

  it('renders an audio slide', () => {
    const prog: Program = {
      ...baseProgram,
      slides: [{
        blockType: 'audioBlock',
        advanceMode: 'onEnd',
        audio: { id: 1, url: 'https://example.com/song.mp3' },
      }],
    }
    const { container } = render(<SlideEngine program={prog} />)
    const audio = container.querySelector('audio')
    expect(audio).toBeTruthy()
  })

  it('renders segment slides with context', () => {
    const prog: Program = {
      ...baseProgram,
      slides: [{
        blockType: 'segmentBlock',
        id: 'seg1',
        name: 'Intro Segment',
        loop: true,
        advanceMode: 'slides',
        slides: [
          { blockType: 'imageBlock', advanceMode: 'timed', image: { id: 1, url: '/img.jpg' } },
        ],
      }],
    }
    const { container } = render(<SlideEngine program={prog} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
  })

  it('image slide renders without fade delay (animation always applied)', () => {
    const { container } = render(<SlideEngine program={baseProgram} />)
    const wrapper = container.querySelector('.slide-slide-wrapper') as HTMLElement
    expect(wrapper).toBeTruthy()
    const anim = wrapper.style.animation as string
    expect(anim).toContain('signageFadeIn')
  })

  it('timed slide advances after duration', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    const prog: Program = {
      ...baseProgram,
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed', duration: 3, image: { id: 1, url: '/img1.jpg', alt: 'Slide 1' } },
        { blockType: 'imageBlock', advanceMode: 'timed', duration: 3, image: { id: 2, url: '/img2.jpg', alt: 'Slide 2' } },
      ],
    }
    render(<SlideEngine program={prog} />)

    act(() => { vi.advanceTimersByTime(3 * 1000 + 500) })
    expect(screen.getByAltText('Slide 2')).toBeTruthy()

    vi.useRealTimers()
  })

  it('timed slide does not advance before duration', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    const prog: Program = {
      ...baseProgram,
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed', duration: 5, image: { id: 1, url: '/img1.jpg', alt: 'Slide 1' } },
        { blockType: 'imageBlock', advanceMode: 'timed', duration: 5, image: { id: 2, url: '/img2.jpg', alt: 'Slide 2' } },
      ],
    }
    render(<SlideEngine program={prog} />)

    // At 4 seconds, still on slide 1
    act(() => { vi.advanceTimersByTime(4 * 1000) })
    const slides1 = screen.queryAllByAltText('Slide 1')
    expect(slides1.length).toBe(1)
    expect(screen.queryByAltText('Slide 2')).toBeNull()

    vi.useRealTimers()
  })

  it('onProgramEnd fires after last timed slide', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    const onEnd = vi.fn()
    const prog: Program = {
      ...baseProgram,
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed', duration: 2, image: { id: 1, url: '/img1.jpg', alt: 'Slide 1' } },
      ],
    }
    render(<SlideEngine program={prog} onProgramEnd={onEnd} />)

    act(() => { vi.advanceTimersByTime(2 * 1000 + 500) })
    expect(onEnd).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('visibilitychange to visible catches up overdue timed slide', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    const prog: Program = {
      ...baseProgram,
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed', duration: 5, image: { id: 1, url: '/img1.jpg', alt: 'Slide 1' } },
        { blockType: 'imageBlock', advanceMode: 'timed', duration: 5, image: { id: 2, url: '/img2.jpg', alt: 'Slide 2' } },
      ],
    }
    render(<SlideEngine program={prog} />)

    expect(screen.getByAltText('Slide 1')).toBeTruthy()

    // Jump the system clock past the advance point without firing setInterval
    vi.setSystemTime(new Date('2024-01-01T00:00:20Z'))

    // Still on slide 1 — interval was frozen and never fired
    expect(screen.getByAltText('Slide 1')).toBeTruthy()

    // Simulate wake: page becomes visible, visibility handler fires
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(screen.getByAltText('Slide 2')).toBeTruthy()

    vi.useRealTimers()
  })
})
