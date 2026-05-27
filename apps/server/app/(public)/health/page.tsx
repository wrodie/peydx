'use client'

import { useEffect, useState } from 'react'

interface Device {
  id: number
  name: string
  deviceId: string
  departments: string[]
  status?: 'online' | 'offline' | 'stale' | null
  lastHeartbeat?: string | null
  currentProgram?: { id: number; title: string } | null
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

export default function HealthDashboard() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/devices?depth=1')
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

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading devices...</div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', color: '#c44' }}>
        Error: {error}
      </div>
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
    <div style={{ padding: 40, fontFamily: 'system-ui', maxWidth: 900 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 8 }}>
        Device Health Dashboard
      </h1>

      <div
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                color: '#666',
              }}
            >
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px' }}>Device</th>
              <th style={{ padding: '10px 12px' }}>Deparments</th>
              <th style={{ padding: '10px 12px' }}>Current Program</th>
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
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>
                      {device.deviceId}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                    {(device.departments || []).join(', ')}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                    {device.currentProgram
                      ? device.currentProgram.title
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#888' }}>
                    {formatTime(device.lastHeartbeat)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
