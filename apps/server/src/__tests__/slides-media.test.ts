import { describe, it, expect, vi, beforeEach } from 'vitest'
import { imageCache } from '../components/slides/editor/useMediaImage'

describe('useMediaImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    imageCache.clear()
  })

  it('constructs correct URL from Media API response', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 1, filename: 'test.webp' }),
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    const res = await fetch('/api/media/1')
    const media = await (res as any).json()
    const url = `/api/media/file/${media.filename}`
    expect(url).toBe('/api/media/file/test.webp')
  })

  it('caches images by mediaId', () => {
    expect(imageCache).toBeDefined()
    expect(imageCache.size).toBe(0)

    const img = { url: '/api/media/file/test.webp', image: {} as any }
    imageCache.set(1, img)
    expect(imageCache.size).toBe(1)
    expect(imageCache.get(1)?.url).toBe('/api/media/file/test.webp')
  })
})
