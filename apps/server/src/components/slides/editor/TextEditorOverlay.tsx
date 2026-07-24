'use client'

import { useEffect, useRef } from 'react'
import type { SlideElement } from './types'

interface TextEditorOverlayProps {
  element: SlideElement
  visScale: number
  onSave: (text: string) => void
  onCancel: () => void
}

export function TextEditorOverlay({ element, visScale, onSave, onCancel }: TextEditorOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.select()
  }, [])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.x * visScale,
    top: element.y * visScale,
    width: element.width * visScale,
    height: element.height * visScale,
    transform: `rotate(${element.rotation}deg)`,
    transformOrigin: 'top left',
    fontFamily: element.textData?.fontFamily || 'Inter',
    fontSize: (element.textData?.fontSize || 48) * visScale,
    color: element.textData?.color || '#ffffff',
    textAlign: element.textData?.textAlign || 'left',
    fontWeight: element.textData?.bold ? 'bold' : 'normal',
    fontStyle: element.textData?.italic ? 'italic' : 'normal',
    lineHeight: element.textData?.lineHeight || 1.2,
    border: '2px solid #4a9eff',
    borderRadius: 4,
    background: 'transparent',
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    padding: '4px 6px',
    margin: 0,
    zIndex: 1000,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  }

  return (
    <textarea
      ref={textareaRef}
      defaultValue={element.textData?.text ?? ''}
      onBlur={(e) => onSave(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      style={style}
    />
  )
}
