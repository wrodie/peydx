'use client'

import { useState, useRef, useEffect, type FC } from 'react'
import {
  ImageIcon,
  MovieIcon,
  YouTubeIcon,
  MusicNote2Icon,
  CaptureIcon,
  FolderIcon,
  ArrowDropDownIcon,
} from '../icons'

type AddSlideMenuProps = {
  onAddSlide: (blockType: string) => void
}

const slideTypes = [
  { type: 'imageBlock', label: 'Image Slide', icon: <ImageIcon size={20} /> },
  { type: 'videoBlock', label: 'Video Slide', icon: <MovieIcon size={20} /> },
  { type: 'youtubeBlock', label: 'YouTube Slide', icon: <YouTubeIcon size={20} /> },
  { type: 'audioBlock', label: 'Audio Slide', icon: <MusicNote2Icon size={20} /> },
  { type: 'blackScreenBlock', label: 'Black Screen Slide', icon: <CaptureIcon size={20} /> },
  { type: 'divider', label: '---', icon: null },
  { type: 'segmentBlock', label: 'Segment', icon: <FolderIcon size={20} /> },
]

export const AddSlideMenu: FC<AddSlideMenuProps> = ({ onAddSlide }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: '6px 14px',
          background: 'var(--theme-primary-500, #3b82f6)',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 500,
        }}
      >
        + Add Slide <ArrowDropDownIcon size={18} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: 'var(--theme-elevation-0)',
            border: '1px solid var(--theme-elevation-200, #e5e7eb)',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            zIndex: 1000,
            minWidth: 200,
            marginTop: 4,
          }}
        >
          {slideTypes.map((item) => {
            if (item.type === 'divider') {
              return (
                <div
                  key="divider"
                  style={{
                    height: 1,
                    background: 'var(--theme-elevation-200, #e5e7eb)',
                    margin: '4px 0',
                  }}
                />
              )
            }
            return (
              <div
                key={item.type}
                onClick={() => {
                  onAddSlide(item.type)
                  setOpen(false)
                }}
                style={{
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: '0.825rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background =
                    'var(--theme-elevation-100, #f3f4f6)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
