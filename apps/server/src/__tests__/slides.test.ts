import { describe, it, expect } from 'vitest'
import {
  createEmptyDesign,
  validateDesign,
  normalizeDesign,
  normalizeElement,
  createElement,
  duplicateElement,
  alignToCanvas,
} from '../components/slides/editor/designJson'
import type { SlideDesign, SlideElement } from '../components/slides/editor/types'

describe('createEmptyDesign', () => {
  it('returns a valid empty design', () => {
    const design = createEmptyDesign()
    expect(design.width).toBe(1920)
    expect(design.height).toBe(1080)
    expect(design.background.type).toBe('color')
    expect(design.background.color).toBe('#000000')
    expect(design.elements).toEqual([])
  })
})

describe('validateDesign', () => {
  it('accepts well-formed input', () => {
    const design = createEmptyDesign()
    design.elements.push({
      id: 'test-1',
      type: 'text',
      x: 100,
      y: 200,
      width: 300,
      height: 100,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      textData: {
        text: 'hello',
        fontFamily: 'Inter',
        fontSize: 48,
        color: '#ffffff',
        textAlign: 'left',
        bold: false,
        italic: false,
        lineHeight: 1.2,
      },
    })
    expect(validateDesign(design)).toBe(true)
  })

  it('rejects null', () => {
    expect(validateDesign(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(validateDesign(undefined)).toBe(false)
  })

  it('rejects missing type', () => {
    expect(validateDesign({ width: 1920, height: 1080, background: { type: 'color' }, elements: [{ id: 'x', x: 0, y: 0, width: 1, height: 1 }] })).toBe(false)
  })

  it('rejects negative width', () => {
    expect(validateDesign({ width: 1920, height: 1080, background: { type: 'color' }, elements: [{ id: 'x', type: 'text', x: 0, y: 0, width: -1, height: 1 }] })).toBe(false)
  })

  it('rejects unknown element type', () => {
    expect(validateDesign({ width: 1920, height: 1080, background: { type: 'color' }, elements: [{ id: 'x', type: 'unknown', x: 0, y: 0, width: 100, height: 100 }] })).toBe(false)
  })
})

describe('normalizeDesign', () => {
  it('normalizes a null input to empty design', () => {
    const d = normalizeDesign(null)
    expect(d.width).toBe(1920)
    expect(d.height).toBe(1080)
    expect(d.elements).toEqual([])
  })

  it('strips unknown fields', () => {
    const d = normalizeDesign({ width: 1920, height: 1080, background: { type: 'color' }, elements: [], unknown: 'bad' })
    expect((d as any).unknown).toBeUndefined()
  })

  it('fills defaults for background', () => {
    const d = normalizeDesign({ width: 1920, height: 1080, elements: [] })
    expect(d.background.type).toBe('color')
    expect(d.background.color).toBe('#000000')
  })

  it('re-sequences zIndex contiguously from 0', () => {
    const el1 = createElement('text')
    el1.zIndex = 5
    const el2 = createElement('text')
    el2.zIndex = 10
    const d = normalizeDesign({ width: 1920, height: 1080, background: { type: 'color' }, elements: [el1, el2] })
    expect(d.elements[0].zIndex).toBe(0)
    expect(d.elements[1].zIndex).toBe(1)
  })

  it('clamps opacity to 0-1', () => {
    const el = createElement('text')
    el.opacity = 2.5
    const d = normalizeDesign({ width: 1920, height: 1080, background: { type: 'color' }, elements: [el] })
    expect(d.elements[0].opacity).toBe(1)
  })

  it('clamps rotation to 0-359', () => {
    const el = createElement('text')
    el.rotation = 400
    const d = normalizeDesign({ width: 1920, height: 1080, background: { type: 'color' }, elements: [el] })
    expect(d.elements[0].rotation).toBe(40)
  })

  it('clamps width/height to minimum 5', () => {
    const el = createElement('text')
    el.width = 2
    el.height = -3
    const d = normalizeDesign({ width: 1920, height: 1080, background: { type: 'color' }, elements: [el] })
    expect(d.elements[0].width).toBe(5)
    expect(d.elements[0].height).toBe(5)
  })
})

describe('normalizeElement', () => {
  it('fills defaults for missing fields', () => {
    const el = normalizeElement({})
    expect(el.id).toBeTruthy()
    expect(el.type).toBe('text')
    expect(el.x).toBe(760)
    expect(el.y).toBe(490)
    expect(el.opacity).toBe(1)
  })
})

describe('createElement', () => {
  it('creates valid text element', () => {
    const el = createElement('text')
    expect(el.type).toBe('text')
    expect(el.textData?.text).toBe('Double-click to edit')
    expect(el.textData?.fontFamily).toBe('Inter')
    expect(el.textData?.fontSize).toBe(48)
  })

  it('creates valid image element', () => {
    const el = createElement('image')
    expect(el.type).toBe('image')
    expect(el.imageData?.mediaId).toBe(0)
    expect(el.width).toBe(400)
    expect(el.height).toBe(300)
  })

  it('creates valid shape element (rect)', () => {
    const el = createElement('shape')
    expect(el.type).toBe('shape')
    expect(el.shapeData?.shape).toBe('rect')
    expect(el.shapeData?.fill).toBe('#ffffff')
  })
})

describe('duplicateElement', () => {
  it('creates a deep clone with new id', () => {
    const el = createElement('text')
    const dup = duplicateElement(el)
    expect(dup.id).not.toBe(el.id)
    expect(dup.type).toBe(el.type)
    expect(dup.textData?.text).toBe(el.textData?.text)
    expect(dup.x).toBe(el.x + 20)
    expect(dup.y).toBe(el.y + 20)
  })

  it('does not mutate original', () => {
    const el = createElement('text')
    const originalX = el.x
    duplicateElement(el)
    expect(el.x).toBe(originalX)
  })
})

describe('alignToCanvas', () => {
  const el: SlideElement = {
    id: 'test',
    type: 'text',
    x: 100,
    y: 200,
    width: 400,
    height: 100,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
  }

  it('aligns left', () => {
    const r = alignToCanvas(el, 'left', 1920, 1080)
    expect(r.x).toBe(0)
    expect(r.y).toBe(200)
  })

  it('aligns center', () => {
    const r = alignToCanvas(el, 'center', 1920, 1080)
    expect(r.x).toBe((1920 - 400) / 2)
  })

  it('aligns right', () => {
    const r = alignToCanvas(el, 'right', 1920, 1080)
    expect(r.x).toBe(1920 - 400)
  })

  it('aligns top', () => {
    const r = alignToCanvas(el, 'top', 1920, 1080)
    expect(r.y).toBe(0)
    expect(r.x).toBe(100)
  })

  it('aligns middle', () => {
    const r = alignToCanvas(el, 'middle', 1920, 1080)
    expect(r.y).toBe((1080 - 100) / 2)
  })

  it('aligns bottom', () => {
    const r = alignToCanvas(el, 'bottom', 1920, 1080)
    expect(r.y).toBe(1080 - 100)
  })
})
