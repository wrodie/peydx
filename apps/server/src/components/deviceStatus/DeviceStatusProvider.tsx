'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'
import { DeviceStatusContext } from './useDeviceStatus'
import type { DeviceStatus, DeviceStatusValue } from './useDeviceStatus'
import { normalizeDevice, applyStatusPatch, applyStateChangePatch } from './deviceStatusLogic'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function DeviceStatusProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const socketRef = useRef<TypedSocket | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/devices?depth=2&limit=100')
      if (!res.ok) return
      const data = await res.json()
      setDevices((data.docs || []).map(normalizeDevice))
    } catch {
      // keep existing devices on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    const socket = io(window.location.origin, { path: '/api/ws' }) as TypedSocket
    socketRef.current = socket

    socket.on('device:status', (data: any) => {
      setDevices((prev) => applyStatusPatch(prev, data))
    })

    socket.on('device:stateChange', (data: any) => {
      setDevices((prev) => applyStateChangePatch(prev, data))
    })

    return () => {
      socket.disconnect()
    }
  }, [refresh])

  const value: DeviceStatusValue = { devices, loading, refresh }

  return <DeviceStatusContext.Provider value={value}>{children}</DeviceStatusContext.Provider>
}
