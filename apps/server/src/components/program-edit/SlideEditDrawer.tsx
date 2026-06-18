'use client'

import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import { useListDrawer } from '@payloadcms/ui'

function extractYouTubeId(input: string): string | null {
  if (!input) return null
  const m = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})|^([a-zA-Z0-9_-]{11})$/)
  return m?.[1] || m?.[2] || null
}

type SlideEditDrawerProps = {
  isOpen: boolean
  slide: any | null
  slideIndex: number
  segmentId?: string
  allSlides: any[]
  mediaMap: Record<number, { url: string; thumbnailUrl: string | null; name: string; filename: string }>
  onClose: () => void
  onSave: (updatedSlide: any, index: number, segmentId?: string) => void
}

export const SlideEditDrawer: FC<SlideEditDrawerProps> = ({
  isOpen,
  slide,
  slideIndex,
  segmentId,
  allSlides,
  mediaMap,
  onClose,
  onSave,
}) => {
  const [localSlide, setLocalSlide] = useState<any>(null)
  const [dirty, setDirty] = useState(false)
  const [browseField, setBrowseField] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState<string | null>(null)
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filterOptions = useMemo(
    () =>
      browseField === 'image' ? { media: { mimeType: { contains: 'image' } } } :
      browseField === 'video' ? { media: { mimeType: { contains: 'video' } } } :
      browseField === 'backgroundAudio' || browseField === 'audio' ? { media: { mimeType: { contains: 'audio' } } } :
      undefined,
    [browseField]
  )

  const [ListDrawer, , { openDrawer, closeDrawer }] = useListDrawer({
    collectionSlugs: ['media'],
    filterOptions,
  })

  const handleListSelect = ({ doc }: { doc: any }) => {
    if (browseField) {
      updateField(browseField, doc.id)
      setBrowseField(null)
      closeDrawer()
    }
  }

  useEffect(() => {
    if (slide) {
      setLocalSlide({ ...slide, duration: slide.duration ?? 5 })
      setDirty(false)
    }
  }, [slide, isOpen])

  useEffect(() => {
    if (browseField) openDrawer()
  }, [browseField, openDrawer])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (dirty && !confirm('You have unsaved changes. Discard?')) return
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, dirty, onClose])

  useEffect(() => {
    const ytId = localSlide?.blockType === 'youtubeBlock' ? extractYouTubeId(localSlide.youtubeId || '') : null
    if (!ytId) { setVideoTitle(null); return }
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current)
    titleTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/youtube-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: ytId }),
        })
        if (!res.ok) { setVideoTitle(null); return }
        const data = await res.json()
        if (data.title) {
          setVideoTitle(data.title)
          setLocalSlide((prev: any) => prev ? { ...prev, videoTitle: data.title } : prev)
        }
      } catch {
        setVideoTitle(null)
      }
    }, 500)
    return () => { if (titleTimerRef.current) clearTimeout(titleTimerRef.current) }
  }, [localSlide?.youtubeId, localSlide?.blockType])

  if (!isOpen || !localSlide) return null

  const blockType = localSlide.blockType

  const updateField = (name: string, value: any) => {
    setLocalSlide((prev: any) => {
      const next = { ...prev, [name]: value }
      if (name === 'advanceMode' && value !== 'timed') {
        next.duration = undefined
      }
      if (name === 'advanceMode' && value === 'timed' && !prev.duration) {
        next.duration = 5
      }
      return next
    })
    setDirty(true)
  }

  const handleSave = () => {
    if (!localSlide) return
    onSave(localSlide, slideIndex, segmentId)
    setDirty(false)
    onClose()
  }

  const handleClose = () => {
    if (dirty && !confirm('You have unsaved changes. Discard?')) return
    onClose()
  }

  const renderMediaField = (fieldName: string, mimeFilter: string) => {
    const mediaValue = localSlide[fieldName]
    const mediaId = typeof mediaValue === 'number' ? mediaValue : mediaValue?.id
    const mediaFromMap = mediaId != null ? mediaMap[mediaId] : null
    const thumbnailUrl = mediaFromMap?.thumbnailUrl || null
    const name = mediaFromMap ? (mediaFromMap.name || mediaFromMap.filename || '') : (mediaId ? 'Loading...' : '')

    const openBrowser = () => { setBrowseField(fieldName) }

    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.825rem' }}>
          {fieldName === 'image' ? 'Image' : fieldName === 'video' ? 'Video' : fieldName === 'backgroundAudio' ? 'Background Audio' : 'Audio'}
        </label>
        {mediaId ? (
          <div
            onClick={openBrowser}
            style={{
              cursor: 'pointer',
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid var(--theme-elevation-200, #e5e7eb)',
            }}
          >
            {thumbnailUrl && mimeFilter !== 'audio' ? (
              <img
                src={thumbnailUrl}
                alt=""
                style={{ width: '100%', maxHeight: 180, objectFit: 'contain', background: 'var(--theme-elevation-100, #f3f4f6)' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 100,
                  background: 'var(--theme-elevation-100, #f3f4f6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  color: 'var(--theme-elevance-400, #9ca3af)',
                }}
              >
                {mimeFilter === 'audio' ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 40, height: 40, opacity: 0.4 }}>
                    <path d="M3 9v6h4l5 5V4L7 9H3zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                ) : null}
              </div>
            )}
            <div
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--theme-elevation-200, #e5e7eb)',
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{name}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-400, #9ca3af)' }}>Change</span>
            </div>
          </div>
        ) : (
          <div
            onClick={openBrowser}
            style={{
              width: '100%',
              height: 100,
              border: '2px dashed var(--theme-elevation-300, #d1d5db)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--theme-elevation-500, #6b7280)',
              fontSize: '0.85rem',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-elevation-50, #f9fafb)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            + Click to browse media
          </div>
        )}
      </div>
    )
  }

  const renderAdvanceSettings = () => {
    const isVideoLike = ['videoBlock', 'youtubeBlock', 'audioBlock'].includes(blockType)

    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.825rem' }}>
          Transition
        </label>
        <select
          value={localSlide.transition || 'fade'}
          onChange={(e) => updateField('transition', e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
            marginBottom: 12,
          }}
        >
          <option value="fade">Fade In</option>
          <option value="cut">Instant Cut</option>
          <option value="slide">Slide Left</option>
        </select>

        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.825rem' }}>
          Advance Mode
        </label>
        <select
          value={localSlide.advanceMode || 'timed'}
          onChange={(e) => updateField('advanceMode', e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
            marginBottom: 12,
          }}
        >
          <option value="timed">Timed (Automatic)</option>
          <option value="manual">Manual (Wait for Click)</option>
          {isVideoLike && <option value="onEnd">On End (Play to Finish)</option>}
        </select>

        {localSlide.advanceMode === 'timed' && (
          <>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.825rem' }}>
              Duration (seconds)
            </label>
            <input
              type="number"
              value={localSlide.duration}
              onChange={(e) => updateField('duration', Number(e.target.value))}
              min={1}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '0.8rem',
                border: '1px solid var(--theme-elevation-300, #d1d5db)',
                borderRadius: 4,
              }}
            />
          </>
        )}
      </div>
    )
  }

  const renderContent = () => {
    switch (blockType) {
      case 'imageBlock':
        return (
          <>
            {renderMediaField('image', 'image')}
            {renderAdvanceSettings()}
          </>
        )

      case 'videoBlock':
        return (
          <>
            {renderMediaField('video', 'video')}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.825rem' }}>
                <input
                  type="checkbox"
                  checked={localSlide.loop || false}
                  onChange={(e) => updateField('loop', e.target.checked)}
                />
                Loop Media
              </label>
            </div>
            {renderAdvanceSettings()}
          </>
        )

      case 'youtubeBlock':
        const ytId = extractYouTubeId(localSlide.youtubeId || '')
        return (
          <>
            {ytId && (
              <div style={{ marginBottom: 16 }}>
                <img
                  src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                  alt="YouTube thumbnail"
                  style={{
                    width: '100%',
                    maxHeight: 180,
                    objectFit: 'contain',
                    borderRadius: 6,
                    background: 'var(--theme-elevation-100, #f3f4f6)',
                  }}
                />
                {videoTitle && (
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, marginTop: 4 }}>
                    {videoTitle}
                  </div>
                )}
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.825rem' }}>
                YouTube URL or ID
              </label>
              <input
                value={localSlide.youtubeId || ''}
                onChange={(e) => updateField('youtubeId', e.target.value)}
                placeholder="e.g. dQw4w9WgXcQ"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--theme-elevation-300, #d1d5db)',
                  borderRadius: 4,
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.825rem' }}>
                <input
                  type="checkbox"
                  checked={localSlide.loop || false}
                  onChange={(e) => updateField('loop', e.target.checked)}
                />
                Loop Media
              </label>
            </div>
            {renderAdvanceSettings()}
          </>
        )

      case 'audioBlock':
        return (
          <>
            {renderMediaField('audio', 'audio')}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.825rem' }}>
                <input
                  type="checkbox"
                  checked={localSlide.loop || false}
                  onChange={(e) => updateField('loop', e.target.checked)}
                />
                Loop Media
              </label>
            </div>
            {renderAdvanceSettings()}
          </>
        )

      case 'blackScreenBlock':
        return renderAdvanceSettings()

      case 'segmentBlock':
        return (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.825rem' }}>
                Segment Name
              </label>
              <input
                value={localSlide.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Enter segment name"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--theme-elevation-300, #d1d5db)',
                  borderRadius: 4,
                }}
              />
            </div>

            {renderMediaField('backgroundAudio', 'audio')}

            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="seg-loop"
                checked={localSlide.loop || false}
                onChange={(e) => updateField('loop', e.target.checked)}
              />
              <label htmlFor="seg-loop" style={{ fontSize: '0.825rem' }}>Loop segment</label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.825rem' }}>
                How to exit this segment
              </label>
              <select
                value={localSlide.advanceMode || 'slides'}
                onChange={(e) => updateField('advanceMode', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--theme-elevation-300, #d1d5db)',
                  borderRadius: 4,
                }}
              >
                <option value="slides">Follow slides</option>
                <option value="timed">Timer</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            {localSlide.advanceMode === 'timed' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.825rem' }}>
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={localSlide.duration || ''}
                  onChange={(e) => updateField('duration', Number(e.target.value))}
                  min={1}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '0.8rem',
                    border: '1px solid var(--theme-elevation-300, #d1d5db)',
                    borderRadius: 4,
                  }}
                />
              </div>
            )}
          </>
        )

      default:
        return (
          <div style={{ color: 'var(--theme-elevation-500, #9ca3af)', padding: '16px 0' }}>
            No editable fields for this slide type.
          </div>
        )
    }
  }

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 9998,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          background: 'white',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--theme-elevation-200, #e5e7eb)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            Edit {blockLabels[blockType] || blockType} Slide
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <ListDrawer onSelect={handleListSelect} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {renderContent()}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid var(--theme-elevation-200, #e5e7eb)',
          }}
        >
          <button
            onClick={handleClose}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: 'var(--theme-elevation-100, #f3f4f6)',
              border: '1px solid var(--theme-elevation-300, #d1d5db)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: 'var(--theme-primary-500, #3b82f6)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </>
  )
}

const blockLabels: Record<string, string> = {
  imageBlock: 'Image',
  videoBlock: 'Video',
  youtubeBlock: 'YouTube',
  audioBlock: 'Audio',
  blackScreenBlock: 'Black Screen',
}
