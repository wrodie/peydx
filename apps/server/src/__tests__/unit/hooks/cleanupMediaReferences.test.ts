import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanupMediaReferences } from '../../../hooks/cleanupMediaReferences'

describe('cleanupMediaReferences', () => {
  let req: any

  beforeEach(() => {
    vi.resetAllMocks()
    req = {
      payload: {
        db: {
          drizzle: {
            execute: vi.fn(),
          },
        },
        findByID: vi.fn(),
        update: vi.fn(),
        logger: { info: vi.fn(), error: vi.fn() },
      },
      context: {},
    }
  })

  function mockBlockResult(ids: number[]) {
    return { rows: ids.map(id => ({ _parent_id: id })) }
  }

  function mockRelsResult(ids: number[]) {
    return { rows: ids.map(id => ({ parent_id: id })) }
  }

  it('removes image slides referencing the deleted media', async () => {
    req.payload.db.drizzle.execute
      .mockResolvedValueOnce(mockBlockResult([1]))
      .mockResolvedValueOnce(mockRelsResult([1]))

    req.payload.findByID.mockResolvedValue({
      id: 1,
      title: 'Program',
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed', image: 5 },
        { blockType: 'imageBlock', advanceMode: 'timed', image: { id: 5 } },
        { blockType: 'videoBlock', advanceMode: 'onEnd', video: 10 },
      ],
      bulkMedia: [5, 10],
    })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 5, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 5 } as any)

    expect(req.payload.update).toHaveBeenCalledTimes(1)
    const updateCall = req.payload.update.mock.calls[0][0]
    expect(updateCall.data.slides).toHaveLength(1)
    expect(updateCall.data.slides[0].blockType).toBe('videoBlock')
    expect(updateCall.data.bulkMedia).toEqual([10])
    expect(updateCall.context).toEqual({ preventSync: true })
  })

  it('removes video slides referencing the deleted media', async () => {
    req.payload.db.drizzle.execute
      .mockResolvedValueOnce(mockBlockResult([2]))
      .mockResolvedValueOnce(mockRelsResult([]))

    req.payload.findByID.mockResolvedValue({
      id: 2,
      title: 'Video Program',
      slides: [
        { blockType: 'videoBlock', advanceMode: 'onEnd', video: 10 },
        { blockType: 'videoBlock', advanceMode: 'onEnd', video: { id: 10 } },
      ],
      bulkMedia: [],
    })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 10, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 10 } as any)

    expect(req.payload.update).toHaveBeenCalledTimes(1)
    expect(req.payload.update.mock.calls[0][0].data.slides).toHaveLength(0)
  })

  it('removes media ID from bulkMedia array', async () => {
    req.payload.db.drizzle.execute
      .mockResolvedValueOnce(mockBlockResult([]))
      .mockResolvedValueOnce(mockRelsResult([3]))

    req.payload.findByID.mockResolvedValue({
      id: 3,
      title: 'Bulk Program',
      slides: [],
      bulkMedia: [1, 5, 10, { id: 5 }],
    })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 5, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 5 } as any)

    const updateCall = req.payload.update.mock.calls[0][0]
    expect(updateCall.data.bulkMedia).toEqual([1, 10])
  })

  it('removes auto-end slide', async () => {
    req.payload.db.drizzle.execute
      .mockResolvedValueOnce(mockBlockResult([4]))
      .mockResolvedValueOnce(mockRelsResult([]))

    req.payload.findByID.mockResolvedValue({
      id: 4,
      title: 'Program',
      slides: [
        { blockType: 'imageBlock', advanceMode: 'timed', image: 7 },
        { id: 'auto-end', blockType: 'blackScreenBlock', advanceMode: 'manual' },
      ],
      bulkMedia: [],
    })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 7, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 7 } as any)

    const updateCall = req.payload.update.mock.calls[0][0]
    expect(updateCall.data.slides).toHaveLength(0)
  })

  it('does not update programs with no references', async () => {
    req.payload.db.drizzle.execute
      .mockResolvedValueOnce(mockBlockResult([]))
      .mockResolvedValueOnce(mockRelsResult([]))

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 5, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 5 } as any)

    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('handles multiple programs with references', async () => {
    req.payload.db.drizzle.execute
      .mockResolvedValueOnce(mockBlockResult([1, 2]))
      .mockResolvedValueOnce(mockRelsResult([1]))

    req.payload.findByID
      .mockResolvedValueOnce({
        id: 1,
        slides: [{ blockType: 'imageBlock', advanceMode: 'timed', image: 5 }],
        bulkMedia: [5],
      })
      .mockResolvedValueOnce({
        id: 2,
        slides: [{ blockType: 'imageBlock', advanceMode: 'timed', image: 5 }],
        bulkMedia: [],
      })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 5, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 5 } as any)

    expect(req.payload.update).toHaveBeenCalledTimes(2)
  })
})
