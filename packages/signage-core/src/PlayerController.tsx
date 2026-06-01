import { useEffect, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { SlideEngine } from './SlideEngine'
import { MenuEngine } from './MenuEngine'
import type { Program, PlayerState, ScheduleEntry, ResolvedSchedule, KeyConfig } from './types'
import { mergeKeyConfig } from './keyConfig'
import type { SlideEngineHandle } from './SlideEngine'

export interface PlayerControllerHandle {
  openMenu: () => void
  exitProgram: () => void
  selectItem: () => void
  nextSlide: () => void
  prevSlide: () => void
  gotoSlide: (index: number) => void
  selectProgram: (programId: number) => void
}

interface PlayerControllerProps {
  scheduleData: ResolvedSchedule | null
  keyConfig?: Partial<KeyConfig>
  onSlideChange?: (index: number) => void
  onStateChange?: (state: PlayerState, programId?: number, menuIndex?: number) => void
}

function getTodayStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function resolveScheduleState(schedule: ScheduleEntry[]): {
  activeAutoPlay: ScheduleEntry | null
  availablePrograms: ScheduleEntry[]
} {
  const now = new Date()
  const today = getTodayStr()

  const todayAvailability = schedule.filter(
    (e) => e.scheduleType === 'availability' && e.startTime.startsWith(today),
  )

  let activeAutoPlay: ScheduleEntry | null = null
  for (const entry of schedule) {
    if (entry.scheduleType !== 'autoplay') continue
    const start = new Date(entry.startTime)
    const end = entry.endTime ? new Date(entry.endTime) : null
    if (start <= now && (!end || now < end)) {
      if (!activeAutoPlay || new Date(entry.startTime) > new Date(activeAutoPlay.startTime)) {
        activeAutoPlay = entry
      }
    }
  }

  return { activeAutoPlay, availablePrograms: todayAvailability }
}

function getNextAutoPlay(schedule: ScheduleEntry[]): ScheduleEntry | null {
  const now = new Date()
  let next: ScheduleEntry | null = null
  for (const entry of schedule) {
    if (entry.scheduleType !== 'autoplay') continue
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
  ({ scheduleData, keyConfig: userKeyConfig, onSlideChange, onStateChange }, ref) => {
    const [playerState, setPlayerState] = useState<PlayerState>('idle')
    const [activeProgram, setActiveProgram] = useState<Program | null>(null)
    const [programKey, setProgramKey] = useState(0)
    const [pendingSlideIndex, setPendingSlideIndex] = useState<number>(0)
    const [menuIndex, setMenuIndex] = useState(0)
    const [showExitOverlay, setShowExitOverlay] = useState(false)
    const [availableEntries, setAvailableEntries] = useState<ScheduleEntry[]>([])
    const [currentScheduleEntry, setCurrentScheduleEntry] = useState<ScheduleEntry | null>(null)

    const engineRef = useRef<SlideEngineHandle>(null)
    const menuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const stateRef = useRef<PlayerState>(playerState)
    const activeProgramRef = useRef<Program | null>(activeProgram)
    const menuIndexRef = useRef(menuIndex)
    const currentScheduleEntryRef = useRef<ScheduleEntry | null>(null)
    const availableEntriesRef = useRef<ScheduleEntry[]>([])
    const scheduleDataRef = useRef<ResolvedSchedule | null>(null)
    const showExitOverlayRef = useRef(false)

    useEffect(() => { stateRef.current = playerState }, [playerState])
    useEffect(() => { activeProgramRef.current = activeProgram }, [activeProgram])
    useEffect(() => { menuIndexRef.current = menuIndex }, [menuIndex])
    useEffect(() => { currentScheduleEntryRef.current = currentScheduleEntry }, [currentScheduleEntry])
    useEffect(() => { availableEntriesRef.current = availableEntries }, [availableEntries])
    useEffect(() => { scheduleDataRef.current = scheduleData }, [scheduleData])
    useEffect(() => { showExitOverlayRef.current = showExitOverlay }, [showExitOverlay])

    const keys = mergeKeyConfig(userKeyConfig)

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
      (state: PlayerState, program?: Program | null, entry?: ScheduleEntry | null, index?: number, availEntries?: ScheduleEntry[]) => {
        clearMenuTimeout()
        setPlayerState(state)
        setShowExitOverlay(false)
        if (availEntries) setAvailableEntries(availEntries)
        if (program) {
          setActiveProgram(program)
          setProgramKey((k) => k + 1)
          setPendingSlideIndex(0)
          setCurrentScheduleEntry(entry ?? null)
        } else if (program === null) {
          setActiveProgram(null)
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
      return resolveScheduleState(sched)
    }, [])

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

      const { availablePrograms } = getResolvedState()
      const programTitles = availablePrograms.map((e) => ({ id: e.programId, title: e.program.title }))
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
      if (availablePrograms.length > 0) {
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
      (programId: number) => {
        const entry = scheduleDataRef.current?.schedule?.find((e) => e.programId === programId)
        if (entry) {
          transitionTo('playing', entry.program, entry, 0)
        }
      },
      [transitionTo],
    )

    useImperativeHandle(ref, () => ({
      openMenu,
      exitProgram,
      selectItem,
      nextSlide: () => engineRef.current?.nextSlide(),
      prevSlide: () => engineRef.current?.prevSlide(),
      gotoSlide: (index: number) => engineRef.current?.gotoSlide(index),
      selectProgram,
    }), [openMenu, exitProgram, selectItem, selectProgram])

    useEffect(() => {
      if (!scheduleData) return

      const { activeAutoPlay, availablePrograms } = resolveScheduleState(scheduleData.schedule)
      const currentState = stateRef.current
      const currentProgramId = activeProgramRef.current?.id

      if (activeAutoPlay) {
        if (currentState !== 'playing' || currentProgramId !== activeAutoPlay.programId) {
          transitionTo('playing', activeAutoPlay.program, activeAutoPlay, 0, availablePrograms)
        }
      } else {
        setAvailableEntries(availablePrograms)
        if (currentState === 'playing' && currentScheduleEntryRef.current?.scheduleType === 'autoplay') {
          if (availablePrograms.length > 0) {
            transitionTo('menu', null, null, 0, availablePrograms)
          } else {
            transitionTo('idle', null, null)
          }
        } else if (currentState === 'idle' && availablePrograms.length > 0) {
          transitionTo('menu', null, null, 0, availablePrograms)
        }
      }
    }, [scheduleData, transitionTo])

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.code === keys.menu) {
          e.preventDefault()
          if (showExitOverlayRef.current) {
            clearMenuTimeout()
            setShowExitOverlay(false)
            return
          }
          openMenu()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [keys, openMenu, clearMenuTimeout])

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
      if (playerState !== 'playing' || !currentScheduleEntry?.endTime || currentScheduleEntry.scheduleType !== 'autoplay') return

      const interval = setInterval(() => {
        if (new Date() >= new Date(currentScheduleEntry.endTime!)) {
          const { availablePrograms } = resolveScheduleState(scheduleDataRef.current?.schedule ?? [])
          if (availablePrograms.length > 0) {
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
        }
      }, 1000)

      return () => clearInterval(interval)
    }, [playerState, currentScheduleEntry, emitState])

    useEffect(() => {
      return () => clearMenuTimeout()
    }, [clearMenuTimeout])

    if (showExitOverlay && activeProgram) {
      return (
        <>
          <SlideEngine
            ref={engineRef}
            key={programKey}
            program={activeProgram}
            onSlideChange={onSlideChange}
          />
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
        </>
      )
    }

    if (playerState === 'menu') {
      const programTitles = availableEntries.map((e) => ({ id: e.programId, title: e.program.title }))
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
        />
      )
    }

    if (playerState === 'playing' && activeProgram) {
      return (
        <SlideEngine
          ref={engineRef}
          key={programKey}
          program={activeProgram}
          initialSlideIndex={pendingSlideIndex}
          onSlideChange={onSlideChange}
        />
      )
    }

    return (
      <div className="slide-stage">
        <div className="slide-status-text">No program scheduled</div>
      </div>
    )
  },
)
