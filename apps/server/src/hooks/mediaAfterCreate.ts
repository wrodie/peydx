import type { CollectionAfterChangeHook } from 'payload'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const mediaAfterCreate: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return
  if (!doc.mimeType?.startsWith('video/') && !doc.mimeType?.startsWith('audio/')) return
  if (!doc.filename) return

  const inputPath = path.resolve(process.cwd(), 'media', doc.filename)

  if (doc.mimeType?.startsWith('video/')) {
    const thumbFilename = doc.filename.replace(/\.[^.]+$/, '_thumb.webp')
    const outputPath = path.resolve(process.cwd(), 'media', thumbFilename)
    try {
      await execFileAsync('ffmpeg', ['-ss', '2', '-i', inputPath, '-vframes', '1', '-vf', 'scale=400:300', outputPath])
    } catch (err) {
      console.error(`Failed to generate video thumbnail for ${doc.filename}:`, err)
    }
  }

  try {
    const { stdout } = await execFileAsync(
      'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', inputPath],
    )
    const durationSeconds = parseFloat(stdout.trim())
    if (!isNaN(durationSeconds) && durationSeconds > 0) {
      await req.payload.update({
        collection: 'media',
        id: doc.id,
        data: { duration: Math.round(durationSeconds) },
        req,
      })
    }
  } catch (err) {
    console.error(`Failed to extract duration for ${doc.filename}:`, err)
  }
}
