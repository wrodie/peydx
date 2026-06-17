import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { SlideEngine } from '../SlideEngine'
import type { Program } from '../types'

describe('SlideEngine transitions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeProgram(slides: any[]): Program {
    return { id: 1, title: 'Test Program', slides }
  }

  it('applies fade animation style for fade transition', () => {
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'timed',
      duration: 5,
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
      transition: 'fade',
    }])
    const { container } = render(<SlideEngine program={prog} />)
    const wrapper = container.querySelector('.slide-slide-wrapper') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.animation).toContain('signageFadeIn')
  })

  it('applies slide animation style for slide transition', () => {
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'timed',
      duration: 5,
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
      transition: 'slide',
    }])
    const { container } = render(<SlideEngine program={prog} />)
    const wrapper = container.querySelector('.slide-slide-wrapper') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.animation).toContain('signageSlideIn')
  })

  it('uses no animation for cut or unspecified transition', () => {
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'timed',
      duration: 5,
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
      transition: 'cut',
    }])
    const { container } = render(<SlideEngine program={prog} />)
    const wrapper = container.querySelector('.slide-slide-wrapper') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.animation).toBe('')
  })
})
