import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'
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
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'timed',
      duration: 5,
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
      transition: 'fade',
    }])
    const { container } = render(<SlideEngine program={prog} />)
    act(() => { vi.advanceTimersByTime(1000) })
    const wrapper = container.querySelector('.slide-slide-wrapper') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.animation).toContain('signageFadeIn')
  })

  it('applies slide animation style for slide transition', () => {
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'timed',
      duration: 5,
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
      transition: 'slide',
    }])
    const { container } = render(<SlideEngine program={prog} />)
    act(() => { vi.advanceTimersByTime(1000) })
    const wrapper = container.querySelector('.slide-slide-wrapper') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.animation).toContain('signageSlideIn')
  })

  it('uses no animation for cut or unspecified transition', () => {
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'timed',
      duration: 5,
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
      transition: 'cut',
    }])
    const { container } = render(<SlideEngine program={prog} />)
    act(() => { vi.advanceTimersByTime(1000) })
    const wrapper = container.querySelector('.slide-slide-wrapper') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.animation).toBe('')
  })

  it('scaleToFill default uses natural size and backdrop renders on initial render', () => {
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'manual',
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
    }])
    const { container } = render(<SlideEngine program={prog} />)
    act(() => { vi.advanceTimersByTime(1000) })
    const foreground = container.querySelector('.slide-foreground') as HTMLElement
    expect(foreground).toBeTruthy()
    expect(foreground.style.width).toBe('')
    expect(foreground.style.height).toBe('')
    const backdrop = container.querySelector('.slide-backdrop') as HTMLImageElement
    expect(backdrop).toBeTruthy()
    expect(backdrop.getAttribute('src')).toContain('/img.jpg')
  })

  it('scaleToFill true fills viewport and backdrop renders on initial render', () => {
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'manual',
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
      scaleToFill: true,
    }])
    const { container } = render(<SlideEngine program={prog} />)
    act(() => { vi.advanceTimersByTime(1000) })
    const foreground = container.querySelector('.slide-foreground') as HTMLElement
    expect(foreground).toBeTruthy()
    expect(foreground.style.width).toBe('100%')
    expect(foreground.style.height).toBe('100%')
    const backdrop = container.querySelector('.slide-backdrop') as HTMLImageElement
    expect(backdrop).toBeTruthy()
    expect(backdrop.getAttribute('src')).toContain('/img.jpg')
  })

  it('scaleToFill false uses natural size and backdrop renders on initial render', () => {
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'manual',
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
      scaleToFill: false,
    }])
    const { container } = render(<SlideEngine program={prog} />)
    act(() => { vi.advanceTimersByTime(1000) })
    const foreground = container.querySelector('.slide-foreground') as HTMLElement
    expect(foreground).toBeTruthy()
    expect(foreground.style.width).toBe('')
    expect(foreground.style.height).toBe('')
    const backdrop = container.querySelector('.slide-backdrop') as HTMLImageElement
    expect(backdrop).toBeTruthy()
    expect(backdrop.getAttribute('src')).toContain('/img.jpg')
  })

  it('backdrop renders after advance when aspect ratios differ', () => {
    vi.useFakeTimers()
    const prog = makeProgram([
      { blockType: 'imageBlock', advanceMode: 'timed', duration: 2, image: { id: 1, url: '/slide1.jpg', alt: 'S1' } },
      { blockType: 'imageBlock', advanceMode: 'timed', duration: 2, image: { id: 2, url: '/slide2.jpg', alt: 'S2' } },
    ])
    const { container } = render(<SlideEngine program={prog} />)
    act(() => { vi.advanceTimersByTime(4000) })
    const alt = container.querySelector('.slide-foreground')?.getAttribute('alt')
    expect(alt).toBe('S2')
    const backdrop = container.querySelector('.slide-backdrop') as HTMLImageElement
    expect(backdrop).toBeTruthy()
    expect(backdrop.getAttribute('src')).toContain('/slide2.jpg')
  })

  it('backdrop skipped after advance when aspect ratios match', () => {
    const origW = window.innerWidth
    const origH = window.innerHeight
    try {
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true, configurable: true })
      vi.useFakeTimers()
      const prog = makeProgram([
        { blockType: 'imageBlock', advanceMode: 'timed', duration: 2, image: { id: 1, url: '/slide1.jpg', alt: 'S1' } },
        { blockType: 'imageBlock', advanceMode: 'timed', duration: 2, image: { id: 2, url: '/slide2.jpg', alt: 'S2' } },
      ])
      const { container } = render(<SlideEngine program={prog} />)
      act(() => { vi.advanceTimersByTime(4000) })
      const alt = container.querySelector('.slide-foreground')?.getAttribute('alt')
      expect(alt).toBe('S2')
      expect(container.querySelector('.slide-backdrop')).toBeNull()
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: origW, writable: true, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: origH, writable: true, configurable: true })
    }
  })
})
