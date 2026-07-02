import { describe, it, expect, vi } from 'vitest'

const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => true),
}))

vi.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: mockExistsSync,
  },
  existsSync: mockExistsSync,
}))

import { mediaAfterRead } from '../../../hooks/mediaAfterRead'

describe('mediaAfterRead', () => {
  it('adds thumbnailURL for video media when thumbnail file exists', () => {
    const doc = {
      mimeType: 'video/mp4',
      filename: 'sample-video.mp4',
      id: 42,
      sizes: {},
    }
    const result = mediaAfterRead({ doc } as any)
    expect(result.thumbnailURL).toBe('/api/media/42/thumbnail')
    expect(result.sizes).toHaveProperty('thumbnail')
    expect(result.sizes!.thumbnail).toEqual({
      url: '/api/media/42/thumbnail',
    })
  })

  it('merges thumbnail into existing sizes object', () => {
    const doc = {
      id: 99,
      mimeType: 'video/mp4',
      filename: 'sample-video.mp4',
      sizes: { fullHD: { url: '/api/media/file/sample-video.webp' } },
    }
    const result = mediaAfterRead({ doc } as any)
    expect(result.sizes!.fullHD).toEqual({ url: '/api/media/file/sample-video.webp' })
    expect(result.sizes!.thumbnail).toBeDefined()
  })

  it('does nothing for non-video media', () => {
    const doc = {
      mimeType: 'image/png',
      filename: 'photo.png',
    }
    const result = mediaAfterRead({ doc } as any)
    expect(result.thumbnailURL).toBeUndefined()
  })

  it('does nothing when filename is missing', () => {
    const doc = { mimeType: 'video/mp4' }
    const result = mediaAfterRead({ doc } as any)
    expect(result.thumbnailURL).toBeUndefined()
  })

  it('does nothing when mimeType is missing', () => {
    const doc = { filename: 'file.mp4' }
    const result = mediaAfterRead({ doc } as any)
    expect(result.thumbnailURL).toBeUndefined()
  })

  it('does nothing when thumbnail file does not exist on disk', () => {
    mockExistsSync.mockReturnValue(false)
    const doc = {
      mimeType: 'video/mp4',
      filename: 'sample-video.mp4',
    }
    const result = mediaAfterRead({ doc } as any)
    expect(result.thumbnailURL).toBeUndefined()
  })
})
