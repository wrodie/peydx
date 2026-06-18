'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'
import { flattenProgram } from 'signage-core'

function extractYouTubeId(input: string): string | null {
  if (!input) return null
  const m = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})|^([a-zA-Z0-9_-]{11})$/)
  return m?.[1] || m?.[2] || null
}

function getThumbnailUrl(slide: any): string | null {
  if (!slide) return null
  if (slide.blockType === 'imageBlock' && slide.image) {
    const img = typeof slide.image === 'object' ? slide.image : null
    if (!img) return null
    return img.sizes?.thumbnail?.url || img.url || null
  }
  if (slide.blockType === 'videoBlock' && slide.video) {
    const vid = typeof slide.video === 'object' ? slide.video : null
    return vid?.sizes?.thumbnail?.url || null
  }
  if (slide.blockType === 'youtubeBlock' && slide.youtubeId) {
    const ytId = extractYouTubeId(slide.youtubeId)
    if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
  }
  return null
}

function getBlockIcon(slide: any): string | null {
  if (!slide) return null
  if (slide.blockType === 'videoBlock') return '🎬'
  if (slide.blockType === 'youtubeBlock') return '▶️'
  if (slide.blockType === 'blackScreenBlock') return '◼'
  return null
}

export function RemoteControlView() {
  const [devices, setDevices] = useState<any[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [currentProgram, setCurrentProgram] = useState<any>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [playerState, setPlayerState] = useState<string>('unknown')
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([])
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const selectedDeviceRef = useRef<any>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/devices?depth=1&limit=100')
      .then((r) => r.json())
      .then((data) => setDevices(data.docs || []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (devices.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const deviceId = params.get('device')
    if (deviceId) {
      const device = devices.find((d) => String(d.id) === deviceId)
      if (device) {
        setSelectedDeviceId(deviceId)
      }
    }
  }, [devices])

  useEffect(() => {
    const socket = io(window.location.origin, { path: '/api/ws' }) as Socket<
      ServerToClientEvents,
      ClientToServerEvents
    >
    socketRef.current = socket

    socket.on('device:status', (data: any) => {
      if (selectedDeviceRef.current && data.id === selectedDeviceRef.current.id) {
        setCurrentSlideIndex(data.slideIndex)
        if (data.programId) {
          fetch(`/api/programs/${data.programId}?depth=2`)
            .then((r) => r.json())
            .then(setCurrentProgram)
            .catch(console.error)
        }
      }
    })

    socket.on('device:stateChange', (data: any) => {
      if (selectedDeviceRef.current && data.id === selectedDeviceRef.current.id) {
        if (data.state) setPlayerState(data.state)
        if (data.state === 'playing' && data.programId) {
          fetch(`/api/programs/${data.programId}?depth=2`)
            .then((r) => r.json())
            .then(setCurrentProgram)
            .catch(console.error)
          setCurrentSlideIndex(data.menuIndex ?? 0)
        } else if (data.state !== 'playing') {
          setCurrentProgram(null)
          setCurrentSlideIndex(0)
        }
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!selectedDeviceId) return
    const id = parseInt(selectedDeviceId, 10)
    const device = devices.find((d) => d.id === id)
    if (!device) return
    selectedDeviceRef.current = device
    setSelectedProgramId('')

    // Try in-memory state store first (instant, accurate)
    fetch(`/api/device-state/${id}`)
      .then((r) => r.json())
      .then((state) => {
        if (state && state.state === 'playing' && state.programId) {
          setPlayerState(state.state)
          setCurrentSlideIndex(state.slideIndex)
          fetch(`/api/programs/${state.programId}?depth=2`)
            .then((r) => r.json())
            .then(setCurrentProgram)
            .catch(console.error)
          return
        }
        // Fall back to device API (slower, stale)
        if (device.currentProgram) {
          const programId =
            typeof device.currentProgram === 'object' ? device.currentProgram.id : device.currentProgram
          fetch(`/api/programs/${programId}?depth=2`)
            .then((r) => r.json())
            .then(setCurrentProgram)
            .catch(console.error)
          setPlayerState('playing')
          setCurrentSlideIndex(device.currentSlideIndex || 0)
        } else {
          setCurrentProgram(null)
          setCurrentSlideIndex(0)
          setPlayerState('idle')
        }
      })
      .catch(() => {
        // If state store unavailable, fall back
        if (device.currentProgram) {
          const programId =
            typeof device.currentProgram === 'object' ? device.currentProgram.id : device.currentProgram
          fetch(`/api/programs/${programId}?depth=2`)
            .then((r) => r.json())
            .then(setCurrentProgram)
            .catch(console.error)
          setPlayerState('playing')
          setCurrentSlideIndex(device.currentSlideIndex || 0)
        } else {
          setCurrentProgram(null)
          setCurrentSlideIndex(0)
          setPlayerState('idle')
        }
      })

    fetch(`/api/schedule?where[devices][contains]=${id}&depth=2&sort=startTime`)
      .then((r) => r.json())
      .then((data) => setAvailableSchedules(data.docs || []))
      .catch(console.error)

    fetch(`/api/programs?depth=2&where[availableDevices][contains]=${id}&limit=100`)
      .then((r) => r.json())
      .then((data) => setAvailablePrograms(data.docs || []))
      .catch(console.error)
  }, [selectedDeviceId, devices])

  useEffect(() => {
    if (stripRef.current && currentSlideIndex >= 0) {
      const thumb = stripRef.current.children[currentSlideIndex] as HTMLElement
      if (thumb) {
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [currentSlideIndex])

  const { slides: flatSlides } = useMemo(
    () => currentProgram ? flattenProgram(currentProgram) : { slides: [] },
    [currentProgram]
  )

  const programOptions = useMemo(() => {
    const seen = new Set<number>()
    const items: { id: number; title: string }[] = []
    for (const s of availableSchedules) {
      const pid = s.program?.id
      if (pid && !seen.has(pid)) {
        seen.add(pid)
        items.push({ id: pid, title: s.program?.title || `Program ${pid}` })
      }
    }
    for (const p of availablePrograms) {
      const pid = p.id
      if (!seen.has(pid)) {
        seen.add(pid)
        items.push({ id: pid, title: p.title || `Program ${pid}` })
      }
    }
    return items
  }, [availableSchedules, availablePrograms])
  const currentSlide = flatSlides[currentSlideIndex] || flatSlides[0]
  const isLastSlide = flatSlides.length > 0 && currentSlideIndex >= flatSlides.length - 1
  const thumbnailUrl = getThumbnailUrl(currentSlide)
  const blockIcon = getBlockIcon(currentSlide)

  const stateColor =
    playerState === 'playing' ? '#22c55e' : playerState === 'menu' ? '#f59e0b' : '#6b7280'

  const handleAdvance = () => {
    if (isLastSlide) {
      handleEnd()
      return
    }
    socketRef.current?.emit('remote:advance', { id: parseInt(selectedDeviceId!, 10) })
  }

  const handlePrevious = () => {
    socketRef.current?.emit('remote:previous', { id: parseInt(selectedDeviceId!, 10) })
  }

  const handleGotoSlide = (slideIndex: number) => {
    socketRef.current?.emit('remote:goto', { id: parseInt(selectedDeviceId!, 10), slideIndex })
  }

  const handleEnd = () => {
    if (!confirm('Are you sure you want to end the current program?')) return
    socketRef.current?.emit('remote:back', { id: parseInt(selectedDeviceId!, 10) })
    setPlayerState('idle')
    setCurrentProgram(null)
    setCurrentSlideIndex(0)
  }

  const handlePause = () => {
    socketRef.current?.emit('remote:pause', { id: parseInt(selectedDeviceId!, 10) })
  }

  const handleLoadProgram = () => {
    if (!selectedProgramId) return
    socketRef.current?.emit('remote:program', {
      id: parseInt(selectedDeviceId!, 10),
      programId: parseInt(selectedProgramId, 10),
    })
  }

  const isPlaying = playerState === 'playing' && currentProgram

  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <div style={{ padding: 16, maxWidth: 600 }}>
        <select
          value={selectedDeviceId || ''}
          onChange={(e) => setSelectedDeviceId(e.target.value || null)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '1rem',
            borderRadius: 6,
            border: '1px solid var(--theme-elevation-200, #ccc)',
            background: 'var(--theme-input-bg, #fff)',
            marginBottom: 16,
          }}
        >
          <option value="">Select a device...</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {selectedDeviceId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--theme-elevation-100, #f3f4f6)',
              fontSize: '0.85rem',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: stateColor,
              }}
            />
            <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{playerState}</span>
          </div>
        )}

        {/* Control buttons — different per state */}
        {isPlaying ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={handleEnd}
              style={{
                flex: 1,
                minHeight: 40,
                fontSize: '0.9rem',
                borderRadius: 6,
                border: '1px solid var(--theme-elevation-300, #ccc)',
                background: '#ef4444',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              End Program
            </button>
          </div>
        ) : selectedDeviceId ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: '0.9rem',
                borderRadius: 6,
                border: '1px solid var(--theme-elevation-200, #ccc)',
              }}
            >
              <option value="">Select a program...</option>
              {programOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <button
              onClick={handleLoadProgram}
              style={{
                minHeight: 40,
                padding: '0 16px',
                fontSize: '0.9rem',
                borderRadius: 6,
                border: '1px solid var(--theme-elevation-200, #ccc)',
                background: 'var(--theme-primary-500, #2563eb)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Load Program
            </button>
          </div>
        ) : null}

        {/* Slide content */}
        {currentProgram && (
          <>
            <div
              style={{
                width: '100%',
                maxHeight: 300,
                background: 'var(--theme-elevation-50, #111)',
                borderRadius: 8,
                overflow: 'hidden',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {currentSlide?.blockType === 'blackScreenBlock' ? (
                <div style={{ width: '100%', height: 300, background: '#000' }} />
              ) : thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={`Slide ${currentSlideIndex + 1}`}
                  style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }}
                />
              ) : blockIcon ? (
                <span style={{ fontSize: '3rem', padding: 40 }}>{blockIcon}</span>
              ) : (
                <span
                  style={{
                    color: 'var(--theme-elevation-500, #888)',
                    fontSize: '0.9rem',
                    padding: 40,
                  }}
                >
                  No preview
                </span>
              )}
            </div>

            <div
              style={{
                textAlign: 'center',
                fontSize: '0.85rem',
                color: 'var(--theme-elevation-600, #666)',
                marginBottom: 12,
              }}
            >
              Slide {currentSlideIndex + 1} of {flatSlides.length}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={handlePrevious}
                style={{
                  flex: 1,
                  minHeight: 48,
                  fontSize: '1rem',
                  borderRadius: 6,
                  border: '1px solid var(--theme-elevation-200, #ccc)',
                  background: 'var(--theme-input-bg, #fff)',
                  cursor: 'pointer',
                  color: 'var(--theme-text, #333)',
                }}
              >
                ◀ Prev
              </button>
              <button
                onClick={handlePause}
                style={{
                  flex: 1,
                  minHeight: 48,
                  fontSize: '1rem',
                  borderRadius: 6,
                  border: '1px solid var(--theme-elevation-200, #ccc)',
                  background: 'var(--theme-elevation-100, #f3f4f6)',
                  cursor: 'pointer',
                  color: 'var(--theme-text, #333)',
                }}
              >
                ⏸ Pause
              </button>
              <button
                onClick={handleAdvance}
                style={{
                  flex: 1,
                  minHeight: 48,
                  fontSize: '1rem',
                  borderRadius: 6,
                  border: '1px solid var(--theme-elevation-200, #ccc)',
                  background: 'var(--theme-primary-500, #3b82f6)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {isLastSlide ? 'End ◼' : 'Next ▶'}
              </button>
            </div>

            <div
              ref={stripRef}
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 8,
                scrollbarWidth: 'thin',
              }}
            >
              {flatSlides.map((slide: any, i: number) => {
                const url = getThumbnailUrl(slide)
                const icon = getBlockIcon(slide)
                return (
                  <div
                    key={slide.id || i}
                    onClick={() => handleGotoSlide(i)}
                    style={{
                      flexShrink: 0,
                      cursor: 'pointer',
                      border:
                        i === currentSlideIndex
                          ? '3px solid var(--theme-primary-500, #3b82f6)'
                          : '3px solid transparent',
                      borderRadius: 6,
                      overflow: 'hidden',
                      width: 80,
                      height: 60,
                      background: 'var(--theme-elevation-100, #222)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {slide.blockType === 'blackScreenBlock' ? (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: '#000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ color: '#666', fontSize: '0.65rem' }}>◼</span>
                      </div>
                    ) : url ? (
                      <img
                        src={url}
                        alt={`Slide ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : icon ? (
                      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                    ) : (
                      <span
                        style={{
                          color: 'var(--theme-elevation-500, #888)',
                          fontSize: '0.65rem',
                        }}
                      >
                        {i + 1}
                      </span>
                    )}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 1,
                        right: 3,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: '0.6rem',
                        padding: '0 3px',
                        borderRadius: 2,
                        lineHeight: '1.2',
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {selectedDeviceId && !currentProgram && !isPlaying && (
          <p
            style={{
              color: 'var(--theme-elevation-500, #888)',
              textAlign: 'center',
              padding: 40,
            }}
          >
            No program currently active on this device.
          </p>
        )}
      </div>
    </div>
  )
}
