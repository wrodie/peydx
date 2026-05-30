'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { SlideEngine } from 'signage-core'
import type { Program, SlideEngineHandle } from 'signage-core'
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
    deviceId: '',
    lastUpdated: new Date().toISOString(),
    schedule: (apiData.docs || []).map((entry: any) => ({
      programId: entry.program?.id,
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

function resolveActiveProgram(scheduleData: any): any {
  const now = new Date()
  const entries = scheduleData.schedule

  let activeEntry: any = null
  for (const entry of entries) {
    const start = new Date(entry.startTime)
    if (start <= now) {
      const end = entry.endTime ? new Date(entry.endTime) : null
      if (!end || now < end) {
        if (!activeEntry || new Date(entry.startTime) > new Date(activeEntry.startTime)) {
          activeEntry = entry
        }
      }
    }
  }
  return activeEntry?.program ?? null
}

interface Props {
  deviceId: string
  token: string
}

export function BrowserPlayer({ deviceId, token }: Props) {
  const [activeProgram, setActiveProgram] = useState<Program | null>(null)
  const [programKey, setProgramKey] = useState(0)
  const [pendingSlideIndex, setPendingSlideIndex] = useState<number | undefined>(undefined)
  const engineRef = useRef<SlideEngineHandle>(null)
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
      fetch(`/api/schedule?where[devices][deviceId][equals]=${deviceId}&where[program.status][equals]=approved&depth=2&sort=startTime`)
        .then(r => r.json())
        .then(data => {
          const normalized = normalizeApiSchedule(data)
          const program = resolveActiveProgram(normalized)
          if (program) {
            setProgramKey(k => k + 1)
            setActiveProgram(program)
            setPendingSlideIndex(0)
          }
        })
        .catch(console.error)
    })

    socket.on('schedule:update', (data: any) => {
      const normalized = normalizeApiSchedule(data.scheduleData)
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

    socket.on('program:update', (data: any) => {
      const updated = data.program as Program
      setActiveProgram(prev => {
        if (prev && prev.id === updated.id) return updated
        setProgramKey(k => k + 1)
        return updated
      })
    })

    socket.on('media:update', () => {
      fetch(`/api/schedule?where[devices][deviceId][equals]=${deviceId}&where[program.status][equals]=approved&depth=2&sort=startTime`)
        .then(r => r.json())
        .then(data => {
          const normalized = normalizeApiSchedule(data)
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

    socket.on('remote:goto', (data: any) => {
      engineRef.current?.gotoSlide(data.slideIndex)
    })

    socket.on('remote:program', (data: any) => {
      const prog = data.program as Program
      setProgramKey(k => k + 1)
      setActiveProgram(prog)
      setPendingSlideIndex(data.slideIndex)
    })

    return () => {
      socket.disconnect()
    }
  }, [deviceId, token])

  const handleSlideChange = useCallback((index: number) => {
    socketRef.current?.emit('device:slideChange', { slideIndex: index })
  }, [])

  const handleLoadSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule?where[devices][deviceId][equals]=${deviceId}&where[program.status][equals]=approved&depth=2&sort=startTime`)
      if (!res.ok) return
      const data = await res.json()
      const normalized = normalizeApiSchedule(data)
      const program = resolveActiveProgram(normalized)
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
  }, [deviceId])

  if (!activeProgram) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'black' }}>
        <div style={{ color: '#888', fontFamily: 'system-ui', fontSize: '1.5rem' }}>No program scheduled</div>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <SlideEngine
        ref={engineRef}
        key={programKey}
        program={activeProgram}
        onProgramEnd={handleLoadSchedule}
        onSlideChange={handleSlideChange}
        initialSlideIndex={pendingSlideIndex}
      />
    </div>
  )
}
