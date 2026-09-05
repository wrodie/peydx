'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'
import { useEffect, useState, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'
import { flattenProgram } from 'signage-core'
import { getMediaUrl, getBlockIcon } from '../utilities/ui/slideMedia'

export function DeviceSlideStatus() {
  const { id } = useDocumentInfo()
  const { value: currentProgram } = useField({ path: 'currentProgram' })
  const [slideData, setSlideData] = useState<any>(null)
  const [displaySlideIndex, setDisplaySlideIndex] = useState(0)
  const slideDataRef = useRef<any>(null)

  // Fetch program data when currentProgram changes
  useEffect(() => {
    if (!currentProgram) {
      setSlideData(null)
      return
    }
    const programId = typeof currentProgram === 'object' && currentProgram !== null ? (currentProgram as any).id : currentProgram
    fetch(`/api/programs/${programId}?depth=2`)
      .then(r => r.json())
      .then(data => {
        setSlideData(data)
        slideDataRef.current = data
      })
      .catch(console.error)
  }, [currentProgram])

  // Socket.IO for real-time updates
  useEffect(() => {
    const socket = io(window.location.origin, { path: '/api/ws' }) as Socket<ServerToClientEvents, ClientToServerEvents>

    socket.on('device:status', (data: any) => {
      if (data.id !== id) return

      setDisplaySlideIndex(data.slideIndex)

      if (data.programId && data.programId !== (slideDataRef.current?.id ?? null)) {
        fetch(`/api/programs/${data.programId}?depth=2`)
          .then(r => r.json())
          .then(d => {
            setSlideData(d)
            slideDataRef.current = d
          })
          .catch(console.error)
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [id])

  const flatSlides = slideData ? flattenProgram(slideData).slides : []

  if (!slideData || flatSlides.length === 0) {
    return (
      <div style={{ padding: '12px 0' }}>
        <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--theme-elevation-500, #666)', marginBottom: 4, display: 'block' }}>
          Current Slide
        </label>
        <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500, #888)' }}>No slides available</div>
      </div>
    )
  }

  const idx = displaySlideIndex
  const currentSlide = flatSlides[idx] || flatSlides[0]
  const thumbnailUrl = getMediaUrl(currentSlide)
  const blockIcon = getBlockIcon(currentSlide?.blockType)

  return (
    <div style={{ padding: '12px 0' }}>
      <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--theme-elevation-500, #666)', marginBottom: 4, display: 'block' }}>
        Current Slide
      </label>
      <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>Slide {idx + 1} of {flatSlides.length}{(currentSlide?.blockType === 'videoBlock' ? ' (video)' : currentSlide?.blockType === 'youtubeBlock' ? ' (YouTube)' : '')}</div>
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={`Slide ${idx + 1}`} style={{ maxWidth: '100%', borderRadius: 4 }} />
      ) : blockIcon ? (
        <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--theme-elevation-100, #f0f0f0)', borderRadius: 4, fontSize: '1.5rem' }}>
          {blockIcon}
        </div>
      ) : null}
    </div>
  )
}
