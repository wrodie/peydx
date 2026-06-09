'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { PlayerController } from 'signage-core'
import type { PlayerControllerHandle, PlayerState } from 'signage-core'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

function normalizeSlide(slide: any): any {
  if (slide.blockType === 'segmentBlock') {
    const bgAudio = slide.backgroundAudio
    return {
      blockType: slide.blockType,
      name: slide.name,
      backgroundAudio: (bgAudio && typeof bgAudio === 'object') ? {
        id: bgAudio.id,
        url: bgAudio.url,
        alt: bgAudio.alt,
      } : null,
      loop: slide.loop ?? false,
      advanceMode: slide.advanceMode ?? 'slides',
      duration: slide.duration ?? null,
      slides: (slide.slides || []).map(normalizeSlide),
      id: slide.id,
    }
  }

  const result: any = {
    blockType: slide.blockType,
    advanceMode: slide.advanceMode,
    duration: slide.duration,
    transition: slide.transition,
    id: slide.id,
  }
  if (slide.blockType === 'imageBlock' && slide.image && typeof slide.image === 'object') {
    result.image = {
      id: slide.image.id,
      url: slide.image.sizes?.fullHD?.url || slide.image.url,
      alt: slide.image.alt,
    }
  }
  if (slide.blockType === 'videoBlock' && slide.video && typeof slide.video === 'object') {
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

function normalizeApiSchedule(apiData: any, programsData?: any, defaultBackgroundUrl?: string | null, deviceName?: string | null, deviceId?: string | number | null) {
  const scheduleDocs = (apiData?.docs || [])
    .filter((entry: any) => entry.program?.status === 'approved')

  const programs = programsData?.docs || []
  const availability = []
  for (const program of programs) {
    if (!program.availableFrom) continue
    if (deviceId) {
      const deviceIds = (program.availableDevices || []).map((d: any) => typeof d === 'object' ? d.id : d)
      if (!deviceIds.includes(Number(deviceId))) continue
    }
    availability.push({
      programId: program.id,
      scheduleType: 'availability' as const,
      startDate: program.availableFrom,
      endDate: program.availableUntil || null,
      program: {
        id: program.id,
        title: program.title,
        loop: program.loop,
        department: program.folder?.department?.name || null,
        slides: (program.slides || []).map(normalizeSlide),
      },
    })
  }

  return {
    lastUpdated: new Date().toISOString(),
    schedule: scheduleDocs.map((entry: any) => ({
      programId: entry.program?.id,
      scheduleType: 'autoplay' as const,
      startTime: entry.startTime,
      endTime: entry.endTime,
      daysOfWeek: entry.daysOfWeek || [],
      startDate: entry.startDate,
      untilDate: entry.untilDate,
      program: {
        id: entry.program?.id,
        title: entry.program?.title,
        loop: entry.program?.loop,
        department: entry.program?.folder?.department?.name || null,
        slides: (entry.program?.slides || []).map(normalizeSlide),
      },
    })),
    availability,
    defaultBackground: defaultBackgroundUrl || null,
    deviceName: deviceName || null,
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
          setScheduleDataIfChanged(normalizeApiSchedule(scheduleData, programsData, bgUrl, deviceName, id))
        })
        .catch(console.error)
    })

    socket.on('schedule:update', () => {
      Promise.all([
        fetch(`/api/schedule?where[devices][contains]=${id}&depth=3&sort=startTime&token=${token}`).then(r => r.json()),
        fetch(`/api/programs?where[status][equals]=approved&depth=2&token=${token}`).then(r => r.json()),
      ]).then(([scheduleData, programsData]) => {
        setScheduleDataIfChanged(normalizeApiSchedule(scheduleData, programsData, deviceBgRef.current, null, id))
      }).catch(console.error)
    })

    socket.on('program:update', () => {
      Promise.all([
        fetch(`/api/schedule?where[devices][contains]=${id}&depth=3&sort=startTime&token=${token}`).then(r => r.json()),
        fetch(`/api/programs?where[status][equals]=approved&depth=2&token=${token}`).then(r => r.json()),
      ]).then(([scheduleData, programsData]) => {
        setScheduleDataIfChanged(normalizeApiSchedule(scheduleData, programsData, deviceBgRef.current, null, id))
      }).catch(console.error)
    })

    socket.on('media:update', () => {
      Promise.all([
        fetch(`/api/schedule?where[devices][contains]=${id}&depth=3&sort=startTime&token=${token}`).then(r => r.json()),
        fetch(`/api/programs?where[status][equals]=approved&depth=2&token=${token}`).then(r => r.json()),
      ]).then(([scheduleData, programsData]) => {
        setScheduleDataIfChanged(normalizeApiSchedule(scheduleData, programsData, deviceBgRef.current, null, id))
      }).catch(console.error)
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

    socket.on('remote:pause', () => {
      controllerRef.current?.togglePause()
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
