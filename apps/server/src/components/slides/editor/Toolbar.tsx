'use client'

import type { FC } from 'react'
import type { SlideElement } from './types'
import type { Alignment } from './designJson'
import {
  FormatAlignLeftIcon,
  FormatAlignCenterIcon,
  FormatAlignRightIcon,
  KeyboardArrowUpIcon,
  KeyboardArrowDownIcon,
  TextFieldsIcon,
  ShapesIcon,
  ImageIcon,
} from '../../icons'

interface ToolbarProps {
  selectedIds: string[]
  canUndo: boolean
  canRedo: boolean
  capturing: boolean
  captureError: string | null
  hasElements: boolean
  onAddText: () => void
  onAddShape: () => void
  onAddImage: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  onMoveZOrder: (dir: 'forward' | 'backward' | 'front' | 'back') => void
  onAlign: (alignment: Alignment) => void
  onCapture: () => void
}

export const Toolbar: FC<ToolbarProps> = ({
  selectedIds,
  canUndo,
  canRedo,
  capturing,
  captureError,
  hasElements,
  onAddText,
  onAddShape,
  onAddImage,
  onDuplicate,
  onDelete,
  onUndo,
  onRedo,
  onMoveZOrder,
  onAlign,
  onCapture,
}) => {
  const hasSelection = selectedIds.length > 0

  return (
    <div style={{
      display: 'flex',
      gap: 6,
      padding: '6px 12px',
      background: 'var(--theme-elevation-100)',
      borderBottom: '1px solid var(--theme-elevation-200)',
      flexShrink: 0,
      zIndex: 10,
      alignItems: 'center',
      flexWrap: 'wrap',
      fontSize: '0.8rem',
    }}>
      <button className="btn btn--style-primary btn--size-small" onClick={onAddText}><TextFieldsIcon size={20} /></button>
      <button className="btn btn--style-secondary btn--size-small" onClick={onAddShape}><ShapesIcon size={20} /></button>
      <button className="btn btn--style-secondary btn--size-small" onClick={onAddImage}><ImageIcon size={20} /></button>
      <span style={{ width: 1, height: 20, background: 'var(--theme-elevation-300)', margin: '0 4px' }} />
      <button className="btn btn--style-secondary btn--size-small" onClick={onDuplicate} disabled={!hasSelection}>Duplicate</button>
      <span style={{ width: 1, height: 20, background: 'var(--theme-elevation-300)', margin: '0 4px' }} />
      <button className="btn btn--style-secondary btn--size-small" onClick={onUndo} disabled={!canUndo}>&#8630;</button>
      <button className="btn btn--style-secondary btn--size-small" onClick={onRedo} disabled={!canRedo}>&#8631;</button>
      <span style={{ width: 1, height: 20, background: 'var(--theme-elevation-300)', margin: '0 4px' }} />
      <button className="btn btn--style-secondary btn--size-small" onClick={() => onMoveZOrder('forward')} disabled={!hasSelection}><KeyboardArrowUpIcon size={20} /></button>
      <button className="btn btn--style-secondary btn--size-small" onClick={() => onMoveZOrder('backward')} disabled={!hasSelection}><KeyboardArrowDownIcon size={20} /></button>
      <span style={{ width: 1, height: 20, background: 'var(--theme-elevation-300)', margin: '0 4px' }} />
      <button className="btn btn--style-secondary btn--size-small" onClick={() => onAlign('left')} disabled={!hasSelection}><FormatAlignLeftIcon size={20} /></button>
      <button className="btn btn--style-secondary btn--size-small" onClick={() => onAlign('center')} disabled={!hasSelection}><FormatAlignCenterIcon size={20} /></button>
      <button className="btn btn--style-secondary btn--size-small" onClick={() => onAlign('right')} disabled={!hasSelection}><FormatAlignRightIcon size={20} /></button>
      <button className="btn btn--style-secondary btn--size-small" onClick={() => onAlign('top')} disabled={!hasSelection}><KeyboardArrowUpIcon size={20} /></button>
      <button className="btn btn--style-secondary btn--size-small" onClick={() => onAlign('middle')} disabled={!hasSelection}><span style={{ fontSize: '0.85rem' }}>&#8597;</span></button>
      <button className="btn btn--style-secondary btn--size-small" onClick={() => onAlign('bottom')} disabled={!hasSelection}><KeyboardArrowDownIcon size={20} /></button>
      <div style={{ flex: 1 }} />
      {captureError && (
        <span style={{ color: '#ef4444', fontSize: '0.75rem', padding: '2px 6px' }}>{captureError}</span>
      )}
      <button className="btn btn--style-primary btn--size-small" onClick={onCapture} disabled={capturing || !hasElements}>
        {capturing ? 'Rendering...' : 'Capture Render'}
      </button>
    </div>
  )
}
