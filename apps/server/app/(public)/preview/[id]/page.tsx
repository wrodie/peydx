'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Media {
  id: number
  url?: string | null
  filename?: string | null
  alt?: string | null
}

interface Slide {
  blockType: 'imageBlock' | 'videoBlock' | 'youtubeBlock'
  image?: Media | number
  video?: Media | number
  youtubeId?: string | null
  advanceMode: 'timed' | 'manual' | 'onEnd'
  duration?: number | null
  transition?: 'fade' | 'cut' | 'slide' | null
  id?: string | null
}

interface Program {
  id: number
  title: string
  slides?: Slide[] | null
}

function resolveMedia(value: Media | number | undefined): Media | null {
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

const TRANSITION_DURATION = 2500

export default function ProgramPreview() {
  const { id } = useParams<{ id: string }>()
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerRef = useRef<any>(null)
  const [videoError, setVideoError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/programs/${id}?depth=2`)
      .then((r) => {
        if (!r.ok) throw new Error('Program not found')
        return r.json()
      })
      .then((data) => {
        setProgram(data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [id])

  const nextSlide = useCallback(() => {
    if (!program?.slides?.length) return
    setCurrentIndex((i) => (i < program.slides!.length - 1 ? i + 1 : 0))
    setVideoError(null)
  }, [program?.slides])

  const prevSlide = useCallback(() => {
    if (!program?.slides?.length) return
    setCurrentIndex((i) => (i > 0 ? i - 1 : program.slides!.length - 1))
    setVideoError(null)
  }, [program?.slides])

  const runSlideLogic = useCallback(
    (slide: Slide | undefined) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (!slide || slide.advanceMode !== 'timed') return
      timerRef.current = setTimeout(nextSlide, (slide.duration || 5) * 1000)
    },
    [nextSlide],
  )

  const currentSlide = program?.slides?.[currentIndex]

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
      if (window.YT && window.YT.Player) {
        interval && clearInterval(interval)
        try {
          playerRef.current?.destroy()
        } catch {}
        playerRef.current = new window.YT.Player(playerId, {
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
              if (event.data === window.YT.PlayerState.ENDED && currentSlide.advanceMode === 'onEnd') {
                nextSlide()
              }
            },
          },
        })
      }
    }

    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.onload = () => initPlayer()
      document.head.appendChild(tag)
      interval = setInterval(() => {
        if (window.YT && window.YT.loaded) {
          clearInterval(interval!)
          initPlayer()
        }
      }, 200)
    } else {
      initPlayer()
    }

    return () => {
      if (interval) clearInterval(interval)
      try {
        playerRef.current?.destroy()
      } catch {}
      playerRef.current = null
    }
  }, [currentIndex, currentSlide, nextSlide])

  if (loading) {
    return (
      <div className="stage">
        <div className="status-text">Loading program...</div>
      </div>
    )
  }

  if (error || !program) {
    return (
      <div className="stage">
        <div className="status-text error">{error || 'Program not found'}</div>
      </div>
    )
  }

  if (!program.slides?.length) {
    return (
      <div className="stage">
        <div className="status-text error">This program has no slides.</div>
      </div>
    )
  }

  const slide = currentSlide!
  const transition = slide.transition || 'fade'
  const slideMedia =
    slide.blockType === 'videoBlock'
      ? resolveMedia(slide.video)
      : resolveMedia(slide.image)
  const mediaUrl = slideMedia?.url ?? ''
  const youtubeId = slide.blockType === 'youtubeBlock' ? parseYouTubeId(slide.youtubeId || '') : null
  const youtubeBackdrop = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null

  return (
    <>
      <style precedence="default" href="program-preview">{`
        .stage {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: black;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .status-text {
          color: #888;
          font-size: 1.25rem;
          font-family: system-ui, sans-serif;
        }
        .status-text.error {
          color: #c44;
        }
        .slide-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 110%;
          height: 110%;
          object-fit: cover;
          filter: blur(30px) brightness(0.5);
          z-index: 1;
        }
        .foreground {
          position: relative;
          z-index: 2;
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .youtube-embed {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .youtube-embed iframe {
          width: 100vw !important;
          height: 56.25vw !important;
          max-height: 100vh !important;
          max-width: 177.78vh !important;
          border: none !important;
        }
        .video-error {
          color: rgba(255,255,255,0.7);
          font-family: system-ui, sans-serif;
          text-align: center;
          padding: 2rem;
          z-index: 2;
        }
        .video-error p {
          margin: 0.5rem 0;
        }
        .video-error-detail {
          font-size: 0.8rem;
          opacity: 0.5;
        }
        .video-error-hint {
          font-size: 0.85rem;
          color: #f1c40f;
        }
        .slide-indicator {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 3;
          color: rgba(255,255,255,0.6);
          font-family: system-ui, sans-serif;
          font-size: 0.8rem;
          background: rgba(0,0,0,0.5);
          padding: 4px 12px;
          border-radius: 12px;
        }
        @keyframes previewFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes previewSlideIn {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div className="stage">
        <div
          key={currentIndex}
          className="slide-wrapper"
          style={{
            animation:
              transition === 'fade'
                ? `previewFadeIn ${TRANSITION_DURATION}ms ease both`
                : transition === 'slide'
                  ? `previewSlideIn ${TRANSITION_DURATION}ms ease both`
                  : undefined,
          }}
        >
          {slide.blockType === 'imageBlock' && (
            <>
              <img
                src={mediaUrl}
                className="backdrop"
                alt=""
                aria-hidden="true"
              />
              <img
                src={mediaUrl}
                className="foreground"
                alt={slideMedia?.alt || 'Slide'}
              />
            </>
          )}
          {slide.blockType === 'videoBlock' && (
            <>
              <video
                src={mediaUrl}
                autoPlay
                muted
                playsInline
                onError={() => {
                  setVideoError(slideMedia?.mimeType || 'unknown format')
                  if (slide.advanceMode !== 'timed') {
                    setTimeout(nextSlide, 3000)
                  }
                }}
                onEnded={() => {
                  if (slide.advanceMode === 'onEnd') nextSlide()
                }}
                className="foreground"
                style={{ display: videoError ? 'none' : undefined }}
              />
              {videoError && (
                <div className="video-error">
                  <p>This video format is not supported in your browser.</p>
                  <p className="video-error-detail">{videoError}</p>
                  <p className="video-error-hint">Convert to MP4 (H.264) for best compatibility, or use a YouTube link.</p>
                </div>
              )}
            </>
          )}
          {slide.blockType === 'youtubeBlock' && youtubeId && (
            <>
              {youtubeBackdrop && (
                <img
                  src={youtubeBackdrop}
                  className="backdrop"
                  alt=""
                  aria-hidden="true"
                />
              )}
              <div
                id={`yt-player-${currentIndex}`}
                className="youtube-embed"
              />
            </>
          )}
        </div>
        {program.slides.length > 1 && (
          <div className="slide-indicator">
            {currentIndex + 1} / {program.slides.length}
          </div>
        )}
      </div>
    </>
  )
}
