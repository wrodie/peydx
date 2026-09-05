'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'
import { DeviceStatusContext } from './useDeviceStatus'
import type { DeviceStatus, DeviceStatusValue } from './useDeviceStatus'
import {
  normalizeDevice,
  applyStatusPatch,
  applyStateChangePatch,
  attachProgram,
} from './deviceStatusLogic'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>
type ProgramId = number | string

const programCache = new Map<string, Promise<any>>()

export function DeviceStatusProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const socketRef = useRef<TypedSocket | null>(null)
  const attachedProgramIdRef = useRef<Map<number, ProgramId>>(new Map())

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/devices?depth=2&limit=100')
      if (!res.ok) return
      const data = await res.json()
      const docs = (data.docs || []) as any[]
      setDevices(docs.map(normalizeDevice))
      const attached = new Map<number, ProgramId>()
      for (const doc of docs) {
        const pid = doc.currentProgram
          ? typeof doc.currentProgram === 'object'
            ? doc.currentProgram.id
            : doc.currentProgram
          : null
        if (pid != null) attached.set(doc.id, pid)
      }
      attachedProgramIdRef.current = attached
    } catch {
      // keep existing devices on failure
    } finally {
      setLoading(false)
    }
  }, [])

  const ensureProgram = useCallback((deviceId: number, programId: ProgramId) => {
    if (programId == null) return
    if (attachedProgramIdRef.current.get(deviceId) === programId) return

    let req = programCache.get(String(programId))
    if (!req) {
      req = fetch(`/api/programs/${programId}?depth=2`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      programCache.set(String(programId), req)
    }
    req.then((program: any) => {
      if (!program) return
      setDevices((prev) => attachProgram(prev, deviceId, program))
      attachedProgramIdRef.current.set(deviceId, programId)
    })
  }, [])

  useEffect(() => {
    refresh()

    const socket = io(window.location.origin, { path: '/api/ws' }) as TypedSocket
    socketRef.current = socket

    socket.on('device:status', (data: any) => {
      setDevices((prev) => applyStatusPatch(prev, data))
      if (data.programId != null) ensureProgram(data.id, data.programId)
    })

    socket.on('device:stateChange', (data: any) => {
      setDevices((prev) => applyStateChangePatch(prev, data))
      if (data.programId != null) ensureProgram(data.id, data.programId)
    })

    return () => {
      socket.disconnect()
    }
  }, [refresh, ensureProgram])

  const value: DeviceStatusValue = { devices, loading, refresh }

  return <DeviceStatusContext.Provider value={value}>{children}</DeviceStatusContext.Provider>
}
