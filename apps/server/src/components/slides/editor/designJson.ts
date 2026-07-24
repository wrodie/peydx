import type { SlideDesign, SlideElement, TextData, ImageData, ShapeData } from './types'

export function createEmptyDesign(): SlideDesign {
  return {
    width: 1920,
    height: 1080,
    background: { type: 'color', color: '#000000' },
    elements: [],
  }
}

export function validateDesign(design: unknown): design is SlideDesign {
  if (!design || typeof design !== 'object') return false
  const d = design as Record<string, unknown>
  if (typeof d.width !== 'number' || typeof d.height !== 'number') return false
  if (!d.background || typeof d.background !== 'object') return false
  const bg = d.background as Record<string, unknown>
  if (bg.type !== 'color' && bg.type !== 'image') return false
  if (!Array.isArray(d.elements)) return false
  for (const el of d.elements) {
    if (!el || typeof el !== 'object') return false
    const e = el as Record<string, unknown>
    if (!e.id || !e.type) return false
    if (e.type !== 'text' && e.type !== 'image' && e.type !== 'shape') return false
    if (typeof e.x !== 'number' || typeof e.y !== 'number') return false
    if (typeof e.width !== 'number' || typeof e.height !== 'number') return false
    if (e.width <= 0 || e.height <= 0) return false
    if (e.type === 'image' && (!e.imageData || typeof (e.imageData as Record<string, unknown>).mediaId !== 'number')) return false
  }
  return true
}

export function normalizeDesign(design: unknown): SlideDesign {
  if (!design || typeof design !== 'object') {
    return createEmptyDesign()
  }
  const d = design as Record<string, unknown>
  const background = d.background as Record<string, unknown> | undefined
  const elements = Array.isArray(d.elements)
    ? d.elements.map(normalizeElement)
    : []

  elements.sort((a, b) => a.zIndex - b.zIndex)
  elements.forEach((el, i) => { el.zIndex = i })

  return {
    width: 1920,
    height: 1080,
    background: {
      type: background?.type === 'image' ? 'image' : 'color',
      color: (background?.color as string) || '#000000',
      imageMediaId: background?.imageMediaId
        ? Number(background.imageMediaId)
        : undefined,
      fit: (background?.fit as string) === 'contain' ? 'contain' : 'cover',
    },
    elements,
  }
}

export function normalizeElement(el: unknown): SlideElement {
  const e = (el || {}) as Record<string, unknown>
  const id = (e.id as string) || crypto.randomUUID?.() || `el-${Date.now()}-${Math.random()}`

  const base = {
    id,
    type: (e.type as SlideElement['type']) || 'text',
    x: Number(e.x) || 760,
    y: Number(e.y) || 490,
    width: Math.max(5, Number(e.width) || 400),
    height: Math.max(5, Number(e.height) || 100),
    rotation: ((Number(e.rotation) % 360) + 360) % 360,
    opacity: e.opacity != null ? Math.min(1, Math.max(0, Number(e.opacity))) : 1,
    zIndex: Number(e.zIndex) || 0,
  }

  const textData = e.textData as Record<string, unknown> | undefined
  const imageData = e.imageData as Record<string, unknown> | undefined
  const shapeData = e.shapeData as Record<string, unknown> | undefined

  return {
    ...base,
    textData: base.type === 'text' ? {
      text: String(textData?.text ?? ''),
      fontFamily: (textData?.fontFamily as string) || 'Inter',
      fontSize: Number(textData?.fontSize) || 48,
      color: (textData?.color as string) || '#ffffff',
      textAlign: (textData?.textAlign as TextData['textAlign']) || 'left',
      bold: Boolean(textData?.bold),
      italic: Boolean(textData?.italic),
      lineHeight: Number(textData?.lineHeight) || 1.2,
    } : undefined,
    imageData: base.type === 'image' ? {
      mediaId: Number(imageData?.mediaId),
      fit: (imageData?.fit as ImageData['fit']) || 'cover',
      borderRadius: Math.max(0, Number(imageData?.borderRadius) || 0),
    } : undefined,
    shapeData: base.type === 'shape' ? {
      shape: (shapeData?.shape as ShapeData['shape']) || 'rect',
      fill: (shapeData?.fill as string) ?? '#ffffff',
      stroke: (shapeData?.stroke as string) ?? 'none',
      strokeWidth: Math.max(0, Number(shapeData?.strokeWidth) || 0),
      borderRadius: Math.max(0, Number(shapeData?.borderRadius) || 0),
    } : undefined,
  }
}

export function createElement(type: SlideElement['type']): SlideElement {
  const id = crypto.randomUUID?.() || `el-${Date.now()}-${Math.random()}`
  const base = {
    id,
    type,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
  }

  switch (type) {
    case 'text':
      return {
        ...base,
        x: 760,
        y: 490,
        width: 400,
        height: 100,
        textData: {
          text: 'Double-click to edit',
          fontFamily: 'Inter',
          fontSize: 48,
          color: '#ffffff',
          textAlign: 'left',
          bold: false,
          italic: false,
          lineHeight: 1.2,
        },
      }
    case 'image':
      return {
        ...base,
        x: 760,
        y: 390,
        width: 400,
        height: 300,
        imageData: {
          mediaId: 0,
          fit: 'cover',
          borderRadius: 0,
        },
      }
    case 'shape':
      return {
        ...base,
        x: 860,
        y: 440,
        width: 200,
        height: 200,
        shapeData: {
          shape: 'rect',
          fill: '#ffffff',
          stroke: 'none',
          strokeWidth: 0,
          borderRadius: 0,
        },
      }
  }
}

export function duplicateElement(el: SlideElement): SlideElement {
  const cloned = structuredClone?.(el) ?? JSON.parse(JSON.stringify(el))
  cloned.id = crypto.randomUUID?.() || `el-${Date.now()}-${Math.random()}`
  cloned.x += 20
  cloned.y += 20
  return cloned
}

export type Alignment =
  | 'left' | 'center' | 'right'
  | 'top' | 'middle' | 'bottom'

export function alignToCanvas(
  element: SlideElement,
  alignment: Alignment,
  canvasWidth: number,
  canvasHeight: number,
): SlideElement {
  switch (alignment) {
    case 'left':
      return { ...element, x: 0 }
    case 'center':
      return { ...element, x: (canvasWidth - element.width) / 2 }
    case 'right':
      return { ...element, x: canvasWidth - element.width }
    case 'top':
      return { ...element, y: 0 }
    case 'middle':
      return { ...element, y: (canvasHeight - element.height) / 2 }
    case 'bottom':
      return { ...element, y: canvasHeight - element.height }
  }
}
