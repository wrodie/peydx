'use client'

import { useDocumentInfo, useField, useAuth } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

const sectionStyle: React.CSSProperties = {
  padding: '12px 0',
  borderBottom: '1px solid var(--theme-elevation-100, #eee)',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  color: 'var(--theme-elevation-500, #666)',
  marginBottom: 4,
  display: 'block',
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '0.85rem',
  border: '1px solid var(--theme-elevation-200, #ddd)',
  borderRadius: 4,
  cursor: 'pointer',
  background: 'var(--theme-elevation-50, #f8f8f8)',
  color: 'var(--theme-elevation-900, #111)',
}

const deployButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'var(--theme-success-500, #22c55e)',
  color: '#fff',
  border: 'none',
}

const infoStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--theme-elevation-700, #444)',
  marginBottom: 8,
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

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999,
  color: '#fff',
  fontFamily: 'inherit',
  gap: 16,
}

async function fetchClientVersion(): Promise<string> {
  try {
    const res = await fetch('/api/globals/settings')
    if (!res.ok) return 'v0.1.0'
    const data = await res.json()
    return data.clientVersion || 'v0.1.0'
  } catch {
    return 'v0.1.0'
  }
}

export function UpdateButton() {
  const { user } = useAuth()
  const { id } = useDocumentInfo()
  const { value: clientVersion } = useField<string>({ path: 'clientVersion' })

  const [pushStatus, setPushStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pushLoading, setPushLoading] = useState(false)

  const [serverInfo, setServerInfo] = useState<{
    currentVersion: string
    latestVersion: string
    updateAvailable: boolean
  } | null>(null)
  const [deployLoading, setDeployLoading] = useState(false)
  const [deployStatus, setDeployStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deploying, setDeploying] = useState(false)
  const reconnectingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isDeviceView = !!(id && clientVersion === undefined)
  const isSettingsView = !isDeviceView && clientVersion !== undefined

  const handlePushUpdate = useCallback(async () => {
    setPushLoading(true)
    setPushStatus(null)
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
        setPushStatus({ type: 'success', message: `${data.devicesUpdated} device(s) updated` })
      } else {
        setPushStatus({ type: 'error', message: data.error || 'Update failed' })
      }
    } catch (err: any) {
      setPushStatus({ type: 'error', message: err.message || 'Network error' })
    } finally {
      setPushLoading(false)
    }
  }, [clientVersion, id, isDeviceView])

  const fetchServerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/server-status')
      if (res.ok) {
        const data = await res.json()
        setServerInfo(data)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (isSettingsView) {
      fetchServerStatus()
    }
  }, [isSettingsView, fetchServerStatus])

  const startReconnecting = useCallback(() => {
    setDeploying(true)
    let attempts = 0
    reconnectingRef.current = setInterval(async () => {
      attempts++
      try {
        const res = await fetch('/api/server-status')
        if (res.ok) {
          clearInterval(reconnectingRef.current!)
          reconnectingRef.current = null
          window.location.reload()
        }
      } catch {}
      if (attempts > 40) {
        clearInterval(reconnectingRef.current!)
        reconnectingRef.current = null
        setDeploying(false)
        setDeployStatus({ type: 'error', message: 'Server did not come back within 2 minutes. Check the server manually.' })
      }
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (reconnectingRef.current) clearInterval(reconnectingRef.current)
    }
  }, [])

  const handleDeploy = useCallback(async () => {
    if (!serverInfo?.latestVersion || serverInfo.latestVersion === 'unknown') {
      setDeployStatus({ type: 'error', message: 'No version information available' })
      return
    }
    setDeployLoading(true)
    setDeployStatus(null)
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: serverInfo.latestVersion }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setDeployStatus({ type: 'success', message: 'Deploy started. Server will restart.' })
        startReconnecting()
      } else {
        setDeployStatus({ type: 'error', message: data.error || 'Deploy failed' })
      }
    } catch (err: any) {
      setDeployStatus({ type: 'error', message: err.message || 'Network error' })
    } finally {
      setDeployLoading(false)
    }
  }, [serverInfo, startReconnecting])

  if (user?.role !== 'admin') return null

  if (isDeviceView) {
    return (
      <div style={{ padding: '12px 0' }}>
        <label style={labelStyle}>Remote Update</label>
        <button type="button" style={buttonStyle} onClick={handlePushUpdate} disabled={pushLoading}>
          {pushLoading ? 'Updating...' : 'Push Update'}
        </button>
        {pushStatus && (
          <div style={pushStatus.type === 'success' ? successStyle : errorStyle}>
            {pushStatus.message}
          </div>
        )}
      </div>
    )
  }

  const version = clientVersion || 'v0.1.0'
  const currentServerVersion = serverInfo?.currentVersion || '...'
  const latestVersion = serverInfo?.latestVersion || '...'
  const hasUpdate = serverInfo?.updateAvailable || false

  return (
    <div>
      <div style={sectionStyle}>
        <label style={labelStyle}>Server Version</label>
        <div style={infoStyle}>
          Current: <strong>{currentServerVersion}</strong>
          {hasUpdate && (
            <span style={{ color: 'var(--theme-warning-500, #f59e0b)', marginLeft: 8 }}>
              Update available: {latestVersion}
            </span>
          )}
        </div>
        <button
          type="button"
          style={deployButtonStyle}
          onClick={handleDeploy}
          disabled={deployLoading || !hasUpdate}
        >
          {deployLoading ? 'Starting...' : hasUpdate ? `Deploy ${latestVersion}` : 'Up to date'}
        </button>
        {deployStatus && (
          <div style={deployStatus.type === 'success' ? successStyle : errorStyle}>
            {deployStatus.message}
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Client Version</label>
        <p style={infoStyle}>
          Deployed client version: <strong>{version}</strong>
        </p>
        <button type="button" style={buttonStyle} onClick={handlePushUpdate} disabled={pushLoading}>
          {pushLoading ? 'Pushing...' : `Push ${version} to All Devices`}
        </button>
        {pushStatus && (
          <div style={pushStatus.type === 'success' ? successStyle : errorStyle}>
            {pushStatus.message}
          </div>
        )}
      </div>

      {deploying && (
        <div style={overlayStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>Server is restarting...</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>This page will refresh automatically when the server is back.</div>
        </div>
      )}
    </div>
  )
}
