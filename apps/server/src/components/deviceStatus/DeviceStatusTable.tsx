'use client'

import { DeviceStatusBadge } from './DeviceStatusBadge'
import { slideCount } from './deviceStatusLogic'
import type { DeviceStatus } from './useDeviceStatus'

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

export function DeviceStatusTable({ devices }: { devices: DeviceStatus[] }) {
  return (
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
          const total = slideCount(device.currentProgram)
          const slideIndex = device.currentSlideIndex ?? 0
          return (
            <tr
              key={device.id}
              style={{
                borderBottom: '1px solid #eee',
                background: device.status === 'offline' ? 'rgba(107,114,128,0.05)' : undefined,
              }}
            >
              <td style={{ padding: '10px 12px' }}>
                <DeviceStatusBadge lastHeartbeat={device.lastHeartbeat} />
              </td>
              <td style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 500 }}>{device.name}</div>
              </td>
              <td style={{ padding: '10px 12px' }}>
                {device.deviceType === 'browser' ? 'Browser' : 'Hardware'}
              </td>
              <td style={{ padding: '10px 12px' }}>
                {(device.departments || []).map((d: any) => (typeof d === 'object' ? d.name : d)).join(', ')}
              </td>
              <td style={{ padding: '10px 12px' }}>
                {device.currentProgram ? device.currentProgram.title || `Program ${device.currentProgram.id}` : '—'}
              </td>
              <td style={{ padding: '10px 12px' }}>
                {device.currentProgram && total > 0 ? `Slide ${slideIndex + 1} of ${total}` : '—'}
              </td>
              <td style={{ padding: '10px 12px', color: '#888' }}>{formatTime(device.lastHeartbeat)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
