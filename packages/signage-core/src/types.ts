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

export type PlayerState = 'idle' | 'menu' | 'playing'

export interface ScheduleEntry {
  programId: number
  scheduleType: 'autoplay'
  startTime: string
  endTime?: string
  daysOfWeek: string[]
  untilDate?: string
  program: Program
}

export interface AvailabilityEntry {
  programId: number
  scheduleType: 'availability'
  startDate: string
  endDate?: string | null
  program: Program
}

export interface ResolvedSchedule {
  lastUpdated: string
  timezone?: string | null
  schedule: ScheduleEntry[]
  availability: AvailabilityEntry[]
  defaultBackground?: string | null
  deviceName?: string | null
  hideProgramList?: boolean
}

export interface KeyConfig {
  menu: string | string[]
  up: string | string[]
  down: string | string[]
  enter: string | string[]
  exit: string | string[]
  pause?: string | string[]
  next: string | string[]
  prev: string | string[]
}

export const DEFAULT_KEY_CONFIG: KeyConfig = {
  menu: ['KeyM', 'ContextMenu'],
  up: 'ArrowUp',
  down: 'ArrowDown',
  enter: 'Enter',
  exit: ['Escape', 'BrowserBack'],
  pause: ['KeyP', 'MediaPlayPause'],
  next: ['Space', 'ArrowRight'],
  prev: 'ArrowLeft',
}

export interface DeviceProvider {
  connectSocket(): any
  fetchSchedule(): Promise<ResolvedSchedule>
  resolveMediaUrl(url: string): string
  getDeviceId(): string | number
  disconnect(): void
}
