export interface Media {
  id: number
  url?: string | null
  filename?: string | null
  alt?: string | null
}

export interface Slide {
  blockType: 'imageBlock' | 'videoBlock' | 'youtubeBlock' | 'audioBlock' | 'blackScreenBlock'
  image?: Media | number
  video?: Media | number
  audio?: Media | number
  youtubeId?: string | null
  advanceMode: 'timed' | 'manual' | 'onEnd'
  duration?: number | null
  transition?: 'fade' | 'cut' | 'slide' | null
  loop?: boolean | null
  id?: string | null
  segmentContext?: SegmentContext | null
}

export interface SegmentContext {
  segmentId: string
  name?: string | null
  backgroundAudio?: Media | null
  loop: boolean
  advanceMode: 'slides' | 'timed' | 'manual'
  duration?: number | null
  index: number
  total: number
}

export interface Segment {
  blockType: 'segmentBlock'
  name?: string | null
  backgroundAudio?: Media | number | null
  loop: boolean
  advanceMode: 'slides' | 'timed' | 'manual'
  duration?: number | null
  slides: Slide[]
  id?: string | null
}

export type SlideOrSegment = Slide | Segment

export interface FlattenedProgram {
  id: number
  title: string
  slides: Slide[]
  loop?: boolean | null
  autoBlackEndSlide?: boolean | null
  department?: string | null
  segmentBoundaries: Map<number, SegmentBoundary>
}

export interface SegmentBoundary {
  segmentId: string
  name?: string | null
  backgroundAudio?: Media | null
  loop: boolean
  advanceMode: 'slides' | 'timed' | 'manual'
  duration?: number | null
  startIndex: number
  endIndex: number
  totalSlides: number
}

export interface Program {
  id: number
  title: string
  slides?: SlideOrSegment[] | null
  loop?: boolean | null
  autoBlackEndSlide?: boolean | null
  department?: string | null
}

export type ScheduleType = 'autoplay' | 'availability'

export type PlayerState = 'idle' | 'menu' | 'playing'

export interface ScheduleEntry {
  programId: number
  scheduleType: ScheduleType
  startTime: string
  endTime?: string
  program: Program
}

export interface ResolvedSchedule {
  lastUpdated: string
  schedule: ScheduleEntry[]
  defaultBackground?: string | null
  deviceName?: string | null
}

export interface KeyConfig {
  menu: string
  up: string
  down: string
  enter: string
  exit: string
  pause?: string
}

export const DEFAULT_KEY_CONFIG: KeyConfig = {
  menu: 'KeyM',
  up: 'ArrowUp',
  down: 'ArrowDown',
  enter: 'Enter',
  exit: 'Escape',
  pause: 'KeyP',
}
