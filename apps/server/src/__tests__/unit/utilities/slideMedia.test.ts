import { describe, it, expect } from 'vitest'
import {
  extractYouTubeId,
  getThumbnailUrl,
  getMediaUrl,
  getBlockIcon,
} from '../../../utilities/ui/slideMedia'

describe('extractYouTubeId', () => {
  it('extracts from watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from youtu.be short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from embed URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('accepts a bare ID', () => {
    expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for empty or invalid input', () => {
    expect(extractYouTubeId('')).toBeNull()
    expect(extractYouTubeId(null)).toBeNull()
    expect(extractYouTubeId(undefined)).toBeNull()
    expect(extractYouTubeId('not a youtube url')).toBeNull()
  })
})

describe('getThumbnailUrl', () => {
  it('returns image thumbnail url with fallback to image url', () => {
    const slide = {
      blockType: 'imageBlock',
      image: { sizes: { thumbnail: { url: '/thumb.jpg' } }, url: '/full.jpg' },
    }
    expect(getThumbnailUrl(slide)).toBe('/thumb.jpg')
  })

  it('falls back to image url when no thumbnail', () => {
    const slide = { blockType: 'imageBlock', image: { url: '/full.jpg' } }
    expect(getThumbnailUrl(slide)).toBe('/full.jpg')
  })

  it('returns video thumbnail url', () => {
    const slide = {
      blockType: 'videoBlock',
      video: { sizes: { thumbnail: { url: '/vid-thumb.jpg' } } },
    }
    expect(getThumbnailUrl(slide)).toBe('/vid-thumb.jpg')
  })

  it('returns youtube thumbnail for youtube block', () => {
    const slide = { blockType: 'youtubeBlock', youtubeId: 'https://youtu.be/dQw4w9WgXcQ' }
    expect(getThumbnailUrl(slide)).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
  })

  it('returns null for null slide or unknown block', () => {
    expect(getThumbnailUrl(null)).toBeNull()
    expect(getThumbnailUrl({ blockType: 'audioBlock' })).toBeNull()
  })
})

describe('getMediaUrl', () => {
  it('delegates to getThumbnailUrl', () => {
    const slide = { blockType: 'imageBlock', image: { url: '/full.jpg' } }
    expect(getMediaUrl(slide)).toBe('/full.jpg')
  })
})

describe('getBlockIcon', () => {
  it('returns an element for known block types', () => {
    for (const blockType of ['imageBlock', 'videoBlock', 'youtubeBlock', 'audioBlock', 'blackScreenBlock']) {
      expect(getBlockIcon(blockType)).not.toBeNull()
    }
  })

  it('returns null for unknown or missing block type', () => {
    expect(getBlockIcon('unknownBlock')).toBeNull()
    expect(getBlockIcon(null)).toBeNull()
    expect(getBlockIcon(undefined)).toBeNull()
  })
})
