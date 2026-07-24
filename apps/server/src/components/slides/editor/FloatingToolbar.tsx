'use client'

import type { FC } from 'react'
import { useRef, useCallback } from 'react'
import type { SlideDesign, SlideElement } from './types'
import {
  FormatBoldIcon,
  FormatItalicIcon,
  FormatAlignLeftIcon,
  FormatAlignCenterIcon,
  FormatAlignRightIcon,
} from '../../icons'

interface FloatingToolbarProps {
  design: SlideDesign
  selectedElements: SlideElement[]
  onElementChange: (id: string, partial: Partial<SlideElement>) => void
  onUpdateBackground: (bg: Partial<SlideDesign['background']>) => void
}

const CARD: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 12px',
  background: 'var(--theme-elevation-50)',
  borderBottom: '1px solid var(--theme-elevation-200)',
  fontSize: '0.9rem',
  fontFamily: 'system-ui, sans-serif',
  color: 'var(--theme-text)',
  overflow: 'hidden',
  minHeight: 36,
  flexShrink: 0,
}

const BTN: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 4,
  color: 'var(--theme-text)',
  padding: '3px 7px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  lineHeight: '22px',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  transition: 'background 0.1s',
}

const BTN_ACTIVE: React.CSSProperties = {
  ...BTN,
  background: 'var(--theme-elevation-200)',
  borderColor: 'var(--theme-elevation-300)',
}

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 22,
  background: 'var(--theme-elevation-200)',
  margin: '0 4px',
  flexShrink: 0,
}

const SELECT: React.CSSProperties = {
  background: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  color: 'var(--theme-text)',
  padding: '2px 6px',
  fontSize: '0.85rem',
  lineHeight: '22px',
  cursor: 'pointer',
}

const INPUT: React.CSSProperties = {
  ...SELECT,
  width: 44,
  textAlign: 'center' as const,
}

export const FloatingToolbar: FC<FloatingToolbarProps> = ({
  design,
  selectedElements,
  onElementChange,
  onUpdateBackground,
}) => {
  const el = selectedElements[0]
  const pendingRef = useRef<Partial<SlideElement>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedUpdate = useCallback((partial: Partial<SlideElement>) => {
    Object.assign(pendingRef.current, partial)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const elId = selectedElements[0]?.id
    if (!elId) return
    debounceRef.current = setTimeout(() => {
      onElementChange(elId, { ...pendingRef.current })
      pendingRef.current = {}
    }, 30)
  }, [onElementChange, selectedElements])

  const update = useCallback((partial: Partial<SlideElement>) => {
    const elId = selectedElements[0]?.id
    if (elId) onElementChange(elId, partial)
  }, [onElementChange, selectedElements])

  if (selectedElements.length === 0) {
    return (
      <div style={CARD}>
        <span style={{ color: 'var(--theme-elevation-500)', marginRight: 4, fontSize: '0.8rem' }}>Background</span>
        <select
          value={design.background.type}
          onChange={(e) => onUpdateBackground({ type: e.target.value as 'color' | 'image' })}
          style={SELECT}
        >
          <option value="color">Color</option>
          <option value="image">Image</option>
        </select>
        {design.background.type === 'color' && (
          <input
            type="color"
            value={design.background.color || '#000000'}
            onChange={(e) => onUpdateBackground({ color: e.target.value })}
            style={{ width: 28, height: 26, padding: 0, border: '1px solid var(--theme-elevation-200)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
          />
        )}
      </div>
    )
  }

  if (!el) return null

  return (
    <div style={CARD}>
      {/* Rotation + opacity */}
      <span style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-500)', marginRight: 2 }}>Rot</span>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={Math.round(el.rotation)}
        onChange={(e) => { const v = e.target.value.replace(/[^0-9-]/g, ''); if (v) debouncedUpdate({ rotation: Number(v) % 360 }) }}
        style={{ ...INPUT, width: 36 }} title="Rotation" />
      <span style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-500)', marginRight: 2 }}>Op</span>
      <input type="range" min={0} max={1} step={0.01} value={el.opacity}
        onChange={(e) => debouncedUpdate({ opacity: Number(e.target.value) })}
        onMouseUp={() => { if (debounceRef.current) clearTimeout(debounceRef.current); onElementChange(el.id, { ...pendingRef.current }); pendingRef.current = {} }}
        style={{ width: 44, margin: 0, accentColor: 'var(--theme-primary-500, #4a9eff)' }} title="Opacity"
      />
      <span style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-500)', width: 28, textAlign: 'right' }}>{Math.round(el.opacity * 100)}%</span>

      {el.type === 'text' && el.textData && (
        <>
          <div style={DIVIDER} />
          <select value={el.textData.fontFamily} onChange={(e) => update({ textData: { ...el.textData!, fontFamily: e.target.value } })}
            style={{ ...SELECT, width: 72 }}>
            <option value="Inter">Inter</option>
            <option value="Lora">Lora</option>
            <option value="Roboto Mono">Mono</option>
          </select>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={el.textData.fontSize}
            onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v) update({ textData: { ...el.textData!, fontSize: Number(v) } }) }}
            style={{ ...INPUT, width: 36 }} title="Size" />
          <input type="color" value={el.textData.color}
            onChange={(e) => debouncedUpdate({ textData: { ...el.textData!, color: e.target.value } })}
            onBlur={() => { if (debounceRef.current) clearTimeout(debounceRef.current); onElementChange(el.id, { ...pendingRef.current }); pendingRef.current = {} }}
            style={{ width: 26, height: 26, padding: 0, border: '1px solid var(--theme-elevation-200)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} title="Color" />
          <button style={el.textData.bold ? BTN_ACTIVE : BTN} onClick={() => update({ textData: { ...el.textData!, bold: !el.textData.bold } })} title="Bold">
            <FormatBoldIcon size={18} />
          </button>
          <button style={el.textData.italic ? BTN_ACTIVE : BTN} onClick={() => update({ textData: { ...el.textData!, italic: !el.textData.italic } })} title="Italic">
            <FormatItalicIcon size={18} />
          </button>
          <div style={DIVIDER} />
          {(['left', 'center', 'right'] as const).map((align) => (
            <button key={align}
              style={el.textData!.textAlign === align ? BTN_ACTIVE : BTN}
              onClick={() => update({ textData: { ...el.textData!, textAlign: align } })}
              title={align}>
              {align === 'left' ? <FormatAlignLeftIcon size={18} /> : align === 'center' ? <FormatAlignCenterIcon size={18} /> : <FormatAlignRightIcon size={18} />}
            </button>
          ))}
        </>
      )}

      {el.type === 'image' && el.imageData && (
        <>
          <div style={DIVIDER} />
          <span style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', marginRight: 2 }}>Fit</span>
          <select value={el.imageData.fit} onChange={(e) => update({ imageData: { ...el.imageData!, fit: e.target.value as 'cover' | 'contain' } })}
            style={SELECT}>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
          <span style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', margin: '0 2px 0 6px' }}>R</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={el.imageData.borderRadius}
            onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v) update({ imageData: { ...el.imageData!, borderRadius: Number(v) } }) }}
            style={{ ...INPUT, width: 36 }} />
        </>
      )}

      {el.type === 'shape' && el.shapeData && (
        <>
          <div style={DIVIDER} />
          <select value={el.shapeData.shape} onChange={(e) => update({ shapeData: { ...el.shapeData!, shape: e.target.value as 'rect' | 'ellipse' | 'line' } })}
            style={SELECT}>
            <option value="rect">Rect</option>
            <option value="ellipse">Ellipse</option>
            <option value="line">Line</option>
          </select>
          <input type="color" value={el.shapeData.fill === 'none' ? '#ffffff' : el.shapeData.fill}
            onChange={(e) => debouncedUpdate({ shapeData: { ...el.shapeData!, fill: e.target.value } })}
            onBlur={() => { if (debounceRef.current) clearTimeout(debounceRef.current); onElementChange(el.id, { ...pendingRef.current }); pendingRef.current = {} }}
            style={{ width: 26, height: 26, padding: 0, border: '1px solid var(--theme-elevation-200)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} title="Fill" />
          <button style={el.shapeData.fill === 'none' ? { ...BTN, borderColor: 'var(--theme-elevation-300)' } : BTN}
            onClick={() => update({ shapeData: { ...el.shapeData!, fill: el.shapeData.fill === 'none' ? '#ffffff' : 'none' } })}
            title="Toggle fill">
            <span style={{ fontSize: '0.7rem' }}>Fill</span>
          </button>
          <input type="color" value={el.shapeData.stroke === 'none' ? '#000000' : el.shapeData.stroke}
            onChange={(e) => debouncedUpdate({ shapeData: { ...el.shapeData!, stroke: e.target.value } })}
            onBlur={() => { if (debounceRef.current) clearTimeout(debounceRef.current); onElementChange(el.id, { ...pendingRef.current }); pendingRef.current = {} }}
            style={{ width: 26, height: 26, padding: 0, border: '1px solid var(--theme-elevation-200)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} title="Stroke" />
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={el.shapeData.strokeWidth}
            onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v) update({ shapeData: { ...el.shapeData!, strokeWidth: Number(v) } }) }}
            style={{ ...INPUT, width: 32 }} title="Stroke W" />
          {el.shapeData.shape === 'rect' && (
            <>
              <span style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', margin: '0 2px 0 6px' }}>R</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={el.shapeData.borderRadius}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v) update({ shapeData: { ...el.shapeData!, borderRadius: Number(v) } }) }}
                style={{ ...INPUT, width: 36 }} />
            </>
          )}
          <button style={el.shapeData.stroke === 'none' ? { ...BTN, borderColor: 'var(--theme-elevation-300)' } : BTN}
            onClick={() => update({ shapeData: { ...el.shapeData!, stroke: el.shapeData.stroke === 'none' ? '#000000' : 'none' } })}
            title="Toggle stroke">
            <span style={{ fontSize: '0.7rem' }}>Stroke</span>
          </button>
        </>
      )}
    </div>
  )
}
