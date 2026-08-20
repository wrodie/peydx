import { mkdir, writeFile, readFile, readdir, rm, stat } from 'fs/promises'
import path from 'path'
import os from 'os'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildImageSlideBlock(mediaId: number) {
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

export function buildVideoSlideBlock(mediaId: number) {
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

export function buildAudioSlideBlock(mediaId: number) {
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

export async function ensureImportFolder(
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

export function ndjson(line: any): Uint8Array {
  return encoder.encode(JSON.stringify(line) + '\n')
}

export interface MediaItem {
  key: string
  buffer: Buffer
  fileName: string
  mimeType: string
  displayName: string
}

export interface StreamImportParams {
  req: any
  fileName: string
  departmentId?: number
  mediaItems: MediaItem[]
  buildSlides: (mediaIdMap: Map<string, number>) => any[]
  skipped?: string[]
}

export async function streamImport(params: StreamImportParams): Promise<Response> {
  const { req, fileName, departmentId, mediaItems, buildSlides } = params
  const skipped: string[] = [...(params.skipped || [])]

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

      const total = mediaItems.length
      let current = 0

      for (const item of mediaItems) {
        current++

        controller.enqueue(ndjson({
          type: 'phase',
          phase: 'media',
          current,
          total,
          name: item.fileName,
        }))

        try {
          const record = await req.payload.create({
            collection: 'media',
            data: { name: item.displayName },
            file: {
              data: item.buffer,
              name: item.fileName,
              mimetype: item.mimeType,
            },
            overrideAccess: true,
            user: req.user,
            context: { skipFolderAutoAssign: true },
          })
          mediaIdMap.set(item.key, record.id)
          createdMedia.push({ id: record.id, name: item.displayName })
        } catch (err: any) {
          req.payload.logger.error(
            { key: item.key, err: String(err) },
            '[streamImport] Media creation failed',
          )
          skipped.push(`Could not create media for ${item.fileName}: ${String(err)}`)
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

      const slides: any[] = buildSlides(mediaIdMap)

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
            title: fileName,
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
                '[streamImport] Failed to assign media folder',
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
          '[streamImport] Program creation failed',
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

export interface ChunkedEndpointOptions {
  uploadsDirName: string
  allowedExt: string
  processImport: (req: any, fileBuffer: Buffer, fileName: string, departmentId?: number) => Promise<Response>
}

export function createChunkedEndpoints(options: ChunkedEndpointOptions): {
  chunkPost: { path: string; method: 'post'; handler: (req: any) => Promise<Response> }
  chunkDelete: { path: string; method: 'delete'; handler: (req: any) => Promise<Response> }
} {
  const { uploadsDirName, allowedExt, processImport } = options
  const ext = allowedExt.replace(/^\./, '')
  const uploadsDir = path.join(os.tmpdir(), uploadsDirName)
  const chunkPath = `/import-${ext}-chunk`

  async function cleanupStaleUploads() {
    try {
      const entries = await readdir(uploadsDir)
      const now = Date.now()
      const ONE_HOUR = 3600_000

      for (const entry of entries) {
        const entryPath = path.join(uploadsDir, entry)
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

  const chunkPost = {
    path: chunkPath,
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

      if (!fileName.toLowerCase().endsWith(allowedExt)) {
        return Response.json({ error: `Only ${allowedExt} files are supported` }, { status: 400 })
      }

      if (!Number.isFinite(totalChunks) || totalChunks < 1) {
        return Response.json({ error: 'Invalid totalChunks' }, { status: 400 })
      }

      if (!Number.isFinite(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
        return Response.json({ error: 'Invalid chunkIndex' }, { status: 400 })
      }

      await cleanupStaleUploads()

      const uploadDir = path.join(uploadsDir, uploadId)

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

      const chunkBaseName = fileName.replace(new RegExp(`${allowedExt.replace(/\./g, '\\.')}$`, 'i'), '')

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

      return processImport(req, fileBuffer, chunkBaseName, departmentId)
    },
  }

  const chunkDelete = {
    path: chunkPath,
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

      const uploadDir = path.join(uploadsDir, uploadId)

      try {
        await rm(uploadDir, { recursive: true, force: true })
      } catch {
        // directory may not exist — idempotent
      }

      return Response.json({ ok: true })
    },
  }

  return { chunkPost, chunkDelete }
}
