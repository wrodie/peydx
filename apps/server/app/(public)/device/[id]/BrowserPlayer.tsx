'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { PlayerController, useRemoteControl, createCmsProvider } from 'signage-core'
import type { PlayerControllerHandle, PlayerState } from 'signage-core'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const POLL_INTERVAL = 60_000
const HEARTBEAT_INTERVAL = 30_000
const RELOAD_GRACE_MS = 60_000

interface Props {
  id: string
  token: string
}

export function BrowserPlayer({ id, token }: Props) {
  const controllerRef = useRef<PlayerControllerHandle>(null)
  const socketRef = useRef<TypedSocket | null>(null)
  const lastSlideChangeRef = useRef<number>(Date.now())
  const lastSlideIndexRef = useRef<number>(0)
  const lastStateRef = useRef<{ state: PlayerState; programId?: number; menuIndex?: number } | null>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recoveryKeyRef = useRef(0)
  const needsWakeRecoveryRef = useRef(false)

  const [scheduleData, setScheduleData] = useState<any>(null)
  const [recoveryKey, setRecoveryKey] = useState(0)
  const provider = useMemo(() => createCmsProvider(id, token), [id, token])

  const setScheduleDataIfChanged = useCallback((data: any, force = false) => {
    setScheduleData((prev: any) => {
      if (!prev) return data
      if (force) return data
      const { lastUpdated: a, ...prevRest } = prev
      const { lastUpdated: b, ...dataRest } = data
      if (JSON.stringify(prevRest) === JSON.stringify(dataRest)) return prev
      return data
    })
  }, [])

  const fetchAndSetSchedule = useCallback(async (force = false) => {
    try {
      const data = await provider.fetchSchedule()
      setScheduleDataIfChanged(data, force)
    } catch (err) {
      console.error(err)
    }
  }, [provider, setScheduleDataIfChanged])

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
    heartbeatTimerRef.current = setInterval(() => {
      const s = socketRef.current
      if (!s?.connected) return
      s.emit('device:heartbeat', {
        programId: lastStateRef.current?.programId ?? null,
        slideIndex: lastSlideIndexRef.current,
      })
    }, HEARTBEAT_INTERVAL)
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  // Socket setup and all lifecycle handlers
  useEffect(() => {
    const socket = provider.connectSocket() as TypedSocket
    socketRef.current = socket

    socket.on('connect', () => {
      fetchAndSetSchedule(needsWakeRecoveryRef.current)
      needsWakeRecoveryRef.current = false
      startHeartbeat()
    })

    socket.on('schedule:update', () => {
      fetchAndSetSchedule()
    })

    socket.on('request:state', () => {
      const last = lastStateRef.current
      if (last) {
        socket.emit('device:stateChange', { state: last.state, programId: last.programId, menuIndex: last.menuIndex })
      }
    })

    socket.on('disconnect', () => {
      needsWakeRecoveryRef.current = true
      stopHeartbeat()
    })

    startHeartbeat()

    pollTimerRef.current = setInterval(() => {
      fetchAndSetSchedule()
    }, POLL_INTERVAL)

    return () => {
      provider.disconnect()
      socketRef.current = null
      stopHeartbeat()
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [provider, fetchAndSetSchedule, startHeartbeat, stopHeartbeat])

  // Wake / visibility recovery
  useEffect(() => {
    let reloadTimeout: ReturnType<typeof setTimeout> | null = null

    const handleWake = () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout)
        reloadTimeout = null
      }

      const s = socketRef.current
      if (s && !s.connected) {
        s.connect()
      }

      fetchAndSetSchedule(true).then(() => {
        needsWakeRecoveryRef.current = false
        recoveryKeyRef.current += 1
        setRecoveryKey(recoveryKeyRef.current)
      })

      startHeartbeat()
      lastSlideChangeRef.current = Date.now()

      reloadTimeout = setTimeout(() => {
        if (Date.now() - lastSlideChangeRef.current > RELOAD_GRACE_MS) {
          window.location.reload()
        }
      }, RELOAD_GRACE_MS)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWake()
      }
    }

    const handleOnline = () => {
      handleWake()
    }

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        handleWake()
      }
    }

    const handleBeforeUnload = () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout)
        reloadTimeout = null
      }
      stopHeartbeat()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (reloadTimeout) clearTimeout(reloadTimeout)
    }
  }, [fetchAndSetSchedule, startHeartbeat, stopHeartbeat])

  const handleSlideChange = useCallback((index: number) => {
    lastSlideChangeRef.current = Date.now()
    lastSlideIndexRef.current = index
    socketRef.current?.emit('device:slideChange', { slideIndex: index })
  }, [])

  const handleStateChange = useCallback(
    (state: PlayerState, programId?: number, menuIndex?: number) => {
      lastStateRef.current = { state, programId, menuIndex }
      socketRef.current?.emit('device:stateChange', { state, programId, menuIndex })
    },
    [],
  )

  const handlePauseChange = useCallback((paused: boolean) => {
    socketRef.current?.emit('device:pauseChange', { paused })
  }, [])

  useRemoteControl(socketRef.current, controllerRef)

  return (
    <div style={{ background: 'black' }}>
      <PlayerController
        ref={controllerRef}
        scheduleData={scheduleData}
        recoveryKey={recoveryKey}
        onSlideChange={handleSlideChange}
        onStateChange={handleStateChange}
        onPauseChange={handlePauseChange}
      />
    </div>
  )
}
