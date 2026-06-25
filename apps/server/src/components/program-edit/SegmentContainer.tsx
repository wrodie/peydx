'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useState, type FC } from 'react'
import { SlideCard } from './SlideCard'
import { DropGap } from './DropGap'

type SegmentContainerProps = {
  segment: any
  index: number
  mediaMap: Record<number, { url: string; thumbnailUrl: string | null; name: string; filename: string }>
  onEditSlide: (slide: any, idx: number, segmentId: string) => void
  onEditSegment: (slide: any, index: number) => void
  onRemoveSlide: (idx: number, segmentId: string) => void
  onEditSegmentName: (name: string) => void
  onRemoveSegment: () => void
}

export const SegmentContainer: FC<SegmentContainerProps> = ({
  segment,
  index,
  mediaMap,
  onEditSlide,
  onEditSegment,
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
    isDragging,
  } = useDraggable({
    id: segmentId,
    data: { type: 'segment', segment, index, segmentId },
  })

  const { setNodeRef: setSlideAreaRef, isOver: isSlideOver } = useDroppable({
    id: `${segmentId}-drop`,
    data: { type: 'segment-drop', segmentId },
  })

  const { setNodeRef: setHeaderDropRef, isOver: isHeaderOver } = useDroppable({
    id: `${segmentId}-header-drop`,
    data: { type: 'gap', container: segmentId, index: Infinity },
  })

  const childSlides = (segment.slides || []) as any[]

  const handleNameSave = () => {
    setEditingName(false)
    if (nameValue !== segment.name) {
      onEditSegmentName(nameValue)
    }
  }

  const headerRef = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    setHeaderDropRef(node)
  }

  return (
    <div
      ref={headerRef}
      style={{
        marginBottom: 8,
        border: `1px solid ${(isDragging || isHeaderOver) ? 'var(--theme-primary-300, #93c5fd)' : 'var(--theme-elevation-300, #d1d5db)'}`,
        borderRadius: 8,
        background: isDragging ? 'var(--theme-elevation-50, #f9fafb)' : 'white',
        opacity: isDragging ? 0 : 1,
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
          {childSlides.length > 0 && (
            <span
              style={{
                background: 'var(--theme-elevation-200, #e5e7eb)',
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              {childSlides.length} slide{childSlides.length !== 1 ? 's' : ''}
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
          {segment.advanceMode && segment.advanceMode !== 'slides' && (
            <span
              style={{
                background: 'var(--theme-elevation-100, #f3f4f6)',
                padding: '2px 8px',
                borderRadius: 10,
                color: 'var(--theme-elevation-600, #4b5563)',
              }}
            >
              {segment.advanceMode === 'timed'
                ? (segment.duration ? `${segment.duration} min` : 'Timed')
                : 'Manual'}
            </span>
          )}
          {!editingName && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEditSegment(segment, index)
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '0.75rem',
              }}
              title="Edit segment properties"
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
        <div style={{ padding: '6px 12px 12px' }}>
          {childSlides.length === 0 ? (
            <div
              ref={setSlideAreaRef}
              style={{
                padding: '20px 12px',
                textAlign: 'center',
                color: 'var(--theme-elevation-400, #9ca3af)',
                fontSize: '0.8rem',
                border: `2px dashed ${isSlideOver ? 'var(--theme-primary-500, #3b82f6)' : 'var(--theme-elevation-200, #e5e7eb)'}`,
                borderRadius: 6,
                background: isSlideOver ? 'var(--theme-primary-50, #eff6ff)' : 'transparent',
                transition: 'background 0.1s, border-color 0.1s',
                position: 'relative',
              }}
            >
              Drag media here or use + Add Slide
              {isSlideOver && (
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <DropGap id={`${segmentId}-gap-0`} container={segmentId} index={0} />
              {childSlides.map((slide: any, i: number) => (
                <div key={`${segmentId}-slide-${i}`}>
                  <SlideCard
                    slide={slide}
                    index={i}
                    isTopLevel={false}
                    mediaMap={mediaMap}
                    onEdit={(s, idx) => onEditSlide(s, idx, segmentId)}
                    onRemove={(idx) => onRemoveSlide(idx, segmentId)}
                    segmentId={segmentId}
                  />
                  <DropGap id={`${segmentId}-gap-${i + 1}`} container={segmentId} index={i + 1} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
