import { describe, it, expect, vi } from 'vitest'
import { programAutoEndSlide } from '../../../hooks/programAutoEndSlide'

describe('programAutoEndSlide', () => {
  it('appends blackScreenBlock when autoBlackEndSlide=true and !loop', () => {
    const doc = {
      slides: [{ id: 's1', blockType: 'imageBlock' }],
      autoBlackEndSlide: true,
      loop: false,
    }
    const result = programAutoEndSlide({ doc } as any)
    expect(result.slides).toHaveLength(2)
    expect(result.slides[1].blockType).toBe('blackScreenBlock')
    expect(result.slides[1].id).toBe('auto-end')
    expect(result.slides[1].advanceMode).toBe('manual')
    expect(result.slides[1].transition).toBe('fade')
    expect(result.slides[1].duration).toBeNull()
  })

  it('does not append when loop=true', () => {
    const doc = {
      slides: [{ id: 's1', blockType: 'imageBlock' }],
      autoBlackEndSlide: true,
      loop: true,
    }
    const result = programAutoEndSlide({ doc } as any)
    expect(result.slides).toHaveLength(1)
  })

  it('does not append when autoBlackEndSlide=false', () => {
    const doc = {
      slides: [{ id: 's1', blockType: 'imageBlock' }],
      autoBlackEndSlide: false,
      loop: false,
    }
    const result = programAutoEndSlide({ doc } as any)
    expect(result.slides).toHaveLength(1)
  })

  it('does not append when last slide is already blackScreenBlock', () => {
    const doc = {
      slides: [
        { id: 's1', blockType: 'imageBlock' },
        { id: 'end', blockType: 'blackScreenBlock' },
      ],
      autoBlackEndSlide: true,
      loop: false,
    }
    const result = programAutoEndSlide({ doc } as any)
    expect(result.slides).toHaveLength(2)
    expect(result.slides[1].blockType).toBe('blackScreenBlock')
    expect(result.slides[1].id).toBe('end')
  })

  it('does not append when slides array is empty', () => {
    const doc = {
      slides: [],
      autoBlackEndSlide: true,
      loop: false,
    }
    const result = programAutoEndSlide({ doc } as any)
    expect(result.slides).toHaveLength(0)
  })

  it('does not append when auto-end slide already exists somewhere', () => {
    const doc = {
      slides: [
        { id: 'auto-end', blockType: 'blackScreenBlock' },
        { id: 's1', blockType: 'imageBlock' },
      ],
      autoBlackEndSlide: true,
      loop: false,
    }
    const result = programAutoEndSlide({ doc } as any)
    expect(result.slides).toHaveLength(2)
  })

  it('filters out slides without blockType', () => {
    const doc = {
      slides: [
        { id: 's1', blockType: 'imageBlock' },
        { id: 'bad' },
        { id: 's2', blockType: 'videoBlock' },
      ],
      autoBlackEndSlide: true,
      loop: false,
    }
    const result = programAutoEndSlide({ doc } as any)
    expect(result.slides).toHaveLength(3)
    expect(result.slides[0].blockType).toBe('imageBlock')
    expect(result.slides[1].blockType).toBe('videoBlock')
    expect(result.slides[2].blockType).toBe('blackScreenBlock')
  })
})
