'use client'

import { TopNavHeader } from '@/components/TopNavHeader'
import { DeviceStatusProvider } from '@/components/deviceStatus/DeviceStatusProvider'
import { DeviceStatusTable } from '@/components/deviceStatus/DeviceStatusTable'
import { useDeviceStatus } from '@/components/deviceStatus/useDeviceStatus'
import { computeStatus, STATUS_COLORS } from '@/utilities/ui/deviceStatus'

function HealthContent() {
  const { devices, loading, refresh } = useDeviceStatus()

  if (loading) {
    return <div style={{ padding: 40 }}>Loading devices...</div>
  }

  const onlineCount = devices.filter((d) => computeStatus(d.lastHeartbeat) === 'online').length
  const staleCount = devices.filter((d) => computeStatus(d.lastHeartbeat) === 'stale').length
  const offlineCount = devices.filter((d) => computeStatus(d.lastHeartbeat) === 'offline').length

  return (
    <div className="health-outer" style={{ padding: 40, maxWidth: '1200px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 8 }}>
        Device Health Dashboard
      </h1>

      <div
        className="health-summary-row"
        style={{ display: 'flex', gap: 24, marginBottom: 32, fontSize: '0.875rem' }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: STATUS_COLORS.online,
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
              background: STATUS_COLORS.stale,
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
              background: STATUS_COLORS.offline,
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
          <DeviceStatusTable devices={devices} />
        </div>
      )}
    </div>
  )
}

export default function HealthDashboard() {
  return (
    <>
      <TopNavHeader />
      <DeviceStatusProvider>
        <HealthContent />
      </DeviceStatusProvider>
    </>
  )
}
