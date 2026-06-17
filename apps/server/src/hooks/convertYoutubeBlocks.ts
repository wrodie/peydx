import type { CollectionBeforeChangeHook } from 'payload'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import { parseYouTubeId, downloadYouTubeVideo } from '../utilities/youtubeDownloader'

const execFileAsync = promisify(execFile)

async function processSlides(
  slides: any[],
  req: any,
  logger: any,
): Promise<boolean> {
  let modified = false

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]

    if (slide.blockType === 'segmentBlock' && Array.isArray(slide.slides)) {
      const segModified = await processSlides(slide.slides, req, logger)
      if (segModified) modified = true
    }

    if (slide.blockType !== 'youtubeBlock' || !slide.convertToVideo) continue

    const ytId = parseYouTubeId(slide.youtubeId || '')
    if (!ytId) {
      logger.warn(
        { youtubeId: slide.youtubeId },
        '[convertYoutubeBlocks] Invalid YouTube ID, skipping',
      )
      continue
    }

    logger.info({ youtubeId: ytId }, '[convertYoutubeBlocks] Downloading YouTube video')

    const result = await downloadYouTubeVideo(ytId, logger)
    if (!result) continue

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
      })

      await fs.rm(path.dirname(result.filePath), {
        recursive: true,
        force: true,
      }).catch(() => {})

      slides[i] = {
        blockType: 'videoBlock',
        video: media.id,
        advanceMode: slide.advanceMode || 'onEnd',
        duration: slide.duration || null,
        transition: slide.transition || 'fade',
        loop: slide.loop || false,
      }

      modified = true
      logger.info(
        { youtubeId: ytId, mediaId: media.id },
        '[convertYoutubeBlocks] Successfully converted',
      )
    } catch (err) {
      logger.error(
        { youtubeId: ytId, err: String(err) },
        '[convertYoutubeBlocks] Media creation failed',
      )
      await fs.rm(path.dirname(result.filePath), {
        recursive: true,
        force: true,
      }).catch(() => {})
    }
  }

  return modified
}

export const convertYoutubeBlocks: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
  if (process.env.YOUTUBE_DOWNLOAD_ENABLED !== 'true') return data

  try {
    await execFileAsync('yt-dlp', ['--version'])
  } catch {
    req.payload.logger.warn(
      '[convertYoutubeBlocks] yt-dlp not found — YouTube blocks will use iframe embed',
    )
    return data
  }

  const slides = data.slides
  if (!Array.isArray(slides)) return data

  req.payload.logger.info('[convertYoutubeBlocks] Scanning for YouTube blocks to convert')

  await processSlides(slides, req, req.payload.logger)

  return data
}
