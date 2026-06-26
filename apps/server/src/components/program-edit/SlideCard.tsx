'use client'
import { useDraggable } from '@dnd-kit/core'
import type { FC } from 'react'
import { AdvanceModeInlineControl } from './AdvanceModeInlineControl'


type SlideCardProps = {
  slide: any
  index: number
  isTopLevel: boolean
  isAutoEnd?: boolean
  mediaMap: Record<number, { url: string; thumbnailUrl: string | null; name: string; filename: string }>
  onEdit: (slide: any, index: number, segmentId?: string) => void
  onRemove: (index: number, segmentId?: string) => void
  onModeChange?: (slide: any, index: number, segmentId: string | undefined, newMode: string) => void
  onDurationChange?: (slide: any, index: number, segmentId: string | undefined, newDuration: number) => void
  segmentId?: string
}

const blockIcons: Record<string, any> = {
  imageBlock: '🖼',
  videoBlock: '🎬',
  youtubeBlock: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#FF0000">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
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

function extractYouTubeId(input: string): string | null {
  if (!input) return null
  const m = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})|^([a-zA-Z0-9_-]{11})$/)
  return m?.[1] || m?.[2] || null
}

export const SlideCard: FC<SlideCardProps> = ({
  slide,
  index,
  isTopLevel,
  isAutoEnd,
  mediaMap,
  onEdit,
  onRemove,
  onModeChange,
  onDurationChange,
  segmentId,
}) => {
  const sortableId = segmentId ? `${segmentId}-slide-${index}` : `slide-${index}`

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: sortableId,
    data: { type: 'slide', slide, index, segmentId, isTopLevel },
  })

  const style: React.CSSProperties = {
    opacity: isDragging ? 0 : 1,
  }

  const getThumbnailUrl = (s: any): string | null => {
    if (!s) return null
    if (s.blockType === 'youtubeBlock') {
      const y = extractYouTubeId(s.youtubeId || '')
      if (y) return `https://img.youtube.com/vi/${y}/mqdefault.jpg`
    }
    const mediaField = s.image || s.video || s.audio
    if (!mediaField) return null
    if (typeof mediaField === 'object' && mediaField !== null) {
      return mediaField.sizes?.thumbnail?.url || mediaField.url || null
    }
    const item = mediaMap[mediaField]
    return item?.thumbnailUrl || null
  }

  const getSlideName = (s: any): string => {
    if (!s) return ''
    if (s.blockType === 'youtubeBlock' && s.videoTitle) return s.videoTitle
    const mediaField = s.image || s.video || s.audio
    if (!mediaField) return blockLabels[s.blockType] || s.blockType
    if (typeof mediaField === 'object' && mediaField !== null) {
      return mediaField.name || mediaField.filename || blockLabels[s.blockType] || s.blockType
    }
    const item = mediaMap[mediaField]
    return item?.name || item?.filename || blockLabels[s.blockType] || s.blockType
  }

  const thumbnail = getThumbnailUrl(slide)
  const name = getSlideName(slide)
  const icon = blockIcons[slide.blockType] || '📄'
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
        cursor: 'default',
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
          padding: '2px 12px',
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
        <AdvanceModeInlineControl
          variant="slide"
          blockType={slide.blockType}
          advanceMode={slide.advanceMode}
          duration={slide.duration}
          onModeChange={(newMode) => onModeChange?.(slide, index, segmentId, newMode)}
          onDurationChange={(newDur) => onDurationChange?.(slide, index, segmentId, newDur)}
        />
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
