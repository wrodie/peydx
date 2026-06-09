import { describe, it, expect } from 'vitest'
import { moveSlides } from '../../../hooks/moveSlides'

describe('moveSlides', () => {
  function makeData(slides: any[]) {
    return { slides }
  }

  it('moves a slide from top-level to a segment', async () => {
    const data = makeData([
      { blockType: 'imageBlock', advanceMode: 'timed', _moveToSegment: 'seg1' },
      { blockType: 'segmentBlock', id: 'seg1', loop: false, advanceMode: 'slides', slides: [] },
    ])
    const result = await moveSlides({ data, req: {}, operation: 'update' } as any)
    expect(result.slides).toHaveLength(1)
    expect(result.slides[0].blockType).toBe('segmentBlock')
    expect(result.slides[0].slides).toHaveLength(1)
    expect(result.slides[0].slides[0].blockType).toBe('imageBlock')
    expect(result.slides[0].slides[0]._moveToSegment).toBeUndefined()
  })

  it('moves a slide from segment to top-level', async () => {
    const data = makeData([
      {
        blockType: 'segmentBlock', id: 'seg1', loop: false, advanceMode: 'slides',
        slides: [
          { blockType: 'imageBlock', advanceMode: 'timed', _moveToSegment: '__top__' },
        ],
      },
    ])
    const result = await moveSlides({ data, req: {}, operation: 'update' } as any)
    expect(result.slides).toHaveLength(2)
    expect(result.slides[1].blockType).toBe('imageBlock')
  })

  it('moves a slide between segments', async () => {
    const data = makeData([
      {
        blockType: 'segmentBlock', id: 'seg1', loop: false, advanceMode: 'slides',
        slides: [
          { blockType: 'imageBlock', advanceMode: 'timed', _moveToSegment: 'seg2' },
        ],
      },
      { blockType: 'segmentBlock', id: 'seg2', loop: false, advanceMode: 'slides', slides: [] },
    ])
    const result = await moveSlides({ data, req: {}, operation: 'update' } as any)
    expect(result.slides[1].slides).toHaveLength(1)
    expect(result.slides[1].slides[0].blockType).toBe('imageBlock')
    expect(result.slides[0].slides).toHaveLength(0)
  })

  it('no-op when moving to same segment', async () => {
    const data = makeData([
      {
        blockType: 'segmentBlock', id: 'seg1', loop: false, advanceMode: 'slides',
        slides: [
          { blockType: 'imageBlock', advanceMode: 'timed', _moveToSegment: 'seg1' },
        ],
      },
    ])
    const result = await moveSlides({ data, req: {}, operation: 'update' } as any)
    expect(result.slides[0].slides).toHaveLength(1)
    expect(result.slides[0].slides[0]._moveToSegment).toBeUndefined()
  })

  it('__none__ results in no move', async () => {
    const data = makeData([
      { blockType: 'imageBlock', advanceMode: 'timed', _moveToSegment: '__none__' },
    ])
    const result = await moveSlides({ data, req: {}, operation: 'update' } as any)
    expect(result.slides).toHaveLength(1)
  })

  it('__top__ from top-level is no-op', async () => {
    const data = makeData([
      { blockType: 'imageBlock', advanceMode: 'timed', _moveToSegment: '__top__' },
    ])
    const result = await moveSlides({ data, req: {}, operation: 'update' } as any)
    expect(result.slides).toHaveLength(1)
  })

  it('strips _moveToSegment field after processing', async () => {
    const data = makeData([
      { blockType: 'imageBlock', advanceMode: 'timed', _moveToSegment: 'seg1' },
      { blockType: 'segmentBlock', id: 'seg1', loop: false, advanceMode: 'slides', slides: [] },
    ])
    const result = await moveSlides({ data, req: {}, operation: 'update' } as any)
    expect(result.slides[0]._moveToSegment).toBeUndefined()
    expect(result.slides[0].slides[0]._moveToSegment).toBeUndefined()
  })

  it('handles empty slides array', async () => {
    const data = makeData(undefined as any)
    const result = await moveSlides({ data: {}, req: {}, operation: 'update' } as any)
    expect(result).toEqual({})
  })

  it('handles multiple moves in one save', async () => {
    const data = makeData([
      { blockType: 'imageBlock', advanceMode: 'timed', _moveToSegment: 'seg1' },
      { blockType: 'videoBlock', advanceMode: 'onEnd', _moveToSegment: 'seg1' },
      { blockType: 'segmentBlock', id: 'seg1', loop: false, advanceMode: 'slides', slides: [] },
    ])
    const result = await moveSlides({ data, req: {}, operation: 'update' } as any)
    expect(result.slides).toHaveLength(1)
    expect(result.slides[0].slides).toHaveLength(2)
  })

  it('drops slide if target segment not found', async () => {
    const data = makeData([
      { blockType: 'imageBlock', advanceMode: 'timed', _moveToSegment: 'nonexistent' },
    ])
    const result = await moveSlides({ data, req: {}, operation: 'update' } as any)
    expect(result.slides).toHaveLength(0)
  })
})
