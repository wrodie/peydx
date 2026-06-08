import type { Program, Slide, SlideOrSegment, Segment, FlattenedProgram, SegmentBoundary } from './types'

export function flattenProgram(program: Program): FlattenedProgram {
  const flat: Slide[] = []
  const boundaries = new Map<number, SegmentBoundary>()

  if (!program.slides?.length) {
    return {
      ...program,
      slides: [],
      segmentBoundaries: boundaries,
    }
  }

  for (const item of program.slides) {
    if (isSegment(item)) {
      const segment = item as Segment
      const segSlides = segment.slides || []
      const startIndex = flat.length
      const endIndex = startIndex + segSlides.length - 1
      const segId = segment.id || `seg-${startIndex}`

      const bgAudio = segment.backgroundAudio != null
        ? (typeof segment.backgroundAudio === 'object' ? segment.backgroundAudio : null)
        : null

      const boundary: SegmentBoundary = {
        segmentId: segId,
        name: segment.name,
        backgroundAudio: bgAudio,
        loop: segment.loop ?? false,
        advanceMode: segment.advanceMode ?? 'slides',
        duration: segment.duration,
        startIndex,
        endIndex,
        totalSlides: segSlides.length,
      }

      for (let i = 0; i < segSlides.length; i++) {
        const slide = segSlides[i]
        flat.push({
          ...slide,
          segmentContext: {
            segmentId: segId,
            name: segment.name,
            backgroundAudio: bgAudio,
            loop: segment.loop ?? false,
            advanceMode: segment.advanceMode ?? 'slides',
            duration: segment.duration,
            index: i,
            total: segSlides.length,
          },
        })
      }

      if (segSlides.length > 0) {
        boundaries.set(startIndex, boundary)
        boundaries.set(endIndex, boundary)
      }
    } else {
      flat.push(item as Slide)
    }
  }

  return {
    id: program.id,
    title: program.title,
    slides: flat,
    loop: program.loop,
    autoBlackEndSlide: program.autoBlackEndSlide,
    department: program.department,
    segmentBoundaries: boundaries,
  }
}

function isSegment(item: SlideOrSegment): item is Segment {
  return item.blockType === 'segmentBlock'
}
