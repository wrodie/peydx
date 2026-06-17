import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFile } from 'fs/promises'

vi.mock('fs/promises')
vi.mock('../../../websocket/io', () => ({
  getIO: vi.fn(),
}))

import { externalApiEndpoints } from '../../../endpoints/integrations'
import { getIO } from '../../../websocket/io'
import { deviceStateStore } from '../../../websocket/deviceState'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ep(path: string, method: string) {
  const found = externalApiEndpoints.find(e => e.path === path && e.method === method)
  if (!found) throw new Error(`Endpoint ${method} ${path} not found`)
  return found
}

function makeReq(overrides: Record<string, any> = {}) {
  const user = {
    collection: 'integrations',
    id: 1,
    name: 'Test Integration',
    expiresAt: '2099-12-31T23:59:59.000Z',
    departments: [],
  }
  const payload = { find: vi.fn(), findByID: vi.fn(), update: vi.fn(), config: { secret: 'test-secret-for-testing' } }
  return {
    user,
    payload,
    routeParams: {},
    clone: () => ({ json: vi.fn().mockRejectedValue(new Error('No body set')) }),
    query: {},
    ...overrides,
  }
}

interface MockIO {
  to: ReturnType<typeof vi.fn>
}

const mockEmit = vi.fn()

function mockIO(): MockIO {
  const io = { to: vi.fn(() => ({ emit: mockEmit })) }
  vi.mocked(getIO).mockReturnValue(io as any)
  return io
}

function asResponse(res: any): Response {
  return res instanceof Response ? res : new Response(JSON.stringify(res), { status: 200 })
}

async function jsonBody(res: Response) {
  return JSON.parse(await res.text())
}

// ---------------------------------------------------------------------------
// Helper extraction for unit-testing module-internal helpers
// ---------------------------------------------------------------------------

function extractYoutubeId(raw: string): string | null {
  if (!raw) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw
  try {
    const url = new URL(raw)
    if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
      if (url.pathname === '/watch') return url.searchParams.get('v') || null
      if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null
    }
  } catch { /* ignore */ }
  return null
}

function computeSlideThumbnail(slide: any): string | null {
  if (!slide) return null
  switch (slide.blockType) {
    case 'imageBlock': {
      const img = slide.image
      if (!img) return null
      return img.sizes?.thumbnail?.url || img.sizes?.card?.url || img.url || null
    }
    case 'videoBlock': {
      const vid = slide.video
      if (!vid) return null
      return vid.sizes?.thumbnail?.url || null
    }
    case 'youtubeBlock': {
      const ytId = extractYoutubeId(slide.youtubeId)
      return ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Helper: extractYoutubeId
// ---------------------------------------------------------------------------

describe('extractYoutubeId', () => {
  it('returns null for empty input', () => {
    expect(extractYoutubeId('')).toBeNull()
    expect(extractYoutubeId(null as any)).toBeNull()
  })

  it('extracts bare 11-char ID', () => {
    expect(extractYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from youtube.com/watch?v=', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from youtu.be/', () => {
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for invalid URL', () => {
    expect(extractYoutubeId('not-a-valid-id')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Helper: computeSlideThumbnail
// ---------------------------------------------------------------------------

describe('computeSlideThumbnail', () => {
  it('returns null for unknown block type', () => {
    expect(computeSlideThumbnail({ blockType: 'audioBlock' })).toBeNull()
    expect(computeSlideThumbnail({ blockType: 'blackScreenBlock' })).toBeNull()
    expect(computeSlideThumbnail(null)).toBeNull()
  })

  it('extracts thumbnail URL from imageBlock using sizes', () => {
    const slide = {
      blockType: 'imageBlock',
      image: { url: '/api/media/file/full.jpg', sizes: { thumbnail: { url: '/api/media/file/thumb.jpg' } } },
    }
    expect(computeSlideThumbnail(slide)).toBe('/api/media/file/thumb.jpg')
  })

  it('falls back to card size for imageBlock', () => {
    const slide = {
      blockType: 'imageBlock',
      image: { url: '/api/media/file/full.jpg', sizes: { card: { url: '/api/media/file/card.jpg' } } },
    }
    expect(computeSlideThumbnail(slide)).toBe('/api/media/file/card.jpg')
  })

  it('falls back to image.url when no sizes', () => {
    const slide = {
      blockType: 'imageBlock',
      image: { url: '/api/media/file/full.jpg' },
    }
    expect(computeSlideThumbnail(slide)).toBe('/api/media/file/full.jpg')
  })

  it('returns null for imageBlock without image', () => {
    expect(computeSlideThumbnail({ blockType: 'imageBlock' })).toBeNull()
  })

  it('extracts thumbnail URL from videoBlock', () => {
    const slide = {
      blockType: 'videoBlock',
      video: { sizes: { thumbnail: { url: '/api/media/file/vid-thumb.jpg' } } },
    }
    expect(computeSlideThumbnail(slide)).toBe('/api/media/file/vid-thumb.jpg')
  })

  it('returns null for videoBlock without sizes', () => {
    const slide = { blockType: 'videoBlock', video: { url: '/api/media/file/video.mp4' } }
    expect(computeSlideThumbnail(slide)).toBeNull()
  })

  it('builds YouTube thumbnail URL', () => {
    const slide = { blockType: 'youtubeBlock', youtubeId: 'dQw4w9WgXcQ' }
    expect(computeSlideThumbnail(slide)).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
  })

  it('returns null for youtubeBlock without valid ID', () => {
    const slide = { blockType: 'youtubeBlock', youtubeId: '' }
    expect(computeSlideThumbnail(slide)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('auth', () => {
  beforeEach(() => { deviceStateStore.clear() })

  it('returns 403 when user is not an integration', async () => {
    const req = makeReq({ user: { collection: 'devices' } })
    const handler = ep('/external/v1/devices', 'get').handler
    const res = asResponse(await handler(req))
    expect(res.status).toBe(403)
    const body = await jsonBody(res)
    expect(body.error).toContain('integration API key')
  })

  it('returns 401 when key is expired', async () => {
    const req = makeReq({ user: { collection: 'integrations', expiresAt: '2020-01-01T00:00:00.000Z' } })
    const handler = ep('/external/v1/devices', 'get').handler
    const res = asResponse(await handler(req))
    expect(res.status).toBe(401)
    const body = await jsonBody(res)
    expect(body.error).toContain('expired')
  })
})

// ---------------------------------------------------------------------------
// GET /external/v1/devices
// ---------------------------------------------------------------------------

describe('GET /external/v1/devices', () => {
  beforeEach(() => { deviceStateStore.clear() })

  it('returns enriched device list', async () => {
    const req = makeReq()
    req.payload.find.mockResolvedValue({
      docs: [{ id: 1, name: 'Screen A', deviceType: 'hardware', status: 'online', departments: [], currentProgram: null }],
    })
    const res = asResponse(await ep('/external/v1/devices', 'get').handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.devices).toHaveLength(1)
    expect(body.devices[0].id).toBe(1)
    expect(body.devices[0].state).toBe('idle')
    expect(body.devices[0].currentProgram).toBeNull()
  })

  it('includes thumbnail when device is playing', async () => {
    deviceStateStore.set(1, { state: 'playing', programId: 10, slideIndex: 0 })
    const req = makeReq()
    req.payload.find.mockResolvedValue({
      docs: [{ id: 1, name: 'Screen A', deviceType: 'hardware', status: 'online', departments: [], currentProgram: 10 }],
    })
    // First findByID (depth 0 — title lookup)
    req.payload.findByID.mockResolvedValueOnce({ id: 10, title: 'Worship', slides: [{ blockType: 'imageBlock', image: { url: '/img/full.jpg' } }] })
    // Second findByID (depth 2 — thumbnail)
    req.payload.findByID.mockResolvedValueOnce({ id: 10, title: 'Worship', slides: [{ blockType: 'imageBlock', image: { url: '/img/full.jpg' } }] })
    const res = asResponse(await ep('/external/v1/devices', 'get').handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.devices[0].currentSlideThumbnail).toBe('/img/full.jpg')
    expect(body.devices[0].currentProgram?.title).toBe('Worship')
  })

  it('passes department where clause for scoped key', async () => {
    const req = makeReq({ user: { collection: 'integrations', expiresAt: '2099-12-31T23:59:59.000Z', departments: [{ id: 5 }] } })
    req.payload.find.mockResolvedValue({ docs: [] })
    await ep('/external/v1/devices', 'get').handler(req)
    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { departments: { in: [5] } } })
    )
  })
})

// ---------------------------------------------------------------------------
// GET /external/v1/devices/:id
// ---------------------------------------------------------------------------

describe('GET /external/v1/devices/:id', () => {
  beforeEach(() => { deviceStateStore.clear() })

  it('returns device detail with program', async () => {
    const req = makeReq({ routeParams: { id: '1' } })
    req.payload.findByID.mockResolvedValue({
      id: 1, name: 'Screen A', deviceType: 'hardware', status: 'online',
      departments: [], currentProgram: null, controllingDevice: null,
    })
    const res = asResponse(await ep('/external/v1/devices/:id', 'get').handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.id).toBe(1)
    expect(body.currentProgram).toBeNull()
  })

  it('returns 400 for invalid id', async () => {
    const req = makeReq({ routeParams: { id: 'abc' } })
    const res = asResponse(await ep('/external/v1/devices/:id', 'get').handler(req))
    expect(res.status).toBe(400)
  })

  it('returns 404 for missing device', async () => {
    const req = makeReq({ routeParams: { id: '999' } })
    req.payload.findByID.mockRejectedValue(new Error('Not found'))
    const res = asResponse(await ep('/external/v1/devices/:id', 'get').handler(req))
    expect(res.status).toBe(404)
  })

  it('returns 403 when device dept not in scope', async () => {
    const req = makeReq({
      user: { collection: 'integrations', expiresAt: '2099-12-31T23:59:59.000Z', departments: [2] },
      routeParams: { id: '1' },
    })
    req.payload.findByID.mockResolvedValue({ id: 1, departments: [{ id: 3 }] })
    const res = asResponse(await ep('/external/v1/devices/:id', 'get').handler(req))
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// POST /external/v1/devices/:id/program
// ---------------------------------------------------------------------------

describe('POST /external/v1/devices/:id/program', () => {
  beforeEach(() => {
    deviceStateStore.clear()
    vi.clearAllMocks()
  })

  it('loads program and emits remote:program', async () => {
    mockIO()
    const req = makeReq({
      routeParams: { id: '1' },
      clone: () => ({ json: vi.fn().mockResolvedValue({ programId: 10 }) }),
    })
    req.payload.findByID
      .mockResolvedValueOnce({ id: 1, departments: [] })                  // device
      .mockResolvedValueOnce({ id: 10, folder: { department: 5 } })       // program depth 1
      .mockResolvedValueOnce({ id: 10, title: 'Worship', slides: [] })    // program depth 2

    const res = asResponse(await ep('/external/v1/devices/:id/program', 'post').handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.success).toBe(true)

    // WebSocket emit
    expect(vi.mocked(getIO)()!.to).toHaveBeenCalledWith('device:1')
    expect(mockEmit).toHaveBeenCalledWith('remote:program', expect.objectContaining({ slideIndex: 0 }))

    // State store
    expect(deviceStateStore.get(1)).toEqual({ state: 'playing', programId: 10, slideIndex: 0 })

    // DB update
    expect(req.payload.update).toHaveBeenCalledWith({
      collection: 'devices', id: 1, data: { currentProgram: 10, currentSlideIndex: 0 }, overrideAccess: true,
    })
  })

  it('returns 400 for missing programId', async () => {
    const req = makeReq({
      routeParams: { id: '1' },
      clone: () => ({ json: vi.fn().mockResolvedValue({}) }),
    })
    const res = asResponse(await ep('/external/v1/devices/:id/program', 'post').handler(req))
    expect(res.status).toBe(400)
  })

  it('returns 404 for missing device', async () => {
    const req = makeReq({
      routeParams: { id: '1' },
      clone: () => ({ json: vi.fn().mockResolvedValue({ programId: 10 }) }),
    })
    req.payload.findByID.mockRejectedValueOnce(new Error('Not found'))
    const res = asResponse(await ep('/external/v1/devices/:id/program', 'post').handler(req))
    expect(res.status).toBe(404)
  })

  it('returns 404 for missing program', async () => {
    const req = makeReq({
      routeParams: { id: '1' },
      clone: () => ({ json: vi.fn().mockResolvedValue({ programId: 10 }) }),
    })
    req.payload.findByID
      .mockResolvedValueOnce({ id: 1, departments: [] })
      .mockRejectedValueOnce(new Error('Not found'))
    const res = asResponse(await ep('/external/v1/devices/:id/program', 'post').handler(req))
    expect(res.status).toBe(404)
  })

  it('returns 403 when device dept not in scope', async () => {
    const req = makeReq({
      user: { collection: 'integrations', expiresAt: '2099-12-31T23:59:59.000Z', departments: [2] },
      routeParams: { id: '1' },
      clone: () => ({ json: vi.fn().mockResolvedValue({ programId: 10 }) }),
    })
    req.payload.findByID.mockResolvedValueOnce({ id: 1, departments: [{ id: 3 }] })
    const res = asResponse(await ep('/external/v1/devices/:id/program', 'post').handler(req))
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// POST /external/v1/devices/:id/advance
// ---------------------------------------------------------------------------

describe('POST /external/v1/devices/:id/advance', () => {
  beforeEach(() => { deviceStateStore.clear(); vi.clearAllMocks() })

  it('emits remote:advance', async () => {
    mockIO()
    const req = makeReq({ routeParams: { id: '1' } })
    req.payload.findByID.mockResolvedValue({ id: 1, departments: [] })
    const res = asResponse(await ep('/external/v1/devices/:id/advance', 'post').handler(req))
    expect(res.status).toBe(200)
    expect(mockEmit).toHaveBeenCalledWith('remote:advance')
  })

  it('returns 403 when device dept not in scope', async () => {
    const req = makeReq({
      user: { collection: 'integrations', expiresAt: '2099-12-31T23:59:59.000Z', departments: [2] },
      routeParams: { id: '1' },
    })
    req.payload.findByID.mockResolvedValue({ id: 1, departments: [{ id: 3 }] })
    const res = asResponse(await ep('/external/v1/devices/:id/advance', 'post').handler(req))
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// POST /external/v1/devices/:id/previous
// ---------------------------------------------------------------------------

describe('POST /external/v1/devices/:id/previous', () => {
  beforeEach(() => { deviceStateStore.clear(); vi.clearAllMocks() })

  it('emits remote:previous', async () => {
    mockIO()
    const req = makeReq({ routeParams: { id: '1' } })
    req.payload.findByID.mockResolvedValue({ id: 1, departments: [] })
    const res = asResponse(await ep('/external/v1/devices/:id/previous', 'post').handler(req))
    expect(res.status).toBe(200)
    expect(mockEmit).toHaveBeenCalledWith('remote:previous')
  })
})

// ---------------------------------------------------------------------------
// POST /external/v1/devices/:id/goto
// ---------------------------------------------------------------------------

describe('POST /external/v1/devices/:id/goto', () => {
  beforeEach(() => { deviceStateStore.clear(); vi.clearAllMocks() })

  it('emits remote:goto with slideIndex', async () => {
    mockIO()
    const req = makeReq({
      routeParams: { id: '1' },
      clone: () => ({ json: vi.fn().mockResolvedValue({ slideIndex: 3 }) }),
    })
    req.payload.findByID.mockResolvedValue({ id: 1, departments: [] })
    const res = asResponse(await ep('/external/v1/devices/:id/goto', 'post').handler(req))
    expect(res.status).toBe(200)
    expect(mockEmit).toHaveBeenCalledWith('remote:goto', { slideIndex: 3 })
  })

  it('returns 400 for missing slideIndex', async () => {
    const req = makeReq({
      routeParams: { id: '1' },
      clone: () => ({ json: vi.fn().mockResolvedValue({}) }),
    })
    const res = asResponse(await ep('/external/v1/devices/:id/goto', 'post').handler(req))
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /external/v1/devices/:id/pause
// ---------------------------------------------------------------------------

describe('POST /external/v1/devices/:id/pause', () => {
  beforeEach(() => { deviceStateStore.clear(); vi.clearAllMocks() })

  it('emits remote:pause', async () => {
    mockIO()
    const req = makeReq({ routeParams: { id: '1' } })
    req.payload.findByID.mockResolvedValue({ id: 1, departments: [] })
    const res = asResponse(await ep('/external/v1/devices/:id/pause', 'post').handler(req))
    expect(res.status).toBe(200)
    expect(mockEmit).toHaveBeenCalledWith('remote:pause')
  })
})

// ---------------------------------------------------------------------------
// POST /external/v1/devices/:id/back
// ---------------------------------------------------------------------------

describe('POST /external/v1/devices/:id/back', () => {
  beforeEach(() => { deviceStateStore.clear(); vi.clearAllMocks() })

  it('emits remote:back', async () => {
    mockIO()
    const req = makeReq({ routeParams: { id: '1' } })
    req.payload.findByID.mockResolvedValue({ id: 1, departments: [] })
    const res = asResponse(await ep('/external/v1/devices/:id/back', 'post').handler(req))
    expect(res.status).toBe(200)
    expect(mockEmit).toHaveBeenCalledWith('remote:back')
  })
})

// ---------------------------------------------------------------------------
// GET /external/v1/programs
// ---------------------------------------------------------------------------

describe('GET /external/v1/programs', () => {
  beforeEach(() => { deviceStateStore.clear() })

  it('returns program list', async () => {
    const req = makeReq()
    req.payload.find.mockResolvedValue({
      docs: [{ id: 1, title: 'Program A' }, { id: 2, title: 'Program B' }],
    })
    const res = asResponse(await ep('/external/v1/programs', 'get').handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.programs).toHaveLength(2)
  })

  it('passes dept where for scoped key', async () => {
    const req = makeReq({
      user: { collection: 'integrations', expiresAt: '2099-12-31T23:59:59.000Z', departments: [2] },
    })
    req.payload.find.mockResolvedValue({ docs: [] })
    await ep('/external/v1/programs', 'get').handler(req)
    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { 'folder.department': { in: [2] } } })
    )
  })
})

// ---------------------------------------------------------------------------
// GET /external/v1/programs/:id
// ---------------------------------------------------------------------------

describe('GET /external/v1/programs/:id', () => {
  beforeEach(() => { deviceStateStore.clear() })

  it('returns program detail', async () => {
    const req = makeReq({ routeParams: { id: '5' } })
    req.payload.findByID.mockResolvedValue({ id: 5, title: 'Program A', slides: [], folder: { department: 1 } })
    const res = asResponse(await ep('/external/v1/programs/:id', 'get').handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.id).toBe(5)
  })

  it('returns 404 for missing program', async () => {
    const req = makeReq({ routeParams: { id: '999' } })
    req.payload.findByID.mockRejectedValue(new Error('Not found'))
    const res = asResponse(await ep('/external/v1/programs/:id', 'get').handler(req))
    expect(res.status).toBe(404)
  })

  it('returns 403 when program dept not in scope', async () => {
    const req = makeReq({
      user: { collection: 'integrations', expiresAt: '2099-12-31T23:59:59.000Z', departments: [1] },
      routeParams: { id: '5' },
    })
    req.payload.findByID.mockResolvedValue({ id: 5, folder: { department: 2 } })
    const res = asResponse(await ep('/external/v1/programs/:id', 'get').handler(req))
    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /external/v1/schedules
// ---------------------------------------------------------------------------

describe('GET /external/v1/schedules', () => {
  beforeEach(() => { deviceStateStore.clear() })

  it('returns active schedules filtered by day and date', async () => {
    const req = makeReq()
    const now = new Date()
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getUTCDay()]
    const today = now.toISOString().split('T')[0]
    req.payload.find.mockResolvedValue({
      docs: [
        { id: 1, daysOfWeek: [dayName], startTime: `${today}T10:00:00Z`, endTime: `${today}T11:00:00Z` },
        { id: 2, daysOfWeek: ['mon'], startTime: `${today}T10:00:00Z`, endTime: `${today}T11:00:00Z` },
      ],
    })
    const res = asResponse(await ep('/external/v1/schedules', 'get').handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.schedules).toHaveLength(1)
    expect(body.schedules[0].id).toBe(1)
  })

  it('passes dept where for scoped key', async () => {
    const req = makeReq({
      user: { collection: 'integrations', expiresAt: '2099-12-31T23:59:59.000Z', departments: [3] },
    })
    req.payload.find.mockResolvedValue({ docs: [] })
    await ep('/external/v1/schedules', 'get').handler(req)
    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { department: { in: [3] } } })
    )
  })
})

// ---------------------------------------------------------------------------
// GET /external/v1/docs
// ---------------------------------------------------------------------------

describe('GET /external/v1/docs', () => {
  it('returns OpenAPI spec', async () => {
    vi.mocked(readFile).mockResolvedValue('openapi: 3.0.3')
    const req = makeReq()
    const res = asResponse(await ep('/external/v1/docs', 'get').handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.spec).toBe('openapi: 3.0.3')
  })

  it('returns 404 when file missing', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))
    const req = makeReq()
    const res = asResponse(await ep('/external/v1/docs', 'get').handler(req))
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// GET /external/v1/ws-docs
// ---------------------------------------------------------------------------

describe('GET /external/v1/ws-docs', () => {
  it('returns AsyncAPI spec', async () => {
    vi.mocked(readFile).mockResolvedValue('asyncapi: 2.6.0')
    const req = makeReq()
    const res = asResponse(await ep('/external/v1/ws-docs', 'get').handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.spec).toBe('asyncapi: 2.6.0')
  })

  it('returns 404 when file missing', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))
    const req = makeReq()
    const res = asResponse(await ep('/external/v1/ws-docs', 'get').handler(req))
    expect(res.status).toBe(404)
  })
})
