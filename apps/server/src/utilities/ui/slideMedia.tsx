import type { ReactNode } from 'react'
import {
  MusicNote2Icon,
  MovieIcon,
  YouTubeIcon,
  CaptureIcon,
  ImageIcon,
} from '../../components/icons'

export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null
  const m = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})|^([a-zA-Z0-9_-]{11})$/)
  return m?.[1] || m?.[2] || null
}

export function getThumbnailUrl(slide: any): string | null {
  if (!slide) return null
  if (slide.blockType === 'imageBlock' && slide.image) {
    const img = typeof slide.image === 'object' ? slide.image : null
    if (!img) return null
    return img.sizes?.thumbnail?.url || img.url || null
  }
  if (slide.blockType === 'videoBlock' && slide.video) {
    const vid = typeof slide.video === 'object' ? slide.video : null
    return vid?.sizes?.thumbnail?.url || null
  }
  if (slide.blockType === 'youtubeBlock' && slide.youtubeId) {
    const ytId = extractYouTubeId(slide.youtubeId)
    if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
  }
  return null
}

export function getMediaUrl(slide: any): string | null {
  return getThumbnailUrl(slide)
}

export function getBlockIcon(blockType?: string | null, size: number = 24): ReactNode {
  if (!blockType) return null
  switch (blockType) {
    case 'imageBlock':
      return <ImageIcon size={size} />
    case 'videoBlock':
      return <MovieIcon size={size} />
    case 'youtubeBlock':
      return <YouTubeIcon size={size} />
    case 'audioBlock':
      return <MusicNote2Icon size={size} />
    case 'blackScreenBlock':
      return <CaptureIcon size={size} />
    default:
      return null
  }
}
