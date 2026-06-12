'use client'

import { useDocumentInfo, useField, useAuth } from '@payloadcms/ui'
import { useCallback, useState } from 'react'

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.85rem',
  border: '1px solid var(--theme-elevation-200, #ddd)',
  borderRadius: 4,
  cursor: 'pointer',
  background: 'var(--theme-elevation-50, #f8f8f8)',
  color: 'var(--theme-elevation-900, #111)',
}

const successStyle: React.CSSProperties = {
  color: 'var(--theme-success-500, #22c55e)',
  fontSize: '0.8rem',
  marginTop: 8,
}

const errorStyle: React.CSSProperties = {
  color: 'var(--theme-error-500, #ef4444)',
  fontSize: '0.8rem',
  marginTop: 8,
}

async function fetchClientVersion(): Promise<string> {
  const res = await fetch('/api/globals/settings')
  if (!res.ok) return 'v0.1.0'
  const data = await res.json()
  return data.clientVersion || 'v0.1.0'
}

export function UpdateButton() {
  const { user } = useAuth()
  const { id } = useDocumentInfo()
  const { value: clientVersion } = useField<string>({ path: 'clientVersion' })

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  // Per-device mode (inside Devices collection)
  const isDeviceView = !!(id && clientVersion === undefined)

  const handlePushUpdate = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const version = clientVersion || (await fetchClientVersion())
      const body: { deviceId?: number } = {}
      if (isDeviceView && id) {
        body.deviceId = id
      }
      const res = await fetch('/api/push-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStatus({ type: 'success', message: `${data.devicesUpdated} device(s) updated` })
      } else {
        setStatus({ type: 'error', message: data.error || 'Update failed' })
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Network error' })
    } finally {
      setLoading(false)
    }
  }, [clientVersion, id, isDeviceView])

  if (user?.role !== 'admin') return null

  if (isDeviceView) {
    return (
      <div style={{ padding: '12px 0' }}>
        <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--theme-elevation-500, #666)', marginBottom: 4, display: 'block' }}>
          Remote Update
        </label>
        <button type="button" style={buttonStyle} onClick={handlePushUpdate} disabled={loading}>
          {loading ? 'Updating...' : 'Push Update'}
        </button>
        {status && (
          <div style={status.type === 'success' ? successStyle : errorStyle}>
            {status.message}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-700, #444)', marginBottom: 12 }}>
        Current client version: <strong>{clientVersion || 'v0.1.0'}</strong>
      </p>
      <button type="button" style={buttonStyle} onClick={handlePushUpdate} disabled={loading}>
        {loading ? 'Pushing...' : `Push ${clientVersion || 'v0.1.0'} to All Devices`}
      </button>
      {status && (
        <div style={status.type === 'success' ? successStyle : errorStyle}>
          {status.message}
        </div>
      )}
    </div>
  )
}
