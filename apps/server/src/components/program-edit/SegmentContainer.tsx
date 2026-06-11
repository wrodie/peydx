'use client'

import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState, type FC } from 'react'
import { SlideCard } from './SlideCard'

type SegmentContainerProps = {
  segment: any
  index: number
  mediaMap: Record<number, { url: string; thumbnailUrl: string | null; name: string; filename: string }>
  onEditSlide: (slide: any, idx: number, segmentId: string) => void
  onRemoveSlide: (idx: number, segmentId: string) => void
  onEditSegmentName: (name: string) => void
  onRemoveSegment: () => void
}

export const SegmentContainer: FC<SegmentContainerProps> = ({
  segment,
  index,
  mediaMap,
  onEditSlide,
  onRemoveSlide,
  onEditSegmentName,
  onRemoveSegment,
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(segment.name || '')
  const segmentId = segment.id || `seg-${index}`

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: segmentId,
    data: { type: 'segment', segment, index, segmentId },
  })

  const { setNodeRef: setSlideAreaRef, isOver: isSlideOver } = useDroppable({
    id: `${segmentId}-drop`,
    data: { type: 'segment-drop', segmentId },
  })

  const slideIds = (segment.slides || []).map(
    (_: any, i: number) => `${segmentId}-slide-${i}`
  )

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleNameSave = () => {
    setEditingName(false)
    if (nameValue !== segment.name) {
      onEditSegmentName(nameValue)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        marginBottom: 8,
        border: `1px solid ${isOver ? 'var(--theme-primary-300, #93c5fd)' : 'var(--theme-elevation-300, #d1d5db)'}`,
        borderRadius: 8,
        background: isDragging ? 'var(--theme-elevation-50, #f9fafb)' : 'white',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderBottom: collapsed ? 'none' : '1px solid var(--theme-elevation-200, #e5e7eb)',
          background: 'var(--theme-elevation-50, #f9fafb)',
          borderRadius: '8px 8px 0 0',
          cursor: 'grab',
        }}
      >
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            color: 'var(--theme-elevation-400, #9ca3af)',
            fontSize: '1.1rem',
            flexShrink: 0,
          }}
        >
          ≡
        </div>

        <span
          onClick={() => setCollapsed(!collapsed)}
          style={{
            cursor: 'pointer',
            fontSize: '0.8rem',
            flexShrink: 0,
          }}
        >
          {collapsed ? '▸' : '▾'}
        </span>

        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📁</span>

        {editingName ? (
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSave()
              if (e.key === 'Escape') {
                setNameValue(segment.name || '')
                setEditingName(false)
              }
            }}
            autoFocus
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid var(--theme-elevation-300, #d1d5db)',
              borderRadius: 4,
            }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditingName(true)}
            style={{
              flex: 1,
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'text',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {segment.name || 'Unnamed Segment'}
          </span>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            fontSize: '0.75rem',
          }}
        >
          {(segment.slides || []).length > 0 && (
            <span
              style={{
                background: 'var(--theme-elevation-200, #e5e7eb)',
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              {(segment.slides || []).length} slide{(segment.slides || []).length !== 1 ? 's' : ''}
            </span>
          )}
          {segment.backgroundAudio && (
            <span style={{ fontSize: '0.875rem' }} title="Background Audio">
              🎵
            </span>
          )}
          {segment.loop && (
            <span
              style={{
                background: 'var(--theme-warning-100, #fef3c7)',
                padding: '2px 8px',
                borderRadius: 10,
                color: 'var(--theme-warning-800, #92400e)',
              }}
            >
              Loop
            </span>
          )}
          {!editingName && (
            <button
              onClick={() => setEditingName(true)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '0.75rem',
              }}
              title="Rename segment"
            >
              ✏️
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemoveSegment()
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              color: 'var(--theme-error-500, #ef4444)',
              fontSize: '0.875rem',
            }}
            title="Remove segment"
          >
            🗑
          </button>
        </div>
      </div>

      {!collapsed && (
        <SortableContext items={slideIds} strategy={verticalListSortingStrategy}>
          <div ref={setSlideAreaRef} style={{ padding: '6px 12px 12px' }}>
            {(segment.slides || []).length === 0 ? (
              <div
                style={{
                  padding: '20px 12px',
                  textAlign: 'center',
                  color: 'var(--theme-elevation-400, #9ca3af)',
                  fontSize: '0.8rem',
                  border: '1px dashed var(--theme-elevation-200, #e5e7eb)',
                  borderRadius: 6,
                }}
              >
                Drag media here or use + Add Slide
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {segment.slides.map((slide: any, i: number) => (
                  <SlideCard
                    key={`${segmentId}-slide-${i}`}
                    slide={slide}
                    index={i}
                    isTopLevel={false}
                    mediaMap={mediaMap}
                    onEdit={(s, idx) => onEditSlide(s, idx, segmentId)}
                    onRemove={(idx) => onRemoveSlide(idx, segmentId)}
                    segmentId={segmentId}
                  />
                ))}
              </div>
            )}
          </div>
        </SortableContext>
      )}
    </div>
  )
}
