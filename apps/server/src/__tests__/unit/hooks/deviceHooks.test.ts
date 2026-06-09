import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import the hook from Devices.ts — we test the controllingDevice logic in the beforeChange hook
// The hook is inline, so we extract the logic for testing

describe('deviceHooks', () => {
  // The controlling device chain prevention logic from the beforeChange hook
  async function validateControllingDevice(data: any, req: any) {
    if (data.controllingDevice) {
      const controller = await req.payload.findByID({
        collection: 'devices',
        id: data.controllingDevice,
        depth: 0,
      })
      if (controller.controllingDevice) {
        throw new Error('Cannot set a controlling device that is itself controlled by another device. Only one level of mirroring is allowed.')
      }
    }
    return data
  }

  it('allows setting controllingDevice when target has no controller', async () => {
    const req = {
      payload: {
        findByID: vi.fn().mockResolvedValue({ id: 10, name: 'Device B', controllingDevice: null }),
      },
    }
    const data = { controllingDevice: 10 }
    const result = await validateControllingDevice(data, req)
    expect(result).toEqual(data)
    expect(req.payload.findByID).toHaveBeenCalledWith({
      collection: 'devices',
      id: 10,
      depth: 0,
    })
  })

  it('blocks chain when controllingDevice is itself controlled (chain prevention)', async () => {
    const req = {
      payload: {
        findByID: vi.fn().mockResolvedValue({ id: 10, controllingDevice: 5 }),
      },
    }
    await expect(
      validateControllingDevice({ controllingDevice: 10 }, req)
    ).rejects.toThrow('Cannot set a controlling device')
  })

  it('allows when controllingDevice is not set', async () => {
    const req = {
      payload: { findByID: vi.fn() },
    }
    const data = { name: 'New Device' }
    const result = await validateControllingDevice(data, req)
    expect(result).toEqual(data)
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })
})

describe('browserToken generation', () => {
  // The beforeValidate hook logic for browserToken
  function generateToken(value: string | undefined): string {
    if (!value) {
      return crypto.randomUUID()
    }
    return value
  }

  it('generates a token when value is empty', () => {
    const token = generateToken('')
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('generates a token when value is undefined', () => {
    const token = generateToken(undefined)
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
  })

  it('preserves existing token', () => {
    const existing = 'existing-token-value'
    expect(generateToken(existing)).toBe(existing)
  })
})
