import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'
import { SlideEngine, imageFillsViewport } from '../SlideEngine'
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

  it('scaleToFill default uses natural size and renders backdrop when thumbnailUrl present', () => {
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'manual',
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1', thumbnailUrl: '/thumb.jpg' },
    }])
    const { container } = render(<SlideEngine program={prog} />)
    act(() => { vi.advanceTimersByTime(1000) })
    const foreground = container.querySelector('.slide-foreground') as HTMLElement
    expect(foreground).toBeTruthy()
    expect(foreground.style.width).toBe('')
    expect(foreground.style.height).toBe('')
    const backdrop = container.querySelector('.slide-backdrop') as HTMLImageElement
    expect(backdrop).toBeTruthy()
    expect(backdrop.getAttribute('src')).toContain('thumb.jpg')
  })

  it('scaleToFill true fills viewport and renders backdrop', () => {
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'manual',
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1', thumbnailUrl: '/thumb.jpg' },
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
    expect(backdrop.getAttribute('src')).toContain('thumb.jpg')
  })

  it('scaleToFill false uses natural size and renders backdrop', () => {
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'manual',
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1', thumbnailUrl: '/thumb.jpg' },
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
    expect(backdrop.getAttribute('src')).toContain('thumb.jpg')
  })

  it('no thumbnailUrl renders no backdrop', () => {
    vi.useFakeTimers()
    const prog = makeProgram([{
      blockType: 'imageBlock',
      advanceMode: 'manual',
      image: { id: 1, url: '/img.jpg', alt: 'Slide 1' },
      scaleToFill: false,
    }])
    const { container } = render(<SlideEngine program={prog} />)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(container.querySelector('.slide-backdrop')).toBeNull()
  })

  it('hides backdrop when image aspect ratio matches viewport', () => {
    const origW = window.innerWidth
    const origH = window.innerHeight
    try {
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true, configurable: true })
      vi.useFakeTimers()
      const prog = makeProgram([{
        blockType: 'imageBlock',
        advanceMode: 'manual',
        image: { id: 1, url: '/img.jpg', alt: 'Slide 1', thumbnailUrl: '/thumb.jpg' },
      }])
      const { container } = render(<SlideEngine program={prog} />)
      act(() => { vi.advanceTimersByTime(1000) })
      const foreground = container.querySelector('.slide-foreground')!
      Object.defineProperty(foreground, 'naturalWidth', { get: () => 1920, configurable: true })
      Object.defineProperty(foreground, 'naturalHeight', { get: () => 1080, configurable: true })
      act(() => { foreground.dispatchEvent(new Event('load', { bubbles: true })) })
      expect(container.querySelector('.slide-backdrop')).toBeNull()
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: origW, writable: true, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: origH, writable: true, configurable: true })
    }
  })

  describe('imageFillsViewport', () => {
    it('returns true when aspect ratios match (16:9)', () => {
      expect(imageFillsViewport(1920, 1080, 1920, 1080)).toBe(true)
      expect(imageFillsViewport(1280, 720, 1920, 1080)).toBe(true)
    })

    it('returns false when aspect ratios differ', () => {
      expect(imageFillsViewport(1920, 1080, 1024, 768)).toBe(false)
    })

    it('returns false when viewport has zero dimension', () => {
      expect(imageFillsViewport(1920, 1080, 0, 1080)).toBe(false)
      expect(imageFillsViewport(1920, 1080, 1920, 0)).toBe(false)
    })
  })
})
