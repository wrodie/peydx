import { useEffect, useRef, useCallback, useState } from 'react'
import { PlayerController, useRemoteControl } from 'signage-core'
import type { PlayerControllerHandle, PlayerState, DeviceProvider, KeyConfig } from 'signage-core'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'
import { createCmsProvider } from './providers/CmsProvider'
import { createLocalProvider } from './providers/LocalProvider'

const POLL_INTERVAL = 60_000
type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

function detectMode(): 'browser' | 'hardware' {
  const params = new URLSearchParams(window.location.search)
  if (params.has('id') && params.has('token')) return 'browser'
  return 'hardware'
}

function createProvider(): DeviceProvider | null {
  const params = new URLSearchParams(window.location.search)
  const mode = detectMode()

  if (mode === 'browser') {
    const id = params.get('id')
    const token = params.get('token')
    if (!id || !token) return null
    return createCmsProvider(id, token)
  }

  return createLocalProvider()
}

export function App() {
  const controllerRef = useRef<PlayerControllerHandle>(null)
  const [scheduleData, setScheduleData] = useState<any>(null)
  const [keyConfig, setKeyConfig] = useState<Partial<KeyConfig> | undefined>(undefined)
  const socketRef = useRef<TypedSocket | null>(null)
  const [provider] = useState(() => createProvider())

  const loadSchedule = useCallback(async () => {
    if (!provider) return
    try {
      const data = await provider.fetchSchedule()
      setScheduleData(prev => {
        if (!prev) return data
        const { lastUpdated: a, ...prevRest } = prev
        const { lastUpdated: b, ...dataRest } = data
        if (JSON.stringify(prevRest) === JSON.stringify(dataRest)) return prev
        return data
      })
    } catch (err) {
      console.error('Failed to load schedule:', err)
    }
  }, [provider])

  const handleSlideChange = useCallback((index: number) => {
    socketRef.current?.emit('device:slideChange', { slideIndex: index })
  }, [])

  const handleStateChange = useCallback(
    (state: PlayerState, programId?: number, menuIndex?: number) => {
      socketRef.current?.emit('device:stateChange', { state, programId, menuIndex })
    },
    [],
  )

  useRemoteControl(socketRef.current, controllerRef)

  // Connect socket and set up event handlers
  useEffect(() => {
    if (!provider) return

    const socket = provider.connectSocket()
    if (!socket) return
    socketRef.current = socket as TypedSocket

    socket.on('connect', () => {
      loadSchedule()
    })

    socket.on('schedule:update', () => {
      loadSchedule()
    })

    return () => {
      provider.disconnect()
      socketRef.current = null
    }
  }, [provider, loadSchedule])

  // Poll as fallback
  useEffect(() => {
    if (!provider) return
    const interval = setInterval(loadSchedule, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [provider, loadSchedule])

  // Load key config in hardware mode
  useEffect(() => {
    if (!provider || detectMode() === 'browser') return
    fetch('/config.json')
      .then(res => {
        if (!res.ok) throw new Error('No config.json')
        return res.json()
      })
      .then(config => {
        if (config?.keys) setKeyConfig(config.keys)
      })
      .catch(() => {
        // No config file — defaults will be used
      })
  }, [provider])

  // Prevent browser back/forward navigation (e.g. BrowserBack key on remotes)
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    const handler = () => {
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  if (!provider) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        Missing device configuration (id and token required)
      </div>
    )
  }

  return (
    <PlayerController
      ref={controllerRef}
      scheduleData={scheduleData}
      keyConfig={keyConfig}
      onSlideChange={handleSlideChange}
      onStateChange={handleStateChange}
    />
  )
}
