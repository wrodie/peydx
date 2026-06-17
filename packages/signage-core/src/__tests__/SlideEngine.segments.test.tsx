import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { SlideEngine } from '../SlideEngine'
import type { Program } from '../types'

describe('SlideEngine segments', () => {
  afterEach(() => {
    vi.restoreAllMocks()
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
})
