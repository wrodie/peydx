export interface SlideDesign {
  width: number
  height: number
  background: SlideBackground
  elements: SlideElement[]
}

export interface SlideBackground {
  type: 'color' | 'image'
  color?: string
  imageMediaId?: number
  fit?: 'cover' | 'contain'
}

export interface SlideElement {
  id: string
  type: 'text' | 'image' | 'shape'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
  textData?: TextData
  imageData?: ImageData
  shapeData?: ShapeData
}

export interface TextData {
  text: string
  fontFamily: string
  fontSize: number
  color: string
  textAlign: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
  lineHeight: number
}

export interface ImageData {
  mediaId: number
  fit: 'cover' | 'contain'
  borderRadius: number
}

export interface ShapeData {
  shape: 'rect' | 'ellipse' | 'line'
  fill: string
  stroke: string
  strokeWidth: number
  borderRadius: number
}
