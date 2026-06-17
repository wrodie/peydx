import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

const execFileAsync = promisify(execFile)

export function parseYouTubeId(input: string): string | null {
  const match = input.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ) || input.match(/^([a-zA-Z0-9_-]{11})$/)
  return match ? match[1] : null
}

export async function downloadYouTubeVideo(
  youtubeId: string,
  logger: any,
): Promise<{ filePath: string; title: string } | null> {
  const url = `https://www.youtube.com/watch?v=${youtubeId}`
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-'))
  const outputPath = path.join(tempDir, `${youtubeId}.mp4`)

  try {
    const { stdout: titleOut } = await execFileAsync('yt-dlp', [
      '--get-title',
      url,
    ])
    const videoTitle = titleOut.trim()

    await execFileAsync('yt-dlp', [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4',
      '-o', outputPath,
      url,
    ])

    const stat = await fs.stat(outputPath)
    if (stat.size === 0) {
      logger.warn({ youtubeId }, '[youtubeDownloader] Downloaded file is empty')
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      return null
    }

    return { filePath: outputPath, title: videoTitle }
  } catch (err) {
    logger.error({ youtubeId, err: String(err) }, '[youtubeDownloader] Download failed')
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    return null
  }
}
