import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('captureRender', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Mock document.fonts
    ;(globalThis as any).document = {
      fonts: { ready: Promise.resolve() },
    }
  })

  it('calls stage.toCanvas with pixelRatio 1', async () => {
    const mockToBlob = vi.fn((cb: (blob: Blob) => void) => cb(new Blob(['test'], { type: 'image/png' })))
    const mockCanvas = { toBlob: mockToBlob }
    const mockToCanvas = vi.fn(() => mockCanvas)
    const stage = { toCanvas: mockToCanvas } as any

    const { captureRender } = await import('../components/slides/editor/useCapture')
    const blob = await captureRender(stage)

    expect(mockToCanvas).toHaveBeenCalledWith({ pixelRatio: 1 })
    expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('rejects if toBlob returns null', async () => {
    const mockToBlob = vi.fn((cb: (blob: Blob | null) => void) => cb(null as any))
    const mockCanvas = { toBlob: mockToBlob }
    const mockToCanvas = vi.fn(() => mockCanvas)
    const stage = { toCanvas: mockToCanvas } as any

    const { captureRender } = await import('../components/slides/editor/useCapture')
    await expect(captureRender(stage)).rejects.toThrow('canvas.toBlob failed')
  })
})

describe('uploadRender', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates new Media record via POST', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 42 }) })
    )
    vi.stubGlobal('fetch', mockFetch)

    const { uploadRender } = await import('../components/slides/editor/useCapture')
    const blob = new Blob(['test'], { type: 'image/png' })
    const id = await uploadRender(blob, 'My Slide')

    expect(mockFetch).toHaveBeenCalledWith('/api/media', expect.objectContaining({ method: 'POST' }))
    expect(id).toBe(42)
  })

  it('updates existing Media record via PATCH', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 10 }) })
    )
    vi.stubGlobal('fetch', mockFetch)

    const { uploadRender } = await import('../components/slides/editor/useCapture')
    const blob = new Blob(['test'], { type: 'image/png' })
    const id = await uploadRender(blob, 'Updated Slide', 10)

    expect(mockFetch).toHaveBeenCalledWith('/api/media/10', expect.objectContaining({ method: 'PATCH' }))
    expect(id).toBe(10)
  })

  it('throws on non-ok response', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    )
    vi.stubGlobal('fetch', mockFetch)

    const { uploadRender } = await import('../components/slides/editor/useCapture')
    const blob = new Blob(['test'], { type: 'image/png' })

    await expect(uploadRender(blob, 'Fail Slide')).rejects.toThrow('Media upload failed: 500')
  })
})
