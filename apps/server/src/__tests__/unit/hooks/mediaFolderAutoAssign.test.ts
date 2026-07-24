import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mediaFolderAutoAssign } from '../../../hooks/mediaFolderAutoAssign'

describe('mediaFolderAutoAssign', () => {
  function makeReq(payloadOverrides: any = {}) {
    return {
      payload: {
        find: vi.fn(),
        ...payloadOverrides,
      },
      user: { id: 1, role: 'standard', departments: [{ id: 10 }] },
    } as any
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('assigns folder from current-folder-media preference', async () => {
    const req = makeReq()
    req.payload.find.mockResolvedValueOnce({
      docs: [{ value: { value: 42 } }],
    })

    const data = {}
    const result = await mediaFolderAutoAssign({ data, req } as any)
    expect(result.folder).toBe(42)
    expect(req.payload.find).toHaveBeenCalledTimes(1)
    expect(req.payload.find).toHaveBeenCalledWith({
      collection: 'payload-preferences',
      depth: 0,
      pagination: false,
      where: {
        and: [
          { key: { equals: 'current-folder-media' } },
          { 'user.value': { equals: 1 } },
        ],
      },
    })
  })

  it('falls back to department root folder when no preference', async () => {
    const req = makeReq()
    req.payload.find
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 77 }] })

    const data = {}
    const result = await mediaFolderAutoAssign({ data, req } as any)
    expect(result.folder).toBe(77)
    expect(req.payload.find).toHaveBeenCalledTimes(2)
  })

  it('falls back to department root folder for admin with no preference', async () => {
    const req = {
      payload: {
        find: vi.fn()
          .mockResolvedValueOnce({ docs: [] })
          .mockResolvedValueOnce({ docs: [] }),
      },
      user: { id: 1, role: 'admin', departments: [{ id: 10 }] },
    } as any

    const data = {}
    const result = await mediaFolderAutoAssign({ data, req } as any)
    expect(result.folder).toBeUndefined()
    expect(req.payload.find).toHaveBeenCalledTimes(2)
  })

  it('does nothing when folder is already set', async () => {
    const req = makeReq()
    const data = { folder: 99 }
    const result = await mediaFolderAutoAssign({ data, req } as any)
    expect(result.folder).toBe(99)
    expect(req.payload.find).not.toHaveBeenCalled()
  })

  it('preference with empty docs falls back', async () => {
    const req = makeReq()
    req.payload.find
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] })

    const data = {}
    const result = await mediaFolderAutoAssign({ data, req } as any)
    expect(result.folder).toBeUndefined()
    expect(req.payload.find).toHaveBeenCalledTimes(2)
  })
})
