'use client'

import { useDroppable } from '@dnd-kit/core'
import { useState, type FC } from 'react'
import { AddSlideMenu } from './AddSlideMenu'
import { ImportProgramModal } from './ImportProgramModal'
import { ExportPptxButton } from './ExportPptxButton'
import { DropGap } from './DropGap'
import { SlideCard } from './SlideCard'
import { SegmentContainer } from './SegmentContainer'

type ProgramTimelineProps = {
  slides: any[]
  mediaMap: Record<number, { url: string; thumbnailUrl: string | null; name: string; filename: string }>
  onAddSlide: (blockType: string) => void
  onImportProgram: (slides: any[]) => void
  onEditSlide: (slide: any, index: number, segmentId?: string) => void
  onEditSegment: (slide: any, index: number, segmentId?: string) => void
  onRemoveSlide: (index: number, segmentId?: string) => void
  onEditSegmentName: (segmentId: string, name: string, segmentIndex: number) => void
  onRemoveSegment: (segmentIndex: number) => void
  onModeChange?: (slide: any, index: number, segmentId: string | undefined, newMode: string) => void
  onDurationChange?: (slide: any, index: number, segmentId: string | undefined, newDuration: number) => void
  onLoopChange?: (slide: any, index: number, segmentId: string | undefined, newLoop: boolean) => void
}

export const ProgramTimeline: FC<ProgramTimelineProps> = ({
  slides,
  mediaMap,
  onAddSlide,
  onImportProgram,
  onEditSlide,
  onEditSegment,
  onRemoveSlide,
  onEditSegmentName,
  onRemoveSegment,
  onModeChange,
  onDurationChange,
  onLoopChange,
}) => {
  const [importModalOpen, setImportModalOpen] = useState(false)

  const { setNodeRef, isOver } = useDroppable({
    id: 'timeline-drop',
    data: { type: 'gap', container: null, index: slides.length },
  })

  const handleEditSlideWrapper = (slide: any, idx: number, segId?: string) => {
    onEditSlide(slide, idx, segId)
  }

  const handleRemoveSlideWrapper = (idx: number, segId?: string) => {
    onRemoveSlide(idx, segId)
  }

  const handleEditSegmentNameWrapper = (name: string, segId: string) => {
    const segIndex = slides.findIndex(
      (s: any) => s.blockType === 'segmentBlock' && (s.id === segId || `seg-${slides.indexOf(s)}` === segId)
    )
    if (segIndex >= 0) {
      onEditSegmentName(segId, name, segIndex)
    }
  }

  const handleRemoveSegmentWrapper = (segIndex: number) => {
    onRemoveSegment(segIndex)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--theme-elevation-200, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >

        <AddSlideMenu onAddSlide={onAddSlide} />
        <button
          onClick={() => setImportModalOpen(true)}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            color: 'var(--theme-primary-500, #3b82f6)',
            border: '1px solid var(--theme-primary-500, #3b82f6)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          Import Program
        </button>
        <ExportPptxButton />
      </div>

      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          background: isOver ? 'var(--theme-primary-50, #eff6ff)' : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        {slides.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--theme-elevation-400, #9ca3af)',
              fontSize: '0.85rem',
              border: '2px dashed var(--theme-elevation-200, #e5e7eb)',
              borderRadius: 8,
            }}
          >
            Drag media from the browser or use + Add Slide to build your program
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <DropGap id="tl-gap-0" container={null} index={0} />
            {slides.map((slide: any, i: number) => {
              if (slide.blockType === 'segmentBlock') {
                const segId = slide.id || `seg-${i}`
                return (
                  <div key={segId}>
                    <SegmentContainer
                      segment={slide}
                      index={i}
                      mediaMap={mediaMap}
                      onEditSlide={handleEditSlideWrapper}
                      onEditSegment={(s, idx) => onEditSegment(s, idx)}
                      onRemoveSlide={handleRemoveSlideWrapper}
                      onEditSegmentName={(name) => handleEditSegmentNameWrapper(name, segId)}
                      onRemoveSegment={() => handleRemoveSegmentWrapper(i)}
                      onModeChange={onModeChange}
                      onDurationChange={onDurationChange}
                      onLoopChange={onLoopChange}
                    />
                    <DropGap id={`tl-gap-${i + 1}`} container={null} index={i + 1} />
                  </div>
                )
              }
              return (
                <div key={`slide-${i}`}>
                  <SlideCard
                    slide={slide}
                    index={i}
                    isTopLevel
                    mediaMap={mediaMap}
                    onEdit={(s, idx) => onEditSlide(s, idx)}
                    onRemove={(idx) => onRemoveSlide(idx)}
                    onModeChange={onModeChange}
                    onDurationChange={onDurationChange}
                    onLoopChange={onLoopChange}
                  />
                  <DropGap id={`tl-gap-${i + 1}`} container={null} index={i + 1} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ImportProgramModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={onImportProgram}
      />
    </div>
  )
}
