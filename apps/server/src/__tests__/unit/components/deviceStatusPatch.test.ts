import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildDeviceStatusPatch } from '../../../components/deviceStatusPatch'

describe('buildDeviceStatusPatch', () => {
  let baseTime: Date

  beforeEach(() => {
    baseTime = new Date('2024-01-01T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(baseTime)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns lastHeartbeat when status is online', () => {
    const result = buildDeviceStatusPatch({ status: 'online' })
    expect(result.lastHeartbeat).toBe(baseTime.toISOString())
  })

  it('returns empty object when status is stale', () => {
    const result = buildDeviceStatusPatch({ status: 'stale' })
    expect(result.lastHeartbeat).toBeUndefined()
    expect(result).toEqual({})
  })

  it('returns empty object when status is offline', () => {
    const result = buildDeviceStatusPatch({ status: 'offline' })
    expect(result.lastHeartbeat).toBeUndefined()
    expect(result).toEqual({})
  })

  it('returns timestamp close to current time', () => {
    const result = buildDeviceStatusPatch({ status: 'online' })
    const ts = new Date(result.lastHeartbeat!)
    const diff = Math.abs(ts.getTime() - baseTime.getTime())
    expect(diff).toBeLessThan(1000)
  })
})
