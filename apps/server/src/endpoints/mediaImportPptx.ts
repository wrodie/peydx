import { parsePptx } from '../utilities/pptxImporter'
import type { SlideMedia } from '../utilities/pptxImporter'
import {
  streamImport,
  createChunkedEndpoints,
  buildImageSlideBlock,
  buildVideoSlideBlock,
  buildAudioSlideBlock,
} from '../utilities/importShared'
import type { MediaItem } from '../utilities/importShared'

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

  const allMedia = new Map<string, SlideMedia>()
  for (const slide of parsed.slides) {
    for (const m of [...slide.images, ...slide.videos, ...slide.audios]) {
      if (!allMedia.has(m.sourceRelPath)) {
        allMedia.set(m.sourceRelPath, m)
      }
    }
  }

  const mediaItems: MediaItem[] = []
  for (const [relPath, media] of allMedia) {
    const lastSlash = relPath.lastIndexOf('/')
    const fname = lastSlash === -1 ? relPath : relPath.slice(lastSlash + 1)

    const mediaName = (media.shapeName && media.kind !== 'image')
      ? `${parsed.fileName} - ${media.shapeName}`
      : `${parsed.fileName} - ${fname}`

    mediaItems.push({
      key: relPath,
      buffer: media.buffer,
      fileName: fname,
      mimeType: media.mimeType,
      displayName: mediaName,
    })
  }

  const buildSlides = (mediaIdMap: Map<string, number>) => {
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

    return slides
  }

  return streamImport({
    req,
    fileName,
    departmentId,
    mediaItems,
    buildSlides,
    skipped,
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

const { chunkPost, chunkDelete } = createChunkedEndpoints({
  uploadsDirName: 'pptx-uploads',
  allowedExt: '.pptx',
  processImport: processPptxImport,
})

export const mediaImportPptxChunk = chunkPost
export const mediaImportPptxChunkAbort = chunkDelete
