import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import type { Program, Slide, SegmentContext, KeyConfig } from './types'
import { flattenProgram } from './flattenProgram'
import { mergeKeyConfig, normalizeKeyCode } from './keyConfig'
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

export interface SlideEngineHandle {
  nextSlide: () => void
  prevSlide: () => void
  gotoSlide: (index: number) => void
  getCurrentIndex: () => number
  getProgramId: () => number | undefined
  getMediaElements: () => { video: HTMLVideoElement | null; audio: HTMLAudioElement | null; youtubePlayer: any }
}

interface SlideEngineProps {
  program: Program
  onProgramEnd?: () => void
  onSlideChange?: (index: number) => void
  initialSlideIndex?: number
  keyConfig?: Partial<KeyConfig>
}

function findSegmentStartIndex(slides: Slide[], currentIndex: number, segCtx?: SegmentContext | null): number {
  if (!segCtx) return 0
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (slides[i]?.segmentContext?.segmentId !== segCtx.segmentId) return i + 1
  }
  return 0
}

function getSegmentEndIndex(slides: Slide[], currentIndex: number, segCtx?: SegmentContext | null): number {
  if (!segCtx) return slides.length - 1
  for (let i = currentIndex + 1; i < slides.length; i++) {
    if (slides[i]?.segmentContext?.segmentId !== segCtx.segmentId) return i - 1
  }
  return slides.length - 1
}

export const SlideEngine = forwardRef<SlideEngineHandle, SlideEngineProps>(
  ({ program, onProgramEnd, onSlideChange, initialSlideIndex, keyConfig: userKeyConfig }, ref) => {
    const keys = mergeKeyConfig(userKeyConfig)
    const flattened = useMemo(() => flattenProgram(program), [program])

    const [currentIndex, setCurrentIndex] = useState(initialSlideIndex ?? 0)
    const [videoError, setVideoError] = useState<string | null>(null)
    const [isEnded, setIsEnded] = useState(false)
    const [segmentLoopKey, setSegmentLoopKey] = useState(0)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const playerRef = useRef<any>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const bgAudioRef = useRef<HTMLAudioElement>(null)
    const prevSegmentIdRef = useRef<string | null>(null)
    const programRef = useRef(program.id)
    const prevProgramIdRef = useRef(program.id)

    useEffect(() => {
      if (program.id !== prevProgramIdRef.current) {
        prevProgramIdRef.current = program.id
        programRef.current = program.id
        setCurrentIndex(initialSlideIndex ?? 0)
        setVideoError(null)
        setIsEnded(false)
        setSegmentLoopKey(0)
        prevSegmentIdRef.current = null
        if (timerRef.current) clearTimeout(timerRef.current)
        if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current)
        try { playerRef.current?.destroy() } catch {}
        playerRef.current = null
        if (bgAudioRef.current) {
          bgAudioRef.current.pause()
          bgAudioRef.current.src = ''
        }
      }
    }, [program.id, initialSlideIndex])

    const slides = flattened.slides

    const currentSlide = slides[currentIndex]
    const segCtx = currentSlide?.segmentContext

    const isLastSlideInSegment = segCtx
      ? getSegmentEndIndex(slides, currentIndex, segCtx) === currentIndex
      : false

    const isLastSlide = slides.length > 0 && currentIndex >= slides.length - 1
    const effectiveProgramEnd = isLastSlide && (!segCtx || !(segCtx.loop || segCtx.advanceMode === 'manual'))

    useLayoutEffect(() => {
      if (!slides?.length || !onProgramEnd) {
        if (isEnded) setIsEnded(false)
        return
      }
      if (effectiveProgramEnd) {
        if (!isEnded) setIsEnded(true)
      } else if (isEnded) {
        setIsEnded(false)
      }
    }, [effectiveProgramEnd, isEnded, slides, onProgramEnd])

    const doNextSlide = useCallback(() => {
      if (isEnded) {
        onProgramEnd?.()
        return
      }
      if (!slides?.length) return

      const slide = slides[currentIndex]
      const ctx = slide?.segmentContext

      if (ctx) {
        if (isLastSlideInSegment && ctx.loop) {
          setCurrentIndex(findSegmentStartIndex(slides, currentIndex, ctx))
          setSegmentLoopKey((k) => k + 1)
          setVideoError(null)
          return
        }
        if (isLastSlideInSegment && ctx.advanceMode === 'manual') {
          return
        }
        if (isLastSlideInSegment && ctx.advanceMode === 'timed') {
          return
        }
      }

      if (currentIndex < slides.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else if (!onProgramEnd) {
        setCurrentIndex(0)
      }
      setVideoError(null)
    }, [slides, onProgramEnd, isEnded, currentIndex, isLastSlideInSegment])

    const doPrevSlide = useCallback(() => {
      if (isEnded || !slides?.length) return
      setCurrentIndex((i) => (i > 0 ? i - 1 : slides.length - 1))
      setVideoError(null)
    }, [slides, isEnded])

    const gotoSlide = useCallback((index: number) => {
      if (slides && index >= 0 && index < slides.length) {
        setCurrentIndex(index)
        setVideoError(null)
      }
    }, [slides])

    useImperativeHandle(ref, () => ({
      nextSlide: doNextSlide,
      prevSlide: doPrevSlide,
      gotoSlide,
      getCurrentIndex: () => currentIndex,
      getProgramId: () => program.id,
      getMediaElements: () => ({
        video: videoRef.current,
        audio: audioRef.current,
        youtubePlayer: playerRef.current,
      }),
    }), [doNextSlide, doPrevSlide, gotoSlide, currentIndex, program.id])

    useEffect(() => {
      onSlideChange?.(currentIndex)
    }, [currentIndex, onSlideChange])

    const runSlideLogic = useCallback(
      (slide: Slide | undefined) => {
        if (timerRef.current) clearTimeout(timerRef.current)
        if (!slide || slide.advanceMode !== 'timed') return
        timerRef.current = setTimeout(doNextSlide, (slide.duration || 5) * 1000)
      },
      [doNextSlide],
    )

    useEffect(() => {
      runSlideLogic(currentSlide)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }, [currentSlide, runSlideLogic])

    // Background audio management
    useEffect(() => {
      const newSegId = segCtx?.segmentId ?? null

      if (newSegId !== prevSegmentIdRef.current) {
        // Leaving previous segment
        if (prevSegmentIdRef.current && bgAudioRef.current) {
          bgAudioRef.current.pause()
          bgAudioRef.current.src = ''
        }

        // Entering new segment with background audio
        if (newSegId && segCtx?.backgroundAudio?.url && bgAudioRef.current) {
          bgAudioRef.current.src = segCtx.backgroundAudio.url
          bgAudioRef.current.load()
          bgAudioRef.current.play().catch(() => {})
        }

        prevSegmentIdRef.current = newSegId
      } else if (segmentLoopKey > 0 && newSegId && segCtx?.backgroundAudio?.url && bgAudioRef.current) {
        // Segment looped, restart background audio
        bgAudioRef.current.pause()
        bgAudioRef.current.load()
        bgAudioRef.current.currentTime = 0
        bgAudioRef.current.play().catch(() => {})
      }
    }, [segCtx, segmentLoopKey])

    // Segment timer for 'timed' advance mode
    useEffect(() => {
      if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current)

      if (segCtx?.advanceMode === 'timed' && segCtx?.duration) {
        const durationMs = segCtx.duration * 60 * 1000
        segmentTimerRef.current = setTimeout(() => {
          // Find the index just after this segment
          const endIdx = getSegmentEndIndex(slides, currentIndex, segCtx)
          if (endIdx < slides.length - 1) {
            setCurrentIndex(endIdx + 1)
          } else if (!onProgramEnd) {
            setCurrentIndex(0)
          }
        }, durationMs)
      }

      return () => {
        if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current)
      }
    }, [currentIndex, slides, segCtx, onProgramEnd, segmentLoopKey])

    useEffect(() => {
      const nextCodes = normalizeKeyCode(keys.next)
      const prevCodes = normalizeKeyCode(keys.prev)
      const handler = (e: KeyboardEvent) => {
        if (nextCodes.includes(e.code)) {
          e.preventDefault()
          doNextSlide()
        } else if (prevCodes.includes(e.code)) {
          e.preventDefault()
          doPrevSlide()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [doNextSlide, doPrevSlide, keys.next, keys.prev])

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
              origin: window.location.origin,
            },
            events: {
              onReady: (event: any) => {
                event.target.playVideo()
              },
              onStateChange: (event: any) => {
                if (event.data === (window as any).YT.PlayerState.ENDED) {
                  if (currentSlide?.loop) {
                    event.target.playVideo()
                  } else if (currentSlide?.advanceMode === 'onEnd') {
                    doNextSlide()
                  }
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
    }, [currentIndex, currentSlide, doNextSlide])

    if (!currentSlide) return null

    const transition = currentSlide.transition || 'fade'
    const slideMedia =
      currentSlide.blockType === 'videoBlock'
        ? resolveMedia(currentSlide.video)
        : currentSlide.blockType === 'audioBlock'
          ? resolveMedia(currentSlide.audio)
          : resolveMedia(currentSlide.image)
    const mediaUrl = slideMedia?.url ?? ''
    const youtubeId = currentSlide.blockType === 'youtubeBlock' ? parseYouTubeId(currentSlide.youtubeId || '') : null
    const youtubeBackdrop = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null

    return (
      <div className="slide-stage">
        <audio ref={bgAudioRef} style={{ display: 'none' }} loop />
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
            opacity: transition !== 'fade' && transition !== 'slide' ? 1 : undefined,
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
                ref={videoRef}
                src={mediaUrl}
                autoPlay
                muted
                disableRemotePlayback
                playsInline
                loop={currentSlide.loop || false}
                onError={() => {
                  setVideoError('unknown format')
                  if (currentSlide.advanceMode !== 'timed') {
                    setTimeout(doNextSlide, 3000)
                  }
                }}
                onEnded={() => {
                  if (!currentSlide.loop && currentSlide.advanceMode === 'onEnd') doNextSlide()
                }}
                onPlaying={(e) => {
                  e.currentTarget.muted = false
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
          {currentSlide.blockType === 'blackScreenBlock' && (
            <div className="slide-stage" style={{ background: '#000' }} />
          )}
          {currentSlide.blockType === 'audioBlock' && (
            <>
              <audio
                ref={audioRef}
                src={mediaUrl}
                autoPlay
                muted
                playsInline
                loop={currentSlide.loop || false}
                onEnded={() => {
                  if (!currentSlide.loop && currentSlide.advanceMode === 'onEnd') doNextSlide()
                }}
                onPlaying={(e) => {
                  e.currentTarget.muted = false
                }}
              />
              <div
                className="slide-stage"
                style={{
                  background: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  className="slide-audio-icon"
                  viewBox="0 0 24 24"
                  fill="white"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M3 9v6h4l5 5V4L7 9H3zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              </div>
            </>
          )}
        </div>
        {isEnded && (
          <div
            key="end-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              background: 'black',
              animation: `signageFadeIn ${TRANSITION_DURATION}ms ease both`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: 'white', fontSize: '1.875rem', fontFamily: 'system-ui, sans-serif', opacity: 0.6, paddingBottom: '20px' }}>
              End of program — press Menu to exit
            </span>
          </div>
        )}
        {slides && slides.length > 1 && (
          <div className="slide-slide-indicator">
            {currentIndex + 1} / {slides.length}
          </div>
        )}
      </div>
    )
  }
)
