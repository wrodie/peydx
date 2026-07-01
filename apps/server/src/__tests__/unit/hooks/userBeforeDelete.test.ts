import { describe, it, expect, vi, beforeEach } from 'vitest'
import { userBeforeDelete } from '../../../hooks/userBeforeDelete'

describe('userBeforeDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows admin to delete anyone', async () => {
    const req = {
      user: { id: 1, role: 'admin' },
      payload: { findByID: vi.fn() },
    } as any

    await expect(userBeforeDelete({ req, id: 2 } as any)).resolves.toBeUndefined()
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })

  it('throws when manager deletes themselves', async () => {
    const req = {
      user: { id: 5, role: 'manager', departments: [1] },
      payload: { findByID: vi.fn() },
    } as any

    await expect(userBeforeDelete({ req, id: 5 } as any)).rejects.toThrow(
      'Managers cannot delete themselves',
    )
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })

  it('allows manager to delete a standard user', async () => {
    const req = {
      user: { id: 1, role: 'manager', departments: [10] },
      payload: {
        findByID: vi.fn().mockResolvedValue({ id: 2, role: 'standard' }),
      },
    } as any

    await expect(userBeforeDelete({ req, id: 2 } as any)).resolves.toBeUndefined()
    expect(req.payload.findByID).toHaveBeenCalledWith({
      collection: 'users',
      id: 2,
      overrideAccess: true,
    })
  })

  it('throws when manager deletes another manager', async () => {
    const req = {
      user: { id: 1, role: 'manager', departments: [10] },
      payload: {
        findByID: vi.fn().mockResolvedValue({ id: 3, role: 'manager' }),
      },
    } as any

    await expect(userBeforeDelete({ req, id: 3 } as any)).rejects.toThrow(
      'Managers can only delete Standard users',
    )
  })

  it('throws when manager deletes an admin', async () => {
    const req = {
      user: { id: 1, role: 'manager', departments: [10] },
      payload: {
        findByID: vi.fn().mockResolvedValue({ id: 4, role: 'admin' }),
      },
    } as any

    await expect(userBeforeDelete({ req, id: 4 } as any)).rejects.toThrow(
      'Managers can only delete Standard users',
    )
  })

  it('resolves silently when there is no user on req', async () => {
    const req = {
      user: null,
      payload: { findByID: vi.fn() },
    } as any

    await expect(userBeforeDelete({ req, id: 2 } as any)).resolves.toBeUndefined()
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })
})
