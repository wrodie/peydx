import { useCallback, useEffect, useRef, useState } from 'react'
import type { Program, Slide } from './types'
import './transitions.css'

const TRANSITION_DURATION = 2500

function resolveMedia(value: { url?: string | null; alt?: string | null } | number | undefined): { url?: string | null; alt?: string | null } | null {
  if (!value) return null
  if (typeof value === 'object') return value
  return null
}

function parseYouTubeId(input: string): string | null {
  const match = input.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ) || input.match(/^([a-zA-Z0-9_-]{11})$/)
  return match ? match[1] : null
}

interface SlideEngineProps {
  program: Program
  onProgramEnd?: () => void
}

export function SlideEngine({ program, onProgramEnd }: SlideEngineProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [videoError, setVideoError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerRef = useRef<any>(null)
  const programRef = useRef(program.id)

  useEffect(() => {
    if (program.id !== programRef.current) {
      programRef.current = program.id
      setCurrentIndex(0)
      setVideoError(null)
      if (timerRef.current) clearTimeout(timerRef.current)
      try { playerRef.current?.destroy() } catch {}
      playerRef.current = null
    }
  }, [program.id])

  const slides = program.slides

  const nextSlide = useCallback(() => {
    if (!slides?.length) return
    setCurrentIndex((i) => {
      if (i < slides.length - 1) return i + 1
      if (onProgramEnd) {
        setTimeout(() => onProgramEnd(), 0)
        return i
      }
      return 0
    })
    setVideoError(null)
  }, [slides, onProgramEnd])

  const prevSlide = useCallback(() => {
    if (!slides?.length) return
    setCurrentIndex((i) => (i > 0 ? i - 1 : slides.length - 1))
    setVideoError(null)
  }, [slides])

  const runSlideLogic = useCallback(
    (slide: Slide | undefined) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (!slide || slide.advanceMode !== 'timed') return
      timerRef.current = setTimeout(nextSlide, (slide.duration || 5) * 1000)
    },
    [nextSlide],
  )

  const currentSlide = slides?.[currentIndex]

  useEffect(() => {
    runSlideLogic(currentSlide)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentSlide, runSlideLogic])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowRight') {
        e.preventDefault()
        nextSlide()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        prevSlide()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextSlide, prevSlide])

  useEffect(() => {
    if (!currentSlide || currentSlide.blockType !== 'youtubeBlock') return

    const ytId = parseYouTubeId(currentSlide.youtubeId || '')
    if (!ytId) return

    const playerId = `yt-player-${currentIndex}`
    let interval: ReturnType<typeof setInterval> | null = null

    function initPlayer() {
      if ((window as any).YT && (window as any).YT.Player) {
        if (interval) clearInterval(interval)
        try { playerRef.current?.destroy() } catch {}
        playerRef.current = new (window as any).YT.Player(playerId, {
          videoId: ytId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            fs: 0,
            playsinline: 1,
          },
          events: {
            onReady: (event: any) => {
              event.target.playVideo()
            },
            onStateChange: (event: any) => {
              if (event.data === (window as any).YT.PlayerState.ENDED && currentSlide.advanceMode === 'onEnd') {
                nextSlide()
              }
            },
          },
        })
      }
    }

    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.onload = () => initPlayer()
      document.head.appendChild(tag)
      interval = setInterval(() => {
        if ((window as any).YT && (window as any).YT.loaded) {
          clearInterval(interval!)
          initPlayer()
        }
      }, 200)
    } else {
      initPlayer()
    }

    return () => {
      if (interval) clearInterval(interval)
      try { playerRef.current?.destroy() } catch {}
      playerRef.current = null
    }
  }, [currentIndex, currentSlide, nextSlide])

  if (!currentSlide) return null

  const transition = currentSlide.transition || 'fade'
  const slideMedia =
    currentSlide.blockType === 'videoBlock'
      ? resolveMedia(currentSlide.video)
      : resolveMedia(currentSlide.image)
  const mediaUrl = slideMedia?.url ?? ''
  const youtubeId = currentSlide.blockType === 'youtubeBlock' ? parseYouTubeId(currentSlide.youtubeId || '') : null
  const youtubeBackdrop = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null

  return (
    <div className="slide-stage">
      <div
        key={currentIndex}
        className="slide-slide-wrapper"
        style={{
          animation:
            transition === 'fade'
              ? `signageFadeIn ${TRANSITION_DURATION}ms ease both`
              : transition === 'slide'
                ? `signageSlideIn ${TRANSITION_DURATION}ms ease both`
                : undefined,
        }}
      >
        {currentSlide.blockType === 'imageBlock' && (
          <>
            <img
              src={mediaUrl}
              className="slide-backdrop"
              alt=""
              aria-hidden="true"
            />
            <img
              src={mediaUrl}
              className="slide-foreground"
              alt={slideMedia?.alt || 'Slide'}
            />
          </>
        )}
        {currentSlide.blockType === 'videoBlock' && (
          <>
            <video
              src={mediaUrl}
              autoPlay
              muted
              playsInline
              onError={() => {
                setVideoError('unknown format')
                if (currentSlide.advanceMode !== 'timed') {
                  setTimeout(nextSlide, 3000)
                }
              }}
              onEnded={() => {
                if (currentSlide.advanceMode === 'onEnd') nextSlide()
              }}
              className="slide-foreground"
              style={{ display: videoError ? 'none' : undefined }}
            />
            {videoError && (
              <div className="slide-video-error">
                <p>This video format is not supported in your browser.</p>
                <p className="slide-video-error-detail">{videoError}</p>
                <p className="slide-video-error-hint">Convert to MP4 (H.264) for best compatibility, or use a YouTube link.</p>
              </div>
            )}
          </>
        )}
        {currentSlide.blockType === 'youtubeBlock' && youtubeId && (
          <>
            {youtubeBackdrop && (
              <img
                src={youtubeBackdrop}
                className="slide-backdrop"
                alt=""
                aria-hidden="true"
              />
            )}
            <div
              id={`yt-player-${currentIndex}`}
              className="slide-youtube-embed"
            />
          </>
        )}
      </div>
      {slides && slides.length > 1 && (
        <div className="slide-slide-indicator">
          {currentIndex + 1} / {slides.length}
        </div>
      )}
    </div>
  )
}
