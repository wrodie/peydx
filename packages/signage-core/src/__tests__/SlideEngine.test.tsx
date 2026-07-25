import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { SlideEngine } from '../SlideEngine'
import type { Program } from '../types'

let decodeResolve: (() => void) | null = null

function createImageMock() {
  const self = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    decode: vi.fn().mockReturnValue(new Promise<void>((resolve) => {
      decodeResolve = resolve
    })),
  }
  Object.defineProperty(self, 'src', {
    set(_: string) {
      setTimeout(() => self.onload?.(), 0)
    },
    get() { return '' },
  })
  return self
}

// Mock YouTube IFrame API
const mockYT = {
  Player: vi.fn(),
}
;(window as any).YT = mockYT
;(window as any).onYouTubeIframeAPIReady = null

describe('SlideEngine', () => {
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

  it('holds image at opacity 0 until decode resolves for a non-cached URL', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('Image', vi.fn(function() { return createImageMock() }))

    const prog: Program = {
      ...baseProgram,
      slides: [{
        blockType: 'imageBlock',
        advanceMode: 'manual',
        image: { id: 1, url: 'https://example.com/uncached.svg', alt: 'Slide' },
        transition: 'fade',
      }],
    }

    const { container } = render(<SlideEngine program={prog} />)

    await act(() => vi.advanceTimersByTime(10))

    const wrapper = container.querySelector('.slide-slide-wrapper') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.opacity).toBe('0')

    await act(() => {
      decodeResolve?.()
    })

    expect(wrapper.style.opacity).toBe('')

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})
