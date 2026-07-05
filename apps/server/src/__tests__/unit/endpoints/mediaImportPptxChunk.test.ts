import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdir, mkdir, writeFile, readFile, rm, stat } from 'fs/promises'
import path from 'path'
import os from 'os'

vi.mock('fs/promises')
vi.mock('../../../utilities/pptxImporter', () => ({
  parsePptx: vi.fn(),
}))
vi.mock('../../../websocket/io', () => ({
  getIO: vi.fn(),
}))

import { mediaImportPptxChunk, mediaImportPptxChunkAbort } from '../../../endpoints/mediaImportPptx'
import { parsePptx } from '../../../utilities/pptxImporter'

const PPTX_UPLOADS_DIR = path.join(os.tmpdir(), 'pptx-uploads')

function makeChunkFormData(overrides: Record<string, any> = {}) {
  const formData = new FormData()
  const defaults: Record<string, any> = {
    chunk: new Blob(['chunk-data'], { type: 'application/octet-stream' }),
    uploadId: '550e8400-e29b-41d4-a716-446655440000',
    chunkIndex: '0',
    totalChunks: '2',
    fileName: 'test.pptx',
  }
  const merged = { ...defaults, ...overrides }
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) formData.append(key, value)
  }
  return formData
}

function makeChunkReq(overrides: Record<string, any> = {}) {
  const formData = overrides.formData ?? makeChunkFormData(overrides.formFields)
  const user = {
    id: 1,
    departments: [{ id: 1, name: 'Test Dept' }],
  }
  const payload = {
    create: vi.fn(),
    find: vi.fn(),
    findByID: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    logger: { error: vi.fn() },
    config: { secret: 'test-secret' },
  }
  return {
    user: overrides.user === null ? null : (overrides.user ?? user),
    payload: overrides.payload ?? payload,
    formData: async () => formData,
    url: overrides.url ?? 'http://localhost/api/import-pptx-chunk',
    ...overrides.extra,
  }
}

function asResponse(res: any): Response {
  return res instanceof Response ? res : new Response(JSON.stringify(res), { status: 200 })
}

async function jsonBody(res: Response) {
  return JSON.parse(await res.text())
}

describe('POST /api/import-pptx-chunk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readdir).mockResolvedValue([])
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)
    vi.mocked(readFile).mockResolvedValue(Buffer.from('chunk-data'))
    vi.mocked(stat).mockResolvedValue({ mtimeMs: Date.now() } as any)
    vi.mocked(rm).mockResolvedValue(undefined)
  })

  it('returns 401 when not authenticated', async () => {
    const req = makeChunkReq({ user: null })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid uploadId (not a UUID)', async () => {
    const req = makeChunkReq({
      formFields: { uploadId: '../../etc/passwd' },
    })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toContain('Invalid uploadId')
  })

  it('returns 400 for uploadId with no form field', async () => {
    const formData = new FormData()
    formData.append('chunk', new Blob(['data']))
    formData.append('chunkIndex', '0')
    formData.append('totalChunks', '1')
    formData.append('fileName', 'test.pptx')
    const req = makeChunkReq({ formData })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-pptx fileName', async () => {
    const req = makeChunkReq({
      formFields: { fileName: 'test.pdf' },
    })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toContain('pptx')
  })

  it('returns 400 for missing chunk file', async () => {
    const formData = new FormData()
    formData.append('uploadId', '550e8400-e29b-41d4-a716-446655440000')
    formData.append('chunkIndex', '0')
    formData.append('totalChunks', '1')
    formData.append('fileName', 'test.pptx')
    const req = makeChunkReq({ formData })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toContain('chunk')
  })

  it('returns 400 for invalid chunkIndex (negative)', async () => {
    const req = makeChunkReq({
      formFields: { chunkIndex: '-1', totalChunks: '2' },
    })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toContain('Invalid chunkIndex')
  })

  it('returns 400 for chunkIndex >= totalChunks', async () => {
    const req = makeChunkReq({
      formFields: { chunkIndex: '2', totalChunks: '2' },
    })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toContain('Invalid chunkIndex')
  })

  it('returns 400 for invalid totalChunks (zero)', async () => {
    const req = makeChunkReq({
      formFields: { totalChunks: '0' },
    })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toContain('Invalid totalChunks')
  })

  it('stores a non-final chunk and returns { ok: true }', async () => {
    const req = makeChunkReq({
      formFields: { chunkIndex: '0', totalChunks: '2' },
    })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.ok).toBe(true)
    expect(body.received).toBe(0)
    expect(body.totalChunks).toBe(2)
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
      path.join(PPTX_UPLOADS_DIR, '550e8400-e29b-41d4-a716-446655440000'),
      { recursive: true },
    )
    expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
      path.join(PPTX_UPLOADS_DIR, '550e8400-e29b-41d4-a716-446655440000', 'chunk.0'),
      expect.any(Buffer),
    )
  })

  it('reads and concatenates chunks on final chunk, then processes', async () => {
    vi.mocked(parsePptx).mockResolvedValue({
      fileName: 'test',
      slides: [],
      skipped: [],
      slideSize: { cx: 12192000, cy: 6858000 },
      mediaRegistry: new Map(),
    })

    const req = makeChunkReq({
      formFields: { chunkIndex: '1', totalChunks: '2' },
    })

    req.payload.find.mockResolvedValue({ docs: [{ id: 1 }] })

    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(200)

    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(rm)).toHaveBeenCalledWith(
      path.join(PPTX_UPLOADS_DIR, '550e8400-e29b-41d4-a716-446655440000'),
      { recursive: true, force: true },
    )
  })

  it('returns 400 when final chunk but prior chunks are missing', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT'))

    const req = makeChunkReq({
      formFields: { chunkIndex: '1', totalChunks: '2' },
    })
    const res = asResponse(await mediaImportPptxChunk.handler(req))
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toContain('reassemble')

    expect(vi.mocked(rm)).toHaveBeenCalledWith(
      path.join(PPTX_UPLOADS_DIR, '550e8400-e29b-41d4-a716-446655440000'),
      expect.any(Object),
    )
  })

  it('runs cleanup of stale temp dirs on each request', async () => {
    const oldTime = Date.now() - 3700_000
    vi.mocked(readdir).mockResolvedValueOnce(['old-dir', 'recent-dir'])
    vi.mocked(stat)
      .mockResolvedValueOnce({ mtimeMs: oldTime } as any)
      .mockResolvedValueOnce({ mtimeMs: Date.now() } as any)

    const req = makeChunkReq({
      formFields: { chunkIndex: '0', totalChunks: '2' },
    })
    await mediaImportPptxChunk.handler(req)

    expect(vi.mocked(rm)).toHaveBeenCalledWith(
      path.join(PPTX_UPLOADS_DIR, 'old-dir'),
      { recursive: true, force: true },
    )
  })
})

describe('DELETE /api/import-pptx-chunk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rm).mockResolvedValue(undefined)
  })

  it('returns 401 when not authenticated', async () => {
    const req = makeChunkReq({
      user: null,
      url: 'http://localhost/api/import-pptx-chunk?uploadId=550e8400-e29b-41d4-a716-446655440000',
    })
    const res = asResponse(await mediaImportPptxChunkAbort.handler(req))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid uploadId', async () => {
    const req = makeChunkReq({
      url: 'http://localhost/api/import-pptx-chunk?uploadId=bad-value',
    })
    const res = asResponse(await mediaImportPptxChunkAbort.handler(req))
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toContain('Invalid uploadId')
  })

  it('returns 400 for missing uploadId', async () => {
    const req = makeChunkReq({
      url: 'http://localhost/api/import-pptx-chunk',
    })
    const res = asResponse(await mediaImportPptxChunkAbort.handler(req))
    expect(res.status).toBe(400)
  })

  it('deletes temp directory and returns { ok: true }', async () => {
    const uploadId = '550e8400-e29b-41d4-a716-446655440000'
    const req = makeChunkReq({
      url: `http://localhost/api/import-pptx-chunk?uploadId=${uploadId}`,
    })
    const res = asResponse(await mediaImportPptxChunkAbort.handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.ok).toBe(true)
    expect(vi.mocked(rm)).toHaveBeenCalledWith(
      path.join(PPTX_UPLOADS_DIR, uploadId),
      { recursive: true, force: true },
    )
  })

  it('returns 200 even if directory does not exist', async () => {
    vi.mocked(rm).mockRejectedValueOnce(new Error('ENOENT'))
    const req = makeChunkReq({
      url: 'http://localhost/api/import-pptx-chunk?uploadId=550e8400-e29b-41d4-a716-446655440000',
    })
    const res = asResponse(await mediaImportPptxChunkAbort.handler(req))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.ok).toBe(true)
  })
})
