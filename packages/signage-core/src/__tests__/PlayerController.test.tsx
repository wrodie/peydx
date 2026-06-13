import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import React, { createRef } from 'react'
import { render, screen, act, cleanup } from '@testing-library/react'
import { PlayerController } from '../PlayerController'
import type { PlayerControllerHandle, ResolvedSchedule } from '../types'

function makeSlides(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    blockType: 'imageBlock' as const,
    advanceMode: 'timed' as const,
    duration: 60,
    image: { id: i + 1, url: `/img${i}.jpg`, alt: `Slide ${i}` },
  }))
}

function makeScheduleData(slides: any[]): ResolvedSchedule {
  return {
    lastUpdated: '2020-01-01T00:00:00.000Z',
    schedule: [],
    availability: [
      {
        programId: 10,
        scheduleType: 'availability',
        startDate: '2020-01-01',
        program: { id: 10, title: 'Test Program', slides },
      },
    ],
    deviceName: 'Test Device',
  }
}

describe('PlayerController', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('renders idle state when no schedule data', () => {
    render(<PlayerController scheduleData={null} />)
    expect(screen.getByText('No program scheduled')).toBeTruthy()
  })

  it('renders menu state when availability exists but no active autoplay', () => {
    render(<PlayerController scheduleData={makeScheduleData(makeSlides(1))} />)
    // Menu should show the available program title
    expect(screen.getAllByText('Test Program').length).toBeGreaterThan(0)
  })

  it('selectProgram transitions to playing with available program', () => {
    const ref = createRef<PlayerControllerHandle>()
    render(<PlayerController ref={ref} scheduleData={makeScheduleData(makeSlides(3))} />)

    act(() => { ref.current?.selectProgram(10) })

    // First slide image should be rendered
    expect(screen.getByAltText('Slide 0')).toBeTruthy()
  })

  it('selectProgram with unavailable program stays in current state', () => {
    const ref = createRef<PlayerControllerHandle>()
    render(<PlayerController ref={ref} scheduleData={makeScheduleData(makeSlides(1))} />)

    act(() => { ref.current?.selectProgram(999) })

    // Program 999 not in schedule/availability — no SlideEngine, still showing menu
    expect(screen.getAllByText('Test Program').length).toBeGreaterThan(0)
    expect(screen.queryByAltText('Slide 0')).toBeNull()
  })

  it('selectProgram with slideIndex starts at that slide', () => {
    const ref = createRef<PlayerControllerHandle>()
    render(<PlayerController ref={ref} scheduleData={makeScheduleData(makeSlides(5))} />)

    act(() => { ref.current?.selectProgram(10, 2) })

    expect(screen.getByAltText('Slide 2')).toBeTruthy()
  })

  it('selectProgram with slideIndex=0 starts at first slide', () => {
    const ref = createRef<PlayerControllerHandle>()
    render(<PlayerController ref={ref} scheduleData={makeScheduleData(makeSlides(5))} />)

    act(() => { ref.current?.selectProgram(10, 0) })

    expect(screen.getByAltText('Slide 0')).toBeTruthy()
  })

  it('selectProgram with default slideIndex starts at first slide', () => {
    const ref = createRef<PlayerControllerHandle>()
    render(<PlayerController ref={ref} scheduleData={makeScheduleData(makeSlides(5))} />)

    act(() => { ref.current?.selectProgram(10) })

    expect(screen.getByAltText('Slide 0')).toBeTruthy()
  })

  it('selectProgram with slideIndex=4 starts at last slide', () => {
    const ref = createRef<PlayerControllerHandle>()
    render(<PlayerController ref={ref} scheduleData={makeScheduleData(makeSlides(5))} />)

    act(() => { ref.current?.selectProgram(10, 4) })

    expect(screen.getByAltText('Slide 4')).toBeTruthy()
  })

  describe('URL program param (?program=&slide=)', () => {
    beforeEach(() => {
      window.history.replaceState({}, '', window.location.pathname)
    })

    it('transitions to playing with available program, skipping menu state', () => {
      window.history.replaceState({}, '', '?program=10')
      render(<PlayerController scheduleData={makeScheduleData(makeSlides(3))} />)
      expect(screen.getByAltText('Slide 0')).toBeTruthy()
    })

    it('does nothing for unavailable program', () => {
      window.history.replaceState({}, '', '?program=999')
      render(<PlayerController scheduleData={makeScheduleData(makeSlides(1))} />)
      expect(screen.getByText('Test Program')).toBeTruthy()
    })

    it('starts at the given slide index', () => {
      window.history.replaceState({}, '', '?program=10&slide=3')
      render(<PlayerController scheduleData={makeScheduleData(makeSlides(5))} />)
      expect(screen.getByAltText('Slide 3')).toBeTruthy()
    })

    it('is consumed only once, does not prevent future auto-play', () => {
      window.history.replaceState({}, '', '?program=10')
      const { rerender } = render(<PlayerController scheduleData={makeScheduleData(makeSlides(3))} />)
      expect(screen.getByAltText('Slide 0')).toBeTruthy()

      // Simulate a schedule update with empty data
      const emptySchedule: ResolvedSchedule = { lastUpdated: '2020-06-01T00:00:00.000Z', schedule: [], availability: [], deviceName: 'Test' }
      rerender(<PlayerController scheduleData={emptySchedule} />)

      // initial program was already consumed — falls through to normal resolution
      // With empty schedule+availability, should go to idle
      expect(screen.queryByAltText('Slide 0')).toBeNull()
      expect(screen.getByText('No program scheduled')).toBeTruthy()
    })
  })
})
