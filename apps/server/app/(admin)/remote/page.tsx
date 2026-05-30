'use client'

import { useEffect, useState, useRef } from 'react'
import { SlideEngine } from 'signage-core'
import type { SlideEngineHandle, Program } from 'signage-core'
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

export default function RemoteControlPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const engineRef = useRef<SlideEngineHandle>(null)
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

    socket.on('device:status', (data) => {
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
        .then((prog: Program) => {
          setCurrentProgram(prog)
          setCurrentSlideIndex(device.currentSlideIndex || 0)
        })
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

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1200 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Remote Control</h1>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: '0.85rem', marginRight: 8 }}>Device:</label>
        <select
          value={selectedDeviceId || ''}
          onChange={e => setSelectedDeviceId(e.target.value || null)}
          style={{ padding: '6px 12px', fontSize: '0.9rem', borderRadius: 4, border: '1px solid #ccc' }}
        >
          <option value="">Select a device...</option>
          {devices.map(d => (
            <option key={d.id} value={d.deviceId}>{d.name} ({d.deviceId})</option>
          ))}
        </select>
      </div>

      {currentProgram && (
        <>
          <div style={{
            width: '100%',
            maxWidth: 960,
            aspectRatio: '16/9',
            background: '#111',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 16,
            position: 'relative',
          }}>
            <SlideEngine
              ref={engineRef}
              program={currentProgram}
              onProgramEnd={() => {}}
              initialSlideIndex={currentSlideIndex}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={handlePrevious}
              style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Previous
            </button>
            <button
              onClick={handleAdvance}
              style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Next
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {currentProgram.slides?.map((slide: any, i: number) => {
              const thumbnailUrl = getThumbnailUrl(slide)
              return (
                <div
                  key={slide.id || i}
                  onClick={() => handleGotoSlide(i)}
                  style={{
                    flexShrink: 0,
                    cursor: 'pointer',
                    border: i === currentSlideIndex ? '3px solid #3b82f6' : '3px solid transparent',
                    borderRadius: 6,
                    overflow: 'hidden',
                    width: 100,
                    height: 75,
                    background: '#222',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt={`Slide ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#888', fontSize: '0.7rem' }}>Slide {i + 1}</span>
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 4,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontSize: '0.65rem',
                    padding: '0 4px',
                    borderRadius: 2,
                  }}>
                    {i + 1}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!currentProgram && selectedDeviceId && (
        <p style={{ color: '#888' }}>No program currently active on this device.</p>
      )}
    </div>
  )
}
