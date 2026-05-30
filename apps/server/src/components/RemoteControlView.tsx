'use client'

import { useEffect, useState, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

function getThumbnailUrl(slide: any): string | null {
  if (!slide) return null
  if (slide.blockType === 'imageBlock' && slide.image) {
    const img = typeof slide.image === 'object' ? slide.image : null
    if (!img) return null
    return img.sizes?.thumbnail?.url || img.url || null
  }
  if (slide.blockType === 'youtubeBlock' && slide.youtubeId) {
    return `https://img.youtube.com/vi/${slide.youtubeId}/mqdefault.jpg`
  }
  return null
}

function getBlockIcon(slide: any): string | null {
  if (!slide) return null
  if (slide.blockType === 'videoBlock') return '🎬'
  if (slide.blockType === 'youtubeBlock') return '▶️'
  return null
}

export function RemoteControlView() {
  const [devices, setDevices] = useState<any[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [currentProgram, setCurrentProgram] = useState<any>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const selectedDeviceRef = useRef<any>(null)

  useEffect(() => {
    fetch('/api/devices?depth=1&limit=100')
      .then(r => r.json())
      .then(data => setDevices(data.docs || []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    const socket = io(window.location.origin, { path: '/api/ws' }) as Socket<ServerToClientEvents, ClientToServerEvents>
    socketRef.current = socket

    socket.on('device:status', (data: any) => {
      if (selectedDeviceRef.current && data.deviceId === selectedDeviceRef.current.deviceId) {
        setCurrentSlideIndex(data.slideIndex)
        if (data.programId && data.programId !== (currentProgram?.id ?? null)) {
          fetch(`/api/programs/${data.programId}?depth=2`)
            .then(r => r.json())
            .then(setCurrentProgram)
            .catch(console.error)
        }
      }
    })

    return () => { socket.disconnect() }
  }, [])

  useEffect(() => {
    if (!selectedDeviceId) return
    const device = devices.find(d => d.deviceId === selectedDeviceId) || devices.find(d => d.id?.toString() === selectedDeviceId)
    if (!device) return
    selectedDeviceRef.current = device

    if (device.currentProgram) {
      const programId = typeof device.currentProgram === 'object' ? device.currentProgram.id : device.currentProgram
      fetch(`/api/programs/${programId}?depth=2`)
        .then(r => r.json())
        .then(setCurrentProgram)
        .catch(console.error)
    } else {
      setCurrentProgram(null)
    }
  }, [selectedDeviceId, devices])

  const handleAdvance = () => {
    socketRef.current?.emit('remote:advance', { deviceId: selectedDeviceId! })
  }

  const handlePrevious = () => {
    socketRef.current?.emit('remote:previous', { deviceId: selectedDeviceId! })
  }

  const handleGotoSlide = (slideIndex: number) => {
    socketRef.current?.emit('remote:goto', { deviceId: selectedDeviceId!, slideIndex })
  }

  const slides = currentProgram?.slides || []
  const currentSlide = slides[currentSlideIndex] || slides[0]
  const thumbnailUrl = getThumbnailUrl(currentSlide)
  const blockIcon = getBlockIcon(currentSlide)

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui', maxWidth: 600 }}>
      <h1 style={{ fontSize: '1.25rem', margin: '0 0 12px' }}>Remote Control</h1>

      <select
        value={selectedDeviceId || ''}
        onChange={e => setSelectedDeviceId(e.target.value || null)}
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
        {devices.map(d => (
          <option key={d.id} value={d.deviceId}>{d.name} ({d.deviceId})</option>
        ))}
      </select>

      {selectedDeviceId && !currentProgram && (
        <p style={{ color: 'var(--theme-elevation-500, #888)', textAlign: 'center', padding: 40 }}>
          No program currently active on this device.
        </p>
      )}

      {currentProgram && (
        <>
          <div style={{
            width: '100%',
            maxHeight: 300,
            background: 'var(--theme-elevation-50, #111)',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`Slide ${currentSlideIndex + 1}`}
                style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }}
              />
            ) : blockIcon ? (
              <span style={{ fontSize: '3rem', padding: 40 }}>{blockIcon}</span>
            ) : (
              <span style={{ color: 'var(--theme-elevation-500, #888)', fontSize: '0.9rem', padding: 40 }}>
                No preview
              </span>
            )}
          </div>

          <div style={{
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'var(--theme-elevation-600, #666)',
            marginBottom: 12,
          }}>
            Slide {currentSlideIndex + 1} of {slides.length}
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
              Next ▶
            </button>
          </div>

          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 8,
            scrollbarWidth: 'thin',
          }}>
            {slides.map((slide: any, i: number) => {
              const url = getThumbnailUrl(slide)
              const icon = getBlockIcon(slide)
              return (
                <div
                  key={slide.id || i}
                  onClick={() => handleGotoSlide(i)}
                  style={{
                    flexShrink: 0,
                    cursor: 'pointer',
                    border: i === currentSlideIndex ? '3px solid var(--theme-primary-500, #3b82f6)' : '3px solid transparent',
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
                  {url ? (
                    <img src={url} alt={`Slide ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : icon ? (
                    <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                  ) : (
                    <span style={{ color: 'var(--theme-elevation-500, #888)', fontSize: '0.65rem' }}>{i + 1}</span>
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: 1,
                    right: 3,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontSize: '0.6rem',
                    padding: '0 3px',
                    borderRadius: 2,
                    lineHeight: '1.2',
                  }}>
                    {i + 1}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
