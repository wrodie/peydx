import { useEffect, useCallback, useState } from 'react'
import type { KeyConfig, ConnectionStatus } from './types'
import { CONNECTION_STATUS_COLORS } from './types'
import { normalizeKeyCode } from './keyConfig'
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
  connectionStatus?: ConnectionStatus
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
  connectionStatus,
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
      const downCodes = normalizeKeyCode(keyConfig.down)
      const upCodes = normalizeKeyCode(keyConfig.up)
      const enterCodes = normalizeKeyCode(keyConfig.enter)
      const exitCodes = normalizeKeyCode(keyConfig.exit)
      const menuCodes = normalizeKeyCode(keyConfig.menu)

      if (downCodes.includes(e.code)) {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % itemCount)
      } else if (upCodes.includes(e.code)) {
        e.preventDefault()
        setSelectedIndex((i) => (i > 0 ? i - 1 : itemCount - 1))
      } else if (enterCodes.includes(e.code)) {
        e.preventDefault()
        if (isExitOverlay) {
          if (clampedIndex === 0) onExit?.()
          else onBack()
        } else if (clampedIndex < programs.length) {
          onSelect(clampedIndex)
        }
      } else if (exitCodes.includes(e.code) || menuCodes.includes(e.code)) {
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
        <span className="menu-top-bar-right" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {currentTime}
          {connectionStatus && (
            <span
              className="player-connection-dot"
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: CONNECTION_STATUS_COLORS[connectionStatus],
                marginLeft: 12,
                flexShrink: 0,
              }}
              title={`Connection: ${connectionStatus}`}
            />
          )}
        </span>
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
        Use ↑↓ to navigate, Enter to select
      </div>
    </div>
  )
}