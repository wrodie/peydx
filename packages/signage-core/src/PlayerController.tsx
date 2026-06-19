import { useEffect, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { SlideEngine } from './SlideEngine'
import { MenuEngine } from './MenuEngine'
import type { Program, PlayerState, ScheduleEntry, AvailabilityEntry, ResolvedSchedule, KeyConfig, Slide } from './types'
import { flattenProgram } from './flattenProgram'
import { mergeKeyConfig, normalizeKeyCode } from './keyConfig'
import type { SlideEngineHandle } from './SlideEngine'

export interface PlayerControllerHandle {
  openMenu: () => void
  exitProgram: () => void
  selectItem: () => void
  nextSlide: () => void
  prevSlide: () => void
  gotoSlide: (index: number) => void
  togglePause: () => void
  selectProgram: (programId: number, slideIndex?: number) => void
}

interface PlayerControllerProps {
  scheduleData: ResolvedSchedule | null
  keyConfig?: Partial<KeyConfig>
  onSlideChange?: (index: number) => void
  onStateChange?: (state: PlayerState, programId?: number, menuIndex?: number) => void
  onPauseChange?: (paused: boolean) => void
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function stripTime(iso: string): string {
  return new Date(iso).toISOString().split('T')[0]
}

function timeOfDayMinutes(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export function resolveScheduleState(
  scheduleEntries: ScheduleEntry[],
  availabilityEntries: AvailabilityEntry[],
): {
  activeAutoPlay: ScheduleEntry | null
  availablePrograms: AvailabilityEntry[]
} {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const todayDayName = DAY_NAMES[now.getUTCDay()]

  const availablePrograms = availabilityEntries.filter((e) => {
    if (!e.startDate) return false
    const start = new Date(e.startDate)
    const end = e.endDate ? new Date(e.endDate) : null
    const todayDate = new Date(today)
    if (start > todayDate) return false
    if (end) {
      const endPlusGrace = new Date(end.getTime() + 24 * 60 * 60 * 1000)
      if (now > endPlusGrace) return false
    }
    return true
  })

  let activeAutoPlay: ScheduleEntry | null = null
  for (const entry of scheduleEntries) {
    if (!entry.startTime) continue

    const daysOfWeek: string[] = entry.daysOfWeek || []
    const isRecurring = daysOfWeek.length > 0

    if (isRecurring) {
      if (!daysOfWeek.includes(todayDayName)) continue
    } else {
      if (stripTime(entry.startTime) !== today) continue
    }

    if (entry.untilDate && new Date(entry.untilDate).toISOString().split('T')[0] < today) continue

    const startMin = timeOfDayMinutes(entry.startTime)
    const endMin = entry.endTime ? timeOfDayMinutes(entry.endTime) : startMin + 60
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()

    if (nowMin < startMin || nowMin >= endMin) continue

    if (!activeAutoPlay || new Date(entry.startTime) > new Date(activeAutoPlay.startTime)) {
      activeAutoPlay = entry
    }
  }

  return { activeAutoPlay, availablePrograms }
}

function getNextAutoPlay(scheduleEntries: ScheduleEntry[]): ScheduleEntry | null {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const todayDayName = DAY_NAMES[now.getUTCDay()]
  let next: ScheduleEntry | null = null

  for (const entry of scheduleEntries) {
    if (!entry.startTime) continue

    const daysOfWeek: string[] = entry.daysOfWeek || []
    const isRecurring = daysOfWeek.length > 0

    if (isRecurring) {
      if (!daysOfWeek.includes(todayDayName)) continue
    } else {
      if (stripTime(entry.startTime) !== today) continue
    }

    if (entry.untilDate && new Date(entry.untilDate).toISOString().split('T')[0] < today) continue

    const start = new Date(entry.startTime)
    if (start > now) {
      if (!next || start < new Date(next.startTime)) {
        next = entry
      }
    }
  }
  return next
}

export const PlayerController = forwardRef<PlayerControllerHandle, PlayerControllerProps>(
  ({ scheduleData, keyConfig: userKeyConfig, onSlideChange, onStateChange, onPauseChange }, ref) => {
    const [playerState, setPlayerState] = useState<PlayerState>('idle')
    const [activeProgram, setActiveProgram] = useState<Program | null>(null)
    const [programKey, setProgramKey] = useState(0)
    const [pendingSlideIndex, setPendingSlideIndex] = useState<number>(0)
    const [menuIndex, setMenuIndex] = useState(0)
    const [showExitOverlay, setShowExitOverlay] = useState(false)
    const [availableEntries, setAvailableEntries] = useState<AvailabilityEntry[]>([])
    const [currentScheduleEntry, setCurrentScheduleEntry] = useState<{ program?: Program; endTime?: string } | null>(null)
    const [showPaused, setShowPaused] = useState(false)
    const [currentTime, setCurrentTime] = useState('')
    const pausedRef = useRef(false)
    const flattenedSlidesRef = useRef<Slide[]>([])

    const engineRef = useRef<SlideEngineHandle>(null)
    const menuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const stateRef = useRef<PlayerState>(playerState)
    const activeProgramRef = useRef<Program | null>(activeProgram)
    const menuIndexRef = useRef(menuIndex)
    const currentScheduleEntryRef = useRef<{ program?: Program; endTime?: string } | null>(null)
    const availableEntriesRef = useRef<AvailabilityEntry[]>([])
    const scheduleDataRef = useRef<ResolvedSchedule | null>(null)
    const showExitOverlayRef = useRef(false)
    const initialUrlProgramConsumed = useRef(false)

    useEffect(() => { stateRef.current = playerState }, [playerState])
    useEffect(() => { activeProgramRef.current = activeProgram }, [activeProgram])
    useEffect(() => { menuIndexRef.current = menuIndex }, [menuIndex])
    useEffect(() => { currentScheduleEntryRef.current = currentScheduleEntry }, [currentScheduleEntry])
    useEffect(() => { availableEntriesRef.current = availableEntries }, [availableEntries])
    useEffect(() => { scheduleDataRef.current = scheduleData }, [scheduleData])
    useEffect(() => { showExitOverlayRef.current = showExitOverlay }, [showExitOverlay])

    const keys = mergeKeyConfig(userKeyConfig)

    const resetPause = useCallback(() => {
      setShowPaused(false)
      pausedRef.current = false
    }, [])

    const handleSlideChange = useCallback((index: number) => {
      resetPause()
      onSlideChange?.(index)
    }, [onSlideChange, resetPause])

    
    const emitState = useCallback(
      (state: PlayerState, programId?: number, idx?: number) => {
        onStateChange?.(state, programId, idx)
      },
      [onStateChange],
    )

    const clearMenuTimeout = useCallback(() => {
      if (menuTimeoutRef.current) {
        clearTimeout(menuTimeoutRef.current)
        menuTimeoutRef.current = null
      }
    }, [])

    const transitionTo = useCallback(
      (state: PlayerState, program?: Program | null, entry?: { program?: Program; endTime?: string } | null, index?: number, availEntries?: AvailabilityEntry[], slideIndex: number = 0) => {
        clearMenuTimeout()
        setPlayerState(state)
        setShowExitOverlay(false)
        setShowPaused(false)
        pausedRef.current = false
        if (availEntries) setAvailableEntries(availEntries)
        if (program) {
          setActiveProgram(program)
          flattenedSlidesRef.current = flattenProgram(program).slides
          setProgramKey((k) => k + 1)
          setPendingSlideIndex(slideIndex)
          setCurrentScheduleEntry(entry ?? null)
        } else if (program === null) {
          setActiveProgram(null)
          flattenedSlidesRef.current = []
          setCurrentScheduleEntry(null)
        }
        if (index !== undefined) setMenuIndex(index)
        if (state !== 'playing') setCurrentScheduleEntry(null)
        emitState(state, program?.id, index)
      },
      [clearMenuTimeout, emitState],
    )

    const getResolvedState = useCallback(() => {
      const sched = scheduleDataRef.current?.schedule ?? []
      const avail = scheduleDataRef.current?.availability ?? []
      return resolveScheduleState(sched, avail)
    }, [])
    const handleProgramEnd = useCallback(() => {
      const { availablePrograms } = getResolvedState()
      if (availablePrograms.length > 0 && !scheduleDataRef.current?.hideProgramList) {
        setAvailableEntries(availablePrograms)
        setMenuIndex(0)
        setPlayerState('menu')
        setActiveProgram(null)
        setCurrentScheduleEntry(null)
        emitState('menu', undefined, 0)
      } else {
        setActiveProgram(null)
        setCurrentScheduleEntry(null)
        setPlayerState('idle')
        emitState('idle')
      }
    }, [emitState, getResolvedState])


    const openMenu = useCallback(() => {
      if (stateRef.current === 'playing' && activeProgramRef.current) {
        setMenuIndex(0)
        setShowExitOverlay(true)
        menuTimeoutRef.current = setTimeout(() => {
          setShowExitOverlay(false)
          menuTimeoutRef.current = null
        }, 30000)
        return
      }

      if (scheduleDataRef.current?.hideProgramList) return

      const { availablePrograms } = getResolvedState()
      const programTitles = availablePrograms.map((e) => ({ id: e.programId, title: e.program.title, department: e.program.department ?? undefined }))
      const menuPrograms = programTitles

      if (menuPrograms.length > 0) {
        setAvailableEntries(availablePrograms)
        transitionTo('menu', null, null, 0, availablePrograms)
      } else if (stateRef.current === 'idle') {
        setAvailableEntries([])
        transitionTo('idle', null, null)
      }
    }, [getResolvedState, transitionTo])

    const exitProgram = useCallback(() => {
      clearMenuTimeout()
      setShowExitOverlay(false)

      const { availablePrograms } = getResolvedState()
      if (availablePrograms.length > 0 && !scheduleDataRef.current?.hideProgramList) {
        setAvailableEntries(availablePrograms)
        setMenuIndex(0)
        setPlayerState('menu')
        setActiveProgram(null)
        setCurrentScheduleEntry(null)
        emitState('menu', undefined, 0)
      } else {
        setCurrentScheduleEntry(null)
        setActiveProgram(null)
        setPlayerState('idle')
        emitState('idle')
      }
    }, [clearMenuTimeout, getResolvedState, emitState])

    const selectItem = useCallback(() => {
      const entries = availableEntriesRef.current
      const idx = menuIndexRef.current
      if (playerState === 'menu' && entries.length > 0 && idx >= 0 && idx < entries.length) {
        const entry = entries[idx]
        transitionTo('playing', entry.program, entry, idx)
      }
    }, [playerState, transitionTo])

    const selectProgram = useCallback(
      (programId: number, slideIndex: number = 0) => {
        const entry = scheduleDataRef.current?.availability?.find((e) => e.programId === programId)
          || scheduleDataRef.current?.schedule?.find((e) => e.programId === programId)
        if (entry) {
          transitionTo('playing', entry.program, null, 0, undefined, slideIndex)
        }
      },
      [transitionTo],
    )

    const togglePause = useCallback(() => {
      if (playerState !== 'playing') return
      const els = engineRef.current?.getMediaElements()
      if (!els) return

      const idx = engineRef.current?.getCurrentIndex() ?? -1
      const blockType = flattenedSlidesRef.current[idx]?.blockType
      if (blockType !== 'videoBlock' && blockType !== 'audioBlock' && blockType !== 'youtubeBlock') return

      if (pausedRef.current) {
        if (blockType === 'videoBlock') els.video?.play()
        else if (blockType === 'audioBlock') els.audio?.play()
        else if (blockType === 'youtubeBlock') els.youtubePlayer?.playVideo()
      } else {
        if (blockType === 'videoBlock') els.video?.pause()
        else if (blockType === 'audioBlock') els.audio?.pause()
        else if (blockType === 'youtubeBlock') els.youtubePlayer?.pauseVideo()
      }

      setShowPaused((prev) => !prev)
      pausedRef.current = !pausedRef.current
      onPauseChange?.(pausedRef.current)
    }, [playerState, onPauseChange])

    useImperativeHandle(ref, () => ({
      openMenu,
      exitProgram,
      selectItem,
      nextSlide: () => engineRef.current?.nextSlide(),
      prevSlide: () => engineRef.current?.prevSlide(),
      gotoSlide: (index: number) => engineRef.current?.gotoSlide(index),
      togglePause,
      selectProgram,
    }), [openMenu, exitProgram, selectItem, selectProgram, togglePause])

    useEffect(() => {
      if (!scheduleData) return

      if (typeof window !== 'undefined' && !initialUrlProgramConsumed.current) {
        const params = new URLSearchParams(window.location.search)
        const urlProgramId = parseInt(params.get('program') || '', 10)
        if (!isNaN(urlProgramId)) {
          const entry = scheduleData.schedule.find((e) => e.programId === urlProgramId)
            || scheduleData.availability.find((e) => e.programId === urlProgramId)
          if (entry) {
            initialUrlProgramConsumed.current = true
            const urlSlideIndex = Math.max(0, parseInt(params.get('slide') || '0', 10))
            transitionTo('playing', entry.program, entry, 0, undefined, urlSlideIndex)
            return
          }
        }
        initialUrlProgramConsumed.current = true
      }

      const { activeAutoPlay, availablePrograms } = resolveScheduleState(scheduleData.schedule, scheduleData.availability ?? [])
      const currentState = stateRef.current
      const currentProgramId = activeProgramRef.current?.id

      if (activeAutoPlay) {
        if (currentState !== 'playing' || currentProgramId !== activeAutoPlay.programId) {
          transitionTo('playing', activeAutoPlay.program, activeAutoPlay, 0, availablePrograms)
        }
      } else {
        setAvailableEntries(availablePrograms)
        if (currentState === 'playing' && currentScheduleEntryRef.current) {
          if (availablePrograms.length > 0) {
            if (!scheduleData?.hideProgramList) {
              transitionTo('menu', null, null, 0, availablePrograms)
            }
          } else {
            transitionTo('idle', null, null)
          }
        } else if (currentState === 'idle' && availablePrograms.length > 0) {
          if (scheduleData?.hideProgramList) {
            transitionTo('idle', null, null)
          } else {
            transitionTo('menu', null, null, 0, availablePrograms)
          }
        } else if (currentState === 'menu') {
          if (scheduleData?.hideProgramList) {
            transitionTo('idle', null, null)
          } else if (availablePrograms.length > 0) {
            transitionTo('menu', null, null, 0, availablePrograms)
          } else {
            transitionTo('idle', null, null)
          }
        }
      }
    }, [scheduleData, transitionTo])

    useEffect(() => {
      const menuCodes = normalizeKeyCode(keys.menu)
      const pauseCodes = normalizeKeyCode(keys.pause || 'KeyP')
      const handler = (e: KeyboardEvent) => {
        if (menuCodes.includes(e.code)) {
          e.preventDefault()
          if (showExitOverlayRef.current) {
            clearMenuTimeout()
            setShowExitOverlay(false)
            return
          }
          openMenu()
        }
        if (pauseCodes.includes(e.code)) {
          e.preventDefault()
          togglePause()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [keys, openMenu, clearMenuTimeout, togglePause])

    useEffect(() => {
      const sched = scheduleData
      if (!sched) return

      const interval = setInterval(() => {
        const next = getNextAutoPlay(sched.schedule)
        if (!next) return

        const now = new Date()
        const start = new Date(next.startTime)

        if (start <= now && start.getTime() > now.getTime() - 2000) {
          const currentState = stateRef.current
          const currentProgramId = activeProgramRef.current?.id
          if (currentState !== 'playing' || currentProgramId !== next.programId) {
            if (showExitOverlayRef.current) {
              clearMenuTimeout()
              setShowExitOverlay(false)
            }
            transitionTo('playing', next.program, next, 0)
          }
        }
      }, 1000)

      return () => clearInterval(interval)
    }, [scheduleData, transitionTo, clearMenuTimeout])

    useEffect(() => {
      if (playerState !== 'playing' || !currentScheduleEntry?.endTime) return

      const interval = setInterval(() => {
        if (new Date() >= new Date(currentScheduleEntry.endTime!)) {
          const schedule = scheduleDataRef.current
          const { availablePrograms } = resolveScheduleState(schedule?.schedule ?? [], schedule?.availability ?? [])
          if (availablePrograms.length > 0 && !schedule?.hideProgramList) {
            setAvailableEntries(availablePrograms)
            setMenuIndex(0)
            setPlayerState('menu')
            setActiveProgram(null)
            setCurrentScheduleEntry(null)
            emitState('menu', undefined, 0)
          } else if (availablePrograms.length > 0 && schedule?.hideProgramList) {
            return
          } else {
            setActiveProgram(null)
            setCurrentScheduleEntry(null)
            setPlayerState('idle')
            emitState('idle')
          }
        }
      }, 1000)

      return () => clearInterval(interval)
    }, [playerState, currentScheduleEntry, emitState])

    useEffect(() => {
      const tick = () => setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      tick()
      const interval = setInterval(tick, 30_000)
      return () => clearInterval(interval)
    }, [])

    useEffect(() => {
      return () => clearMenuTimeout()
    }, [clearMenuTimeout])

    if (playerState === 'playing' && activeProgram) {
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <SlideEngine
            ref={engineRef}
            key={programKey}
            program={activeProgram}
            initialSlideIndex={pendingSlideIndex}
            onSlideChange={handleSlideChange}
            onProgramEnd={activeProgram.loop ? undefined : handleProgramEnd}
            keyConfig={userKeyConfig}
          />
          {showExitOverlay && (
            <MenuEngine
              programs={[]}
              selectedIndex={0}
              onSelect={() => {}}
              onBack={() => {
                clearMenuTimeout()
                setShowExitOverlay(false)
              }}
              onExit={exitProgram}
              keyConfig={keys}
              title="Options"
              exitLabel="Exit Program"
              continueLabel="Continue"
            />
          )}
          {showPaused && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.4)',
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              <span style={{ color: 'white', fontSize: '3rem', fontWeight: 600, opacity: 0.8 }}>
                ⏸ Paused
              </span>
            </div>
          )}
        </div>
      )
    }

    if (playerState === 'menu') {
      const programTitles = availableEntries.map((e) => ({ id: e.programId, title: e.program.title, department: e.program.department ?? undefined }))
      return (
        <MenuEngine
          programs={programTitles}
          selectedIndex={menuIndex}
          onSelect={(idx) => {
            if (idx >= 0 && idx < availableEntries.length) {
              const entry = availableEntries[idx]
              transitionTo('playing', entry.program, entry, idx)
            }
          }}
          onBack={() => {
            if (activeProgram) {
              return
            }
            setPlayerState('idle')
            emitState('idle')
          }}
          keyConfig={keys}
          title="Select a Program"
          deviceName={scheduleData?.deviceName}
          defaultBackground={scheduleData?.defaultBackground}
        />
      )
    }

    return (
      <div className="menu-overlay">
        {scheduleData?.defaultBackground && (
          <img src={scheduleData.defaultBackground} className="menu-background" alt="" />
        )}
        <div className="menu-overlay-bg" />
        <div className="menu-top-bar">
          <span className="menu-top-bar-left">{scheduleData?.deviceName || 'Signage'}</span>
          <span className="menu-top-bar-right">{currentTime}</span>
        </div>
      </div>
    )
  },
)
