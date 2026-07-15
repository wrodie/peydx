export function normalizeSlide(
  slide: any,
  resolveMediaUrl: (url: string) => string = (url) => url,
): any {
  if (slide.blockType === 'segmentBlock') {
    const bgAudio = slide.backgroundAudio
    return {
      blockType: slide.blockType,
      name: slide.name,
      backgroundAudio:
        bgAudio && typeof bgAudio === 'object'
          ? {
              id: bgAudio.id,
              url: bgAudio.url ? resolveMediaUrl(bgAudio.url) : null,
              alt: bgAudio.alt,
              filename: bgAudio.filename,
            }
          : null,
      loop: slide.loop ?? false,
      advanceMode: slide.advanceMode ?? 'slides',
      duration: slide.duration ?? null,
      slides: (slide.slides || []).map((s: any) => normalizeSlide(s, resolveMediaUrl)),
      id: slide.id,
    }
  }

  const result: any = {
    blockType: slide.blockType,
    advanceMode: slide.advanceMode,
    duration: slide.duration,
    transition: slide.transition,
    scaleToFill: slide.scaleToFill,
    loop: slide.loop,
    id: slide.id,
  }

  if (slide.blockType === 'imageBlock' && slide.image && typeof slide.image === 'object') {
    result.image = {
      id: slide.image.id,
      url: slide.image.sizes?.fullHD?.url
        ? resolveMediaUrl(slide.image.sizes.fullHD.url)
        : slide.image.url
          ? resolveMediaUrl(slide.image.url)
          : null,
      alt: slide.image.alt,
      filename: slide.image.filename,
    }
  }
  if (slide.blockType === 'videoBlock' && slide.video && typeof slide.video === 'object') {
    result.video = {
      id: slide.video.id,
      url: slide.video.url ? resolveMediaUrl(slide.video.url) : null,
      alt: slide.video.alt,
      filename: slide.video.filename,
    }
  }
  if (slide.blockType === 'audioBlock' && slide.audio && typeof slide.audio === 'object') {
    result.audio = {
      id: slide.audio.id,
      url: slide.audio.url ? resolveMediaUrl(slide.audio.url) : null,
      alt: slide.audio.alt,
      filename: slide.audio.filename,
    }
  }
  if (slide.blockType === 'youtubeBlock') {
    result.youtubeId = slide.youtubeId
  }

  return result
}
