'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { PlayerController, useRemoteControl, createCmsProvider } from 'signage-core'
import type { PlayerControllerHandle, PlayerState } from 'signage-core'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface Props {
  id: string
  token: string
}

export function BrowserPlayer({ id, token }: Props) {
  const controllerRef = useRef<PlayerControllerHandle>(null)
  const socketRef = useRef<TypedSocket | null>(null)
  const [scheduleData, setScheduleData] = useState<any>(null)
  const provider = useMemo(() => createCmsProvider(id, token), [id, token])

  const setScheduleDataIfChanged = useCallback((data: any) => {
    setScheduleData((prev: any) => {
      if (!prev) return data
      const { lastUpdated: a, ...prevRest } = prev
      const { lastUpdated: b, ...dataRest } = data
      if (JSON.stringify(prevRest) === JSON.stringify(dataRest)) return prev
      return data
    })
  }, [])

  useEffect(() => {
    const socket = provider.connectSocket() as TypedSocket
    socketRef.current = socket

    socket.on('connect', async () => {
      try {
        const data = await provider.fetchSchedule()
        setScheduleDataIfChanged(data)
      } catch (err) {
        console.error(err)
      }
    })

    socket.on('schedule:update', async () => {
      try {
        const data = await provider.fetchSchedule()
        setScheduleDataIfChanged(data)
      } catch (err) {
        console.error(err)
      }
    })

    return () => {
      provider.disconnect()
      socketRef.current = null
    }
  }, [provider, setScheduleDataIfChanged])

  const handleSlideChange = useCallback((index: number) => {
    socketRef.current?.emit('device:slideChange', { slideIndex: index })
  }, [])

  const handleStateChange = useCallback(
    (state: PlayerState, programId?: number, menuIndex?: number) => {
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
        onSlideChange={handleSlideChange}
        onStateChange={handleStateChange}
        onPauseChange={handlePauseChange}
      />
    </div>
  )
}
