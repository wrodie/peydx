'use client'

import { useState, useRef, useEffect, type FC } from 'react'
import {
  PanToolIcon,
  TimerIcon,
  SkipNextIcon,
  RepeatIcon,
} from '../icons'

type AdvanceModeInlineControlProps = {
  variant: 'slide' | 'segment'
  blockType?: string | undefined
  advanceMode: string | undefined
  duration: number | null | undefined
  loop?: boolean
  onModeChange: (newMode: string) => void
  onDurationChange: (newDuration: number) => void
  onLoopChange?: (newLoop: boolean) => void
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

export const AdvanceModeInlineControl: FC<AdvanceModeInlineControlProps> = ({
  variant,
  blockType,
  advanceMode,
  duration,
  loop,
  onModeChange,
  onDurationChange,
  onLoopChange,
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

  const modeBtn = (mode: string, icon: React.ReactNode, title: string) => {
    const active = advanceMode === mode
    return (
      <button
        type="button"
        title={title}
        style={{
          ...btnStyle,
          color: active ? 'var(--theme-primary-500, #3b82f6)' : 'var(--theme-elevation-400, #9ca3af)',
        }}
        onClick={(e) => {
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
          border: isTimed ? '1.5px solid var(--theme-primary-500, #3b82f6)' : '1px solid var(--theme-elevation-300, #d1d5db)',
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

  const loopActive = !!loop

  const supportsOnEnd = blockType === 'videoBlock' || blockType === 'youtubeBlock' || blockType === 'audioBlock'

  if (variant === 'slide') {
    return (
      <>
        <style>{`input.adv-dur::-webkit-outer-spin-button,input.adv-dur::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}input.adv-dur{-moz-appearance:textfield}`}</style>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {supportsOnEnd && (
          <>
            <button
              type="button"
              title={loopActive ? 'Looping - click to disable' : 'Loop - repeat this slide'}
              style={{
                ...btnStyle,
                color: loopActive ? 'var(--theme-primary-500, #3b82f6)' : 'var(--theme-elevation-400, #9ca3af)',
              }}
              onClick={(e) => { e.stopPropagation(); onLoopChange?.(!loop) }}
            >
              <RepeatIcon size={18} />
            </button>
            {modeBtn('onEnd', <SkipNextIcon size={18} />, 'On End - advance when media finishes')}
          </>
        )}
        {modeBtn('manual', <PanToolIcon size={18} />, 'Manual - requires user click to advance')}
        {modeBtn('timed', <TimerIcon size={18} />, 'Timed - auto-advance after duration')}
        {timedInput}
      </div>
      </>
    )
  }

  return (
    <>
      <style>{`input.adv-dur::-webkit-outer-spin-button,input.adv-dur::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}input.adv-dur{-moz-appearance:textfield}`}</style>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        title={loopActive ? 'Looping - click to disable' : 'Loop - repeat this segment'}
        style={{
          ...btnStyle,
          color: loopActive ? 'var(--theme-primary-500, #3b82f6)' : 'var(--theme-elevation-400, #9ca3af)',
        }}
        onClick={(e) => { e.stopPropagation(); onLoopChange?.(!loop) }}
      >
        <RepeatIcon size={18} />
      </button>
      {modeBtn('slides', <SkipNextIcon size={18} />, 'On End - advance after all child slides')}
      {modeBtn('manual', <PanToolIcon size={18} />, 'Manual - requires user click to advance')}
      {modeBtn('timed', <TimerIcon size={18} />, 'Timed - auto-advance after duration')}
      {timedInput}
      </div>
    </>
  )
}
