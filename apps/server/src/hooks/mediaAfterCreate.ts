import type { CollectionAfterChangeHook } from 'payload'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const mediaAfterCreate: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return
  if (!doc.mimeType?.startsWith('video/')) return
  if (!doc.filename) return

  const inputPath = path.resolve(process.cwd(), 'media', doc.filename)

  ;(async () => {
    const thumbFilename = doc.filename!.replace(/\.[^.]+$/, '_thumb.webp')
    const outputPath = path.resolve(process.cwd(), 'media', thumbFilename)
    try {
      await execFileAsync('ffmpeg', ['-ss', '2', '-i', inputPath, '-vframes', '1', '-vf', 'scale=400:300', outputPath])
    } catch (err) {
      console.error(`Failed to generate video thumbnail for ${doc.filename}:`, err)
    }
  })()
}
