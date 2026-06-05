export interface Media {
  id: number
  url?: string | null
  filename?: string | null
  alt?: string | null
}

export interface Slide {
  blockType: 'imageBlock' | 'videoBlock' | 'youtubeBlock' | 'blackScreenBlock'
  image?: Media | number
  video?: Media | number
  youtubeId?: string | null
  advanceMode: 'timed' | 'manual' | 'onEnd'
  duration?: number | null
  transition?: 'fade' | 'cut' | 'slide' | null
  id?: string | null
}

export interface Program {
  id: number
  title: string
  slides?: Slide[] | null
  loop?: boolean | null
  autoBlackEndSlide?: boolean | null
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
}

export interface KeyConfig {
  menu: string
  up: string
  down: string
  enter: string
  exit: string
}

export const DEFAULT_KEY_CONFIG: KeyConfig = {
  menu: 'KeyM',
  up: 'ArrowUp',
  down: 'ArrowDown',
  enter: 'Enter',
  exit: 'Escape',
}
