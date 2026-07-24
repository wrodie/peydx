'use client'

import type { SlideElement } from './types'
import type { HTMLImageElement as KonvaImageRef } from 'konva/lib/shapes/Image'
import { Rect as KonvaRect, Text as KonvaText, Image as KonvaImage, Ellipse as KonvaEllipse, Line as KonvaLine } from 'react-konva'

interface ElementNodeProps {
  element: SlideElement
  imageCache: Map<number, { url: string; image: HTMLImageElement }>
  isSelected: boolean
  onSelect: (id: string) => void
  onChange: (id: string, partial: Partial<SlideElement>) => void
  onTextEdit: (element: SlideElement) => void
}

export function ElementNode({ element, imageCache, isSelected, onSelect, onChange, onTextEdit }: ElementNodeProps) {
  const commonProps = {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    opacity: element.opacity,
    draggable: true,
    onClick: () => onSelect(element.id),
    onTap: () => onSelect(element.id),
    onDragEnd: (e: any) => {
      onChange(element.id, { x: e.target.x(), y: e.target.y() })
    },
    onTransformEnd: (e: any) => {
      const node = e.target
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      onChange(element.id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(5, node.width() * scaleX),
        height: Math.max(5, node.height() * scaleY),
        rotation: node.rotation(),
      })
      node.scaleX(1)
      node.scaleY(1)
    },
  }

  switch (element.type) {
    case 'text':
      return (
        <KonvaText
          {...commonProps}
          text={element.textData?.text ?? ''}
          fontFamily={element.textData?.fontFamily ?? 'Inter'}
          fontSize={element.textData?.fontSize ?? 48}
          fill={element.textData?.color ?? '#ffffff'}
          align={element.textData?.textAlign ?? 'left'}
          fontStyle={`${element.textData?.bold ? 'bold' : ''} ${element.textData?.italic ? 'italic' : ''}`.trim() || 'normal'}
          lineHeight={element.textData?.lineHeight ?? 1.2}
          onDblClick={() => onTextEdit(element)}
          onDblTap={() => onTextEdit(element)}
        />
      )

    case 'image': {
      const cached = element.imageData?.mediaId ? imageCache.get(element.imageData.mediaId) : undefined
      const img = cached?.image
      if (!img) return null
      return (
        <KonvaImage
          {...commonProps}
          image={img}
        />
      )
    }

    case 'shape': {
      const shape = element.shapeData?.shape ?? 'rect'
      switch (shape) {
        case 'rect':
          return (
            <KonvaRect
              {...commonProps}
              fill={element.shapeData?.fill === 'none' ? undefined : element.shapeData?.fill}
              stroke={element.shapeData?.stroke === 'none' ? undefined : element.shapeData?.stroke}
              strokeWidth={element.shapeData?.strokeWidth ?? 0}
              cornerRadius={element.shapeData?.borderRadius ?? 0}
            />
          )
        case 'ellipse':
          return (
            <KonvaEllipse
              {...commonProps}
              x={element.x + element.width / 2}
              y={element.y + element.height / 2}
              radiusX={element.width / 2}
              radiusY={element.height / 2}
              fill={element.shapeData?.fill === 'none' ? undefined : element.shapeData?.fill}
              stroke={element.shapeData?.stroke === 'none' ? undefined : element.shapeData?.stroke}
              strokeWidth={element.shapeData?.strokeWidth ?? 0}
            />
          )
        case 'line':
          return (
            <KonvaLine
              {...commonProps}
              points={[0, element.height / 2, element.width, element.height / 2]}
              stroke={element.shapeData?.stroke === 'none' ? '#000000' : element.shapeData?.stroke ?? '#000000'}
              strokeWidth={element.shapeData?.strokeWidth ?? 2}
              listening={true}
            />
          )
        default:
          return null
      }
    }

    default:
      return null
  }
}
