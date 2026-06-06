import { useEffect, useCallback, useState } from 'react'
import type { KeyConfig } from './types'
import './menu.css'

export interface MenuEngineProps {
  programs: Array<{ id: number; title: string; department?: string }>
  selectedIndex: number
  onSelect: (index: number) => void
  onBack: () => void
  onExit?: () => void
  keyConfig: KeyConfig
  title?: string
  exitLabel?: string
  continueLabel?: string
  deviceName?: string | null
  defaultBackground?: string | null
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MenuEngine({
  programs,
  selectedIndex: initialIndex,
  onSelect,
  onBack,
  onExit,
  keyConfig,
  title = 'Select a Program',
  exitLabel,
  continueLabel,
  deviceName,
  defaultBackground,
}: MenuEngineProps) {
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialIndex))
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date()))

  const isExitOverlay = !!(exitLabel && continueLabel)
  const itemCount = isExitOverlay ? 2 : programs.length
  const clampedIndex = Math.max(0, Math.min(selectedIndex, itemCount - 1))

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(formatTime(new Date())), 30_000)
    return () => clearInterval(interval)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === keyConfig.down) {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % itemCount)
      } else if (e.code === keyConfig.up) {
        e.preventDefault()
        setSelectedIndex((i) => (i > 0 ? i - 1 : itemCount - 1))
      } else if (e.code === keyConfig.enter) {
        e.preventDefault()
        if (isExitOverlay) {
          if (clampedIndex === 0) onExit?.()
          else onBack()
        } else if (clampedIndex < programs.length) {
          onSelect(clampedIndex)
        }
      } else if (e.code === keyConfig.exit || e.code === keyConfig.menu) {
        e.preventDefault()
        onBack()
      }
    },
    [keyConfig, itemCount, clampedIndex, onSelect, onBack, onExit, isExitOverlay, programs.length],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const displayItems = isExitOverlay
    ? [
        { id: -1, title: exitLabel!, department: undefined },
        { id: -2, title: continueLabel!, department: undefined },
      ]
    : programs

  return (
    <div className="menu-overlay">
      {defaultBackground && (
        <img src={defaultBackground} className="menu-background" alt="" />
      )}
      <div className="menu-overlay-bg" />
      <div className="menu-top-bar">
        <span className="menu-top-bar-left">{deviceName || 'Signage'}</span>
        <span className="menu-top-bar-right">{currentTime}</span>
      </div>
      <div className="menu-panel">
        <div className="menu-list-label">{title}</div>
        <div className="menu-list">
          {displayItems.map((item, i) => (
            <div
              key={item.id}
              className={`menu-item${i === clampedIndex ? ' menu-item-selected' : ''}`}
              onClick={() => {
                if (isExitOverlay) {
                  if (i === 0) onExit?.()
                  else onBack()
                } else {
                  onSelect(i)
                }
              }}
            >
              <div className="menu-item-title">{item.title}</div>
              {item.department && <div className="menu-item-dept">{item.department}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="menu-hint">
        {isExitOverlay ? 'Use ↑↓ to navigate, Enter to select' : 'Use ↑↓ to navigate, Enter to select, M/Esc to exit'}
      </div>
    </div>
  )
}