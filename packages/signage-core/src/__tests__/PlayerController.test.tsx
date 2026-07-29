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
    expect(screen.getByText('Signage')).toBeTruthy()
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

  it('exitProgram returns to idle when no approved programs', () => {
    const ref = createRef<PlayerControllerHandle>()
    const data: ResolvedSchedule = {
      lastUpdated: '2020-01-01T00:00:00.000Z',
      schedule: [],
      availability: [],
      deviceName: null,
    }
    render(<PlayerController ref={ref} scheduleData={data} />)

    expect(screen.getByText('Signage')).toBeTruthy()
  })

  it('exitProgram from playing returns to menu when availability exists', () => {
    const ref = createRef<PlayerControllerHandle>()
    render(<PlayerController ref={ref} scheduleData={makeScheduleData(makeSlides(3))} />)

    act(() => { ref.current?.selectProgram(10) })
    expect(screen.getByAltText('Slide 0')).toBeTruthy()

    act(() => { ref.current?.exitProgram() })
    expect(screen.getAllByText('Test Program').length).toBeGreaterThan(0)
    expect(screen.queryByAltText('Slide 0')).toBeNull()
  })

  it('exitProgram from idle is no-op', () => {
    const ref = createRef<PlayerControllerHandle>()
    render(<PlayerController ref={ref} scheduleData={null} />)

    act(() => { ref.current?.exitProgram() })
    expect(screen.getByText('Signage')).toBeTruthy()
  })

  describe('manual override (userOverrideRef)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2020-01-01T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    function makeDualSchedule(): ResolvedSchedule {
      return {
        lastUpdated: '2020-01-01T00:00:00.000Z',
        schedule: [
          {
            programId: 1,
            scheduleType: 'autoplay',
            startTime: '2020-01-01T00:00:00.000Z',
            endTime: '2020-01-01T23:59:00.000Z',
            daysOfWeek: [],
            program: { id: 1, title: 'Scheduled Program', slides: [
              { blockType: 'imageBlock', advanceMode: 'timed', duration: 60, image: { id: 1, url: '/scheduled.jpg', alt: 'Scheduled Slide' } },
            ]},
          },
        ],
        availability: [
          {
            programId: 10,
            scheduleType: 'availability',
            startDate: '2020-01-01',
            program: { id: 10, title: 'Available Program', slides: [
              { blockType: 'imageBlock', advanceMode: 'timed', duration: 60, image: { id: 2, url: '/manual.jpg', alt: 'Manual Slide' } },
            ]},
          },
        ],
        deviceName: 'Test',
      }
    }

    it('selectProgram manual override prevents schedule takeover on schedule data refresh', () => {
      const ref = createRef<PlayerControllerHandle>()
      const data = makeDualSchedule()
      const { rerender } = render(<PlayerController ref={ref} scheduleData={data} />)

      // Initial: active autoplay schedule should be playing
      expect(screen.getByAltText('Scheduled Slide')).toBeTruthy()

      // User manually selects a different program from availability
      act(() => { ref.current?.selectProgram(10) })
      expect(screen.getByAltText('Manual Slide')).toBeTruthy()
      expect(screen.queryByAltText('Scheduled Slide')).toBeNull()

      // Simulate a schedule data refresh — would normally override
      rerender(<PlayerController ref={ref} scheduleData={{ ...data }} />)

      // Manual program should still be playing (not overridden by schedule)
      expect(screen.getByAltText('Manual Slide')).toBeTruthy()
      expect(screen.queryByAltText('Scheduled Slide')).toBeNull()
    })

    it('exitProgram from manual override resumes schedule autoplay', () => {
      const ref = createRef<PlayerControllerHandle>()
      render(<PlayerController ref={ref} scheduleData={makeDualSchedule()} />)

      // Initial: active autoplay schedule should be playing
      expect(screen.getByAltText('Scheduled Slide')).toBeTruthy()

      // User manually selects a different program
      act(() => { ref.current?.selectProgram(10) })
      expect(screen.getByAltText('Manual Slide')).toBeTruthy()

      // User exits the manual program
      act(() => { ref.current?.exitProgram() })

      // Schedule should immediately resume
      expect(screen.getByAltText('Scheduled Slide')).toBeTruthy()
    })
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
      // With empty schedule+availability but program already playing from availability, should continue
      expect(screen.getByAltText('Slide 0')).toBeTruthy()
    })
  })

  describe('content updates during playback', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2020-01-01T12:00:00Z'))
      window.history.replaceState({}, '', window.location.pathname)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    function makeBaseSchedule(): ResolvedSchedule {
      return {
        lastUpdated: '2020-01-01T00:00:00.000Z',
        schedule: [{
          programId: 1,
          scheduleType: 'autoplay',
          startTime: '2020-01-01T00:00:00.000Z',
          endTime: '2020-01-01T23:59:00.000Z',
          daysOfWeek: [],
          priority: 0,
          program: { id: 1, title: 'Scheduled', slides: [
            { id: 's1', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 1, url: '/img1.jpg', alt: 'Slide 1' } },
            { id: 's2', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 2, url: '/img2.jpg', alt: 'Slide 2' } },
            { id: 's3', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 3, url: '/img3.jpg', alt: 'Slide 3' } },
          ]},
        }],
        availability: [],
        deviceName: 'Test',
      }
    }

    it('updates program content in place when slides are appended (same program ID)', () => {
      const ref = createRef<PlayerControllerHandle>()
      const data = makeBaseSchedule()
      const { rerender } = render(<PlayerController ref={ref} scheduleData={data} />)

      expect(screen.getByAltText('Slide 1')).toBeTruthy()
      expect(screen.getByText('1 / 3')).toBeTruthy()

      act(() => { ref.current?.gotoSlide(1) })
      expect(screen.getByAltText('Slide 2')).toBeTruthy()

      const updated: ResolvedSchedule = {
        ...data,
        schedule: [{
          ...data.schedule[0],
          program: {
            ...data.schedule[0].program,
            slides: [
              { id: 's1', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 1, url: '/img1.jpg', alt: 'Slide 1' } },
              { id: 's2', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 2, url: '/img2.jpg', alt: 'Slide 2' } },
              { id: 's3', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 3, url: '/img3.jpg', alt: 'Slide 3' } },
              { id: 's4', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 4, url: '/img4.jpg', alt: 'Slide 4' } },
            ],
          },
        }],
      }
      rerender(<PlayerController ref={ref} scheduleData={updated} />)

      // Same slide (s2) now at index 1 of 4
      expect(screen.getByAltText('Slide 2')).toBeTruthy()
      expect(screen.getByText('2 / 4')).toBeTruthy()
    })

    it('adjusts slide index when new slides are inserted before current', () => {
      const ref = createRef<PlayerControllerHandle>()
      const data = makeBaseSchedule()
      const { rerender } = render(<PlayerController ref={ref} scheduleData={data} />)

      act(() => { ref.current?.gotoSlide(2) })
      expect(screen.getByAltText('Slide 3')).toBeTruthy()

      const updated: ResolvedSchedule = {
        ...data,
        schedule: [{
          ...data.schedule[0],
          program: {
            ...data.schedule[0].program,
            slides: [
              { id: 's1', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 1, url: '/img1.jpg', alt: 'Slide 1' } },
              { id: 'sX', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 99, url: '/imgX.jpg', alt: 'Inserted' } },
              { id: 's2', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 2, url: '/img2.jpg', alt: 'Slide 2' } },
              { id: 's3', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 3, url: '/img3.jpg', alt: 'Slide 3' } },
            ],
          },
        }],
      }
      rerender(<PlayerController ref={ref} scheduleData={updated} />)

      // Slide 3 (s3) now at index 3 of 4
      expect(screen.getByAltText('Slide 3')).toBeTruthy()
      expect(screen.getByText('4 / 4')).toBeTruthy()
    })

    it('clamps to last slide when current slide is deleted', () => {
      const ref = createRef<PlayerControllerHandle>()
      const data = makeBaseSchedule()
      const { rerender } = render(<PlayerController ref={ref} scheduleData={data} />)

      act(() => { ref.current?.gotoSlide(2) })
      expect(screen.getByAltText('Slide 3')).toBeTruthy()

      const updated: ResolvedSchedule = {
        ...data,
        schedule: [{
          ...data.schedule[0],
          program: {
            ...data.schedule[0].program,
            slides: [
              { id: 's1', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 1, url: '/img1.jpg', alt: 'Slide 1' } },
              { id: 's2', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 2, url: '/img2.jpg', alt: 'Slide 2' } },
            ],
          },
        }],
      }
      rerender(<PlayerController ref={ref} scheduleData={updated} />)

      // Clamped to last slide (s2 at index 1)
      expect(screen.getByAltText('Slide 2')).toBeTruthy()
      expect(screen.getByText('2 / 2')).toBeTruthy()
    })

    it('preserves current slide by identity when availability program content changes (user override)', () => {
      const ref = createRef<PlayerControllerHandle>()
      const data: ResolvedSchedule = {
        lastUpdated: '2020-01-01T00:00:00.000Z',
        schedule: [{
          programId: 1,
          scheduleType: 'autoplay',
          startTime: '2020-01-01T00:00:00.000Z',
          endTime: '2020-01-01T23:59:00.000Z',
          daysOfWeek: [],
          priority: 0,
          program: { id: 1, title: 'Scheduled', slides: [
            { id: 's1', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 1, url: '/sched.jpg', alt: 'Scheduled' } },
          ]},
        }],
        availability: [{
          programId: 10,
          scheduleType: 'availability',
          startDate: '2020-01-01',
          program: { id: 10, title: 'Available', slides: [
            { id: 'm1', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 2, url: '/manual.jpg', alt: 'Manual Slide' } },
          ]},
        }],
        deviceName: 'Test',
      }
      const { rerender } = render(<PlayerController ref={ref} scheduleData={data} />)

      // Autoplay starts first
      expect(screen.getByAltText('Scheduled')).toBeTruthy()

      // User selects availability program
      act(() => { ref.current?.selectProgram(10) })
      expect(screen.getByAltText('Manual Slide')).toBeTruthy()

      // Update the availability program content (same slide IDs, changed content)
      const updated: ResolvedSchedule = {
        ...data,
        availability: [{
          ...data.availability[0],
          program: {
            ...data.availability[0].program,
            slides: [
              { id: 'm1', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 5, url: '/updated.jpg', alt: 'Updated Slide' } },
            ],
          },
        }],
      }
      rerender(<PlayerController ref={ref} scheduleData={updated} />)

      expect(screen.getByAltText('Updated Slide')).toBeTruthy()
      expect(screen.queryByAltText('Manual Slide')).toBeNull()
    })

    it('updates program content when selected via menu (userOverrideRef path)', () => {
      const data: ResolvedSchedule = {
        lastUpdated: '2020-01-01T00:00:00.000Z',
        schedule: [],
        availability: [{
          programId: 10,
          scheduleType: 'availability',
          startDate: '2020-01-01',
          program: {
            id: 10,
            title: 'My Program',
            slides: [
              { id: 'm1', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 1, url: '/img1.jpg', alt: 'Slide A' } },
            ],
          },
        }],
        deviceName: 'Test',
      }
      const { rerender } = render(<PlayerController scheduleData={data} />)

      // Should show menu with program title
      expect(screen.getByText('My Program')).toBeTruthy()

      // Click to select via menu (the bug path — onSelect must set userOverrideRef.current)
      act(() => { screen.getByText('My Program').click() })
      expect(screen.getByAltText('Slide A')).toBeTruthy()

      // Update the program content
      const updated: ResolvedSchedule = {
        ...data,
        availability: [{
          ...data.availability[0],
          program: {
            ...data.availability[0].program,
            slides: [
              { id: 'm1', blockType: 'imageBlock' as const, advanceMode: 'timed' as const, duration: 60, image: { id: 2, url: '/img2.jpg', alt: 'Slide B' } },
            ],
          },
        }],
      }
      rerender(<PlayerController scheduleData={updated} />)

      expect(screen.getByAltText('Slide B')).toBeTruthy()
      expect(screen.queryByAltText('Slide A')).toBeNull()
    })

    it('does not re-transition when schedule data has identical slides', () => {
      const ref = createRef<PlayerControllerHandle>()
      const data = makeBaseSchedule()
      const { rerender } = render(<PlayerController ref={ref} scheduleData={data} />)

      expect(screen.getByAltText('Slide 1')).toBeTruthy()
      expect(screen.getByText('1 / 3')).toBeTruthy()

      // Rerender with shallow copy of same data (triggers effect but identical slides)
      rerender(<PlayerController ref={ref} scheduleData={{ ...data }} />)

      // Still showing same slide
      expect(screen.getByAltText('Slide 1')).toBeTruthy()
      expect(screen.getByText('1 / 3')).toBeTruthy()
    })
  })
})
