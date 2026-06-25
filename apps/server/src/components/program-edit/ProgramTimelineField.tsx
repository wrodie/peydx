'use client'

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDocumentInfo, useForm } from '@payloadcms/ui'
import { useState, useCallback, useMemo, useEffect, useRef, type FC } from 'react'
import { MediaBrowser } from './MediaBrowser'
import { ProgramTimeline } from './ProgramTimeline'
import { SlideEditDrawer } from './SlideEditDrawer'
import { computeMove, findTopLevelSegmentIndex } from './computeMove'

type ProgramTimelineFieldProps = {
  path: string
}

const newSlideDefaults: Record<string, any> = {
  imageBlock: {
    blockType: 'imageBlock',
    transition: 'fade',
    advanceMode: 'manual',
    duration: 5,
  },
  videoBlock: {
    blockType: 'videoBlock',
    transition: 'fade',
    advanceMode: 'onEnd',
    loop: false,
  },
  youtubeBlock: {
    blockType: 'youtubeBlock',
    youtubeId: '',
    videoTitle: null,
    transition: 'fade',
    advanceMode: 'onEnd',
    loop: false,
  },
  audioBlock: {
    blockType: 'audioBlock',
    transition: 'fade',
    advanceMode: 'onEnd',
    loop: false,
  },
  blackScreenBlock: {
    blockType: 'blackScreenBlock',
    transition: 'fade',
    advanceMode: 'manual',
  },
  segmentBlock: {
    blockType: 'segmentBlock',
    name: 'New Segment',
    slides: [],
    loop: false,
    advanceMode: 'slides',
  },
}

function buildRowState(blockType: string, data?: any): Record<string, any> {
  const s: Record<string, any> = {}
  s.blockType = { value: blockType, initialValue: blockType, valid: true }
  s._moveToSegment = { value: '__none__', initialValue: '__none__', valid: true }

  switch (blockType) {
    case 'imageBlock':
      s.image = { value: data?.image ?? null, initialValue: data?.image ?? null, valid: true }
      s.transition = { value: data?.transition ?? 'fade', initialValue: data?.transition ?? 'fade', valid: true }
      s.advanceMode = { value: data?.advanceMode ?? 'manual', initialValue: data?.advanceMode ?? 'manual', valid: true }
      s.duration = { value: data?.duration ?? null, initialValue: data?.duration ?? null, valid: true }
      break
    case 'videoBlock':
      s.video = { value: data?.video ?? null, initialValue: data?.video ?? null, valid: true }
      s.transition = { value: data?.transition ?? 'fade', initialValue: data?.transition ?? 'fade', valid: true }
      s.advanceMode = { value: data?.advanceMode ?? 'onEnd', initialValue: data?.advanceMode ?? 'onEnd', valid: true }
      s.duration = { value: data?.duration ?? null, initialValue: data?.duration ?? null, valid: true }
      s.loop = { value: data?.loop ?? false, initialValue: data?.loop ?? false, valid: true }
      break
    case 'youtubeBlock':
      s.youtubeId = { value: data?.youtubeId ?? '', initialValue: data?.youtubeId ?? '', valid: true }
      s.videoTitle = { value: data?.videoTitle ?? null, initialValue: data?.videoTitle ?? null, valid: true }
      s.transition = { value: data?.transition ?? 'fade', initialValue: data?.transition ?? 'fade', valid: true }
      s.advanceMode = { value: data?.advanceMode ?? 'onEnd', initialValue: data?.advanceMode ?? 'onEnd', valid: true }
      s.duration = { value: data?.duration ?? null, initialValue: data?.duration ?? null, valid: true }
      s.loop = { value: data?.loop ?? false, initialValue: data?.loop ?? false, valid: true }
      break
    case 'audioBlock':
      s.audio = { value: data?.audio ?? null, initialValue: data?.audio ?? null, valid: true }
      s.transition = { value: data?.transition ?? 'fade', initialValue: data?.transition ?? 'fade', valid: true }
      s.advanceMode = { value: data?.advanceMode ?? 'onEnd', initialValue: data?.advanceMode ?? 'onEnd', valid: true }
      s.duration = { value: data?.duration ?? null, initialValue: data?.duration ?? null, valid: true }
      s.loop = { value: data?.loop ?? false, initialValue: data?.loop ?? false, valid: true }
      break
    case 'blackScreenBlock':
      s.transition = { value: data?.transition ?? 'fade', initialValue: data?.transition ?? 'fade', valid: true }
      s.advanceMode = { value: data?.advanceMode ?? 'manual', initialValue: data?.advanceMode ?? 'manual', valid: true }
      s.duration = { value: null, initialValue: null, valid: true }
      break
    case 'segmentBlock':
      s.name = { value: data?.name ?? 'New Segment', initialValue: data?.name ?? 'New Segment', valid: true }
      s.backgroundAudio = { value: data?.backgroundAudio ?? null, initialValue: data?.backgroundAudio ?? null, valid: true }
      s.loop = { value: data?.loop ?? false, initialValue: data?.loop ?? false, valid: true }
      s.advanceMode = { value: data?.advanceMode ?? 'slides', initialValue: data?.advanceMode ?? 'slides', valid: true }
      s.duration = { value: data?.duration ?? null, initialValue: data?.duration ?? null, valid: true }
      s.bulkMedia = { value: null, initialValue: null, valid: true }
      const segSlides = data?.slides || []
      s.slides = {
        value: segSlides.length,
        initialValue: segSlides.length,
        valid: true,
        disableFormData: segSlides.length > 0,
        rows: segSlides.map((_: any, i: number) => ({
          id: `seg-row-${i}`,
          blockType: segSlides[i]?.blockType,
        })),
      }
      break
  }
  return s
}

export type MediaMap = Record<number, {
  url: string
  thumbnailUrl: string | null
  name: string
  filename: string
}>

function extractMediaIds(slides: any[]): number[] {
  const ids = new Set<number>()
  const walk = (items: any[]) => {
    for (const s of items) {
      if (!s) continue
      if (s.image && typeof s.image === 'number') ids.add(s.image)
      if (s.video && typeof s.video === 'number') ids.add(s.video)
      if (s.audio && typeof s.audio === 'number') ids.add(s.audio)
      if (s.backgroundAudio && typeof s.backgroundAudio === 'number') ids.add(s.backgroundAudio)
      if (s.blockType === 'segmentBlock' && s.slides) walk(s.slides)
    }
  }
  walk(slides)
  return [...ids]
}

// --- resolveDestination ---

function resolveDestination(
  overData: any,
  topLevelCount: number,
  segmentCounts: Record<string, number>,
): { container: string | null; index: number } | null {
  if (!overData) return null

  if (overData.type === 'gap') {
    const count = overData.container === null
      ? topLevelCount
      : (segmentCounts[overData.container] || 0)
    return {
      container: overData.container,
      index: overData.index === Infinity ? count : overData.index,
    }
  }

  if (overData.type === 'segment-drop') {
    const count = segmentCounts[overData.segmentId] || 0
    return { container: overData.segmentId, index: count }
  }

  if (overData.type === 'slide' && overData.isTopLevel) {
    return { container: null, index: overData.index }
  }

  if (overData.type === 'slide' && !overData.isTopLevel) {
    return { container: overData.segmentId, index: overData.index }
  }

  if (overData.type === 'segment') {
    return { container: null, index: overData.index }
  }

  if (overData.type === 'timeline') {
    return { container: null, index: topLevelCount }
  }

  return null
}

// --- block icons ---

const blockIcons: Record<string, string> = {
  imageBlock: '\uD83D\uDDBC',
  videoBlock: '\uD83C\uDFAC',
  youtubeBlock: '\u25B6',
  audioBlock: '\uD83C\uDFB5',
  blackScreenBlock: '\u25FC',
  segmentBlock: '\uD83D\uDCC1',
}

const blockLabels: Record<string, string> = {
  imageBlock: 'Image',
  videoBlock: 'Video',
  youtubeBlock: 'YouTube',
  audioBlock: 'Audio',
  blackScreenBlock: 'Black',
  segmentBlock: 'Segment',
}

// --- main component ---

export const ProgramTimelineField: FC<ProgramTimelineFieldProps> = ({ path }) => {
  const { id } = useDocumentInfo()
  const { getDataByPath, addFieldRow, removeFieldRow, moveFieldRow, replaceFieldRow, dispatchFields } = useForm()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingSlide, setEditingSlide] = useState<any>(null)
  const [editingSlideIndex, setEditingSlideIndex] = useState(-1)
  const [editingSegmentId, setEditingSegmentId] = useState<string | undefined>(undefined)
  const [activeDrag, setActiveDrag] = useState<any>(null)
  const [mediaMap, setMediaMap] = useState<MediaMap>({})
  const mediaClearRef = useRef<(() => void) | null>(null)
  const activeDragRef = useRef(activeDrag)
  activeDragRef.current = activeDrag

  const rawSlides = (getDataByPath(path) as any[]) || []
  const slides = rawSlides.filter(
    (s: any) => s && s.blockType && !String(s.id).startsWith('auto')
  )

  const mediaIds = useMemo(() => extractMediaIds(slides), [slides])

  const segmentCounts = useMemo(() => {
    const map: Record<string, number> = {}
    slides.forEach((s: any, i: number) => {
      if (s.blockType === 'segmentBlock') {
        const segId = s.id || `seg-${i}`
        map[segId] = (s.slides || []).length
      }
    })
    return map
  }, [slides])

  useEffect(() => {
    if (mediaIds.length === 0) { setMediaMap({}); return }
    let cancelled = false
    const ids = mediaIds.join(',')
    fetch(`/api/media?depth=0&limit=50&where[id][in]=${ids}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const map: MediaMap = {}
        for (const doc of data.docs || []) {
          const thumb = doc.sizes?.thumbnail?.url || doc.url || null
          if (doc.id != null) {
            map[doc.id] = {
              url: doc.url || '',
              thumbnailUrl: thumb,
              name: doc.name || doc.filename || '',
              filename: doc.filename || '',
            }
          }
        }
        setMediaMap(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [mediaIds.join(',')])

  const handleAddSlide = useCallback(
    (blockType: string) => {
      const def = newSlideDefaults[blockType]
      if (!def) return
      if (blockType !== 'blackScreenBlock') {
        setEditingSlide({ ...def, _isNew: true })
        setEditingSlideIndex(rawSlides.length)
        setEditingSegmentId(undefined)
        setDrawerOpen(true)
      }
    },
    [rawSlides]
  )

  const handleEditSlide = useCallback(
    (slide: any, index: number, segmentId?: string) => {
      setEditingSlide(slide)
      setEditingSlideIndex(index)
      setEditingSegmentId(segmentId)
      setDrawerOpen(true)
    },
    []
  )

  const handleSaveSlide = useCallback(
    (updatedSlide: any, index: number, segmentId?: string) => {
      if (updatedSlide._isNew) {
        delete updatedSlide._isNew
        addFieldRow({
          path,
          blockType: updatedSlide.blockType,
          schemaPath: `${path}.${updatedSlide.blockType}`,
          subFieldState: buildRowState(updatedSlide.blockType, updatedSlide),
        })
      } else if (segmentId) {
        const segIdx = segmentId != null ? rawSlides.findIndex((s: any) => s && s.id === segmentId) : -1
        if (segIdx < 0) return
        const rowPath = `${path}.${segIdx}.slides`
        replaceFieldRow({
          path: rowPath,
          rowIndex: index,
          schemaPath: `${path}.${updatedSlide.blockType}`,
          subFieldState: buildRowState(updatedSlide.blockType, updatedSlide),
        })
      } else if (updatedSlide.blockType === 'segmentBlock') {
        const segFields = ['name', 'backgroundAudio', 'loop', 'advanceMode', 'duration']
        for (const field of segFields) {
          dispatchFields({
            type: 'UPDATE',
            path: `${path}.${index}.${field}`,
            value: updatedSlide[field] ?? null,
          })
        }
      } else {
        replaceFieldRow({
          path,
          rowIndex: index,
          schemaPath: `${path}.${updatedSlide.blockType}`,
          subFieldState: buildRowState(updatedSlide.blockType, updatedSlide),
        })
      }
      setDrawerOpen(false)
      setEditingSlide(null)
      setEditingSlideIndex(-1)
      setEditingSegmentId(undefined)
    },
    [path, addFieldRow, replaceFieldRow, rawSlides, dispatchFields]
  )

  const handleRemoveSlide = useCallback(
    (index: number, segmentId?: string) => {
      if (!confirm('Remove this slide?')) return
      if (segmentId) {
        const segIdx = rawSlides.findIndex((s: any) => s && s.id === segmentId)
        if (segIdx >= 0) {
          removeFieldRow({ path: `${path}.${segIdx}.slides`, rowIndex: index })
        }
      } else {
        removeFieldRow({ path, rowIndex: index })
      }
    },
    [path, removeFieldRow, rawSlides]
  )

  const handleEditSegmentName = useCallback(
    (segmentId: string, name: string, segmentIndex: number) => {
      dispatchFields({
        type: 'UPDATE',
        path: `${path}.${segmentIndex}.name`,
        value: name,
      })
    },
    [path, dispatchFields]
  )

  const handleRemoveSegment = useCallback(
    (segmentIndex: number) => {
      if (!confirm('Remove this entire segment?')) return
      removeFieldRow({ path, rowIndex: segmentIndex })
    },
    [path, removeFieldRow]
  )

  const handleImportProgram = useCallback(
    (importedSlides: any[]) => {
      const currentLen = rawSlides.length
      const filtered = importedSlides.filter(
        (s: any) => s && s.blockType && !String(s.id).startsWith('auto')
      )
      console.log(`[ImportProgram] importing ${filtered.length} slides (current=${currentLen})`)

      for (let i = 0; i < filtered.length; i++) {
        const slide = filtered[i]
        if (!slide || !slide.blockType) continue

        const slideData = { ...slide }
        delete slideData.id
        delete slideData._moveToSegment
        slideData.bulkMedia = null

        if (slideData.blockType === 'segmentBlock') {
          const childSlides = (slideData.slides || [])
            .filter((s: any) => s && s.blockType && !String(s.id).startsWith('auto'))
            .map((s: any) => {
              const cs = { ...s }
              delete cs.id
              delete cs._moveToSegment
              return cs
            })
          slideData.slides = []

          addFieldRow({
            path,
            blockType: slideData.blockType,
            schemaPath: `${path}.${slideData.blockType}`,
            subFieldState: buildRowState(slideData.blockType, slideData),
          })

          const segIdx = currentLen + i
          for (const childSlide of childSlides) {
            addFieldRow({
              path: `${path}.${segIdx}.slides`,
              blockType: childSlide.blockType,
              schemaPath: `${path}.${childSlide.blockType}`,
              subFieldState: buildRowState(childSlide.blockType, childSlide),
            })
          }
        } else {
          addFieldRow({
            path,
            blockType: slideData.blockType,
            schemaPath: `${path}.${slideData.blockType}`,
            subFieldState: buildRowState(slideData.blockType, slideData),
          })
        }
      }
    },
    [path, rawSlides.length, addFieldRow]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag(event.active.data.current)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null)
      const { active, over } = event
      if (!over) return

      const activeData = active.data.current as any
      const overData = over.data.current as any
      if (!activeData || !overData) return

      if (activeData.type === 'media') {
        handleMediaDrop(activeData, overData)
        return
      }

      if (activeData.type === 'slide' || activeData.type === 'segment') {
        moveSlideTo(activeData, overData)
      }
    },
    [slides, segmentCounts]
  )

  const handleMediaDrop = useCallback(
    (activeData: any, overData: any) => {
      const dst = resolveDestination(overData, slides.length, segmentCounts)
      if (!dst) return

      const items: Array<{ mimeType: string; id: number }> =
        activeData.items || [{ mimeType: activeData.mimeType, id: activeData.id }]

      let insertIdx = dst.index

      for (const { mimeType, id: mediaId } of items) {
        let blockType = 'imageBlock'
        if (mimeType?.startsWith('video/')) blockType = 'videoBlock'
        else if (mimeType?.startsWith('audio/')) blockType = 'audioBlock'

        const slideData = {
          blockType,
          transition: 'fade',
          advanceMode: blockType === 'imageBlock' ? 'manual' : 'onEnd',
          image: blockType === 'imageBlock' ? mediaId : undefined,
          video: blockType === 'videoBlock' ? mediaId : undefined,
          audio: blockType === 'audioBlock' ? mediaId : undefined,
          loop: false,
        }

        if (dst.container === null) {
          addFieldRow({
            path,
            blockType: slideData.blockType,
            rowIndex: insertIdx,
            schemaPath: `${path}.${slideData.blockType}`,
            subFieldState: buildRowState(slideData.blockType, slideData),
          })
        } else {
          const segIdx = findTopLevelSegmentIndex(rawSlides, dst.container)
          if (segIdx < 0) return
          addFieldRow({
            path: `${path}.${segIdx}.slides`,
            blockType: slideData.blockType,
            rowIndex: insertIdx,
            schemaPath: `${path}.${slideData.blockType}`,
            subFieldState: buildRowState(slideData.blockType, slideData),
          })
        }

        insertIdx++
      }

      mediaClearRef.current?.()
    },
    [path, addFieldRow, rawSlides, slides.length, segmentCounts]
  )

  const moveSlideTo = useCallback(
    (activeData: any, overData: any) => {
      const dst = resolveDestination(overData, slides.length, segmentCounts)
      if (!dst) return

      if (activeData.type === 'segment' && dst.container !== null) return

      const srcContainer = activeData.segmentId ?? null
      const srcIndex = activeData.index

      const result = computeMove({
        rootPath: path,
        topLevelSlides: slides,
        srcContainer,
        srcIndex,
        dstContainer: dst.container,
        dstIndex: dst.index,
      })
      if (!result) return

      if (result.kind === 'same-container') {
        moveFieldRow({
          path: result.path,
          moveFromIndex: result.moveFromIndex,
          moveToIndex: result.moveToIndex,
        })
      } else {
        const removeArr = getDataByPath(result.removePath) as any[] | undefined
        const movedSlide = removeArr?.[result.removeIndex]
        if (!movedSlide) return

        removeFieldRow({ path: result.removePath, rowIndex: result.removeIndex })

        let actualInsertPath = result.insertPath
        if (result.removePath === path && result.insertPath !== path) {
          const updatedSlides = (getDataByPath(path) as any[]) || []
          const newSegIdx = findTopLevelSegmentIndex(updatedSlides, dst.container!)
          if (newSegIdx >= 0) {
            actualInsertPath = `${path}.${newSegIdx}.slides`
          }
        }

        addFieldRow({
          path: actualInsertPath,
          blockType: movedSlide.blockType,
          rowIndex: result.insertIndex,
          schemaPath: `${path}.${movedSlide.blockType}`,
          subFieldState: buildRowState(movedSlide.blockType, movedSlide),
        })
      }
    },
    [path, slides, segmentCounts, moveFieldRow, removeFieldRow, addFieldRow, getDataByPath]
  )

  const renderDragOverlay = () => {
    const d = activeDragRef.current
    if (!d) return null

    if (d.type === 'media') {
      const items = d.items || []
      const first = items[0]
      const thumbUrl = first?.sizes?.thumbnail?.url || first?.url || null

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'white',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
          }}
        >
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
            {thumbUrl
              ? <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '1.1rem', opacity: 0.5 }}>🖼</span>
            }
          </div>
          <span style={{ fontWeight: 600 }}>
            {items.length > 1
              ? `${items.length} items`
              : (first?.name || first?.filename || 'Media')
            }
          </span>
          {items.length > 1 && (
            <span style={{ color: 'var(--theme-elevation-500, #6b7280)', fontSize: '0.75rem' }}>
              +{items.length - 1} more
            </span>
          )}
        </div>
      )
    }

    if (d.type === 'segment') {
      const seg = d.segment
      const count = (seg?.slides || []).length
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'white',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>📁</span>
          <span style={{ fontWeight: 600 }}>{seg?.name || 'Segment'}</span>
          <span style={{ color: 'var(--theme-elevation-500, #6b7280)', fontSize: '0.8rem' }}>
            {count} slide{count !== 1 ? 's' : ''}
          </span>
        </div>
      )
    }

    if (d.type === 'slide') {
      const slide = d.slide
      const icon = blockIcons[slide?.blockType] || '📄'
      const label = blockLabels[slide?.blockType] || slide?.blockType

      const getThumbnailUrl = (s: any): string | null => {
        if (!s) return null
        if (s.blockType === 'youtubeBlock' && s.youtubeId) {
          const m = String(s.youtubeId).match(/[a-zA-Z0-9_-]{11}/)
          if (m) return `https://img.youtube.com/vi/${m[0]}/mqdefault.jpg`
        }
        const mediaField = s.image || s.video || s.audio
        if (!mediaField) return null
        if (typeof mediaField === 'object' && mediaField !== null) {
          return mediaField.sizes?.thumbnail?.url || mediaField.url || null
        }
        const item = mediaMap[mediaField]
        return item?.thumbnailUrl || null
      }

      const getName = (s: any): string => {
        if (!s) return label
        if (s.blockType === 'youtubeBlock' && s.videoTitle) return s.videoTitle
        const mediaField = s.image || s.video || s.audio
        if (!mediaField) return label
        if (typeof mediaField === 'object' && mediaField !== null) {
          return mediaField.name || mediaField.filename || label
        }
        const item = mediaMap[mediaField]
        return item?.name || item?.filename || label
      }

      const thumbnail = getThumbnailUrl(slide)
      const name = getName(slide)

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'white',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
          }}
        >
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
            {thumbnail
              ? <img src={thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '1.1rem', opacity: 0.5 }}>{icon}</span>
            }
          </div>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
            {name}
          </span>
          <span style={{ color: 'var(--theme-elevation-500, #6b7280)', fontSize: '0.75rem' }}>
            #{d.index + 1}
          </span>
        </div>
      )
    }

    return null
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - var(--app-header-height) - var(--doc-controls-height))',
          minHeight: 400,
        }}
      >
        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <MediaBrowser collapsed={!mediaBrowserOpen} onToggle={() => setMediaBrowserOpen(v => !v)} clearSelectionRef={mediaClearRef} />
          <ProgramTimeline
            slides={slides}
            mediaMap={mediaMap}
            onAddSlide={handleAddSlide}
            onImportProgram={handleImportProgram}
            onEditSlide={handleEditSlide}
            onEditSegment={handleEditSlide}
            onRemoveSlide={handleRemoveSlide}
            onEditSegmentName={handleEditSegmentName}
            onRemoveSegment={handleRemoveSegment}
          />
        </div>

      </div>

      <SlideEditDrawer
        isOpen={drawerOpen}
        slide={editingSlide}
        slideIndex={editingSlideIndex}
        segmentId={editingSegmentId}
        allSlides={slides}
        mediaMap={mediaMap}
        onClose={() => {
          setDrawerOpen(false)
          setEditingSlide(null)
          setEditingSlideIndex(-1)
          setEditingSegmentId(undefined)
        }}
        onSave={handleSaveSlide}
      />

      <DragOverlay dropAnimation={null}>
        {renderDragOverlay()}
      </DragOverlay>
    </DndContext>
  )
}
