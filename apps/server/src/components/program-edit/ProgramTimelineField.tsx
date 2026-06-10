'use client'

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useField, useDocumentInfo, useForm } from '@payloadcms/ui'
import { useState, useCallback, useMemo, useEffect, type FC } from 'react'
import { MediaBrowser } from './MediaBrowser'
import { ProgramTimeline } from './ProgramTimeline'
import { SlideEditDrawer } from './SlideEditDrawer'
import { SidebarTabs } from './SidebarTabs'

type ProgramTimelineFieldProps = {
  path: string
}

const newSlideDefaults: Record<string, any> = {
  imageBlock: {
    blockType: 'imageBlock',
    transition: 'fade',
    advanceMode: 'timed',
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
      s.advanceMode = { value: data?.advanceMode ?? 'timed', initialValue: data?.advanceMode ?? 'timed', valid: true }
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

function findSegmentIndex(slides: any[], segmentId: string): number {
  return slides.findIndex(
    (s: any, i: number) =>
      s.blockType === 'segmentBlock' &&
      (s.id === segmentId || `seg-${i}` === segmentId)
  )
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
      if (s.blockType === 'segmentBlock' && s.slides) walk(s.slides)
    }
  }
  walk(slides)
  return [...ids]
}

export const ProgramTimelineField: FC<ProgramTimelineFieldProps> = ({ path }) => {
  const { id } = useDocumentInfo()
  const { getDataByPath, addFieldRow, removeFieldRow, moveFieldRow, replaceFieldRow, dispatchFields } = useForm()
  const titleField = useField<string>({ path: 'title' })

  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingSlide, setEditingSlide] = useState<any>(null)
  const [editingSlideIndex, setEditingSlideIndex] = useState(-1)
  const [editingSegmentId, setEditingSegmentId] = useState<string | undefined>(undefined)
  const [activeDrag, setActiveDrag] = useState<any>(null)
  const [mediaMap, setMediaMap] = useState<MediaMap>({})

  const rawSlides = (getDataByPath(path) as any[]) || []
  const slides = rawSlides.filter(
    (s: any) => s && s.blockType && !String(s.id).startsWith('auto')
  )

  const mediaIds = useMemo(() => extractMediaIds(slides), [slides])

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
      addFieldRow({
        path,
        blockType,
        schemaPath: `${path}.${blockType}`,
        subFieldState: buildRowState(blockType, def),
      })
      if (blockType !== 'blackScreenBlock') {
        setEditingSlide({ ...def })
        setEditingSlideIndex(rawSlides.length)
        setEditingSegmentId(undefined)
        setDrawerOpen(true)
      }
    },
    [path, addFieldRow, rawSlides]
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
      if (segmentId) {
        const segIdx = findSegmentIndex(slides, segmentId)
        if (segIdx < 0) return
        const rowPath = `${path}.${segIdx}.slides`
        replaceFieldRow({
          path: rowPath,
          rowIndex: index,
          schemaPath: `${path}.${updatedSlide.blockType}`,
          subFieldState: buildRowState(updatedSlide.blockType, updatedSlide),
        })
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
    [path, slides]
  )

  const handleRemoveSlide = useCallback(
    (index: number, segmentId?: string) => {
      if (!confirm('Remove this slide?')) return
      if (segmentId) {
        const segIdx = findSegmentIndex(slides, segmentId)
        if (segIdx >= 0) {
          removeFieldRow({ path: `${path}.${segIdx}.slides`, rowIndex: index })
        }
      } else {
        removeFieldRow({ path, rowIndex: index })
      }
    },
    [path, removeFieldRow, slides]
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

      if (activeData.type === 'slide') {
        handleSlideMove(activeData, overData)
      }
    },
    [slides]
  )

  const handleMediaDrop = useCallback(
    (activeData: any, overData: any) => {
      const { mimeType, id: mediaId } = activeData
      let blockType = 'imageBlock'
      if (mimeType?.startsWith('video/')) blockType = 'videoBlock'
      else if (mimeType?.startsWith('audio/')) blockType = 'audioBlock'

      const slideData = {
        blockType,
        transition: 'fade',
        advanceMode: blockType === 'imageBlock' ? 'timed' : 'onEnd',
        image: blockType === 'imageBlock' ? mediaId : undefined,
        video: blockType === 'videoBlock' ? mediaId : undefined,
        audio: blockType === 'audioBlock' ? mediaId : undefined,
        loop: false,
      }

      if (overData.type === 'segment-drop') {
        const segIdx = findSegmentIndex(slides, overData.segmentId)
        if (segIdx >= 0) {
          addFieldRow({
            path: `${path}.${segIdx}.slides`,
            blockType,
            schemaPath: `${path}.${blockType}`,
            subFieldState: buildRowState(blockType, slideData),
          })
        }
      } else if (overData.type === 'slide' && overData.isTopLevel) {
        addFieldRow({
          path,
          blockType,
          rowIndex: overData.index,
          schemaPath: `${path}.${blockType}`,
          subFieldState: buildRowState(blockType, slideData),
        })
      } else if (overData.type === 'slide' && overData.segmentId) {
        const segIdx = findSegmentIndex(slides, overData.segmentId)
        if (segIdx >= 0) {
          addFieldRow({
            path: `${path}.${segIdx}.slides`,
            blockType,
            rowIndex: overData.index,
            schemaPath: `${path}.${blockType}`,
            subFieldState: buildRowState(blockType, slideData),
          })
        }
      } else {
        addFieldRow({
          path,
          blockType,
          schemaPath: `${path}.${blockType}`,
          subFieldState: buildRowState(blockType, slideData),
        })
      }
    },
    [path, addFieldRow, slides]
  )

  const handleSlideMove = useCallback(
    (activeData: any, overData: any) => {
      const activeSegId = activeData.segmentId
      const overSegId = overData.segmentId

      const sameLevel = !activeSegId && !overSegId
      const sameSegment = activeSegId && overSegId && activeSegId === overSegId

      if (sameLevel) {
        if (slides.length > 1) {
          moveFieldRow({ path, moveFromIndex: activeData.index, moveToIndex: overData.index })
        }
        return
      }

      if (sameSegment) {
        const segIdx = findSegmentIndex(slides, activeSegId)
        if (segIdx < 0) return
        const segSlides = slides[segIdx]?.slides || []
        if (segSlides.length > 1) {
          moveFieldRow({
            path: `${path}.${segIdx}.slides`,
            moveFromIndex: activeData.index,
            moveToIndex: overData.index,
          })
        }
        return
      }

      const currentSlides = getDataByPath(path) as any[]
      if (!currentSlides) return

      const moved = currentSlides[activeData.index]
      if (!moved) return

      if (activeSegId && !overSegId) {
        const segIdx = findSegmentIndex(currentSlides, activeSegId)
        if (segIdx < 0) return
        const segSlides = currentSlides[segIdx]?.slides || []
        const movedSlide = segSlides[activeData.index]
        if (!movedSlide) return
        removeFieldRow({ path: `${path}.${segIdx}.slides`, rowIndex: activeData.index })
        addFieldRow({
          path,
          blockType: movedSlide.blockType,
          schemaPath: `${path}.${movedSlide.blockType}`,
          subFieldState: buildRowState(movedSlide.blockType, movedSlide),
        })
        return
      }

      if (!activeSegId && overSegId) {
        const segIdx = findSegmentIndex(currentSlides, overSegId)
        if (segIdx < 0) return
        const movedSlide = currentSlides[activeData.index]
        if (!movedSlide) return
        removeFieldRow({ path, rowIndex: activeData.index })
        addFieldRow({
          path: `${path}.${segIdx}.slides`,
          blockType: movedSlide.blockType,
          schemaPath: `${path}.${movedSlide.blockType}`,
          subFieldState: buildRowState(movedSlide.blockType, movedSlide),
        })
        return
      }

      if (activeSegId && overSegId && activeSegId !== overSegId) {
        const srcSegIdx = findSegmentIndex(currentSlides, activeSegId)
        const dstSegIdx = findSegmentIndex(currentSlides, overSegId)
        if (srcSegIdx < 0 || dstSegIdx < 0) return
        const srcSlides = currentSlides[srcSegIdx]?.slides || []
        const movedSlide = srcSlides[activeData.index]
        if (!movedSlide) return
        removeFieldRow({ path: `${path}.${srcSegIdx}.slides`, rowIndex: activeData.index })
        addFieldRow({
          path: `${path}.${dstSegIdx}.slides`,
          blockType: movedSlide.blockType,
          schemaPath: `${path}.${movedSlide.blockType}`,
          subFieldState: buildRowState(movedSlide.blockType, movedSlide),
        })
      }
    },
    [path, slides, moveFieldRow, removeFieldRow, addFieldRow, getDataByPath]
  )

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 400,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            borderBottom: '1px solid var(--theme-elevation-200, #e5e7eb)',
            background: 'var(--theme-elevation-50, #f9fafb)',
          }}
        >
          <button
            onClick={() => setMediaBrowserOpen(!mediaBrowserOpen)}
            style={{
              background: 'transparent',
              border: '1px solid var(--theme-elevation-300, #d1d5db)',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '6px 10px',
              fontSize: '1rem',
              lineHeight: 1,
            }}
            title="Toggle Media Browser"
          >
            {mediaBrowserOpen ? '◀' : '▶'}
          </button>

          <input
            value={titleField.value || ''}
            onChange={(e) => titleField.setValue(e.target.value)}
            placeholder="Program Title"
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '1rem',
              fontWeight: 600,
              border: '1px solid transparent',
              borderRadius: 4,
              background: 'transparent',
            }}
            onFocus={(e) => {
              e.target.style.border = '1px solid var(--theme-elevation-300, #d1d5db)'
              e.target.style.background = 'white'
            }}
            onBlur={(e) => {
              e.target.style.border = '1px solid transparent'
              e.target.style.background = 'transparent'
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <MediaBrowser collapsed={!mediaBrowserOpen} />
          <ProgramTimeline
            slides={slides}
            mediaMap={mediaMap}
            onAddSlide={handleAddSlide}
            onEditSlide={handleEditSlide}
            onRemoveSlide={handleRemoveSlide}
            onEditSegmentName={handleEditSegmentName}
            onRemoveSegment={handleRemoveSegment}
          />
        </div>

        <SidebarTabs />
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

      <DragOverlay>
        {activeDrag && (
          <div
            style={{
              padding: '8px 16px',
              background: 'white',
              border: '1px solid var(--theme-elevation-300, #d1d5db)',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontSize: '0.85rem',
            }}
          >
            {activeDrag.type === 'media'
              ? `🖼 ${activeDrag.filename}`
              : activeDrag.slide
                ? `Slide ${activeDrag.index + 1}`
                : ''}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
