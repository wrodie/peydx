import { parsePptx } from '../utilities/pptxImporter'
import type { SlideMedia } from '../utilities/pptxImporter'

function buildImageSlideBlock(mediaId: number) {
  return {
    blockType: 'imageBlock',
    blockName: null,
    image: mediaId,
    advanceMode: 'manual',
    transition: 'fade',
    duration: null,
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
  logger: any,
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
    logger.info(
      { deptId: deptIds[0], type },
      '[ensureImportFolder] Finding root folder by department',
    )
  } else {
    rootFolderQuery.where.type = { equals: type }
    logger.info(
      { type, role: (user as any).role },
      '[ensureImportFolder] No departments — finding root folder by type only',
    )
  }

  const rootFolders = await payload.find(rootFolderQuery)

  if (!rootFolders.docs?.[0]) {
    logger.info(
      { query: rootFolderQuery.where },
      '[ensureImportFolder] No root folder found',
    )
    return undefined
  }

  const rootId = rootFolders.docs[0].id
  logger.info(
    { rootId, rootName: rootFolders.docs[0].name, type },
    '[ensureImportFolder] Found root folder',
  )

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

  if (existing.docs?.[0]) {
    logger.info(
      { folderId: existing.docs[0].id, name, type },
      '[ensureImportFolder] Reusing existing subfolder',
    )
    return existing.docs[0].id
  }

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

  logger.info(
    { folderId: folder.id, name, type },
    '[ensureImportFolder] Created subfolder',
  )

  return folder.id
}

const encoder = new TextEncoder()

function ndjson(line: any): Uint8Array {
  return encoder.encode(JSON.stringify(line) + '\n')
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

    const [mediaFolderId, programsFolderId] = await Promise.all([
      ensureImportFolder(req.payload, req.payload.logger, fileName, 'media', req.user, departmentId),
      ensureImportFolder(req.payload, req.payload.logger, fileName, 'programs', req.user, departmentId),
    ])

    req.payload.logger.info(
      { mediaFolderId, programsFolderId, userRole: (req.user as any)?.role },
      '[mediaImportPptx] Folder setup complete',
    )

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
          if (programsFolderId) {
            await req.payload.delete({ collection: 'folders', id: programsFolderId }).catch(() => {})
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
            const childSlides: any[] = []
            for (const img of ps.images) {
              const id = mediaIdMap.get(img.sourceRelPath)
              if (id) childSlides.push(buildImageSlideBlock(id))
            }
            for (const vid of ps.videos) {
              const id = mediaIdMap.get(vid.sourceRelPath)
              if (id) childSlides.push(buildVideoSlideBlock(id))
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

          for (const img of ps.images) {
            const id = mediaIdMap.get(img.sourceRelPath)
            if (id) slides.push(buildImageSlideBlock(id))
          }
          for (const vid of ps.videos) {
            const id = mediaIdMap.get(vid.sourceRelPath)
            if (id) slides.push(buildVideoSlideBlock(id))
          }
          for (const aud of ps.audios) {
            if (aud.acrossSlides <= 1) {
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
          if (programsFolderId) {
            await req.payload.delete({ collection: 'folders', id: programsFolderId }).catch(() => {})
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
              folder: programsFolderId || undefined,
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
                req.payload.logger.info(
                  { mediaId: m.id, folderId: mediaFolderId },
                  '[mediaImportPptx] Assigned media folder',
                )
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
          if (programsFolderId) {
            await req.payload.delete({ collection: 'folders', id: programsFolderId }).catch(() => {})
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
  },
}
