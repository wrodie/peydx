'use client'

import { useAuth } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from 'signage-core'
import {
  FiberManualRecordIcon,
  PendingIcon,
  RadioButtonUncheckedIcon,
  CheckIcon,
  ArrowForwardIcon,
} from './icons'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface DeviceRow {
  id: number
  name: string
  deviceType: string
  status: string
  clientVersion: string | null
}

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
  gap: 8,
}

const steps = [
  { key: 'checkout', label: 'Checking out version' },
  { key: 'building', label: 'Building client image' },
  { key: 'pushing', label: 'Pushing to registry' },
  { key: 'rebuilding', label: 'Rebuilding server' },
]

function getStepInfo(step: string | null) {
  if (!step) return null
  const idx = steps.findIndex(s => s.key === step)
  return { idx, current: step }
}

function statusDot(status: string): React.ReactNode {
  switch (status) {
    case 'online': return <FiberManualRecordIcon size={12} style={{ color: '#22c55e' }} />
    case 'updating': return <PendingIcon size={12} style={{ color: '#f59e0b' }} />
    default: return <RadioButtonUncheckedIcon size={12} style={{ color: '#6b7280' }} />
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'online': return '#22c55e'
    case 'updating': return '#f59e0b'
    default: return '#999'
  }
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 12,
  fontSize: '0.85rem',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '2px solid var(--theme-elevation-200, #ddd)',
  color: 'var(--theme-elevation-500, #666)',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--theme-elevation-100, #eee)',
}

const smallButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: '0.8rem',
  border: '1px solid var(--theme-elevation-200, #ddd)',
  borderRadius: 4,
  cursor: 'pointer',
  background: 'var(--theme-elevation-50, #f8f8f8)',
  color: 'var(--theme-elevation-900, #111)',
}

export function UpdateButton() {
  const { user } = useAuth()

  const [pushStatus, setPushStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushDeviceStatus, setPushDeviceStatus] = useState<Record<number, { type: 'loading' | 'success' | 'error'; message: string } | null>>({})

  const [serverInfo, setServerInfo] = useState<{
    currentVersion: string
    latestVersion: string
    updateAvailable: boolean
    serverManager?: boolean
    error?: string | null
  } | null>(null)
  const [deployLoading, setDeployLoading] = useState(false)
  const [deployStatus, setDeployStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deploying, setDeploying] = useState(false)
  const [deployStep, setDeployStep] = useState<string | null>(null)
  const reconnectingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deployPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [devicesLoading, setDevicesLoading] = useState(true)

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices?depth=0&limit=100')
      if (!res.ok) return
      const data = await res.json()
      setDevices((data.docs || []).map((d: any) => ({
        id: d.id,
        name: d.name || '(unnamed)',
        deviceType: d.deviceType || 'hardware',
        status: d.status || 'offline',
        clientVersion: d.clientVersion || null,
      })))
    } catch {
      // ignore
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDevices()

    const socket: TypedSocket = io(window.location.origin, {
      path: '/api/ws',
      transports: ['websocket', 'polling'],
    }) as TypedSocket

    socket.on('device:status', (data) => {
      setDevices(prev => prev.map(d =>
        d.id === data.id
          ? { ...d, status: data.status, clientVersion: data.clientVersion ?? d.clientVersion }
          : d
      ))
    })

    return () => { socket.disconnect() }
  }, [fetchDevices])

  const handlePushUpdate = useCallback(async (deviceId?: number) => {
    if (deviceId) {
      setPushDeviceStatus(prev => ({ ...prev, [deviceId]: { type: 'loading', message: 'Sending...' } }))
    } else {
      setPushLoading(true)
    }
    setPushStatus(null)
    try {
      const body: { deviceId?: number } = {}
      if (deviceId) body.deviceId = deviceId
      const res = await fetch('/api/push-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (deviceId) {
          setPushDeviceStatus(prev => ({ ...prev, [deviceId]: { type: 'success', message: 'Sent' } }))
          setTimeout(() => setPushDeviceStatus(prev => ({ ...prev, [deviceId]: null })), 5000)
        } else {
          let msg = `${data.devicesUpdated} device(s) updated`
          if (data.warning) msg += ` (${data.warning})`
          setPushStatus({ type: 'success', message: msg })
        }
      } else {
        if (deviceId) {
          setPushDeviceStatus(prev => ({ ...prev, [deviceId]: { type: 'error', message: data.error || 'Failed' } }))
          setTimeout(() => setPushDeviceStatus(prev => ({ ...prev, [deviceId]: null })), 8000)
        } else {
          setPushStatus({ type: 'error', message: data.error || 'Update failed' })
        }
      }
    } catch (err: any) {
      if (deviceId) {
        setPushDeviceStatus(prev => ({ ...prev, [deviceId]: { type: 'error', message: err.message || 'Network error' } }))
        setTimeout(() => setPushDeviceStatus(prev => ({ ...prev, [deviceId]: null })), 8000)
      } else {
        setPushStatus({ type: 'error', message: err.message || 'Network error' })
      }
    } finally {
      setPushLoading(false)
    }
  }, [])

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
    fetchServerStatus()
  }, [fetchServerStatus])

  const startReconnecting = useCallback(() => {
    setDeploying(true)
    let attempts = 0
    let sawDisconnect = false
    reconnectingRef.current = setInterval(async () => {
      attempts++
      try {
        const res = await fetch('/api/server-status')
        if (res.ok && sawDisconnect) {
          clearInterval(reconnectingRef.current!)
          reconnectingRef.current = null
          clearInterval(deployPollRef.current!)
          deployPollRef.current = null
          window.location.reload()
        }
      } catch {
        sawDisconnect = true
      }
      if (attempts > 160) {
        clearInterval(reconnectingRef.current!)
        reconnectingRef.current = null
        clearInterval(deployPollRef.current!)
        deployPollRef.current = null
        setDeploying(false)
        setDeployStatus({ type: 'error', message: 'Server did not come back within 8 minutes. Check the server manually.' })
      }
    }, 3000)
  }, [])

  const startDeployPolling = useCallback(() => {
    deployPollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/deploy-status')
        if (res.ok) {
          const data = await res.json()
          setDeployStep(data.step)
          console.log('[deploy-poll] step:', data.step)
          if (data.step === 'done') {
            clearInterval(deployPollRef.current!)
            deployPollRef.current = null
            setTimeout(() => window.location.reload(), 5000)
          }
        }
      } catch {}
    }, 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (reconnectingRef.current) clearInterval(reconnectingRef.current)
      if (deployPollRef.current) clearInterval(deployPollRef.current)
    }
  }, [])

  const handleDeploy = useCallback(async () => {
    if (!serverInfo?.latestVersion || serverInfo.latestVersion === 'unknown') {
      setDeployStatus({ type: 'error', message: 'No version information available' })
      return
    }
    setDeployLoading(true)
    setDeployStatus(null)
    setDeployStep('checkout')
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: serverInfo.latestVersion }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        startDeployPolling()
        startReconnecting()
      } else {
        setDeployStatus({ type: 'error', message: data.error || 'Deploy failed' })
      }
    } catch (err: any) {
      setDeployStatus({ type: 'error', message: err.message || 'Network error' })
    } finally {
      setDeployLoading(false)
    }
  }, [serverInfo, startReconnecting, startDeployPolling])

  if (user?.role !== 'admin') return null

  const currentServerVersion = serverInfo?.currentVersion || '...'
  const latestVersion = serverInfo?.latestVersion || '...'
  const hasUpdate = serverInfo?.updateAvailable || false
  const serverManagerConnected = serverInfo?.serverManager !== false

  const stepInfo = getStepInfo(deployStep)

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
          {!serverManagerConnected && (
            <span style={{ color: 'var(--theme-elevation-500, #666)', marginLeft: 8, fontSize: '0.8rem' }}>
              Server manager not connected
            </span>
          )}
          {serverInfo?.error && (
            <span style={{ color: 'var(--theme-warning-500, #f59e0b)', marginLeft: 8, fontSize: '0.8rem' }}>
              {serverInfo.error}
            </span>
          )}
        </div>
        {hasUpdate ? (
          <button
            type="button"
            style={deployButtonStyle}
            onClick={handleDeploy}
            disabled={deployLoading}
          >
            {deployLoading ? 'Starting...' : `Deploy ${latestVersion}`}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...infoStyle, marginTop: 0 }}>Up to date</span>
            {serverInfo?.error && (
              <button
                type="button"
                style={{ ...buttonStyle, padding: '2px 10px', fontSize: '0.8rem' }}
                onClick={fetchServerStatus}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {deployStatus && (
          <div style={deployStatus.type === 'success' ? successStyle : errorStyle}>
            {deployStatus.message}
          </div>
        )}
        {hasUpdate && (
          <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500, #666)', marginTop: 8 }}>
            This process can take up to 5 minutes.
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Update Client Devices</label>
        <p style={infoStyle}>
          Pushes the current sync-agent version to connected hardware devices.
        </p>
        <button type="button" style={buttonStyle} onClick={() => handlePushUpdate()} disabled={pushLoading}>
          {pushLoading ? 'Pushing...' : 'Push Latest to All Devices'}
        </button>
        {pushStatus && (
          <div style={pushStatus.type === 'success' ? successStyle : errorStyle}>
            {pushStatus.message}
          </div>
        )}

        {devicesLoading ? (
          <p style={infoStyle}>Loading devices...</p>
        ) : devices.length === 0 ? (
          <p style={infoStyle}>No devices found.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Version</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id}>
                  <td style={tdStyle}>{d.name}</td>
                  <td style={tdStyle}>{d.deviceType}</td>
                  <td style={{ ...tdStyle, color: statusColor(d.status) }}>
                    {statusDot(d.status)} {d.status}
                  </td>
                  <td style={tdStyle}>{d.clientVersion || '\u2014'}</td>
                  <td style={tdStyle}>
                    {d.deviceType === 'hardware' ? (
                      <div>
                        <button
                          type="button"
                          style={smallButtonStyle}
                          onClick={() => handlePushUpdate(d.id)}
                          disabled={pushDeviceStatus[d.id]?.type === 'loading'}
                        >
                          {pushDeviceStatus[d.id]?.type === 'loading' ? 'Sending...' : 'Update'}
                        </button>
                        {pushDeviceStatus[d.id] && (
                          <div style={{
                            fontSize: '0.75rem',
                            marginTop: 4,
                            color: pushDeviceStatus[d.id]!.type === 'success'
                              ? 'var(--theme-success-500, #22c55e)'
                              : pushDeviceStatus[d.id]!.type === 'error'
                                ? 'var(--theme-error-500, #ef4444)'
                                : 'var(--theme-elevation-500, #666)',
                          }}>
                            {pushDeviceStatus[d.id]!.message}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--theme-elevation-500, #666)', fontSize: '0.8rem' }}>
                        {'\u2014'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deploying && (
        <div style={overlayStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>Deploying {latestVersion}...</div>
          <div style={{ width: 320, marginTop: 12 }}>
            {steps.map((step, i) => {
              const done = stepInfo ? i < stepInfo.idx : false
              const active = stepInfo ? i === stepInfo.idx : false
              return (
                <div
                  key={step.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '4px 0',
                    opacity: done ? 0.8 : active ? 1 : 0.4,
                    color: done ? '#22c55e' : active ? '#fff' : '#999',
                  }}
                >
                  <span style={{ width: 20, textAlign: 'center' }}>
                    {done ? <CheckIcon size={16} /> : active ? <ArrowForwardIcon size={16} /> : <RadioButtonUncheckedIcon size={16} />}
                  </span>
                  <span>{step.label}</span>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: 16 }}>
            This can take up to 5 minutes. The page will refresh automatically.
          </div>
        </div>
      )}
    </div>
  )
}
