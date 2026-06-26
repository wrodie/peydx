import { describe, it, expect } from 'vitest'
import { computeMove } from '../../../components/program-edit/computeMove'

function makeSlides(slides: any[]): any[] {
  return slides
}

function seg(name: string, slides: any[] = []) {
  return { id: name, blockType: 'segmentBlock', slides, name, advanceMode: 'slides', loop: false }
}

function slide(blockType = 'imageBlock') {
  return { blockType }
}

describe('computeMove', () => {
  const rootPath = 'slides'

  it('same-container top-level: move before (src < dst)', () => {
    const slides = makeSlides([
      slide(), slide(), slide(), slide(),
    ])
    const result = computeMove({
      rootPath,
      topLevelSlides: slides,
      srcContainer: null,
      srcIndex: 0,
      dstContainer: null,
      dstIndex: 3,
    })
    expect(result).not.toBeNull()
    expect(result!.kind).toBe('same-container')
    if (result!.kind === 'same-container') {
      expect(result.path).toBe(rootPath)
      expect(result.moveFromIndex).toBe(0)
      expect(result.moveToIndex).toBe(2)
    }
  })

  it('same-container top-level: move after (src > dst)', () => {
    const slides = makeSlides([
      slide(), slide(), slide(), slide(),
    ])
    const result = computeMove({
      rootPath,
      topLevelSlides: slides,
      srcContainer: null,
      srcIndex: 3,
      dstContainer: null,
      dstIndex: 0,
    })
    expect(result).not.toBeNull()
    expect(result!.kind).toBe('same-container')
    if (result!.kind === 'same-container') {
      expect(result.path).toBe(rootPath)
      expect(result.moveFromIndex).toBe(3)
      expect(result.moveToIndex).toBe(0)
    }
  })

  it('same-container within segment', () => {
    const slides = makeSlides([
      seg('seg-1', [slide('imageBlock'), slide('videoBlock'), slide('audioBlock')]),
    ])
    const result = computeMove({
      rootPath,
      topLevelSlides: slides,
      srcContainer: 'seg-1',
      srcIndex: 0,
      dstContainer: 'seg-1',
      dstIndex: 2,
    })
    expect(result).not.toBeNull()
    expect(result!.kind).toBe('same-container')
    if (result!.kind === 'same-container') {
      expect(result.path).toBe('slides.0.slides')
      expect(result.moveFromIndex).toBe(0)
      expect(result.moveToIndex).toBe(1)
    }
  })

  it('cross-container: top-level → segment', () => {
    const slides = makeSlides([
      slide('imageBlock'),
      seg('seg-1', [slide('videoBlock')]),
    ])
    const result = computeMove({
      rootPath,
      topLevelSlides: slides,
      srcContainer: null,
      srcIndex: 0,
      dstContainer: 'seg-1',
      dstIndex: 1,
    })
    expect(result).not.toBeNull()
    expect(result!.kind).toBe('cross-container')
    if (result!.kind === 'cross-container') {
      expect(result.removePath).toBe(rootPath)
      expect(result.removeIndex).toBe(0)
      expect(result.insertPath).toBe('slides.1.slides')
      expect(result.insertIndex).toBe(1)
    }
  })

  it('cross-container: segment → top-level', () => {
    const slides = makeSlides([
      seg('seg-1', [slide('imageBlock'), slide('videoBlock')]),
      slide('audioBlock'),
    ])
    const result = computeMove({
      rootPath,
      topLevelSlides: slides,
      srcContainer: 'seg-1',
      srcIndex: 1,
      dstContainer: null,
      dstIndex: 1,
    })
    expect(result).not.toBeNull()
    expect(result!.kind).toBe('cross-container')
    if (result!.kind === 'cross-container') {
      expect(result.removePath).toBe('slides.0.slides')
      expect(result.removeIndex).toBe(1)
      expect(result.insertPath).toBe(rootPath)
      expect(result.insertIndex).toBe(1)
    }
  })

  it('cross-container: segment → segment', () => {
    const slides = makeSlides([
      seg('seg-1', [slide('imageBlock')]),
      seg('seg-2', [slide('videoBlock')]),
    ])
    const result = computeMove({
      rootPath,
      topLevelSlides: slides,
      srcContainer: 'seg-1',
      srcIndex: 0,
      dstContainer: 'seg-2',
      dstIndex: 1,
    })
    expect(result).not.toBeNull()
    expect(result!.kind).toBe('cross-container')
    if (result!.kind === 'cross-container') {
      expect(result.removePath).toBe('slides.0.slides')
      expect(result.removeIndex).toBe(0)
      expect(result.insertPath).toBe('slides.1.slides')
      expect(result.insertIndex).toBe(1)
    }
  })

  it('same-container: target at end via Infinity count', () => {
    const slides = makeSlides([
      slide(), slide(), slide(),
    ])
    const result = computeMove({
      rootPath,
      topLevelSlides: slides,
      srcContainer: null,
      srcIndex: 0,
      dstContainer: null,
      dstIndex: 3,
    })
    expect(result).not.toBeNull()
    expect(result!.kind).toBe('same-container')
    if (result!.kind === 'same-container') {
      expect(result.moveFromIndex).toBe(0)
      expect(result.moveToIndex).toBe(2)
    }
  })

  it('segment move: top-level reorder (same-container)', () => {
    const slides = makeSlides([
      slide(),
      seg('seg-1', [slide()]),
      slide(),
    ])
    const result = computeMove({
      rootPath,
      topLevelSlides: slides,
      srcContainer: null,
      srcIndex: 1,
      dstContainer: null,
      dstIndex: 0,
    })
    expect(result).not.toBeNull()
    expect(result!.kind).toBe('same-container')
    if (result!.kind === 'same-container') {
      expect(result.path).toBe(rootPath)
      expect(result.moveFromIndex).toBe(1)
      expect(result.moveToIndex).toBe(0)
    }
  })

  it('returns null for unknown segment container', () => {
    const slides = makeSlides([slide()])
    const result = computeMove({
      rootPath,
      topLevelSlides: slides,
      srcContainer: 'nonexistent',
      srcIndex: 0,
      dstContainer: null,
      dstIndex: 1,
    })
    expect(result).toBeNull()
  })
})
