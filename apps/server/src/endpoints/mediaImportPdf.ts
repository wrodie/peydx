import { parsePdf } from '../utilities/pdfImporter'
import { streamImport, createChunkedEndpoints, buildImageSlideBlock } from '../utilities/importShared'
import type { MediaItem } from '../utilities/importShared'

async function processPdfImport(
  req: any,
  fileBuffer: Buffer,
  fileName: string,
  departmentId?: number,
): Promise<Response> {
  let parsed
  try {
    parsed = await parsePdf(fileBuffer, fileName)
  } catch (err: any) {
    req.payload.logger.error({ err: String(err) }, '[mediaImportPdf] PDF parsing failed')
    return Response.json(
      { error: `Failed to parse PDF: ${err.message || String(err)}` },
      { status: 400 },
    )
  }

  const mediaItems: MediaItem[] = parsed.pages.map((page: any, i: number) => ({
    key: `page-${i}`,
    buffer: page.buffer,
    fileName: page.fileName,
    mimeType: page.mimeType,
    displayName: page.displayName,
  }))

  const buildSlides = (mediaIdMap: Map<string, number>) => {
    const slides: any[] = []
    for (let i = 0; i < parsed.pages.length; i++) {
      const id = mediaIdMap.get(`page-${i}`)
      if (id) slides.push(buildImageSlideBlock(id))
    }
    return slides
  }

  return streamImport({
    req,
    fileName,
    departmentId,
    mediaItems,
    buildSlides,
    skipped: parsed.skipped,
  })
}

export const mediaImportPdf = {
  path: '/import-pdf',
  method: 'post' as const,
  handler: async (req: any): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    let pdfFile: any
    let departmentId: number | undefined

    try {
      const formData = await req.formData()
      pdfFile = formData.get('file')
      const deptVal = formData.get('department')
      if (deptVal) departmentId = parseInt(String(deptVal), 10) || undefined
    } catch {
      return Response.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }

    if (!pdfFile || typeof pdfFile === 'string') {
      return Response.json({ error: 'A .pdf file is required' }, { status: 400 })
    }

    const originalName: string = pdfFile.name || 'presentation.pdf'
    if (!originalName.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'Only .pdf files are supported' }, { status: 400 })
    }

    const fileName = originalName.replace(/\.pdf$/i, '')

    let fileBuffer: Buffer
    try {
      fileBuffer = Buffer.from(await pdfFile.arrayBuffer())
    } catch {
      return Response.json({ error: 'Failed to read uploaded file' }, { status: 400 })
    }

    return processPdfImport(req, fileBuffer, fileName, departmentId)
  },
}

const { chunkPost, chunkDelete } = createChunkedEndpoints({
  uploadsDirName: 'pdf-uploads',
  allowedExt: '.pdf',
  processImport: processPdfImport,
})

export const mediaImportPdfChunk = chunkPost
export const mediaImportPdfChunkAbort = chunkDelete
