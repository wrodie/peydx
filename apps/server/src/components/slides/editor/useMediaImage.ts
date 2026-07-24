import { useState, useEffect } from 'react'

const imageCache = new Map<number, { url: string; image: HTMLImageElement }>()

export { imageCache }

export function useMediaImage(mediaId: number | undefined): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>(
    mediaId ? imageCache.get(mediaId)?.image : undefined,
  )

  useEffect(() => {
    if (!mediaId) {
      setImage(undefined)
      return
    }

    const cached = imageCache.get(mediaId)
    if (cached) {
      setImage(cached.image)
      return
    }

    let cancelled = false

    fetch(`/api/media/${mediaId}`)
      .then((res) => res.json())
      .then((media) => {
        if (cancelled) return
        const url = `/api/media/file/${media.filename}`
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.src = url
        img.onload = () => {
          if (!cancelled) {
            imageCache.set(mediaId, { url, image: img })
            setImage(img)
          }
        }
      })
      .catch(() => {
        // Media not found or network error — silently fail
      })

    return () => {
      cancelled = true
    }
  }, [mediaId])

  return image
}
