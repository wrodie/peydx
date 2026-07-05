import { parsePptx } from '../utilities/pptxImporter'
import type { SlideMedia } from '../utilities/pptxImporter'
import { mkdir, writeFile, readFile, readdir, rm, stat } from 'fs/promises'
import path from 'path'
import os from 'os'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function buildImageSlideBlock(mediaId: number) {
  return {
    blockType: 'imageBlock',
    blockName: null,
    image: mediaId,
    advanceMode: 'manual',
    transition: 'fade',
    duration: null,
    scaleToFill: true,
  }
}

function buildVideoSlideBlock(mediaId: number) {
  return {
    blockType: 'videoBlock',
    blockName: null,
    video: mediaId,
    advanceMode: 'onEnd',
    transition: 'fade',
    duration: null,
    loop: false,
    scaleToFill: true,
  }
}

function buildAudioSlideBlock(mediaId: number) {
  return {
    blockType: 'audioBlock',
    blockName: null,
    audio: mediaId,
    advanceMode: 'onEnd',
    transition: 'fade',
    duration: null,
    loop: false,
  }
}

async function ensureImportFolder(
  payload: any,
  name: string,
  type: 'media' | 'programs',
  user: any,
  departmentId?: number,
): Promise<number | undefined> {
  const deptIds = departmentId
    ? [departmentId]
    : (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)

  const rootFolderQuery: any = {
    collection: 'folders',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: {
      parent: { exists: false },
    },
  }

  if (deptIds.length > 0) {
    rootFolderQuery.where.type = { equals: type }
    rootFolderQuery.where.department = { equals: deptIds[0] }
  } else {
    rootFolderQuery.where.type = { equals: type }
  }

  const rootFolders = await payload.find(rootFolderQuery)

  if (!rootFolders.docs?.[0]) return undefined

  const rootId = rootFolders.docs[0].id

  const existing = await payload.find({
    collection: 'folders',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: {
      type: { equals: type },
      parent: { equals: rootId },
      name: { equals: name },
    },
  })

  if (existing.docs?.[0]) return existing.docs[0].id

  const folder = await payload.create({
    collection: 'folders',
    data: {
      name,
      type,
      parent: rootId,
    },
    overrideAccess: true,
    user,
  })

  return folder.id
}

const encoder = new TextEncoder()

function ndjson(line: any): Uint8Array {
  return encoder.encode(JSON.stringify(line) + '\n')
}

async function processPptxImport(
  req: any,
  fileBuffer: Buffer,
  fileName: string,
  departmentId?: number,
): Promise<Response> {
  let parsed
  try {
    parsed = await parsePptx(fileBuffer)
    parsed.fileName = fileName
  } catch (err: any) {
    req.payload.logger.error({ err: String(err) }, '[mediaImportPptx] PPTX parsing failed')
    return Response.json(
      { error: `Failed to parse PPTX: ${err.message || String(err)}` },
      { status: 400 },
    )
  }

  const skipped: string[] = [...parsed.skipped]

  const mediaFolderId = await ensureImportFolder(
    req.payload, fileName, 'media', req.user, departmentId,
  )

  const programsRoot = await req.payload.find({
    collection: 'folders',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: {
      type: { equals: 'programs' },
      parent: { exists: false },
      ...(departmentId ? { department: { equals: departmentId } } : {}),
    },
  })
  const programsFolderId = programsRoot.docs?.[0]?.id

  const stream = new ReadableStream({
    start: async (controller) => {
      const mediaIdMap = new Map<string, number>()
      const createdMedia: Array<{ id: number; name: string }> = []

      const allMedia = new Map<string, SlideMedia>()
      for (const slide of parsed.slides) {
        for (const m of [...slide.images, ...slide.videos, ...slide.audios]) {
          if (!allMedia.has(m.sourceRelPath)) {
            allMedia.set(m.sourceRelPath, m)
          }
        }
      }

      const total = allMedia.size
      let current = 0

      for (const [relPath, media] of allMedia) {
        current++
        const lastSlash = relPath.lastIndexOf('/')
        const fname = lastSlash === -1 ? relPath : relPath.slice(lastSlash + 1)

        const mediaName = (media.shapeName && media.kind !== 'image')
          ? `${parsed.fileName} - ${media.shapeName}`
          : `${parsed.fileName} - ${fname}`

        controller.enqueue(ndjson({
          type: 'phase',
          phase: 'media',
          current,
          total,
          name: fname,
        }))

        try {
          const record = await req.payload.create({
            collection: 'media',
            data: { name: mediaName },
            file: {
              data: media.buffer,
              name: fname,
              mimetype: media.mimeType,
            },
            overrideAccess: true,
            user: req.user,
            context: { skipFolderAutoAssign: true },
          })
          mediaIdMap.set(relPath, record.id)
          createdMedia.push({ id: record.id, name: mediaName })
        } catch (err: any) {
          req.payload.logger.error(
            { relPath, err: String(err) },
            '[mediaImportPptx] Media creation failed',
          )
          skipped.push(`Could not create media for ${fname}: ${String(err)}`)
        }
      }

      if (createdMedia.length === 0) {
        if (mediaFolderId) {
          await req.payload.delete({ collection: 'folders', id: mediaFolderId }).catch(() => {})
        }
        controller.enqueue(ndjson({ type: 'error', message: 'No media could be imported from this file', skipped }))
        controller.close()
        return
      }

      const slides: any[] = []
      let openSegment: {
        segmentObj: any
        remainingSlides: number
      } | null = null

      for (let si = 0; si < parsed.slides.length; si++) {
        const ps = parsed.slides[si]

        if (openSegment) {
          if (ps.audios.length > 0 || ps.videos.length > 0) {
            if (openSegment.segmentObj.slides.length > 0) {
              slides.push(openSegment.segmentObj)
            }
            openSegment = null
          } else {
            const childSlides: any[] = []
            for (const img of ps.images) {
              const id = mediaIdMap.get(img.sourceRelPath)
              if (id) childSlides.push(buildImageSlideBlock(id))
            }
            if (childSlides.length > 0) {
              openSegment.segmentObj.slides.push(...childSlides)
            }
            openSegment.remainingSlides--
            if (openSegment.remainingSlides <= 0) {
              if (openSegment.segmentObj.slides.length > 0) {
                slides.push(openSegment.segmentObj)
              }
              openSegment = null
            }
            continue
          }
        }

        const spanningAudio = ps.audios.find(a => a.acrossSlides > 1)
        if (spanningAudio) {
          const audioId = mediaIdMap.get(spanningAudio.sourceRelPath)
          if (audioId) {
            const segmentSlides: any[] = []
            for (const img of ps.images) {
              const id = mediaIdMap.get(img.sourceRelPath)
              if (id) segmentSlides.push(buildImageSlideBlock(id))
            }
            for (const vid of ps.videos) {
              const id = mediaIdMap.get(vid.sourceRelPath)
              if (id) segmentSlides.push(buildVideoSlideBlock(id))
            }

            const fname = spanningAudio.sourceRelPath.slice(
              spanningAudio.sourceRelPath.lastIndexOf('/') + 1,
            )

            const segment = {
              blockType: 'segmentBlock',
              blockName: null,
              name: `Segment - ${fname}`,
              backgroundAudio: audioId,
              loop: false,
              advanceMode: 'slides',
              duration: null,
              slides: segmentSlides,
              bulkMedia: [],
            }

            openSegment = {
              segmentObj: segment,
              remainingSlides: spanningAudio.acrossSlides - 1,
            }
            continue
          }
        }

        const standaloneAudios = ps.audios.filter(a => a.acrossSlides <= 1)
        const hasSegmentMedia = ps.images.length > 0 || ps.videos.length > 0

        if (hasSegmentMedia && standaloneAudios.length > 0) {
          const bgAudio = standaloneAudios[0]
          const audioId = mediaIdMap.get(bgAudio.sourceRelPath)
          if (audioId) {
            const segmentSlides: any[] = []
            for (const img of ps.images) {
              const id = mediaIdMap.get(img.sourceRelPath)
              if (id) segmentSlides.push(buildImageSlideBlock(id))
            }
            for (const vid of ps.videos) {
              const id = mediaIdMap.get(vid.sourceRelPath)
              if (id) segmentSlides.push(buildVideoSlideBlock(id))
            }

            const fname = bgAudio.sourceRelPath.slice(
              bgAudio.sourceRelPath.lastIndexOf('/') + 1,
            )

            slides.push({
              blockType: 'segmentBlock',
              blockName: null,
              name: `Segment - ${fname}`,
              backgroundAudio: audioId,
              loop: false,
              advanceMode: 'slides',
              duration: null,
              slides: segmentSlides,
              bulkMedia: [],
            })
          }
          for (let ai = 1; ai < standaloneAudios.length; ai++) {
            const id = mediaIdMap.get(standaloneAudios[ai].sourceRelPath)
            if (id) slides.push(buildAudioSlideBlock(id))
          }
        } else {
          for (const img of ps.images) {
            const id = mediaIdMap.get(img.sourceRelPath)
            if (id) slides.push(buildImageSlideBlock(id))
          }
          for (const vid of ps.videos) {
            const id = mediaIdMap.get(vid.sourceRelPath)
            if (id) slides.push(buildVideoSlideBlock(id))
          }
          for (const aud of standaloneAudios) {
            const id = mediaIdMap.get(aud.sourceRelPath)
            if (id) slides.push(buildAudioSlideBlock(id))
          }
        }
      }

      if (openSegment) {
        if (openSegment.segmentObj.slides.length > 0) {
          slides.push(openSegment.segmentObj)
        }
      }

      if (slides.length === 0) {
        for (const m of createdMedia) {
          await req.payload.delete({ collection: 'media', id: m.id }).catch(() => {})
        }
        if (mediaFolderId) {
          await req.payload.delete({ collection: 'folders', id: mediaFolderId }).catch(() => {})
        }
        controller.enqueue(ndjson({
          type: 'error',
          message: 'No slides were produced from this file. All media may have been skipped.',
          skipped,
        }))
        controller.close()
        return
      }

      try {
        controller.enqueue(ndjson({ type: 'phase', phase: 'program' }))
        const program = await req.payload.create({
          collection: 'programs',
          data: {
            title: parsed.fileName,
            folder: programsFolderId,
            slides,
            loop: false,
            autoBlackEndSlide: true,
          },
          overrideAccess: true,
          user: req.user,
        })

        if (mediaFolderId) {
          for (const m of createdMedia) {
            try {
              await req.payload.update({
                collection: 'media',
                id: m.id,
                data: { folder: mediaFolderId },
                overrideAccess: true,
                user: req.user,
              })
            } catch (err: any) {
              req.payload.logger.error(
                { mediaId: m.id, folderId: mediaFolderId, err: String(err) },
                '[mediaImportPptx] Failed to assign media folder',
              )
            }
          }
        }

        controller.enqueue(ndjson({
          type: 'result',
          program,
          mediaCreated: createdMedia,
          skipped,
        }))
        controller.close()
      } catch (err: any) {
        req.payload.logger.error(
          { err: String(err) },
          '[mediaImportPptx] Program creation failed',
        )
        for (const m of createdMedia) {
          await req.payload.delete({ collection: 'media', id: m.id }).catch(() => {})
        }
        if (mediaFolderId) {
          await req.payload.delete({ collection: 'folders', id: mediaFolderId }).catch(() => {})
        }
        controller.enqueue(ndjson({
          type: 'error',
          message: 'Failed to create program',
          skipped,
        }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}

export const mediaImportPptx = {
  path: '/import-pptx',
  method: 'post' as const,
  handler: async (req: any): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    let pptxFile: any
    let departmentId: number | undefined

    try {
      const formData = await req.formData()
      pptxFile = formData.get('file')
      const deptVal = formData.get('department')
      if (deptVal) departmentId = parseInt(String(deptVal), 10) || undefined
    } catch {
      return Response.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }

    if (!pptxFile || typeof pptxFile === 'string') {
      return Response.json({ error: 'A .pptx file is required' }, { status: 400 })
    }

    const originalName: string = pptxFile.name || 'presentation.pptx'
    if (!originalName.toLowerCase().endsWith('.pptx')) {
      return Response.json({ error: 'Only .pptx files are supported' }, { status: 400 })
    }

    const fileName = originalName.replace(/\.pptx$/i, '')

    let fileBuffer: Buffer
    try {
      fileBuffer = Buffer.from(await pptxFile.arrayBuffer())
    } catch {
      return Response.json({ error: 'Failed to read uploaded file' }, { status: 400 })
    }

    return processPptxImport(req, fileBuffer, fileName, departmentId)
  },
}

const PPTX_UPLOADS_DIR = path.join(os.tmpdir(), 'pptx-uploads')

async function cleanupStaleUploads() {
  try {
    const entries = await readdir(PPTX_UPLOADS_DIR)
    const now = Date.now()
    const ONE_HOUR = 3600_000

    for (const entry of entries) {
      const entryPath = path.join(PPTX_UPLOADS_DIR, entry)
      try {
        const entryStat = await stat(entryPath)
        if (now - entryStat.mtimeMs > ONE_HOUR) {
          await rm(entryPath, { recursive: true, force: true })
        }
      } catch {
        // skip individual entry errors
      }
    }
  } catch {
    // directory may not exist yet
  }
}

export const mediaImportPptxChunk = {
  path: '/import-pptx-chunk',
  method: 'post' as const,
  handler: async (req: any): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    let chunk: any
    let uploadId: string | undefined
    let chunkIndex: number
    let totalChunks: number
    let fileName: string
    let departmentId: number | undefined

    try {
      const formData = await req.formData()
      chunk = formData.get('chunk')
      uploadId = formData.get('uploadId') ? String(formData.get('uploadId')) : undefined
      chunkIndex = parseInt(String(formData.get('chunkIndex') ?? ''), 10)
      totalChunks = parseInt(String(formData.get('totalChunks') ?? ''), 10)
      fileName = String(formData.get('fileName') ?? '')
      const deptVal = formData.get('department')
      if (deptVal) departmentId = parseInt(String(deptVal), 10) || undefined
    } catch {
      return Response.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }

    if (!chunk || typeof chunk === 'string') {
      return Response.json({ error: 'A chunk file is required' }, { status: 400 })
    }

    if (!uploadId || !UUID_RE.test(uploadId)) {
      return Response.json({ error: 'Invalid uploadId' }, { status: 400 })
    }

    if (!fileName.toLowerCase().endsWith('.pptx')) {
      return Response.json({ error: 'Only .pptx files are supported' }, { status: 400 })
    }

    if (!Number.isFinite(totalChunks) || totalChunks < 1) {
      return Response.json({ error: 'Invalid totalChunks' }, { status: 400 })
    }

    if (!Number.isFinite(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
      return Response.json({ error: 'Invalid chunkIndex' }, { status: 400 })
    }

    await cleanupStaleUploads()

    const uploadDir = path.join(PPTX_UPLOADS_DIR, uploadId)

    try {
      await mkdir(uploadDir, { recursive: true })
      const chunkBuf = Buffer.from(await chunk.arrayBuffer())
      await writeFile(path.join(uploadDir, `chunk.${chunkIndex}`), chunkBuf)
    } catch (err: any) {
      return Response.json({ error: `Failed to store chunk: ${err.message}` }, { status: 500 })
    }

    if (chunkIndex < totalChunks - 1) {
      return Response.json({ ok: true, received: chunkIndex, totalChunks })
    }

    const chunkBaseName = fileName.replace(/\.pptx$/i, '')

    let fileBuffer: Buffer
    try {
      const buffers: Buffer[] = []
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(uploadDir, `chunk.${i}`)
        buffers.push(await readFile(chunkPath))
      }
      fileBuffer = Buffer.concat(buffers)
    } catch (err: any) {
      await rm(uploadDir, { recursive: true, force: true }).catch(() => {})
      return Response.json(
        { error: `Failed to reassemble file: missing or corrupt chunks` },
        { status: 400 },
      )
    }

    try {
      await rm(uploadDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }

    return processPptxImport(req, fileBuffer, chunkBaseName, departmentId)
  },
}

export const mediaImportPptxChunkAbort = {
  path: '/import-pptx-chunk',
  method: 'delete' as const,
  handler: async (req: any): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const url = new URL(req.url)
    const uploadId = url.searchParams.get('uploadId')

    if (!uploadId || !UUID_RE.test(uploadId)) {
      return Response.json({ error: 'Invalid uploadId' }, { status: 400 })
    }

    const uploadDir = path.join(PPTX_UPLOADS_DIR, uploadId)

    try {
      await rm(uploadDir, { recursive: true, force: true })
    } catch {
      // directory may not exist — idempotent
    }

    return Response.json({ ok: true })
  },
}
