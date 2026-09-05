'use client'

import { DeviceStatusBadge } from './DeviceStatusBadge'
import type { DeviceStatus } from './useDeviceStatus'

export function DeviceStatusGrid({
  devices,
  adminRoute = '/admin',
}: {
  devices: DeviceStatus[]
  adminRoute?: string
}) {
  if (devices.length === 0) {
    return <p style={{ color: 'var(--theme-elevation-500)', padding: '20px 0' }}>No devices in your departments</p>
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
      {devices.map((d) => (
        <div
          key={d.id}
          className="dash-device-card"
          style={{
            width: '240px',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--theme-elevation-200)',
            background: 'var(--theme-elevation-50)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <DeviceStatusBadge lastHeartbeat={d.lastHeartbeat} showLabel />
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--theme-text)' }}>{d.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)' }}>
            Program: {d.currentProgram?.title || '--'}
          </div>
          <a
            href={`${adminRoute}/remote?device=${d.id}`}
            style={{
              display: 'inline-block',
              textAlign: 'center',
              textDecoration: 'none',
              marginTop: '4px',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'var(--theme-primary-500, #2563eb)',
              color: '#fff',
            }}
          >
            Remote Control
          </a>
        </div>
      ))}
    </div>
  )
}
