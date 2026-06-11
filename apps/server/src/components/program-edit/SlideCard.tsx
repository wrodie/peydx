'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FC } from 'react'

type SlideCardProps = {
  slide: any
  index: number
  isTopLevel: boolean
  isAutoEnd?: boolean
  mediaMap: Record<number, { url: string; thumbnailUrl: string | null; name: string; filename: string }>
  onEdit: (slide: any, index: number, segmentId?: string) => void
  onRemove: (index: number, segmentId?: string) => void
  segmentId?: string
}

const blockIcons: Record<string, string> = {
  imageBlock: '🖼',
  videoBlock: '🎬',
  youtubeBlock: '▶️',
  audioBlock: '🎵',
  blackScreenBlock: '◼',
  segmentBlock: '📁',
}

const blockLabels: Record<string, string> = {
  imageBlock: 'Image',
  videoBlock: 'Video',
  youtubeBlock: 'YouTube',
  audioBlock: 'Audio',
  blackScreenBlock: 'Black',
  segmentBlock: 'Segment',
}

const transitionLabels: Record<string, string> = {
  fade: 'Fade',
  cut: 'Cut',
  slide: 'Slide',
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export const SlideCard: FC<SlideCardProps> = ({
  slide,
  index,
  isTopLevel,
  isAutoEnd,
  mediaMap,
  onEdit,
  onRemove,
  segmentId,
}) => {
  const sortableId = segmentId ? `${segmentId}-slide-${index}` : `slide-${index}`

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: { type: 'slide', slide, index, segmentId, isTopLevel },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getMediaId = (s: any): number | null => {
    if (!s) return null
    if (s.blockType === 'imageBlock' && typeof s.image === 'number') return s.image
    if (s.blockType === 'videoBlock' && typeof s.video === 'number') return s.video
    if (s.blockType === 'audioBlock' && typeof s.audio === 'number') return s.audio
    return null
  }

  const mediaId = getMediaId(slide)
  const mediaItem = mediaId != null ? mediaMap[mediaId] : null
  const thumbnail = mediaItem?.thumbnailUrl || (
    slide.blockType === 'youtubeBlock' && slide.youtubeId
      ? `https://img.youtube.com/vi/${slide.youtubeId}/mqdefault.jpg`
      : null
  )
  const icon = blockIcons[slide.blockType] || '📄'
  const name = mediaItem?.name || mediaItem?.filename || blockLabels[slide.blockType] || slide.blockType
  const modeLabel =
    slide.advanceMode === 'timed'
      ? formatDuration(slide.duration)
      : slide.advanceMode === 'onEnd'
        ? 'onEnd'
        : 'manual'
  const transitionLabel = transitionLabels[slide.transition] || slide.transition

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: isAutoEnd
          ? 'var(--theme-elevation-50, #f9fafb)'
          : isDragging
            ? 'var(--theme-elevation-100, #f3f4f6)'
            : 'white',
        border: `1px solid ${isDragging ? 'var(--theme-primary-300, #93c5fd)' : 'var(--theme-elevation-200, #e5e7eb)'}`,
        borderRadius: 6,
        cursor: isAutoEnd ? 'default' : 'grab',
        opacity: isAutoEnd ? 0.5 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: isAutoEnd ? 'default' : 'grab',
          color: 'var(--theme-elevation-400, #9ca3af)',
          fontSize: '1.1rem',
          padding: '2px',
          flexShrink: 0,
        }}
      >
        ≡
      </div>

      <div
        style={{
          width: 48,
          height: 36,
          borderRadius: 4,
          overflow: 'hidden',
          flexShrink: 0,
          background: 'var(--theme-elevation-100, #f3f4f6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {slide.blockType === 'audioBlock' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 28, height: 28, opacity: 0.5 }}>
            <path d="M3 9v6h4l5 5V4L7 9H3zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
      </div>

      <div
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.9rem',
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.875rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          fontSize: '0.75rem',
        }}
      >
        {modeLabel && (
          <span
            style={{
              background: 'var(--theme-elevation-100, #f3f4f6)',
              padding: '2px 8px',
              borderRadius: 10,
              color: 'var(--theme-elevation-600, #4b5563)',
            }}
          >
            {modeLabel}
          </span>
        )}
        {transitionLabel && (
          <span
            style={{
              background: 'var(--theme-elevation-100, #f3f4f6)',
              padding: '2px 8px',
              borderRadius: 10,
              color: 'var(--theme-elevation-600, #4b5563)',
            }}
          >
            {transitionLabel}
          </span>
        )}
      </div>

      {!isAutoEnd && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(slide, index, segmentId)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: '0.875rem',
            }}
            title="Edit slide"
          >
            ✏️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(index, segmentId)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: '0.875rem',
            }}
            title="Remove slide"
          >
            🗑
          </button>
        </div>
      )}
    </div>
  )
}
