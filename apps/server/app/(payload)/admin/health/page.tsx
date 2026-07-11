'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from 'signage-core'
import { flattenProgram } from 'signage-core'
import { TopNavHeader } from '@/components/TopNavHeader'

interface Device {
  id: number
  name: string
  deviceType?: 'hardware' | 'browser'
  departments: Array<{ id: number; name: string }> | string[]
  status?: 'online' | 'offline' | 'stale' | null
  lastHeartbeat?: string | null
  currentProgram?: { id: number; title: string; slides?: any[] } | null
  currentSlideIndex?: number | null
}

function computeStatus(lastHeartbeat: string | null | undefined): 'online' | 'stale' | 'offline' {
  if (!lastHeartbeat) return 'offline'
  const diff = Date.now() - new Date(lastHeartbeat).getTime()
  if (diff < 3 * 60 * 1000) return 'online'
  if (diff < 10 * 60 * 1000) return 'stale'
  return 'offline'
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60) return `${mins} mins ago`
  const hours = Math.floor(mins / 60)
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  return d.toLocaleString()
}

const statusColors: Record<string, string> = {
  online: '#2ecc71',
  stale: '#f1c40f',
  offline: '#e74c3c',
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export default function HealthDashboard() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<TypedSocket | null>(null)

  const updateDevice = useCallback((id: number, patch: Partial<Device>) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )
  }, [])

  useEffect(() => {
    fetch('/api/devices?depth=2')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch devices')
        return r.json()
      })
      .then((data) => {
        setDevices(data.docs || [])
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const socket: TypedSocket = io(window.location.origin, { path: '/api/ws' })
    socketRef.current = socket

    socket.on('device:status', (data) => {
      updateDevice(data.id, {
        status: data.status as any,
        currentSlideIndex: data.slideIndex,
      })
    })

    socket.on('device:stateChange', (data) => {
      updateDevice(data.id, {
        lastHeartbeat: new Date().toISOString(),
      })
    })

    return () => { socket.disconnect() }
  }, [updateDevice])

  if (loading) {
    return (
      <>
        <TopNavHeader />
        <div style={{ padding: 40 }}>Loading devices...</div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <TopNavHeader />
        <div style={{ padding: 40, color: '#c44' }}>
          Error: {error}
        </div>
      </>
    )
  }

  const onlineCount = devices.filter(
    (d) => computeStatus(d.lastHeartbeat) === 'online',
  ).length
  const staleCount = devices.filter(
    (d) => computeStatus(d.lastHeartbeat) === 'stale',
  ).length
  const offlineCount = devices.filter(
    (d) => computeStatus(d.lastHeartbeat) === 'offline',
  ).length

  return (
    <>
      <TopNavHeader />
      <div className="health-outer" style={{ padding: 40, maxWidth: '1200px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 8 }}>
          Device Health Dashboard
        </h1>

        <div
          className="health-summary-row"
          style={{
            display: 'flex',
            gap: 24,
            marginBottom: 32,
            fontSize: '0.875rem',
          }}
        >
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: statusColors.online,
                marginRight: 6,
              }}
            />
            Online: {onlineCount}
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: statusColors.stale,
                marginRight: 6,
              }}
            />
            Stale: {staleCount}
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: statusColors.offline,
                marginRight: 6,
              }}
            />
            Offline: {offlineCount}
          </span>
        </div>

        {devices.length === 0 ? (
          <p style={{ color: '#888' }}>No devices registered.</p>
        ) : (
          <div className="health-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid #ddd',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  color: '#666',
                }}
              >
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Device</th>
                <th style={{ padding: '10px 12px' }}>Type</th>
                <th style={{ padding: '10px 12px' }}>Departments</th>
                <th style={{ padding: '10px 12px' }}>Current Program</th>
                <th style={{ padding: '10px 12px' }}>Current Slide</th>
                <th style={{ padding: '10px 12px' }}>Last Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const status = computeStatus(device.lastHeartbeat)
                return (
                  <tr
                    key={device.id}
                    style={{
                      borderBottom: '1px solid #eee',
                      background:
                        status === 'offline' ? 'rgba(231,76,60,0.05)' : undefined,
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: statusColors[status],
                        }}
                        title={status}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 500 }}>{device.name}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {device.deviceType === 'browser' ? 'Browser' : 'Hardware'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {(device.departments || []).map((d: any) =>
                        typeof d === 'object' ? (d as { name: string }).name : d
                      ).join(', ')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {device.currentProgram
                        ? device.currentProgram.title || `Program ${device.currentProgram.id}`
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {device.currentProgram && device.currentSlideIndex != null
                        ? (() => {
                            const program = device.currentProgram as any
                            const flatProgram = flattenProgram(program)
                            if (!flatProgram.slides.length) return '—'
                            const slide = flatProgram.slides[device.currentSlideIndex] as any
                            if (!slide) return '—'
                            if (slide.blockType === 'imageBlock' && slide.image) {
                              const img = typeof slide.image === 'object' ? slide.image : null
                              return img?.sizes?.thumbnail?.url ? (
                                <img
                                  src={img.sizes.thumbnail.url}
                                  style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4 }}
                                  alt=""
                                />
                              ) : '—'
                            }
                            if (slide.blockType === 'videoBlock' && slide.video) {
                              const vid = typeof slide.video === 'object' ? slide.video : null
                              if (vid?.sizes?.thumbnail?.url) {
                                return (
                                  <img
                                    src={vid.sizes.thumbnail.url}
                                    style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4 }}
                                    alt=""
                                  />
                                )
                              }
                            }
                            if (slide.blockType === 'youtubeBlock' && slide.youtubeId) {
                              return (
                                <img
                                  src={`https://img.youtube.com/vi/${slide.youtubeId}/mqdefault.jpg`}
                                  style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4 }}
                                  alt=""
                                />
                              )
                            }
                            if (slide.blockType === 'blackScreenBlock') {
                              return (
                                <div style={{ width: 60, height: 45, background: '#111', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ color: '#666', fontSize: '0.65rem' }}>◼</span>
                                </div>
                              )
                            }
                            return `Slide ${device.currentSlideIndex + 1}`
                          })()
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#888' }}>
                      {formatTime(device.lastHeartbeat)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  )
}
