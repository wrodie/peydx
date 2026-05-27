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
  blockType: 'imageBlock' | 'videoBlock'
  image?: Media | number
  video?: Media | number
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

const TRANSITION_DURATION = 500

export default function ProgramPreview() {
  const { id } = useParams<{ id: string }>()
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  }, [program?.slides])

  const prevSlide = useCallback(() => {
    if (!program?.slides?.length) return
    setCurrentIndex((i) => (i > 0 ? i - 1 : program.slides!.length - 1))
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(60px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        .animate-fade {
          animation: fadeIn ${TRANSITION_DURATION}ms ease both;
        }
        .animate-cut {
          opacity: 1;
        }
        .animate-slide {
          animation: slideIn ${TRANSITION_DURATION}ms ease both;
        }
      `}</style>
      <div className="stage">
        <div
          key={currentIndex}
          className={`slide-wrapper animate-${transition}`}
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
            <video
              src={mediaUrl}
              autoPlay
              muted
              playsInline
              onEnded={() => {
                if (slide.advanceMode === 'onEnd') nextSlide()
              }}
              className="foreground"
            />
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
