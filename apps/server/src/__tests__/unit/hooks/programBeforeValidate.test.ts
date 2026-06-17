import { describe, it, expect, vi } from 'vitest'
import { programBeforeValidate } from '../../../hooks/programBeforeValidate'

describe('programBeforeValidate', () => {
  it('strips slides with id === "auto-end"', () => {
    const data = {
      slides: [
        { id: 'slide-1', blockType: 'imageBlock' },
        { id: 'auto-end', blockType: 'blackScreenBlock' },
        { id: 'slide-2', blockType: 'videoBlock' },
      ],
    }
    const result = programBeforeValidate({ data } as any)
    expect(result.slides).toHaveLength(2)
    expect(result.slides![0].id).toBe('slide-1')
    expect(result.slides![1].id).toBe('slide-2')
  })

  it('strips slides with missing blockType', () => {
    const data = {
      slides: [
        { id: 'slide-1', blockType: 'imageBlock' },
        { id: 'bad-slide' },
        { id: 'slide-2', blockType: 'videoBlock' },
      ],
    }
    const result = programBeforeValidate({ data } as any)
    expect(result.slides).toHaveLength(2)
    expect(result.slides![0].blockType).toBe('imageBlock')
    expect(result.slides![1].blockType).toBe('videoBlock')
  })

  it('preserves normal slides untouched', () => {
    const data = {
      slides: [
        { id: 's1', blockType: 'imageBlock' },
        { id: 's2', blockType: 'videoBlock' },
        { id: 's3', blockType: 'segmentBlock' },
      ],
    }
    const result = programBeforeValidate({ data } as any)
    expect(result.slides).toEqual(data.slides)
  })

  it('handles empty slides array', () => {
    const data = { slides: [] }
    const result = programBeforeValidate({ data } as any)
    expect(result.slides).toEqual([])
  })

  it('returns data unchanged when slides is undefined', () => {
    const data = { title: 'foo' }
    const result = programBeforeValidate({ data } as any)
    expect(result).toEqual(data)
  })
})
