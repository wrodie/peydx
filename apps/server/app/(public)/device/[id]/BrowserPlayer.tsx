'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { PlayerController, normalizeApiSchedule, useRemoteControl } from 'signage-core'
import type { PlayerControllerHandle, PlayerState } from 'signage-core'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface Props {
  id: string
  token: string
}

export function BrowserPlayer({ id, token }: Props) {
  const controllerRef = useRef<PlayerControllerHandle>(null)
  const [scheduleData, setScheduleData] = useState<any>(null)
  const socketRef = useRef<TypedSocket | null>(null)
  const deviceBgRef = useRef<string | null>(null)
  const lastDataRef = useRef<any>(null)

  const setScheduleDataIfChanged = useCallback((data: any) => {
    setScheduleData((prev: any) => {
      if (!prev) return data
      // Compare without lastUpdated to avoid false changes
      const { lastUpdated: a, ...prevRest } = prev
      const { lastUpdated: b, ...dataRest } = data
      if (JSON.stringify(prevRest) === JSON.stringify(dataRest)) return prev
      return data
    })
  }, [])

  useEffect(() => {
    const origin = window.location.origin
    const socket = io(origin, {
      path: '/api/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    }) as TypedSocket
    socketRef.current = socket

    socket.on('connect', () => {
      const devicePromise = fetch(`/api/devices/${id}?depth=1&token=${token}`)
        .then((r) => r.json())
        .then((device) => {
          const bg = device?.defaultBackground
          const url = bg ? (bg.sizes?.fullHD?.url || bg.url || null) : null
          deviceBgRef.current = url
          return { bgUrl: url, deviceName: device?.name || null }
        })
        .catch(() => { deviceBgRef.current = null; return { bgUrl: null, deviceName: null } })

      const schedulePromise = fetch(
        `/api/schedule?where[devices][contains]=${id}&depth=3&sort=startTime&token=${token}`
      ).then((r) => r.json())

      const programsPromise = fetch(
        `/api/programs?where[status][equals]=approved&depth=2&token=${token}`
      ).then((r) => r.json())

      Promise.all([devicePromise, schedulePromise, programsPromise])
        .then(([{ bgUrl, deviceName }, scheduleData, programsData]) => {
          setScheduleDataIfChanged(normalizeApiSchedule(scheduleData, programsData, { defaultBackgroundUrl: bgUrl, deviceName, deviceId: id }))
        })
        .catch(console.error)
    })

    socket.on('schedule:update', () => {
      Promise.all([
        fetch(`/api/schedule?where[devices][contains]=${id}&depth=3&sort=startTime&token=${token}`).then(r => r.json()),
        fetch(`/api/programs?where[status][equals]=approved&depth=2&token=${token}`).then(r => r.json()),
      ]).then(([scheduleData, programsData]) => {
        setScheduleDataIfChanged(normalizeApiSchedule(scheduleData, programsData, { defaultBackgroundUrl: deviceBgRef.current, deviceId: id }))
      }).catch(console.error)
    })

    return () => {
      socket.disconnect()
    }
  }, [id, token])

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

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <PlayerController
        ref={controllerRef}
        scheduleData={scheduleData}
        onSlideChange={handleSlideChange}
        onStateChange={handleStateChange}
      />
    </div>
  )
}
