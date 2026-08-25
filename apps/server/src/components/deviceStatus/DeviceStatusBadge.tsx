'use client'

import { computeStatus, STATUS_COLORS, STATUS_LABELS } from '../../utilities/ui/deviceStatus'

export function DeviceStatusBadge({
  lastHeartbeat,
  size = 10,
  showLabel = false,
}: {
  lastHeartbeat: string | null | undefined
  size?: number
  showLabel?: boolean
}) {
  const status = computeStatus(lastHeartbeat)
  const color = STATUS_COLORS[status]

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
        title={status}
      />
      {showLabel && (
        <span style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600)' }}>{STATUS_LABELS[status]}</span>
      )}
    </span>
  )
}
