'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Transformer } from 'react-konva'
import type Konva from 'konva'

interface SelectionLayerProps {
  selectedIds: string[]
  elements: { id: string }[]
  stageRef: React.RefObject<Konva.Stage | null>
  transformerRef: React.RefObject<Konva.Transformer | null>
}

export function SelectionLayer({ selectedIds, elements, stageRef, transformerRef }: SelectionLayerProps) {
  const previousIdsRef = useRef<string[]>([])

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return

    const previousIds = previousIdsRef.current
    previousIdsRef.current = [...selectedIds]

    const stage = stageRef.current
    if (!stage) return

    if (selectedIds.length === 0) {
      transformer.nodes([])
      transformer.getLayer()?.batchDraw()
      return
    }

    // Only update if selection actually changed (avoids unnecessary detach/reattach)
    const sameSelection =
      previousIds.length === selectedIds.length &&
      previousIds.every((id) => selectedIds.includes(id))

    if (sameSelection) {
      transformer.getLayer()?.batchDraw()
      return
    }

    const nodes = selectedIds
      .map((id) => stage.findOne('#' + id))
      .filter(Boolean) as Konva.Node[]

    transformer.nodes(nodes)
    transformer.getLayer()?.batchDraw()
  }, [selectedIds, elements, stageRef, transformerRef])

  return (
    <Transformer
      ref={transformerRef as any}
      rotateEnabled={true}
      resizeEnabled={true}
      keepRatio={false}
      anchorSize={8}
      anchorCornerRadius={4}
      borderStroke="#4a9eff"
      anchorStroke="#4a9eff"
      anchorFill="#ffffff"
      rotateAnchorOffset={30}
      boundBoxFunc={(oldBox, newBox) => {
        if (newBox.width < 5 || newBox.height < 5) {
          return oldBox
        }
        return newBox
      }}
    />
  )
}
