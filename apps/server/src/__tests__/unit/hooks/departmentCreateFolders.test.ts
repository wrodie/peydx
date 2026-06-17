import { describe, it, expect, vi } from 'vitest'
import { departmentCreateFolders } from '../../../hooks/departmentCreateFolders'

describe('departmentCreateFolders', () => {
  it('creates two root folders (media + programs) on create', async () => {
    const req = {
      payload: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      user: { id: 1, role: 'admin' },
    }
    const doc = { id: 5, name: 'Worship' }

    await departmentCreateFolders({
      doc,
      operation: 'create',
      req,
    } as any)

    expect(req.payload.create).toHaveBeenCalledTimes(2)
    expect(req.payload.create).toHaveBeenCalledWith({
      collection: 'folders',
      data: { name: 'Worship', type: 'media', department: 5, order: 0 },
      req,
    })
    expect(req.payload.create).toHaveBeenCalledWith({
      collection: 'folders',
      data: { name: 'Worship', type: 'programs', department: 5, order: 0 },
      req,
    })
  })

  it('does nothing on update (not create)', async () => {
    const req = {
      payload: { create: vi.fn() },
    }
    await departmentCreateFolders({
      doc: { id: 5, name: 'Worship' },
      operation: 'update',
      req,
    } as any)

    expect(req.payload.create).not.toHaveBeenCalled()
  })

  it('folder names match department name', async () => {
    const req = {
      payload: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    }
    const doc = { id: 5, name: 'Youth Ministry' }

    await departmentCreateFolders({
      doc,
      operation: 'create',
      req,
    } as any)

    expect(req.payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Youth Ministry' }),
      })
    )
  })

  it('folders have correct type and department', async () => {
    const req = {
      payload: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    }
    const doc = { id: 99, name: 'Admin' }

    await departmentCreateFolders({
      doc,
      operation: 'create',
      req,
    } as any)

    const calls = req.payload.create.mock.calls
    expect(calls[0][0].data.type).toBe('media')
    expect(calls[1][0].data.type).toBe('programs')
    expect(calls[0][0].data.department).toBe(99)
    expect(calls[1][0].data.department).toBe(99)
    expect(calls[0][0].data.order).toBe(0)
  })
})
