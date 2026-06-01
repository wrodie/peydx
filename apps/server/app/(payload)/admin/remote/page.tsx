'use client'

import { RemoteControlView } from '@/components/RemoteControlView'

export default function RemoteControlPage() {
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--theme-elevation-50, #f8f8f8)',
          borderBottom: '1px solid var(--theme-elevation-150, #e0e0e0)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <a
          href="/admin"
          style={{
            fontSize: '0.85rem',
            color: 'var(--theme-elevation-600, #666)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Admin
        </a>
        <span
          style={{
            fontSize: '0.85rem',
            color: 'var(--theme-elevation-400, #999)',
          }}
        >
          /
        </span>
        <span
          style={{
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'var(--theme-text, #333)',
          }}
        >
          Remote Control
        </span>
      </div>

      <RemoteControlView />
    </div>
  )
}
