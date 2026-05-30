'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'
import { useEffect, useState, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

function getMediaUrl(slide: any): string | null {
  if (slide.blockType === 'imageBlock' && slide.image) {
    const img = typeof slide.image === 'object' ? slide.image : null
    if (!img) return null
    return img.sizes?.thumbnail?.url || img.url || null
  }
  if (slide.blockType === 'videoBlock') {
    return null
  }
  if (slide.blockType === 'youtubeBlock' && slide.youtubeId) {
    return `https://img.youtube.com/vi/${slide.youtubeId}/mqdefault.jpg`
  }
  return null
}

export function DeviceSlideStatus() {
  const { id } = useDocumentInfo()
  const { value: currentProgram } = useField({ path: 'currentProgram' })
  const { value: currentSlideIndex } = useField<number>({ path: 'currentSlideIndex' })
  const [slideData, setSlideData] = useState<any>(null)
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)

  useEffect(() => {
    if (!currentProgram || !id) return
    const programId = typeof currentProgram === 'object' && currentProgram !== null ? (currentProgram as any).id : currentProgram
    fetch(`/api/programs/${programId}?depth=2`)
      .then(r => r.json())
      .then(setSlideData)
      .catch(console.error)
  }, [currentProgram, id])

  useEffect(() => {
    if (!id) return
    const socket = io(window.location.origin, { path: '/api/ws' }) as Socket<ServerToClientEvents, ClientToServerEvents>
    socketRef.current = socket

    socket.on('device:status', (data: any) => {
      if (data.deviceId === id) {
        if (data.programId && data.programId !== (slideData?.id ?? null)) {
          fetch(`/api/programs/${data.programId}?depth=2`)
            .then(r => r.json())
            .then(setSlideData)
            .catch(console.error)
        }
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [id])

  if (!slideData || !slideData.slides?.length) {
    return (
      <div style={{ padding: '12px 0' }}>
        <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--theme-elevation-500, #666)', marginBottom: 4, display: 'block' }}>
          Current Slide
        </label>
        <div style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-500, #888)' }}>No slides available</div>
      </div>
    )
  }

  const idx = currentSlideIndex || 0
  const currentSlide = slideData.slides[idx] || slideData.slides[0]
  const thumbnailUrl = getMediaUrl(currentSlide)

  return (
    <div style={{ padding: '12px 0' }}>
      <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--theme-elevation-500, #666)', marginBottom: 4, display: 'block' }}>
        Current Slide
      </label>
      <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>Slide {idx + 1} of {slideData.slides.length}</div>
      {thumbnailUrl && (
        <img src={thumbnailUrl} alt={`Slide ${idx + 1}`} style={{ maxWidth: '100%', borderRadius: 4 }} />
      )}
    </div>
  )
}
