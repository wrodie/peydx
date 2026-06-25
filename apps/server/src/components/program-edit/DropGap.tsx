'use client'

import { useDroppable } from '@dnd-kit/core'
import type { FC } from 'react'

type DropGapProps = {
  id: string
  container: string | null
  index: number
}

export const DropGap: FC<DropGapProps> = ({ id, container, index }) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'gap', container, index },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        height: 4,
        flexShrink: 0,
        width: '100%',
        position: 'relative',
      }}
    >
      {isOver && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: '50%',
            height: 2,
            transform: 'translateY(-50%)',
            background: 'var(--theme-primary-500, #3b82f6)',
            borderRadius: 1,
          }}
        />
      )}
    </div>
  )
}
