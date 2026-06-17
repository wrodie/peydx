import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { SlideEngine } from '../SlideEngine'
import type { Program } from '../types'

describe('SlideEngine audio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeProgram(slides: any[], overrides?: Partial<Program>): Program {
    return { id: 1, title: 'Test Program', slides, ...overrides }
  }

  it('renders audio element for audio slide', () => {
    const prog = makeProgram([{
      blockType: 'audioBlock',
      advanceMode: 'onEnd',
      audio: { id: 1, url: 'https://example.com/song.mp3' },
    }])
    const { container } = render(<SlideEngine program={prog} />)
    const audio = container.querySelector('audio')
    expect(audio).toBeTruthy()
  })

  it('renders audio icon SVG for audio slide', () => {
    const prog = makeProgram([{
      blockType: 'audioBlock',
      advanceMode: 'onEnd',
      audio: { id: 1, url: 'https://example.com/song.mp3' },
    }])
    const { container } = render(<SlideEngine program={prog} />)
    const icon = container.querySelector('.slide-audio-icon')
    expect(icon).toBeTruthy()
  })

  it('renders segment without background audio fine', () => {
    const prog = makeProgram([{
      blockType: 'segmentBlock',
      id: 'seg1',
      advanceMode: 'slides',
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed', image: { id: 1, url: '/img.jpg' } },
      ],
    }])
    const { container } = render(<SlideEngine program={prog} />)
    expect(container.querySelector('img')).toBeTruthy()
  })
})
