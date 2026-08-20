import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdir, mkdir, writeFile, readFile, rm, stat } from 'fs/promises'
import path from 'path'
import os from 'os'

vi.mock('fs/promises')
vi.mock('../../../utilities/pdfImporter', () => ({
  parsePdf: vi.fn(),
}))

import { mediaImportPdf, mediaImportPdfChunk, mediaImportPdfChunkAbort } from '../../../endpoints/mediaImportPdf'
import { parsePdf } from '../../../utilities/pdfImporter'

const PDF_UPLOADS_DIR = path.join(os.tmpdir(), 'pdf-uploads')

function makePdfPage(i: number) {
  return {
    buffer: Buffer.from(`fake-png-${i}`),
    displayName: `test - Page ${i + 1}`,
    fileName: `test - Page ${i + 1}.png`,
    mimeType: 'image/png',
  }
}

function makeReq(options: { user?: any; fileName?: string } = {}) {
  let mediaId = 100
  const payload = {
    create: vi.fn(async (args: any) => {
      const collection = args?.collection
      if (collection === 'folders') return { id: 11 }
      if (collection === 'media') {
        const id = mediaId++
        return { id, name: args?.data?.name }
      }
      if (collection === 'programs') return { id: 200, title: args?.data?.title }
      return { id: 999 }
    }),
    find: vi.fn(async (args: any) => {
      const where = args?.where || {}
      const type = where.type?.equals
      if (type === 'media' && where.parent?.exists === false) return { docs: [{ id: 10 }] }
      if (type === 'media' && where.parent?.equals === 10) return { docs: [] }
      if (type === 'programs' && where.parent?.exists === false) return { docs: [{ id: 20 }] }
      return { docs: [] }
    }),
    findByID: vi.fn(),
    delete: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    logger: { error: vi.fn() },
    config: { secret: 'test-secret' },
  }

  const fileName = options.fileName ?? 'test.pdf'
  const formData = new FormData()
  formData.append('file', new File(['fake-pdf-bytes'], fileName, { type: 'application/pdf' }))

  const user = options.user === null
    ? null
    : (options.user ?? { id: 1, departments: [{ id: 1, name: 'Test Dept' }] })

  return {
    user,
    payload,
    formData: async () => formData,
    url: 'http://localhost/api/import-pdf',
  }
}

function makeChunkFormData(overrides: Record<string, any> = {}) {
  const formData = new FormData()
  const defaults: Record<string, any> = {
    chunk: new Blob(['chunk-data'], { type: 'application/octet-stream' }),
    uploadId: '550e8400-e29b-41d4-a716-446655440000',
    chunkIndex: '0',
    totalChunks: '2',
    fileName: 'test.pdf',
  }
  const merged = { ...defaults, ...overrides }
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) formData.append(key, value)
  }
  return formData
}

function makeChunkReq(overrides: Record<string, any> = {}) {
  const formData = overrides.formData ?? makeChunkFormData(overrides.formFields)
  const user = { id: 1, departments: [{ id: 1, name: 'Test Dept' }] }
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
    url: overrides.url ?? 'http://localhost/api/import-pdf-chunk',
    ...overrides.extra,
  }
}

function asResponse(res: any): Response {
  return res instanceof Response ? res : new Response(JSON.stringify(res), { status: 200 })
}

async function readNdjson(res: Response): Promise<any[]> {
  const text = await res.text()
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
}

function collectionCalls(createMock: any, collection: string): any[] {
  return createMock.mock.calls
    .filter((c: any[]) => c[0]?.collection === collection)
    .map((c: any[]) => c[0])
}

describe('POST /api/import-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('imports PDF pages as image slides', async () => {
    vi.mocked(parsePdf).mockResolvedValue({
      pages: [makePdfPage(0), makePdfPage(1)],
      skipped: [],
    })

    const req = makeReq()
    const res = await mediaImportPdf.handler(req)
    const lines = await readNdjson(res)

    const mediaCalls = collectionCalls(req.payload.create, 'media')
    expect(mediaCalls).toHaveLength(2)
    expect(mediaCalls[0].file.name).toBe('test - Page 1.png')
    expect(mediaCalls[0].data.name).toBe('test - Page 1')
    expect(mediaCalls[1].file.name).toBe('test - Page 2.png')

    const programData = collectionCalls(req.payload.create, 'programs')[0].data
    expect(programData.title).toBe('test')
    expect(programData.slides).toHaveLength(2)
    expect(programData.slides[0]).toMatchObject({ blockType: 'imageBlock', image: 100 })
    expect(programData.slides[1]).toMatchObject({ blockType: 'imageBlock', image: 101 })

    const result = lines.find((l) => l.type === 'result')
    expect(result.mediaCreated).toHaveLength(2)
  })

  it('returns 400 for non-pdf file', async () => {
    const req = makeReq({ fileName: 'test.txt' })
    const res = asResponse(await mediaImportPdf.handler(req))
    expect(res.status).toBe(400)
    const body = JSON.parse(await res.text())
    expect(body.error).toContain('.pdf')
  })

  it('returns 401 when not authenticated', async () => {
    const req = makeReq({ user: null })
    const res = asResponse(await mediaImportPdf.handler(req))
    expect(res.status).toBe(401)
  })

  it('returns 400 when parsePdf throws', async () => {
    vi.mocked(parsePdf).mockRejectedValue(new Error('bad pdf'))

    const req = makeReq()
    const res = asResponse(await mediaImportPdf.handler(req))
    expect(res.status).toBe(400)
    const body = JSON.parse(await res.text())
    expect(body.error).toContain('Failed to parse PDF')
  })

  it('rolls back when PDF has 0 pages', async () => {
    vi.mocked(parsePdf).mockResolvedValue({ pages: [], skipped: [] })

    const req = makeReq()
    const res = await mediaImportPdf.handler(req)
    const lines = await readNdjson(res)

    expect(collectionCalls(req.payload.create, 'media')).toHaveLength(0)
    expect(collectionCalls(req.payload.create, 'programs')).toHaveLength(0)

    const deleteCalls = req.payload.delete.mock.calls.map((c: any[]) => c[0])
    expect(deleteCalls).toHaveLength(1)
    expect(deleteCalls[0]).toMatchObject({ collection: 'folders', id: 11 })

    const error = lines.find((l) => l.type === 'error')
    expect(error.message).toBe('No media could be imported from this file')
  })
})

describe('POST /api/import-pdf-chunk', () => {
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
    const res = asResponse(await mediaImportPdfChunk.handler(req))
    expect(res.status).toBe(401)
  })

  it('returns 400 for non-pdf fileName', async () => {
    const req = makeChunkReq({ formFields: { fileName: 'test.pptx' } })
    const res = asResponse(await mediaImportPdfChunk.handler(req))
    expect(res.status).toBe(400)
    const body = JSON.parse(await res.text())
    expect(body.error).toContain('.pdf')
  })

  it('stores a non-final chunk and returns { ok: true }', async () => {
    const req = makeChunkReq({ formFields: { chunkIndex: '0', totalChunks: '2' } })
    const res = asResponse(await mediaImportPdfChunk.handler(req))
    expect(res.status).toBe(200)
    const body = JSON.parse(await res.text())
    expect(body.ok).toBe(true)
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
      path.join(PDF_UPLOADS_DIR, '550e8400-e29b-41d4-a716-446655440000'),
      { recursive: true },
    )
  })

  it('reads and concatenates chunks on final chunk, then processes', async () => {
    vi.mocked(parsePdf).mockResolvedValue({ pages: [], skipped: [] })

    const req = makeChunkReq({ formFields: { chunkIndex: '1', totalChunks: '2' } })
    req.payload.find.mockResolvedValue({ docs: [{ id: 1 }] })

    const res = asResponse(await mediaImportPdfChunk.handler(req))
    expect(res.status).toBe(200)
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(rm)).toHaveBeenCalledWith(
      path.join(PDF_UPLOADS_DIR, '550e8400-e29b-41d4-a716-446655440000'),
      { recursive: true, force: true },
    )
  })
})

describe('DELETE /api/import-pdf-chunk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rm).mockResolvedValue(undefined)
  })

  it('deletes temp directory and returns { ok: true }', async () => {
    const uploadId = '550e8400-e29b-41d4-a716-446655440000'
    const req = makeChunkReq({
      url: `http://localhost/api/import-pdf-chunk?uploadId=${uploadId}`,
    })
    const res = asResponse(await mediaImportPdfChunkAbort.handler(req))
    expect(res.status).toBe(200)
    const body = JSON.parse(await res.text())
    expect(body.ok).toBe(true)
    expect(vi.mocked(rm)).toHaveBeenCalledWith(
      path.join(PDF_UPLOADS_DIR, uploadId),
      { recursive: true, force: true },
    )
  })
})
