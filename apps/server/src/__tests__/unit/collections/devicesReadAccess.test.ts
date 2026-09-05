import { describe, it, expect } from 'vitest'
import { Devices } from '../../../collections/Devices'

const read = (Devices as any).access.read

describe('Devices read access', () => {
  it('allows admins to read all devices', () => {
    const result = read({ req: { user: { role: 'admin', collection: 'users' }, query: {} } })
    expect(result).toBe(true)
  })

  it('restricts device collection users to their own device', () => {
    const result = read({ req: { user: { id: 7, collection: 'devices' }, query: {} } })
    expect(result).toEqual({ id: { equals: 7 } })
  })

  it('filters standard users to devices in their departments', () => {
    const result = read({
      req: { user: { role: 'standard', collection: 'users', departments: [1, { id: 3 }] }, query: {} },
    })
    expect(result).toEqual({ departments: { in: [1, 3] } })
  })

  it('denies unauthenticated requests without a browser-token query', () => {
    const result = read({ req: { user: null, query: {} } })
    expect(result).toBe(false)
  })
})
