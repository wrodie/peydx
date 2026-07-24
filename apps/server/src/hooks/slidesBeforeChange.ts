import type { CollectionBeforeChangeHook } from 'payload'

function normalizeElement(el: any): any {
  const id = el.id || crypto.randomUUID?.() || `el-${Date.now()}-${Math.random()}`
  return {
    id,
    type: el.type || 'text',
    x: Number(el.x) || 760,
    y: Number(el.y) || 490,
    width: Math.max(5, Number(el.width) || 400),
    height: Math.max(5, Number(el.height) || 100),
    rotation: ((Number(el.rotation) % 360) + 360) % 360,
    opacity: Math.min(1, Math.max(0, Number(el.opacity) ?? 1)),
    zIndex: Number(el.zIndex) || 0,
    textData: el.textData ? {
      text: String(el.textData.text ?? ''),
      fontFamily: el.textData.fontFamily || 'Inter',
      fontSize: Number(el.textData.fontSize) || 48,
      color: el.textData.color || '#ffffff',
      textAlign: el.textData.textAlign || 'left',
      bold: Boolean(el.textData.bold),
      italic: Boolean(el.textData.italic),
      lineHeight: Number(el.textData.lineHeight) || 1.2,
    } : undefined,
    imageData: el.imageData ? {
      mediaId: Number(el.imageData.mediaId),
      fit: el.imageData.fit || 'cover',
      borderRadius: Math.max(0, Number(el.imageData.borderRadius) || 0),
    } : undefined,
    shapeData: el.shapeData ? {
      shape: el.shapeData.shape || 'rect',
      fill: el.shapeData.fill ?? '#ffffff',
      stroke: el.shapeData.stroke ?? 'none',
      strokeWidth: Math.max(0, Number(el.shapeData.strokeWidth) || 0),
      borderRadius: Math.max(0, Number(el.shapeData.borderRadius) || 0),
    } : undefined,
  }
}

function normalizeDesign(design: any): any {
  if (!design || typeof design !== 'object') {
    return createEmptyDesign()
  }

  const elements = Array.isArray(design.elements)
    ? design.elements.map(normalizeElement)
    : []

  elements.sort((a: any, b: any) => a.zIndex - b.zIndex)
  elements.forEach((el: any, i: number) => { el.zIndex = i })

  return {
    width: 1920,
    height: 1080,
    background: {
      type: design.background?.type === 'image' ? 'image' : 'color',
      color: design.background?.color || '#000000',
      imageMediaId: design.background?.imageMediaId
        ? Number(design.background.imageMediaId)
        : undefined,
      fit: design.background?.fit || 'cover',
    },
    elements,
  }
}

function createEmptyDesign() {
  return {
    width: 1920,
    height: 1080,
    background: { type: 'color', color: '#000000' },
    elements: [],
  }
}

export const slidesBeforeChange: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  const user = req.user as any

  data.designJson = normalizeDesign(data.designJson)

  if (!data.width) data.width = 1920
  if (!data.height) data.height = 1080

  if (user && !data.createdBy) {
    data.createdBy = user.id
  }

  return data
}
