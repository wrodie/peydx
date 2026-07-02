import type { PayloadHandler } from 'payload'
import path from 'path'
import fs from 'fs'

export const mediaThumbnail: PayloadHandler = async (req) => {
  const mediaId = req.routeParams?.id as string
  if (!mediaId) {
    return Response.json({ error: 'Missing media ID' }, { status: 400 })
  }

  const result = await req.payload.find({
    collection: 'media',
    depth: 0,
    limit: 1,
    where: { id: { equals: mediaId } },
  })

  if (result.docs.length === 0) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const media = result.docs[0]
  if (!media.filename) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const thumbFilename = (media.filename as string).replace(/\.[^.]+$/, '_thumb.webp')
  const thumbPath = path.resolve(process.cwd(), 'media', thumbFilename)

  if (!fs.existsSync(thumbPath)) {
    return Response.json({ error: 'Thumbnail not available' }, { status: 404 })
  }

  const stat = fs.statSync(thumbPath)
  const content = fs.readFileSync(thumbPath)
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
