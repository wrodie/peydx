export interface Media {
  id: number
  url?: string | null
  filename?: string | null
  alt?: string | null
}

export interface Slide {
  blockType: 'imageBlock' | 'videoBlock' | 'youtubeBlock'
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
}
