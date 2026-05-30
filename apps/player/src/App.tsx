import { useEffect, useState, useCallback, useRef } from 'react'
import { SlideEngine } from 'signage-core'
import type { Program, SlideEngineHandle } from 'signage-core'
import { resolveActiveProgram, normalizeApiSchedule } from './schedule-resolver'
import { createBrowserSocket, createHardwareSocket } from './socket'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

const POLL_INTERVAL = 60_000
const MANIFEST_URL = '/schedule.json'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

function detectMode(): 'browser' | 'hardware' {
  const params = new URLSearchParams(window.location.search)
  if (params.has('deviceId') && params.has('token')) return 'browser'
  return 'hardware'
}

function getDeviceConfig() {
  const params = new URLSearchParams(window.location.search)
  return {
    deviceId: params.get('deviceId') || undefined,
    token: params.get('token') || undefined,
  }
}

export function App() {
  const [activeProgram, setActiveProgram] = useState<Program | null>(null)
  const [programKey, setProgramKey] = useState(0)
  const [pendingSlideIndex, setPendingSlideIndex] = useState<number | undefined>(undefined)
  const engineRef = useRef<SlideEngineHandle>(null)
  const scheduleRef = useRef<any>(null)
  const socketRef = useRef<TypedSocket | null>(null)
  const mode = detectMode()
  const modeRef = useRef(mode)

  // Browser mode: connect to CMS Socket.IO
  useEffect(() => {
    if (mode !== 'browser') return

    const config = getDeviceConfig()
    if (!config.deviceId || !config.token) return

    const origin = window.location.origin
    const socket = createBrowserSocket(origin, config.token)
    socketRef.current = socket

    socket.on('connect', () => {
      // Fetch initial schedule
      fetch(`/api/schedule?where[devices][contains]=${config.deviceId}&where[program.status][equals]=approved&depth=2&sort=startTime`)
        .then(r => r.json())
        .then(data => {
          const normalized = normalizeApiSchedule(data)
          scheduleRef.current = normalized
          const program = resolveActiveProgram(normalized)
          setActiveProgram(prev => {
            if (prev && program && prev.id === program.id) return program
            if (program) {
              setProgramKey(k => k + 1)
              setPendingSlideIndex(0)
            } else {
              setActiveProgram(null)
            }
            return program
          })
        })
        .catch(console.error)
    })

    socket.on('schedule:update', (data) => {
      const normalized = normalizeApiSchedule(data.scheduleData)
      scheduleRef.current = normalized
      const program = resolveActiveProgram(normalized)
      setActiveProgram(prev => {
        if (prev && program && prev.id === program.id) return program
        if (program) {
          setProgramKey(k => k + 1)
          setPendingSlideIndex(0)
        } else {
          return null
        }
        return program
      })
    })

    socket.on('program:update', (data) => {
      const updated = data.program as Program
      setActiveProgram(prev => {
        if (prev && prev.id === updated.id) return updated
        setProgramKey(k => k + 1)
        return updated
      })
    })

    socket.on('media:update', (_data) => {
      // Re-fetch schedule to get updated media URLs
      fetch(`/api/schedule?where[devices][contains]=${config.deviceId}&where[program.status][equals]=approved&depth=2&sort=startTime`)
        .then(r => r.json())
        .then(data => {
          const normalized = normalizeApiSchedule(data)
          scheduleRef.current = normalized
          const program = resolveActiveProgram(normalized)
          setActiveProgram(prev => {
            if (prev && program && prev.id === program.id) return program
            if (program) {
              setProgramKey(k => k + 1)
              setPendingSlideIndex(0)
            }
            return program
          })
        })
        .catch(console.error)
    })

    socket.on('remote:advance', () => {
      engineRef.current?.nextSlide()
    })

    socket.on('remote:previous', () => {
      engineRef.current?.prevSlide()
    })

    socket.on('remote:goto', (data) => {
      engineRef.current?.gotoSlide(data.slideIndex)
    })

    socket.on('remote:program', (data) => {
      const prog = data.program as Program
      setProgramKey(k => k + 1)
      setActiveProgram(prog)
      setPendingSlideIndex(data.slideIndex)
    })

    return () => {
      socket.disconnect()
    }
  }, [mode])

  // Hardware mode: poll schedule.json with optional Socket.IO relay
  useEffect(() => {
    if (mode !== 'hardware') return

    const hardwareSocket = createHardwareSocket(window.location.origin, '')
    socketRef.current = hardwareSocket

    hardwareSocket.on('connect', () => {
      loadSchedule()
    })

    hardwareSocket.on('remote:advance', () => {
      engineRef.current?.nextSlide()
    })

    hardwareSocket.on('remote:previous', () => {
      engineRef.current?.prevSlide()
    })

    hardwareSocket.on('remote:goto', (data) => {
      engineRef.current?.gotoSlide(data.slideIndex)
    })

    hardwareSocket.on('remote:program', (data) => {
      const prog = data.program as Program
      setProgramKey(k => k + 1)
      setActiveProgram(prog)
      setPendingSlideIndex(data.slideIndex)
    })

    return () => {
      hardwareSocket.disconnect()
    }
  }, [mode])

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch(MANIFEST_URL)
      if (!res.ok) return
      const data = await res.json()
      scheduleRef.current = data
      const program = resolveActiveProgram(data)
      setActiveProgram(prev => {
        if (prev && program && prev.id === program.id) return program
        if (program) {
          setProgramKey(k => k + 1)
          setPendingSlideIndex(0)
        }
        return program
      })
    } catch (err) {
      console.error('Failed to load schedule:', err)
    }
  }, [])

  // Poll as fallback
  useEffect(() => {
    const interval = setInterval(loadSchedule, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [loadSchedule])

  const handleSlideChange = useCallback((index: number) => {
    if (modeRef.current === 'browser' && socketRef.current) {
      socketRef.current.emit('device:slideChange', { slideIndex: index })
    }
  }, [])

  if (!activeProgram) {
    return (
      <div className="slide-stage">
        <div className="slide-status-text">No program scheduled</div>
      </div>
    )
  }

  return (
    <SlideEngine
      ref={engineRef}
      key={programKey}
      program={activeProgram}
      onProgramEnd={() => loadSchedule()}
      onSlideChange={handleSlideChange}
      initialSlideIndex={pendingSlideIndex}
    />
  )
}
