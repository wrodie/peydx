'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { PlayerController } from 'signage-core'
import type { PlayerControllerHandle, PlayerState } from 'signage-core'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

function normalizeSlide(slide: any): any {
  const result: any = {
    blockType: slide.blockType,
    advanceMode: slide.advanceMode,
    duration: slide.duration,
    transition: slide.transition,
    id: slide.id,
  }
  if (slide.blockType === 'imageBlock' && slide.image) {
    result.image = {
      id: slide.image.id,
      url: slide.image.sizes?.fullHD?.url || slide.image.url,
      alt: slide.image.alt,
    }
  }
  if (slide.blockType === 'videoBlock' && slide.video) {
    result.video = {
      id: slide.video.id,
      url: slide.video.url,
      alt: slide.video.alt,
    }
  }
  if (slide.blockType === 'youtubeBlock') {
    result.youtubeId = slide.youtubeId
  }
  return result
}

function normalizeApiSchedule(apiData: any) {
  return {
    lastUpdated: new Date().toISOString(),
    schedule: (apiData.docs || [])
      .filter((entry: any) => entry.program?.status === 'approved')
      .map((entry: any) => ({
      programId: entry.program?.id,
      scheduleType: entry.scheduleType || 'autoplay',
      startTime: entry.startTime,
      endTime: entry.endTime,
      program: {
        id: entry.program?.id,
        title: entry.program?.title,
        loop: entry.program?.loop,
        slides: (entry.program?.slides || []).map(normalizeSlide),
      },
    })),
  }
}

interface Props {
  id: string
  token: string
}

export function BrowserPlayer({ id, token }: Props) {
  const controllerRef = useRef<PlayerControllerHandle>(null)
  const [scheduleData, setScheduleData] = useState<any>(null)
  const socketRef = useRef<TypedSocket | null>(null)

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
      fetch(`/api/schedule?where[devices][contains]=${id}&depth=2&sort=startTime&token=${token}`)
        .then((r) => r.json())
        .then((data) => {
          setScheduleData(normalizeApiSchedule(data))
        })
        .catch(console.error)
    })

    socket.on('schedule:update', (data: any) => {
      setScheduleData(normalizeApiSchedule(data.scheduleData))
    })

    socket.on('program:update', () => {
      fetch(`/api/schedule?where[devices][contains]=${id}&depth=2&sort=startTime&token=${token}`)
        .then((r) => r.json())
        .then((data) => {
          setScheduleData(normalizeApiSchedule(data))
        })
        .catch(console.error)
    })

    socket.on('media:update', () => {
      fetch(`/api/schedule?where[devices][contains]=${id}&depth=2&sort=startTime&token=${token}`)
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

    socket.on('remote:goto', (data: any) => {
      controllerRef.current?.gotoSlide(data.slideIndex)
    })

    socket.on('remote:program', (data: any) => {
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
