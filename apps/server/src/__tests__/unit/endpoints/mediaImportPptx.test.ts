import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../utilities/pptxImporter', () => ({
  parsePptx: vi.fn(),
}))

import { mediaImportPptx } from '../../../endpoints/mediaImportPptx'
import { parsePptx } from '../../../utilities/pptxImporter'
import type { SlideMedia } from '../../../utilities/pptxImporter'

interface SlideInput {
  images?: SlideMedia[]
  videos?: SlideMedia[]
  audios?: SlideMedia[]
}

function makeFullScreenImageMedia(sourceRelPath: string, shapeName?: string): SlideMedia {
  return {
    relId: `rId-${sourceRelPath}`,
    sourceRelPath,
    buffer: Buffer.from('fake-image-data'),
    mimeType: 'image/jpeg',
    kind: 'image',
    acrossSlides: 0,
    slideShapeIndex: 0,
    shapeId: 1,
    shapeName,
  }
}

function makeAudioMedia(sourceRelPath: string, acrossSlides = 1, shapeName?: string): SlideMedia {
  return {
    relId: `rId-${sourceRelPath}`,
    sourceRelPath,
    buffer: Buffer.from('fake-audio-data'),
    mimeType: 'audio/mpeg',
    kind: 'audio',
    acrossSlides,
    slideShapeIndex: 0,
    shapeId: 2,
    shapeName,
  }
}

function makeParsedPptx(slides: SlideInput[]) {
  return {
    fileName: 'test',
    slideSize: { cx: 12192000, cy: 6858000 },
    slides: slides.map((s) => ({
      images: s.images || [],
      videos: s.videos || [],
      audios: s.audios || [],
      hasFullScreenMedia: true,
    })),
    mediaRegistry: new Map(),
    skipped: [],
  }
}

function makeReq(options: { payloadOverrides?: Record<string, any> } = {}) {
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

  if (options.payloadOverrides) {
    Object.assign(payload, options.payloadOverrides)
  }

  const formData = new FormData()
  formData.append(
    'file',
    new File(['fake-pptx-bytes'], 'test.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }),
  )

  const user = { id: 1, departments: [{ id: 1, name: 'Test Dept' }] }

  return {
    user,
    payload,
    formData: async () => formData,
    url: 'http://localhost/api/import-pptx',
  }
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

describe('POST /api/import-pptx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('imports images from multiple slides into a program', async () => {
    vi.mocked(parsePptx).mockResolvedValue(makeParsedPptx([
      { images: [makeFullScreenImageMedia('ppt/media/image1.png')] },
      { images: [makeFullScreenImageMedia('ppt/media/image2.png')] },
    ]))

    const req = makeReq()
    const res = await mediaImportPptx.handler(req)
    const lines = await readNdjson(res)

    const mediaCalls = collectionCalls(req.payload.create, 'media')
    expect(mediaCalls).toHaveLength(2)
    expect(mediaCalls[0].context).toEqual({ skipFolderAutoAssign: true })
    expect(mediaCalls[0].file.name).toBe('image1.png')
    expect(mediaCalls[0].data.name).toBe('test - image1.png')
    expect(mediaCalls[1].file.name).toBe('image2.png')
    expect(mediaCalls[1].data.name).toBe('test - image2.png')

    const programCalls = collectionCalls(req.payload.create, 'programs')
    expect(programCalls).toHaveLength(1)
    const programData = programCalls[0].data
    expect(programData.title).toBe('test')
    expect(programData.loop).toBe(false)
    expect(programData.autoBlackEndSlide).toBe(true)
    expect(programData.folder).toBe(20)
    expect(programData.slides).toHaveLength(2)
    expect(programData.slides[0]).toMatchObject({
      blockType: 'imageBlock',
      image: 100,
      advanceMode: 'manual',
      transition: 'fade',
      scaleToFill: true,
    })
    expect(programData.slides[1]).toMatchObject({ blockType: 'imageBlock', image: 101 })

    const updateCalls = req.payload.update.mock.calls.map((c: any[]) => c[0])
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[0]).toMatchObject({ collection: 'media', id: 100, data: { folder: 11 } })
    expect(updateCalls[1]).toMatchObject({ collection: 'media', id: 101, data: { folder: 11 } })

    const phases = lines.filter((l) => l.type === 'phase').map((l) => l.phase)
    expect(phases).toEqual(['media', 'media', 'program'])
    expect(lines[0]).toMatchObject({ type: 'phase', phase: 'media', current: 1, total: 2 })
    expect(lines[1]).toMatchObject({ type: 'phase', phase: 'media', current: 2, total: 2 })

    const result = lines[lines.length - 1]
    expect(result.type).toBe('result')
    expect(result.program.title).toBe('test')
    expect(result.mediaCreated).toHaveLength(2)
    expect(result.skipped).toHaveLength(0)
  })

  it('deduplicates media referenced by multiple slides', async () => {
    vi.mocked(parsePptx).mockResolvedValue(makeParsedPptx([
      { images: [makeFullScreenImageMedia('ppt/media/dup.png')] },
      { images: [makeFullScreenImageMedia('ppt/media/dup.png')] },
    ]))

    const req = makeReq()
    const res = await mediaImportPptx.handler(req)
    await readNdjson(res)

    const mediaCalls = collectionCalls(req.payload.create, 'media')
    expect(mediaCalls).toHaveLength(1)

    const programData = collectionCalls(req.payload.create, 'programs')[0].data
    expect(programData.slides).toHaveLength(2)
    expect(programData.slides[0].image).toBe(100)
    expect(programData.slides[1].image).toBe(100)
  })

  it('rolls back when no media could be created', async () => {
    vi.mocked(parsePptx).mockResolvedValue(makeParsedPptx([{ images: [] }]))

    const req = makeReq()
    const res = await mediaImportPptx.handler(req)
    const lines = await readNdjson(res)

    expect(collectionCalls(req.payload.create, 'media')).toHaveLength(0)
    expect(collectionCalls(req.payload.create, 'programs')).toHaveLength(0)

    const deleteCalls = req.payload.delete.mock.calls.map((c: any[]) => c[0])
    expect(deleteCalls).toHaveLength(1)
    expect(deleteCalls[0]).toMatchObject({ collection: 'folders', id: 11 })

    const error = lines.find((l) => l.type === 'error')
    expect(error.message).toBe('No media could be imported from this file')
  })

  it('rolls back when no slides are produced', async () => {
    vi.mocked(parsePptx).mockResolvedValue(makeParsedPptx([
      { audios: [makeAudioMedia('ppt/media/bg.mp3', 2)] },
    ]))

    const req = makeReq()
    const res = await mediaImportPptx.handler(req)
    const lines = await readNdjson(res)

    const mediaCalls = collectionCalls(req.payload.create, 'media')
    expect(mediaCalls).toHaveLength(1)
    expect(collectionCalls(req.payload.create, 'programs')).toHaveLength(0)

    const deleteCalls = req.payload.delete.mock.calls.map((c: any[]) => c[0])
    const mediaDelete = deleteCalls.filter((c) => c.collection === 'media')
    const folderDelete = deleteCalls.filter((c) => c.collection === 'folders')
    expect(mediaDelete).toHaveLength(1)
    expect(mediaDelete[0]).toMatchObject({ collection: 'media', id: 100 })
    expect(folderDelete).toHaveLength(1)
    expect(folderDelete[0]).toMatchObject({ collection: 'folders', id: 11 })

    const error = lines.find((l) => l.type === 'error')
    expect(error.message).toBe('No slides were produced from this file. All media may have been skipped.')
  })

  it('rolls back when all media creates fail', async () => {
    vi.mocked(parsePptx).mockResolvedValue(makeParsedPptx([
      { images: [makeFullScreenImageMedia('ppt/media/image1.png')] },
    ]))

    const req = makeReq()
    vi.mocked(req.payload.create).mockImplementation(async (args: any) => {
      const collection = args?.collection
      if (collection === 'folders') return { id: 11 }
      if (collection === 'media') throw new Error('media upload failed')
      if (collection === 'programs') return { id: 200, title: args?.data?.title }
      return { id: 999 }
    })

    const res = await mediaImportPptx.handler(req)
    const lines = await readNdjson(res)

    expect(collectionCalls(req.payload.create, 'programs')).toHaveLength(0)
    const deleteCalls = req.payload.delete.mock.calls.map((c: any[]) => c[0])
    expect(deleteCalls.filter((c) => c.collection === 'media')).toHaveLength(0)
    expect(deleteCalls).toHaveLength(1)
    expect(deleteCalls[0]).toMatchObject({ collection: 'folders', id: 11 })

    const error = lines.find((l) => l.type === 'error')
    expect(error.message).toBe('No media could be imported from this file')
    expect(error.skipped.some((s: string) => s.includes('image1.png'))).toBe(true)
  })

  it('rolls back when program creation fails', async () => {
    vi.mocked(parsePptx).mockResolvedValue(makeParsedPptx([
      { images: [makeFullScreenImageMedia('ppt/media/image1.png')] },
    ]))

    const req = makeReq()
    vi.mocked(req.payload.create).mockImplementation(async (args: any) => {
      const collection = args?.collection
      if (collection === 'folders') return { id: 11 }
      if (collection === 'media') return { id: 100, name: args?.data?.name }
      if (collection === 'programs') throw new Error('program creation failed')
      return { id: 999 }
    })

    const res = await mediaImportPptx.handler(req)
    const lines = await readNdjson(res)

    const deleteCalls = req.payload.delete.mock.calls.map((c: any[]) => c[0])
    expect(deleteCalls.filter((c) => c.collection === 'media')).toHaveLength(1)
    expect(deleteCalls[0]).toMatchObject({ collection: 'media', id: 100 })
    expect(deleteCalls.filter((c) => c.collection === 'folders')).toHaveLength(1)
    expect(deleteCalls.find((c) => c.collection === 'folders')).toMatchObject({ collection: 'folders', id: 11 })

    const error = lines.find((l) => l.type === 'error')
    expect(error.message).toBe('Failed to create program')
  })

  it('creates segmentBlock for spanning audio', async () => {
    vi.mocked(parsePptx).mockResolvedValue(makeParsedPptx([
      {
        images: [makeFullScreenImageMedia('ppt/media/img1.png')],
        audios: [makeAudioMedia('ppt/media/bg.mp3', 2, 'Background Music')],
      },
      { images: [makeFullScreenImageMedia('ppt/media/img2.png')] },
    ]))

    const req = makeReq()
    const res = await mediaImportPptx.handler(req)
    const lines = await readNdjson(res)

    const programData = collectionCalls(req.payload.create, 'programs')[0].data
    expect(programData.slides).toHaveLength(1)
    const segment = programData.slides[0]
    expect(segment).toMatchObject({
      blockType: 'segmentBlock',
      backgroundAudio: 101,
      advanceMode: 'slides',
      loop: false,
    })
    expect(segment.slides).toHaveLength(2)
    expect(segment.slides[0]).toMatchObject({ blockType: 'imageBlock', image: 100 })
    expect(segment.slides[1]).toMatchObject({ blockType: 'imageBlock', image: 102 })

    const result = lines.find((l) => l.type === 'result')
    expect(result.mediaCreated).toHaveLength(3)
  })
})
