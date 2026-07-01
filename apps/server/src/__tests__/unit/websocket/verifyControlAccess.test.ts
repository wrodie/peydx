import { describe, it, expect } from 'vitest'
import { verifyControlAccess, verifyProgramDepartmentAccess } from '../../../websocket/verifyControlAccess'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayload(overrides: Record<string, any> = {}) {
  const payload = {
    findByID: overrides.findByID ?? (() => { throw new Error('not mocked') }),
    ...overrides,
  }
  return payload
}

function makeDevice(id: number, departments: (number | { id: number })[]) {
  return { id, departments }
}

function makeProgram(id: number, folder?: { department?: number | { id: number } | null }) {
  return { id, title: 'Test Program', folder: folder ?? null }
}

// ---------------------------------------------------------------------------
// verifyControlAccess
// ---------------------------------------------------------------------------

describe('verifyControlAccess', () => {
  // Device sockets (preserved behavior)
  it('allows device-type sockets', async () => {
    const payload = makePayload()
    const result = await verifyControlAccess(
      { type: 'device', id: 5, departments: [1] },
      99,
      payload
    )
    expect(result).toBe(true)
  })

  // Admin user
  it('allows admin user for any device', async () => {
    const payload = makePayload()
    const result = await verifyControlAccess(
      { type: 'user', id: 1, role: 'admin', departments: [1] },
      999,
      payload
    )
    expect(result).toBe(true)
  })

  // Manager user — same department
  it('allows manager user when device is in their department', async () => {
    const payload = makePayload({
      findByID: async ({ collection, id }: any) => {
        expect(collection).toBe('devices')
        expect(id).toBe(10)
        return makeDevice(10, [1, 2])
      },
    })
    const result = await verifyControlAccess(
      { type: 'user', id: 2, role: 'manager', departments: [2] },
      10,
      payload
    )
    expect(result).toBe(true)
  })

  // Manager user — different department
  it('denies manager user when device is in a different department', async () => {
    const payload = makePayload({
      findByID: async () => makeDevice(10, [1, 2]),
    })
    const result = await verifyControlAccess(
      { type: 'user', id: 2, role: 'manager', departments: [3] },
      10,
      payload
    )
    expect(result).toBe(false)
  })

  // Manager user — empty user departments (should not happen in practice, but guard)
  it('denies manager user with no departments', async () => {
    const payload = makePayload()
    const result = await verifyControlAccess(
      { type: 'user', id: 2, role: 'manager', departments: [] },
      10,
      payload
    )
    expect(result).toBe(false)
  })

  // Standard user — same department
  it('allows standard user when device is in their department', async () => {
    const payload = makePayload({
      findByID: async () => makeDevice(10, [5]),
    })
    const result = await verifyControlAccess(
      { type: 'user', id: 3, role: 'standard', departments: [5] },
      10,
      payload
    )
    expect(result).toBe(true)
  })

  // Standard user — different department
  it('denies standard user when device is in a different department', async () => {
    const payload = makePayload({
      findByID: async () => makeDevice(10, [6]),
    })
    const result = await verifyControlAccess(
      { type: 'user', id: 3, role: 'standard', departments: [7] },
      10,
      payload
    )
    expect(result).toBe(false)
  })

  // Integration — global (empty departments)
  it('allows integration with no department scoping (global)', async () => {
    const payload = makePayload()
    const result = await verifyControlAccess(
      { type: 'integration', id: 1, departments: [] },
      999,
      payload
    )
    expect(result).toBe(true)
  })

  // Integration — departments overlap
  it('allows integration when device departments overlap', async () => {
    const payload = makePayload({
      findByID: async () => makeDevice(20, [8, 9]),
    })
    const result = await verifyControlAccess(
      { type: 'integration', id: 2, departments: [9, 10] },
      20,
      payload
    )
    expect(result).toBe(true)
  })

  // Integration — no overlap
  it('denies integration when device departments do not overlap', async () => {
    const payload = makePayload({
      findByID: async () => makeDevice(20, [8]),
    })
    const result = await verifyControlAccess(
      { type: 'integration', id: 2, departments: [9] },
      20,
      payload
    )
    expect(result).toBe(false)
  })

  // Device not found
  it('denies when device is not found', async () => {
    const payload = makePayload({
      findByID: async () => { throw new Error('Not found') },
    })
    const result = await verifyControlAccess(
      { type: 'user', id: 2, role: 'manager', departments: [1] },
      999,
      payload
    )
    expect(result).toBe(false)
  })

  // Unknown socket type
  it('denies unknown socket type', async () => {
    const payload = makePayload()
    const result = await verifyControlAccess(
      { type: 'unknown', id: 1 },
      999,
      payload
    )
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// verifyProgramDepartmentAccess
// ---------------------------------------------------------------------------

describe('verifyProgramDepartmentAccess', () => {
  // Admin
  it('allows admin user for any program', async () => {
    const payload = makePayload()
    const result = await verifyProgramDepartmentAccess(
      { type: 'user', id: 1, role: 'admin', departments: [1] },
      999,
      payload
    )
    expect(result).toBe(true)
  })

  // Device socket
  it('allows device-type sockets for any program', async () => {
    const payload = makePayload()
    const result = await verifyProgramDepartmentAccess(
      { type: 'device', id: 5, departments: [1] },
      999,
      payload
    )
    expect(result).toBe(true)
  })

  // Integration — global
  it('allows global integration for any program', async () => {
    const payload = makePayload()
    const result = await verifyProgramDepartmentAccess(
      { type: 'integration', id: 1, departments: [] },
      999,
      payload
    )
    expect(result).toBe(true)
  })

  // Manager — program in department
  it('allows manager when program department is in their scope', async () => {
    const payload = makePayload({
      findByID: async ({ collection, id }: any) => {
        expect(collection).toBe('programs')
        expect(id).toBe(100)
        return makeProgram(100, { department: { id: 3 } })
      },
    })
    const result = await verifyProgramDepartmentAccess(
      { type: 'user', id: 2, role: 'manager', departments: [3, 4] },
      100,
      payload
    )
    expect(result).toBe(true)
  })

  // Standard — program out of department
  it('denies standard when program department is out of scope', async () => {
    const payload = makePayload({
      findByID: async () => makeProgram(100, { department: { id: 5 } }),
    })
    const result = await verifyProgramDepartmentAccess(
      { type: 'user', id: 3, role: 'standard', departments: [3] },
      100,
      payload
    )
    expect(result).toBe(false)
  })

  // Integration — scoped, program department matches
  it('allows scoped integration when program department matches', async () => {
    const payload = makePayload({
      findByID: async () => makeProgram(100, { department: { id: 5 } }),
    })
    const result = await verifyProgramDepartmentAccess(
      { type: 'integration', id: 2, departments: [5] },
      100,
      payload
    )
    expect(result).toBe(true)
  })

  // Program with no folder / no department
  it('denies when program has no folder department', async () => {
    const payload = makePayload({
      findByID: async () => makeProgram(100, { department: null }),
    })
    const result = await verifyProgramDepartmentAccess(
      { type: 'user', id: 2, role: 'manager', departments: [3] },
      100,
      payload
    )
    expect(result).toBe(false)
  })

  // Program not found
  it('denies when program is not found', async () => {
    const payload = makePayload({
      findByID: async () => { throw new Error('Not found') },
    })
    const result = await verifyProgramDepartmentAccess(
      { type: 'user', id: 2, role: 'manager', departments: [1] },
      999,
      payload
    )
    expect(result).toBe(false)
  })

  // Program department as raw number
  it('handles program department as raw number', async () => {
    const payload = makePayload({
      findByID: async () => makeProgram(100, { department: 3 }),
    })
    const result = await verifyProgramDepartmentAccess(
      { type: 'user', id: 2, role: 'manager', departments: [3] },
      100,
      payload
    )
    expect(result).toBe(true)
  })
})
