import { describe, it, expect, vi, beforeEach } from 'vitest'
import { folderBeforeDelete } from '../../../hooks/folderBeforeDelete'

describe('folderBeforeDelete', () => {
  function makeReq(finders: any = {}) {
    return {
      payload: {
        find: vi.fn(),
        ...finders,
      },
    } as any
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when folder has sub-folders', async () => {
    const req = makeReq()
    req.payload.find
      .mockResolvedValueOnce({ totalDocs: 3 })
      .mockResolvedValueOnce({ totalDocs: 0 })
      .mockResolvedValueOnce({ totalDocs: 0 })

    await expect(
      folderBeforeDelete({ req, id: 1 } as any)
    ).rejects.toThrow('Cannot delete folder: it contains 3 sub-folder(s)')
  })

  it('throws when folder has media items', async () => {
    const req = makeReq()
    req.payload.find
      .mockResolvedValueOnce({ totalDocs: 0 })
      .mockResolvedValueOnce({ totalDocs: 5 })
      .mockResolvedValueOnce({ totalDocs: 0 })

    await expect(
      folderBeforeDelete({ req, id: 1 } as any)
    ).rejects.toThrow('Cannot delete folder: it contains 5 media item(s)')
  })

  it('throws when folder has programs', async () => {
    const req = makeReq()
    req.payload.find
      .mockResolvedValueOnce({ totalDocs: 0 })
      .mockResolvedValueOnce({ totalDocs: 0 })
      .mockResolvedValueOnce({ totalDocs: 2 })

    await expect(
      folderBeforeDelete({ req, id: 1 } as any)
    ).rejects.toThrow('Cannot delete folder: it contains 2 program(s)')
  })

  it('succeeds when folder is empty', async () => {
    const req = makeReq()
    req.payload.find
      .mockResolvedValue({ totalDocs: 0 })

    await expect(
      folderBeforeDelete({ req, id: 1 } as any)
    ).resolves.toBeUndefined()
  })

  it('throws with combined message for multiple content types', async () => {
    const req = makeReq()
    req.payload.find
      .mockResolvedValueOnce({ totalDocs: 2 })
      .mockResolvedValueOnce({ totalDocs: 4 })
      .mockResolvedValueOnce({ totalDocs: 1 })

    await expect(
      folderBeforeDelete({ req, id: 1 } as any)
    ).rejects.toThrow(
      'Cannot delete folder: it contains 2 sub-folder(s), 4 media item(s), 1 program(s)'
    )
  })
})
