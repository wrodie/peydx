import { describe, it, expect } from 'vitest'
import { stripInternal } from '../../../components/program-edit/stripInternal'

describe('stripInternal', () => {
  it('removes _moveToSegment, bulkMedia, id, and auto-* slides', () => {
    const slides = [
      { id: 'a1', blockType: 'imageBlock', image: 1, _moveToSegment: 'seg1', bulkMedia: [1, 2] },
      { id: 'auto-end', blockType: 'imageBlock', image: 2 },
      { id: 's1', blockType: 'segmentBlock', name: 'Seg', slides: [
        { id: 'c1', blockType: 'videoBlock', video: 3, _moveToSegment: '__top__', bulkMedia: null },
      ]},
    ]

    const result = stripInternal(slides)

    expect(result).toHaveLength(2)
    expect(result[0]).not.toHaveProperty('id')
    expect(result[0]).not.toHaveProperty('_moveToSegment')
    expect(result[0].bulkMedia).toBeNull()
    expect(result[0].image).toBe(1)

    expect(result[1].slides).toHaveLength(1)
    expect(result[1].slides[0]).not.toHaveProperty('id')
    expect(result[1].slides[0]).not.toHaveProperty('_moveToSegment')
    expect(result[1].slides[0].video).toBe(3)
  })

  it('strips nested segment slides recursively', () => {
    const slides = [
      { id: 'outer', blockType: 'segmentBlock', name: 'Outer', slides: [
        { id: 'inner', blockType: 'segmentBlock', name: 'Inner', slides: [
          { id: 'leaf', blockType: 'imageBlock', image: 5 },
        ]},
      ]},
    ]

    const result = stripInternal(slides)

    expect(result).toHaveLength(1)
    expect(result[0].slides).toHaveLength(1)
    expect(result[0].slides[0].slides).toHaveLength(1)
    expect(result[0].slides[0].slides[0].image).toBe(5)
  })

  it('filters out slides with missing blockType or falsy values', () => {
    const slides = [
      null,
      { id: 'x', _moveToSegment: 'seg' },
      { id: 'ok', blockType: 'imageBlock', image: 7 },
    ]

    const result = stripInternal(slides)

    expect(result).toHaveLength(1)
    expect(result[0].image).toBe(7)
  })
})
