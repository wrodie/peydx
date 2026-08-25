'use client'

import { createContext, useContext } from 'react'

export interface DeviceStatus {
  id: number
  name: string
  deviceType: 'hardware' | 'browser'
  departments: any[]
  status: string | null
  lastHeartbeat: string | null
  currentProgramId: number | null
  currentProgram: any | null
  currentSlideIndex: number | null
  clientVersion: string | null
}

export interface DeviceStatusValue {
  devices: DeviceStatus[]
  loading: boolean
  refresh: () => void
}

export const DeviceStatusContext = createContext<DeviceStatusValue | null>(null)

export function useDeviceStatus(): DeviceStatusValue {
  const ctx = useContext(DeviceStatusContext)
  if (!ctx) throw new Error('useDeviceStatus must be used within a DeviceStatusProvider')
  return ctx
}
