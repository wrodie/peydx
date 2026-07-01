import { describe, it, expect, vi, beforeEach } from 'vitest'
import { userBeforeChange } from '../../../hooks/userBeforeChange'

describe('userBeforeChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns data when no user on req', async () => {
    const data = { name: 'New User' }
    const req = { user: null } as any

    const result = await userBeforeChange({ data, req, operation: 'create' } as any)
    expect(result).toEqual(data)
  })

  it('allows admin to set any role', async () => {
    const data = { name: 'Admin User', role: 'admin', departments: [1, 2] }
    const req = { user: { role: 'admin' } } as any

    const result = await userBeforeChange({ data, req, operation: 'create' } as any)
    expect(result).toEqual(data)
  })

  it('allows manager to create a standard user in their departments', async () => {
    const data = { name: 'Standard User', role: 'standard', departments: [10] }
    const req = { user: { role: 'manager', departments: [10, 20] } } as any

    const result = await userBeforeChange({ data, req, operation: 'create' } as any)
    expect(result).toEqual(data)
  })

  it('throws when manager sets a non-standard role', async () => {
    const data = { name: 'Manager Wannabe', role: 'manager', departments: [10] }
    const req = { user: { role: 'manager', departments: [10] } } as any

    await expect(
      userBeforeChange({ data, req, operation: 'create' } as any),
    ).rejects.toThrow('Managers can only create users with the Standard role')
  })

  it('throws when manager assigns a department outside their own', async () => {
    const data = { name: 'Cross Dept', role: 'standard', departments: [99] }
    const req = { user: { role: 'manager', departments: [10, 20] } } as any

    await expect(
      userBeforeChange({ data, req, operation: 'create' } as any),
    ).rejects.toThrow('Managers can only assign users to their own departments')
  })

  it('allows manager with multiple departments to assign to any of them', async () => {
    const data = { name: 'User', role: 'standard', departments: [10, 20] }
    const req = { user: { role: 'manager', departments: [10, 20, 30] } } as any

    const result = await userBeforeChange({ data, req, operation: 'create' } as any)
    expect(result).toEqual(data)
  })

  it('allows manager to create user without specifying a role (defaults to standard)', async () => {
    const data = { name: 'No Role', departments: [10] }
    const req = { user: { role: 'manager', departments: [10] } } as any

    const result = await userBeforeChange({ data, req, operation: 'create' } as any)
    expect(result).toEqual(data)
  })
})
