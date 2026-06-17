import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import { parseYouTubeId, downloadYouTubeVideo } from '../utilities/youtubeDownloader'

const execFileAsync = promisify(execFile)

export const mediaImportYoutube = {
  path: '/import-youtube',
  method: 'post' as const,
  handler: async (req: any) => {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (process.env.YOUTUBE_DOWNLOAD_ENABLED !== 'true') {
      return Response.json(
        { error: 'YouTube download is not enabled on this server' },
        { status: 400 },
      )
    }

    let body: { url?: string } = {}
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const url = body.url
    if (!url) {
      return Response.json({ error: 'url is required' }, { status: 400 })
    }

    const ytId = parseYouTubeId(url)
    if (!ytId) {
      return Response.json({ error: 'Invalid YouTube URL or video ID' }, { status: 400 })
    }

    try {
      await execFileAsync('yt-dlp', ['--version'])
    } catch {
      return Response.json(
        { error: 'yt-dlp is not installed on the server' },
        { status: 500 },
      )
    }

    const result = await downloadYouTubeVideo(ytId, req.payload.logger)
    if (!result) {
      return Response.json(
        { error: 'Failed to download YouTube video' },
        { status: 500 },
      )
    }

    try {
      const fileBuffer = await fs.readFile(result.filePath)

      const media = await req.payload.create({
        collection: 'media',
        data: {
          name: result.title || `YouTube - ${ytId}`,
        },
        file: {
          data: fileBuffer,
          name: `yt-${ytId}.mp4`,
          mimetype: 'video/mp4',
        },
        overrideAccess: true,
        user: req.user,
      })

      await fs.rm(path.dirname(result.filePath), {
        recursive: true,
        force: true,
      }).catch(() => {})

      return Response.json(media)
    } catch (err: any) {
      req.payload.logger.error(
        { youtubeId: ytId, err: String(err) },
        '[mediaImportYoutube] Media creation failed',
      )
      await fs.rm(path.dirname(result.filePath), {
        recursive: true,
        force: true,
      }).catch(() => {})
      return Response.json(
        { error: 'Failed to create media entry' },
        { status: 500 },
      )
    }
  },
}
