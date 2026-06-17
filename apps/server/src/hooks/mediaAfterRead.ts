import type { CollectionAfterReadHook } from 'payload'
import path from 'path'
import fs from 'fs'

export const mediaAfterRead: CollectionAfterReadHook = ({ doc }) => {
  if (doc.mimeType?.startsWith('video/') && doc.filename) {
    const thumbFilename = doc.filename.replace(/\.[^.]+$/, '_thumb.webp')
    const thumbPath = path.resolve(process.cwd(), 'media', thumbFilename)
    if (fs.existsSync(thumbPath)) {
      const thumbUrl = `/api/media/file/${encodeURIComponent(thumbFilename)}`
      doc.thumbnailURL = thumbUrl
      doc.sizes = {
        ...doc.sizes,
        thumbnail: {
          url: thumbUrl,
        },
      }
    }
  }
  return doc
}
