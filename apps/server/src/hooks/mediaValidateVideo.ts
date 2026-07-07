import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import path from 'path'
import os from 'os'
import { writeFile, unlink } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const mediaValidateVideo: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return
  if (!data?.mimeType?.startsWith('video/')) return
  if (!data?.filename) return
  if (!req.file?.data) return

  const tmpPath = path.resolve(os.tmpdir(), `vid-probe-${Date.now()}-${data.filename}`)

  try {
    await writeFile(tmpPath, req.file.data)

    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      tmpPath,
    ])

    const codecName = stdout.trim()
    if (codecName && codecName !== 'h264') {
      throw new APIError(
        `This video is encoded with an unsupported codec: ${codecName}. ` +
        'Please re-encode it to H.264 before uploading.',
        400
      )
    }
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}
