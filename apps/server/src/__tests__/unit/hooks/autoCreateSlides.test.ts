import { describe, it, expect, vi, beforeEach } from 'vitest'
import { autoCreateSlides } from '../../../hooks/autoCreateSlides'

function makeMedia(id: number, mimeType: string) {
  return { id, mimeType, filename: `file${id}.ext`, url: `/media/file${id}.ext` }
}

function makeReq(payloadOverrides: any = {}) {
  return {
    payload: {
      findByID: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
      ...payloadOverrides,
    },
  } as any
}

describe('autoCreateSlides', () => {
  let req: any

  beforeEach(() => {
    req = makeReq()
  })

  it('creates image slide for new image media', async () => {
    req.payload.findByID.mockResolvedValue(makeMedia(1, 'image/png'))
    const result = await autoCreateSlides({
      data: { bulkMedia: [1], slides: [] },
      originalDoc: { id: 1, bulkMedia: [] },
      req,
      operation: 'update',
    } as any)

    expect(result.slides).toHaveLength(1)
    expect(result.slides[0].blockType).toBe('imageBlock')
    expect(result.slides[0].image).toBe(1)
    expect(result.slides[0].advanceMode).toBe('manual')
    expect(result.slides[0].duration).toBeNull()
    expect(result.bulkMedia).toEqual([])
  })

  it('creates video slide for video media', async () => {
    req.payload.findByID.mockResolvedValue(makeMedia(2, 'video/mp4'))
    const result = await autoCreateSlides({
      data: { bulkMedia: [2], slides: [] },
      originalDoc: { id: 1, bulkMedia: [] },
      req,
      operation: 'update',
    } as any)

    expect(result.slides[0].blockType).toBe('videoBlock')
    expect(result.slides[0].video).toBe(2)
    expect(result.slides[0].advanceMode).toBe('onEnd')
  })

  it('creates audio slide for audio media', async () => {
    req.payload.findByID.mockResolvedValue(makeMedia(3, 'audio/mp3'))
    const result = await autoCreateSlides({
      data: { bulkMedia: [3], slides: [] },
      originalDoc: { id: 1, bulkMedia: [] },
      req,
      operation: 'update',
    } as any)

    expect(result.slides[0].blockType).toBe('audioBlock')
    expect(result.slides[0].audio).toBe(3)
    expect(result.slides[0].advanceMode).toBe('onEnd')
  })

  it('does not create slides for existing media', async () => {
    req.payload.findByID.mockResolvedValue(makeMedia(2, 'image/png'))
    const result = await autoCreateSlides({
      data: { bulkMedia: [1, 2], slides: [] },
      originalDoc: { id: 1, bulkMedia: [1] },
      req,
      operation: 'update',
    } as any)

    expect(req.payload.findByID).toHaveBeenCalledTimes(1)
    expect(result.slides).toHaveLength(1)
  })

  it('handles mix of new and existing media', async () => {
    req.payload.findByID.mockImplementation(({ id }) => makeMedia(id, 'image/png'))
    const result = await autoCreateSlides({
      data: { bulkMedia: [1, 2, 3], slides: [{ blockType: 'imageBlock', advanceMode: 'timed', image: 1 }] },
      originalDoc: { id: 1, bulkMedia: [1] },
      req,
      operation: 'update',
    } as any)

    expect(req.payload.findByID).toHaveBeenCalledTimes(2)
    expect(result.slides).toHaveLength(3)
    expect(result.bulkMedia).toEqual([])
  })

  it('handles empty bulkMedia', async () => {
    const result = await autoCreateSlides({
      data: { bulkMedia: [], slides: [{ blockType: 'imageBlock', advanceMode: 'timed' }] },
      originalDoc: { id: 1, bulkMedia: [] },
      req,
      operation: 'update',
    } as any)

    expect(req.payload.findByID).not.toHaveBeenCalled()
    expect(result.slides).toHaveLength(1)
  })

  it('processes segment-level bulkMedia', async () => {
    req.payload.findByID.mockResolvedValue(makeMedia(5, 'image/png'))
    const result = await autoCreateSlides({
      data: {
        bulkMedia: [],
        slides: [
          {
            blockType: 'segmentBlock', id: 'seg1',
            bulkMedia: [5], slides: [],
          },
        ],
      },
      originalDoc: {
        id: 1, bulkMedia: [],
        slides: [{ blockType: 'segmentBlock', id: 'seg1', bulkMedia: [], slides: [] }],
      },
      req,
      operation: 'update',
    } as any)

    expect(result.slides[0].slides).toHaveLength(1)
    expect(result.slides[0].bulkMedia).toEqual([])
    expect(result.slides[0].slides[0].blockType).toBe('imageBlock')
  })

  it('clears segment bulkMedia when no new IDs', async () => {
    const result = await autoCreateSlides({
      data: {
        bulkMedia: [],
        slides: [
          { blockType: 'segmentBlock', id: 'seg1', bulkMedia: [1], slides: [] },
        ],
      },
      originalDoc: {
        id: 1, bulkMedia: [],
        slides: [{ blockType: 'segmentBlock', id: 'seg1', bulkMedia: [1], slides: [] }],
      },
      req,
      operation: 'update',
    } as any)

    expect(result.slides[0].bulkMedia).toEqual([])
    expect(result.slides[0].slides).toEqual([])
  })

  it('clears top-level bulkMedia after processing', async () => {
    req.payload.findByID.mockResolvedValue(makeMedia(1, 'image/png'))
    const result = await autoCreateSlides({
      data: { bulkMedia: [1], slides: [] },
      originalDoc: { id: 1, bulkMedia: [] },
      req,
      operation: 'update',
    } as any)

    expect(result.bulkMedia).toEqual([])
  })

  it('throws when findByID fails', async () => {
    req.payload.findByID.mockRejectedValue(new Error('Not Found'))
    await expect(
      autoCreateSlides({
        data: { bulkMedia: [1], slides: [] },
        originalDoc: { id: 1, bulkMedia: [] },
        req,
        operation: 'update',
      } as any)
    ).rejects.toThrow('Not Found')
  })
})
