import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanupMediaReferences } from '../../../hooks/cleanupMediaReferences'

describe('cleanupMediaReferences', () => {
  let req: any

  beforeEach(() => {
    req = {
      payload: {
        find: vi.fn(),
        update: vi.fn(),
      },
    }
  })

  it('removes image slides referencing the deleted media', async () => {
    req.payload.find.mockResolvedValue({
      docs: [
        {
          id: 1,
          title: 'Program',
          slides: [
            { blockType: 'imageBlock', advanceMode: 'timed', image: 5 },
            { blockType: 'imageBlock', advanceMode: 'timed', image: { id: 5 } },
            { blockType: 'videoBlock', advanceMode: 'onEnd', video: 10 },
          ],
          bulkMedia: [5, 10],
        },
      ],
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
    req.payload.find.mockResolvedValue({
      docs: [
        {
          id: 2,
          title: 'Video Program',
          slides: [
            { blockType: 'videoBlock', advanceMode: 'onEnd', video: 10 },
            { blockType: 'videoBlock', advanceMode: 'onEnd', video: { id: 10 } },
          ],
          bulkMedia: [],
        },
      ],
    })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 10, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 10 } as any)

    expect(req.payload.update).toHaveBeenCalledTimes(1)
    expect(req.payload.update.mock.calls[0][0].data.slides).toHaveLength(0)
  })

  it('removes media ID from bulkMedia array', async () => {
    req.payload.find.mockResolvedValue({
      docs: [
        {
          id: 3,
          title: 'Bulk Program',
          slides: [],
          bulkMedia: [1, 5, 10, { id: 5 }],
        },
      ],
    })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 5, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 5 } as any)

    const updateCall = req.payload.update.mock.calls[0][0]
    expect(updateCall.data.bulkMedia).toEqual([1, 10])
  })

  it('removes auto-end slide', async () => {
    req.payload.find.mockResolvedValue({
      docs: [
        {
          id: 4,
          title: 'Program',
          slides: [
            { blockType: 'imageBlock', advanceMode: 'timed', image: 7 },
            { id: 'auto-end', blockType: 'blackScreenBlock', advanceMode: 'manual' },
          ],
          bulkMedia: [],
        },
      ],
    })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 7, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 7 } as any)

    const updateCall = req.payload.update.mock.calls[0][0]
    expect(updateCall.data.slides).toHaveLength(0)
  })

  it('does not update programs with no references', async () => {
    req.payload.find.mockResolvedValue({
      docs: [
        {
          id: 5,
          title: 'Unrelated',
          slides: [{ blockType: 'videoBlock', advanceMode: 'onEnd', video: 99 }],
          bulkMedia: [],
        },
      ],
    })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 5, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 5 } as any)

    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('handles multiple programs with references', async () => {
    req.payload.find.mockResolvedValue({
      docs: [
        { id: 1, slides: [{ blockType: 'imageBlock', advanceMode: 'timed', image: 5 }], bulkMedia: [5] },
        { id: 2, slides: [{ blockType: 'imageBlock', advanceMode: 'timed', image: 5 }], bulkMedia: [] },
      ],
    })

    await cleanupMediaReferences({ data: {}, originalDoc: { id: 5, slides: [], bulkMedia: [] }, req, operation: 'delete', id: 5 } as any)

    expect(req.payload.update).toHaveBeenCalledTimes(2)
  })
})
