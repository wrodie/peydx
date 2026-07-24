'use client'

import type { FC } from 'react'
import { HexColorPicker } from 'react-colorful'
import type { SlideDesign, SlideElement } from './types'

interface InspectorProps {
  design: SlideDesign
  selectedElements: SlideElement[]
  onElementChange: (id: string, partial: Partial<SlideElement>) => void
  onUpdateBackground: (bg: Partial<SlideDesign['background']>) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: 6,
  padding: '3px 6px',
  borderRadius: 3,
  border: '1px solid var(--theme-elevation-300)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  fontSize: '0.8rem',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 2,
  color: 'var(--theme-elevation-600)',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 12,
  paddingBottom: 12,
  borderBottom: '1px solid var(--theme-elevation-200)',
}

export const Inspector: FC<InspectorProps> = ({ design, selectedElements, onElementChange, onUpdateBackground }) => {
  if (selectedElements.length === 0) {
    return (
      <div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>Background</h3>
        <div style={sectionStyle}>
          <label style={labelStyle}>Type</label>
          <select
            value={design.background.type}
            onChange={(e) => onUpdateBackground({ type: e.target.value as 'color' | 'image' })}
            style={inputStyle}
          >
            <option value="color">Color</option>
            <option value="image">Image</option>
          </select>
          {design.background.type === 'color' && (
            <div>
              <label style={labelStyle}>Color</label>
              <HexColorPicker
                color={design.background.color || '#000000'}
                onChange={(c) => onUpdateBackground({ color: c })}
                style={{ width: '100%', height: 140, marginBottom: 6 }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>
        Properties ({selectedElements.length})
      </h3>
      {selectedElements.map((el) => (
        <div key={el.id} style={sectionStyle}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.75rem', color: 'var(--theme-elevation-500)', textTransform: 'capitalize' }}>
            {el.type}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <div>
              <label style={labelStyle}>X</label>
              <input type="number" value={Math.round(el.x)} onChange={(e) => onElementChange(el.id, { x: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Y</label>
              <input type="number" value={Math.round(el.y)} onChange={(e) => onElementChange(el.id, { y: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>W</label>
              <input type="number" value={Math.round(el.width)} onChange={(e) => onElementChange(el.id, { width: Math.max(5, Number(e.target.value)) })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>H</label>
              <input type="number" value={Math.round(el.height)} onChange={(e) => onElementChange(el.id, { height: Math.max(5, Number(e.target.value)) })} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
            <div>
              <label style={labelStyle}>Rotation</label>
              <input type="number" value={Math.round(el.rotation)} onChange={(e) => onElementChange(el.id, { rotation: Number(e.target.value) % 360 })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Z-Index</label>
              <input type="number" value={el.zIndex} onChange={(e) => onElementChange(el.id, { zIndex: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: 4 }}>
            <label style={labelStyle}>Opacity</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="range" min={0} max={1} step={0.01} value={el.opacity}
                onChange={(e) => onElementChange(el.id, { opacity: Number(e.target.value) })}
                style={{ flex: 1 }} />
              <span style={{ fontSize: '0.75rem', width: 30, textAlign: 'right', color: 'var(--theme-elevation-600)' }}>
                {Math.round(el.opacity * 100)}%
              </span>
            </div>
          </div>

          {el.type === 'text' && el.textData && (
            <div style={{ marginTop: 8 }}>
              <label style={labelStyle}>Font</label>
              <select value={el.textData.fontFamily}
                onChange={(e) => onElementChange(el.id, { textData: { ...el.textData!, fontFamily: e.target.value } })}
                style={inputStyle}>
                <option value="Inter">Inter</option>
                <option value="Lora">Lora</option>
                <option value="Roboto Mono">Roboto Mono</option>
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <div>
                  <label style={labelStyle}>Size</label>
                  <input type="number" value={el.textData.fontSize}
                    onChange={(e) => onElementChange(el.id, { textData: { ...el.textData!, fontSize: Number(e.target.value) } })}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Line H</label>
                  <input type="number" step={0.1} value={el.textData.lineHeight}
                    onChange={(e) => onElementChange(el.id, { textData: { ...el.textData!, lineHeight: Number(e.target.value) } })}
                    style={inputStyle} />
                </div>
              </div>

              <div style={{ marginTop: 4 }}>
                <label style={labelStyle}>Color</label>
                <HexColorPicker
                  color={el.textData.color}
                  onChange={(c) => onElementChange(el.id, { textData: { ...el.textData!, color: c } })}
                  style={{ width: '100%', height: 120, marginBottom: 6 }}
                />
              </div>

              <label style={labelStyle}>Align</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button key={align}
                    onClick={() => onElementChange(el.id, { textData: { ...el.textData!, textAlign: align } })}
                    className={`btn btn--size-small ${el.textData.textAlign === align ? 'btn--style-primary' : 'btn--style-secondary'}`}
                    style={{ flex: 1, fontSize: '0.75rem', padding: '2px 4px' }}>
                    {align === 'left' ? '\u2190' : align === 'center' ? '\u2194' : '\u2192'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={el.textData.bold}
                    onChange={(e) => onElementChange(el.id, { textData: { ...el.textData!, bold: e.target.checked } })} />
                  <strong>B</strong>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={el.textData.italic}
                    onChange={(e) => onElementChange(el.id, { textData: { ...el.textData!, italic: e.target.checked } })} />
                  <em>I</em>
                </label>
              </div>

              <label style={labelStyle}>Content</label>
              <textarea value={el.textData.text}
                onChange={(e) => onElementChange(el.id, { textData: { ...el.textData!, text: e.target.value } })}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: el.textData.fontFamily }} />
            </div>
          )}

          {el.type === 'image' && el.imageData && (
            <div style={{ marginTop: 8 }}>
              <label style={labelStyle}>Media ID</label>
              <input type="number" value={el.imageData.mediaId}
                onChange={(e) => onElementChange(el.id, { imageData: { ...el.imageData!, mediaId: Number(e.target.value) } })}
                style={inputStyle} />

              <label style={labelStyle}>Fit</label>
              <select value={el.imageData.fit}
                onChange={(e) => onElementChange(el.id, { imageData: { ...el.imageData!, fit: e.target.value as 'cover' | 'contain' } })}
                style={inputStyle}>
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>

              <label style={labelStyle}>Border Radius</label>
              <input type="number" value={el.imageData.borderRadius}
                onChange={(e) => onElementChange(el.id, { imageData: { ...el.imageData!, borderRadius: Math.max(0, Number(e.target.value)) } })}
                style={inputStyle} />
            </div>
          )}

          {el.type === 'shape' && el.shapeData && (
            <div style={{ marginTop: 8 }}>
              <label style={labelStyle}>Shape</label>
              <select value={el.shapeData.shape}
                onChange={(e) => onElementChange(el.id, { shapeData: { ...el.shapeData!, shape: e.target.value as 'rect' | 'ellipse' | 'line' } })}
                style={inputStyle}>
                <option value="rect">Rectangle</option>
                <option value="ellipse">Ellipse</option>
                <option value="line">Line</option>
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
                <div>
                  <label style={labelStyle}>Fill</label>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input type="color" value={el.shapeData.fill === 'none' ? '#ffffff' : el.shapeData.fill}
                      onChange={(e) => onElementChange(el.id, { shapeData: { ...el.shapeData!, fill: e.target.value } })}
                      style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', padding: 0 }} />
                    <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                      <input type="checkbox" checked={el.shapeData.fill === 'none'}
                        onChange={(e) => onElementChange(el.id, { shapeData: { ...el.shapeData!, fill: e.target.checked ? 'none' : '#ffffff' } })} />
                      none
                    </label>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Stroke</label>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input type="color" value={el.shapeData.stroke === 'none' ? '#000000' : el.shapeData.stroke}
                      onChange={(e) => onElementChange(el.id, { shapeData: { ...el.shapeData!, stroke: e.target.value } })}
                      style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', padding: 0 }} />
                    <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                      <input type="checkbox" checked={el.shapeData.stroke === 'none'}
                        onChange={(e) => onElementChange(el.id, { shapeData: { ...el.shapeData!, stroke: e.target.checked ? 'none' : '#000000' } })} />
                      none
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <div>
                  <label style={labelStyle}>Stroke W</label>
                  <input type="number" value={el.shapeData.strokeWidth}
                    onChange={(e) => onElementChange(el.id, { shapeData: { ...el.shapeData!, strokeWidth: Math.max(0, Number(e.target.value)) } })}
                    style={inputStyle} />
                </div>
                {el.shapeData.shape === 'rect' && (
                  <div>
                    <label style={labelStyle}>Radius</label>
                    <input type="number" value={el.shapeData.borderRadius}
                      onChange={(e) => onElementChange(el.id, { shapeData: { ...el.shapeData!, borderRadius: Math.max(0, Number(e.target.value)) } })}
                      style={inputStyle} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
