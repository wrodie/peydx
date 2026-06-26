'use client'

import { useState, useRef, useEffect, type FC } from 'react'

type AdvanceModeInlineControlProps = {
  variant: 'slide' | 'segment'
  blockType?: string | undefined
  advanceMode: string | undefined
  duration: number | null | undefined
  onModeChange: (newMode: string) => void
  onDurationChange: (newDuration: number) => void
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.9rem',
  padding: 0,
  flexShrink: 0,
  lineHeight: 1,
  background: 'transparent',
}

const inputStyle: React.CSSProperties = {
  width: 36,
  height: 28,
  padding: '0 4px',
  fontSize: '0.8rem',
  border: '1px solid var(--theme-elevation-300, #d1d5db)',
  borderRadius: 4,
  textAlign: 'center',
  boxSizing: 'border-box',
}

const inputGroupStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
}

const suffixStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--theme-elevation-500, #6b7280)',
}

const supportsOnEnd = (blockType?: string) =>
  blockType === 'videoBlock' || blockType === 'youtubeBlock' || blockType === 'audioBlock'

export const AdvanceModeInlineControl: FC<AdvanceModeInlineControlProps> = ({
  variant,
  blockType,
  advanceMode,
  duration,
  onModeChange,
  onDurationChange,
}) => {
  const [localDuration, setLocalDuration] = useState(String(duration ?? ''))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalDuration(String(duration ?? ''))
  }, [duration])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const modeBtn = (mode: string, icon: string, title: string, disabled?: boolean) => {
    const active = advanceMode === mode
    return (
      <button
        type="button"
        title={title}
        style={{
          ...btnStyle,
          border: active ? '1.5px solid var(--theme-primary-500, #3b82f6)' : 'none',
          color: active ? 'var(--theme-primary-500, #3b82f6)' : 'var(--theme-elevation-400, #9ca3af)',
          opacity: disabled && !active ? 0.4 : 1,
          cursor: disabled && !active ? 'default' : 'pointer',
        }}
        onClick={disabled && !active ? undefined : (e) => {
          e.stopPropagation()
          if (!active) onModeChange(mode)
        }}
      >
        {icon}
      </button>
    )
  }

  const isTimed = advanceMode === 'timed'
  const unit = variant === 'segment' ? 'min' : 's'

  const timedInput = (
    <div style={inputGroupStyle}>
      <input
        type="number"
        min={1}
        inputMode="numeric"
        className="adv-dur"
        disabled={!isTimed}
        style={{
          ...inputStyle,
          opacity: isTimed ? 1 : 0.4,
          cursor: isTimed ? 'text' : 'default',
        }}
        value={localDuration}
        onChange={(e) => {
          const val = e.target.value
          setLocalDuration(val)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            debounceRef.current = null
            const n = parseInt(val, 10)
            if (!isNaN(n) && n > 0) onDurationChange(n)
          }, 400)
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <span style={{
        ...suffixStyle,
        opacity: isTimed ? 1 : 0.4,
      }}>{unit}</span>
    </div>
  )

  if (variant === 'slide') {
    return (
      <>
        <style>{`input.adv-dur::-webkit-outer-spin-button,input.adv-dur::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}input.adv-dur{-moz-appearance:textfield}`}</style>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {modeBtn('manual', '✋', 'Manual - requires user click to advance')}
        {modeBtn('timed', '⏱', 'Timed - auto-advance after duration')}
        {timedInput}
        {modeBtn('onEnd', '⏭', 'On End - advance when media finishes', !supportsOnEnd(blockType))}
      </div>
      </>
    )
  }

  return (
    <>
      <style>{`input.adv-dur::-webkit-outer-spin-button,input.adv-dur::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}input.adv-dur{-moz-appearance:textfield}`}</style>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {modeBtn('slides', '⤵', 'Slides - advance after all child slides')}
      {modeBtn('timed', '⏱', 'Timed - auto-advance after duration')}
      {timedInput}
      {modeBtn('manual', '✋', 'Manual - requires user click to advance')}
      </div>
    </>
  )
}
