import { useEffect, useRef, useCallback, useState } from 'react'
import { PlayerController } from 'signage-core'
import type { PlayerControllerHandle, PlayerState } from 'signage-core'
import { normalizeApiSchedule } from './schedule-resolver'
import { createBrowserSocket, createHardwareSocket } from './socket'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

const POLL_INTERVAL = 60_000
const MANIFEST_URL = '/schedule.json'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

function detectMode(): 'browser' | 'hardware' {
  const params = new URLSearchParams(window.location.search)
  if (params.has('id') && params.has('token')) return 'browser'
  return 'hardware'
}

function getDeviceConfig() {
  const params = new URLSearchParams(window.location.search)
  return {
    id: params.get('id') || undefined,
    token: params.get('token') || undefined,
  }
}

export function App() {
  const controllerRef = useRef<PlayerControllerHandle>(null)
  const [scheduleData, setScheduleData] = useState<any>(null)
  const socketRef = useRef<TypedSocket | null>(null)
  const mode = detectMode()

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch(MANIFEST_URL)
      if (!res.ok) return
      const data = await res.json()
      setScheduleData(data)
    } catch (err) {
      console.error('Failed to load schedule:', err)
    }
  }, [])

  const handleSlideChange = useCallback((index: number) => {
    socketRef.current?.emit('device:slideChange', { slideIndex: index })
  }, [])

  const handleStateChange = useCallback(
    (state: PlayerState, programId?: number, menuIndex?: number) => {
      socketRef.current?.emit('device:stateChange', { state, programId, menuIndex })
    },
    [],
  )

  // Browser mode: connect to CMS Socket.IO
  useEffect(() => {
    if (mode !== 'browser') return

    const config = getDeviceConfig()
    if (!config.id || !config.token) return

    const origin = window.location.origin
    const socket = createBrowserSocket(origin, config.token)
    socketRef.current = socket

    socket.on('connect', () => {
      fetch(`/api/schedule?where[devices][contains]=${config.id}&where[program.status][equals]=approved&depth=2&sort=startTime`)
        .then((r) => r.json())
        .then((data) => {
          setScheduleData(normalizeApiSchedule(data))
        })
        .catch(console.error)
    })

    socket.on('schedule:update', (data) => {
      setScheduleData(normalizeApiSchedule(data.scheduleData))
    })

    socket.on('program:update', () => {
      fetch(`/api/schedule?where[devices][contains]=${config.id}&where[program.status][equals]=approved&depth=2&sort=startTime`)
        .then((r) => r.json())
        .then((data) => {
          setScheduleData(normalizeApiSchedule(data))
        })
        .catch(console.error)
    })

    socket.on('media:update', () => {
      fetch(`/api/schedule?where[devices][contains]=${config.id}&where[program.status][equals]=approved&depth=2&sort=startTime`)
        .then((r) => r.json())
        .then((data) => {
          setScheduleData(normalizeApiSchedule(data))
        })
        .catch(console.error)
    })

    socket.on('remote:advance', () => {
      controllerRef.current?.nextSlide()
    })

    socket.on('remote:previous', () => {
      controllerRef.current?.prevSlide()
    })

    socket.on('remote:goto', (data) => {
      controllerRef.current?.gotoSlide(data.slideIndex)
    })

    socket.on('remote:program', (data) => {
      controllerRef.current?.selectProgram(data.program?.id)
    })

    socket.on('remote:menu', () => {
      controllerRef.current?.openMenu()
    })

    socket.on('remote:back', () => {
      controllerRef.current?.exitProgram()
    })

    socket.on('remote:select', () => {
      controllerRef.current?.selectItem()
    })

    return () => {
      socket.disconnect()
    }
  }, [mode])

  // Hardware mode: poll schedule.json with optional Socket.IO relay
  useEffect(() => {
    if (mode !== 'hardware') return

    loadSchedule()

    const hardwareSocket = createHardwareSocket(window.location.origin, '')
    socketRef.current = hardwareSocket

    hardwareSocket.on('connect', () => {
      loadSchedule()
    })

    hardwareSocket.on('remote:advance', () => {
      controllerRef.current?.nextSlide()
    })

    hardwareSocket.on('remote:previous', () => {
      controllerRef.current?.prevSlide()
    })

    hardwareSocket.on('remote:goto', (data) => {
      controllerRef.current?.gotoSlide(data.slideIndex)
    })

    hardwareSocket.on('remote:program', (data) => {
      controllerRef.current?.selectProgram(data.program?.id)
    })

    hardwareSocket.on('remote:menu', () => {
      controllerRef.current?.openMenu()
    })

    hardwareSocket.on('remote:back', () => {
      controllerRef.current?.exitProgram()
    })

    hardwareSocket.on('remote:select', () => {
      controllerRef.current?.selectItem()
    })

    return () => {
      hardwareSocket.disconnect()
    }
  }, [mode, loadSchedule])

  // Poll as fallback
  useEffect(() => {
    const interval = setInterval(loadSchedule, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [loadSchedule])

  return (
    <PlayerController
      ref={controllerRef}
      scheduleData={scheduleData}
      onSlideChange={handleSlideChange}
      onStateChange={handleStateChange}
    />
  )
}
