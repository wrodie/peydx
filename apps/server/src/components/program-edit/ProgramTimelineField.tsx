'use client'

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useDocumentInfo, useForm } from '@payloadcms/ui'
import { useState, useCallback, useMemo, useEffect, useRef, type FC } from 'react'
import { MediaBrowser } from './MediaBrowser'
import { ProgramTimeline } from './ProgramTimeline'
import { SlideEditDrawer } from './SlideEditDrawer'

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
      if (s.backgroundAudio && typeof s.backgroundAudio === 'number') ids.add(s.backgroundAudio)
      if (s.blockType === 'segmentBlock' && s.slides) walk(s.slides)
    }
  }
  walk(slides)
  return [...ids]
}

export const ProgramTimelineField: FC<ProgramTimelineFieldProps> = ({ path }) => {
  const { id } = useDocumentInfo()
  const { getDataByPath, addFieldRow, removeFieldRow, moveFieldRow, replaceFieldRow, dispatchFields } = useForm()

  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingSlide, setEditingSlide] = useState<any>(null)
  const [editingSlideIndex, setEditingSlideIndex] = useState(-1)
  const [editingSegmentId, setEditingSegmentId] = useState<string | undefined>(undefined)
  const [activeDrag, setActiveDrag] = useState<any>(null)
  const [mediaMap, setMediaMap] = useState<MediaMap>({})
  const mediaClearRef = useRef<(() => void) | null>(null)

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
        handleSlideMove(activeData, overData)
      }
    },
    [slides]
  )

  const handleMediaDrop = useCallback(
    (activeData: any, overData: any) => {
      const items: Array<{ mimeType: string; id: number }> =
        activeData.items || [{ mimeType: activeData.mimeType, id: activeData.id }]

      const slideDatas = items.map(({ mimeType, id: mediaId }) => {
        let blockType = 'imageBlock'
        if (mimeType?.startsWith('video/')) blockType = 'videoBlock'
        else if (mimeType?.startsWith('audio/')) blockType = 'audioBlock'
        return {
          blockType,
          transition: 'fade',
          advanceMode: blockType === 'imageBlock' ? 'manual' : 'onEnd',
          image: blockType === 'imageBlock' ? mediaId : undefined,
          video: blockType === 'videoBlock' ? mediaId : undefined,
          audio: blockType === 'audioBlock' ? mediaId : undefined,
          loop: false,
        }
      })

      if (overData.type === 'segment-drop') {
        const segIdx = overData.segmentId != null ? findSegmentIndex(rawSlides, overData.segmentId) : -1
        if (segIdx >= 0) {
          for (const sd of slideDatas) {
            addFieldRow({
              path: `${path}.${segIdx}.slides`,
              blockType: sd.blockType,
              schemaPath: `${path}.${sd.blockType}`,
              subFieldState: buildRowState(sd.blockType, sd),
            })
          }
        }
      } else if (overData.type === 'slide' && overData.isTopLevel) {
        let idx = overData.index
        for (const sd of slideDatas) {
          addFieldRow({
            path,
            blockType: sd.blockType,
            rowIndex: idx,
            schemaPath: `${path}.${sd.blockType}`,
            subFieldState: buildRowState(sd.blockType, sd),
          })
          idx!++
        }
      } else if (overData.type === 'slide' && overData.segmentId) {
        const segIdx = overData.segmentId != null ? rawSlides.findIndex((s: any) => s && s.id === overData.segmentId) : -1
        if (segIdx >= 0) {
          let idx = overData.index
          for (const sd of slideDatas) {
            addFieldRow({
              path: `${path}.${segIdx}.slides`,
              blockType: sd.blockType,
              rowIndex: idx,
              schemaPath: `${path}.${sd.blockType}`,
              subFieldState: buildRowState(sd.blockType, sd),
            })
            idx!++
          }
        }
      } else {
        for (const sd of slideDatas) {
          addFieldRow({
            path,
            blockType: sd.blockType,
            schemaPath: `${path}.${sd.blockType}`,
            subFieldState: buildRowState(sd.blockType, sd),
          })
        }
      }

      mediaClearRef.current?.()
    },
    [path, addFieldRow, rawSlides]
  )

  const handleSlideMove = useCallback(
    (activeData: any, overData: any) => {
      const activeSegId = activeData.segmentId
      const overSegId = overData.segmentId

      if (activeData.type === 'segment') {
        const activeId = activeData.segment?.id
        const activeRawIdx = rawSlides.findIndex((s: any) => s && s.id === activeId)
        if (activeRawIdx < 0) return

        let targetRawIdx: number | null = null
        if (overData.type === 'segment-drop' || (overData.type === 'slide' && overData.segmentId)) {
          targetRawIdx = rawSlides.findIndex((s: any) => s && s.id === overData.segmentId)
        } else if (overData.type === 'segment') {
          const overId = (overData as any).segment?.id
          targetRawIdx = overId != null ? rawSlides.findIndex((s: any) => s && s.id === overId) : null
        } else if (overData.type === 'slide' && overData.isTopLevel) {
          const overId = overData.slide?.id
          targetRawIdx = overId != null ? rawSlides.findIndex((s: any) => s && s.id === overId) : overData.index
        }
        if (targetRawIdx != null && rawSlides.length > 1 && targetRawIdx !== activeRawIdx) {
          moveFieldRow({ path, moveFromIndex: activeRawIdx, moveToIndex: targetRawIdx })
        }
        return
      }

      if (activeData.type === 'slide' && overData.type === 'segment-drop' && overData.segmentId) {
        if (activeData.segmentId !== overData.segmentId) {
          const destSegIdx = findSegmentIndex(rawSlides, overData.segmentId)
          if (destSegIdx >= 0) {
            if (activeData.segmentId) {
              const srcSegIdx = findSegmentIndex(rawSlides, activeData.segmentId)
              if (srcSegIdx < 0) return
              const srcSlides = rawSlides[srcSegIdx]?.slides || []
              const movedSlide = srcSlides[activeData.index]
              if (!movedSlide) return
              removeFieldRow({ path: `${path}.${srcSegIdx}.slides`, rowIndex: activeData.index })
              addFieldRow({
                path: `${path}.${destSegIdx}.slides`,
                blockType: movedSlide.blockType,
                schemaPath: `${path}.${movedSlide.blockType}`,
                subFieldState: buildRowState(movedSlide.blockType, movedSlide),
              })
            } else {
              const currentSlides = getDataByPath(path) as any[]
              const movedSlide = currentSlides?.[activeData.index]
              if (!movedSlide) return
              removeFieldRow({ path, rowIndex: activeData.index })
              addFieldRow({
                path: `${path}.${destSegIdx}.slides`,
                blockType: movedSlide.blockType,
                schemaPath: `${path}.${movedSlide.blockType}`,
                subFieldState: buildRowState(movedSlide.blockType, movedSlide),
              })
            }
            return
          }
        }
      }

      const sameLevel = !activeSegId && !overSegId
      const sameSegment = activeSegId && overSegId && activeSegId === overSegId

      if (sameLevel) {
        if (rawSlides.length > 1) {
          const overId = overData.slide?.id
          const targetRawIdx = overId != null ? rawSlides.findIndex((s: any) => s && s.id === overId) : overData.index
          const activeId = activeData.slide?.id
          const activeRawIdx = activeId != null ? rawSlides.findIndex((s: any) => s && s.id === activeId) : activeData.index
          if (activeRawIdx >= 0 && targetRawIdx >= 0 && targetRawIdx !== activeRawIdx) {
            moveFieldRow({ path, moveFromIndex: activeRawIdx, moveToIndex: targetRawIdx })
          }
        }
        return
      }

      if (sameSegment) {
        const segIdx = findSegmentIndex(rawSlides, activeSegId!)
        if (segIdx < 0) return
        const segSlides = rawSlides[segIdx]?.slides || []
        if (segSlides.length > 1) {
          moveFieldRow({
            path: `${path}.${segIdx}.slides`,
            moveFromIndex: activeData.index,
            moveToIndex: overData.index,
          })
        }
        return
      }

      if (activeSegId && !overSegId) {
        const currentSlides = getDataByPath(path) as any[]
        if (!currentSlides) return
        const segIdx = findSegmentIndex(currentSlides, activeSegId)
        if (segIdx < 0) return
        const segSlides = currentSlides[segIdx]?.slides || []
        const movedSlide = segSlides[activeData.index]
        if (!movedSlide) return
        removeFieldRow({ path: `${path}.${segIdx}.slides`, rowIndex: activeData.index })
        addFieldRow({
          path,
          blockType: movedSlide.blockType,
          rowIndex: overData.type === 'slide' && overData.isTopLevel ? overData.index : undefined,
          schemaPath: `${path}.${movedSlide.blockType}`,
          subFieldState: buildRowState(movedSlide.blockType, movedSlide),
        })
        return
      }

      if (!activeSegId && overSegId) {
        const currentSlides = getDataByPath(path) as any[]
        if (!currentSlides) return
        const segIdx = findSegmentIndex(currentSlides, overSegId)
        if (segIdx < 0) return
        const movedSlide = currentSlides[activeData.index]
        if (!movedSlide) return
        removeFieldRow({ path, rowIndex: activeData.index })
        addFieldRow({
          path: `${path}.${segIdx}.slides`,
          blockType: movedSlide.blockType,
          rowIndex: overData.type === 'slide' ? overData.index : undefined,
          schemaPath: `${path}.${movedSlide.blockType}`,
          subFieldState: buildRowState(movedSlide.blockType, movedSlide),
        })
        return
      }

      if (activeSegId && overSegId && activeSegId !== overSegId) {
        const currentSlides = getDataByPath(path) as any[]
        if (!currentSlides) return
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
          rowIndex: overData.type === 'slide' ? overData.index : undefined,
          schemaPath: `${path}.${movedSlide.blockType}`,
          subFieldState: buildRowState(movedSlide.blockType, movedSlide),
        })
      }
    },
    [path, slides, rawSlides, moveFieldRow, removeFieldRow, addFieldRow, getDataByPath]
  )

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
              ? `🖼 ${activeDrag.items?.length > 1 ? `${activeDrag.items.length} items` : (activeDrag.items?.[0]?.filename || 'Media')}`
              : activeDrag.slide
                ? `Slide ${activeDrag.index + 1}`
                : ''}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
