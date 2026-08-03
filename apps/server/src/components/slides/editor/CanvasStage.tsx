'use client'

import { useRef, type FC } from 'react'
import { Stage, Layer, Rect as KonvaRect, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import type { SlideDesign, SlideElement } from './types'
import { ElementNode } from './elements/ElementNode'
import { SelectionLayer } from './SelectionLayer'
import { TextEditorOverlay } from './TextEditorOverlay'

interface CanvasStageProps {
  design: SlideDesign
  visScale: number
  imageCache: Map<number, { url: string; image: HTMLImageElement }>
  selectedIds: string[]
  editingTextId: string | null
  editingText: SlideElement | null
  onSelect: (id: string) => void
  onElementChange: (id: string, partial: Partial<SlideElement>) => void
  onTextEdit: (element: SlideElement) => void
  onTextSave: (element: SlideElement, text: string) => void
  onTextCancel: () => void
  onStageClick: () => void
  stageRef: React.RefObject<Konva.Stage | null>
  transformerRef: React.RefObject<Konva.Transformer | null>
}

const CanvasStage: FC<CanvasStageProps> = ({
  design,
  visScale,
  imageCache,
  selectedIds,
  editingTextId,
  editingText,
  onSelect,
  onElementChange,
  onTextEdit,
  onTextSave,
  onTextCancel,
  onStageClick,
  stageRef,
  transformerRef,
}) => {
  const bgImage = imageCache.get(design.background.imageMediaId ?? -1)?.image

  return (
    <div
      style={{
        width: design.width * visScale,
        height: design.height * visScale,
        overflow: 'hidden',
        position: 'relative',
        background: '#1a1a2e',
        borderRadius: 4,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      <Stage
        ref={stageRef as any}
        width={design.width}
        height={design.height}
        style={{
          transform: `scale(${visScale})`,
          transformOrigin: 'top left',
        }}
        onClick={(e: any) => {
          if (e.target === e.target.getStage()) {
            onStageClick()
          }
        }}
        onTap={(e: any) => {
          if (e.target === e.target.getStage()) {
            onStageClick()
          }
        }}
      >
        <Layer>
          {design.background.type === 'color' && (
            <KonvaRect
              x={0}
              y={0}
              width={design.width}
              height={design.height}
              fill={design.background.color || '#000000'}
              listening={false}
            />
          )}
          {design.background.type === 'image' && bgImage && (
            <KonvaImage
              x={0}
              y={0}
              width={design.width}
              height={design.height}
              image={bgImage}
              listening={false}
            />
          )}

          {[...design.elements]
            .sort((a, b) => a.zIndex - b.zIndex)
            .filter((el) => el.id !== editingTextId)
            .map((el) => (
              <ElementNode
                key={el.id}
                element={el}
                imageCache={imageCache}
                isSelected={selectedIds.includes(el.id)}
                onSelect={onSelect}
                onChange={onElementChange}
                onTextEdit={onTextEdit}
              />
            ))}
          <SelectionLayer
            selectedIds={selectedIds}
            elements={design.elements}
            stageRef={stageRef}
            transformerRef={transformerRef}
          />
        </Layer>
      </Stage>

      {editingText && (
        <TextEditorOverlay
          element={editingText}
          visScale={visScale}
          onSave={(text) => onTextSave(editingText, text)}
          onCancel={onTextCancel}
        />
      )}
    </div>
  )
}

export default CanvasStage
