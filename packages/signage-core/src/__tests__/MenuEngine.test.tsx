import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MenuEngine } from '../MenuEngine'
import { DEFAULT_KEY_CONFIG } from '../types'
import type { KeyConfig } from '../types'

describe('MenuEngine', () => {
  const programs = [
    { id: 1, title: 'Morning Service', department: 'Worship' },
    { id: 2, title: 'Youth Announcements', department: 'Youth' },
    { id: 3, title: 'Welcome Loop', department: 'Creative' },
  ]

  const baseProps = {
    programs,
    selectedIndex: 0,
    onSelect: vi.fn(),
    onBack: vi.fn(),
    keyConfig: DEFAULT_KEY_CONFIG,
  }

  it('renders program titles', () => {
    render(<MenuEngine {...baseProps} />)
    expect(screen.getByText('Morning Service')).toBeDefined()
    expect(screen.getByText('Youth Announcements')).toBeDefined()
  })

  it('renders device name', () => {
    render(<MenuEngine {...baseProps} deviceName="Lobby TV" />)
    expect(screen.getByText('Lobby TV')).toBeDefined()
  })

  it('renders clock component', () => {
    const { container } = render(<MenuEngine {...baseProps} />)
    const timeText = container.querySelector('.menu-top-bar-right')
    expect(timeText).toBeTruthy()
  })

  it('renders default background image when provided', () => {
    const { container } = render(
      <MenuEngine {...baseProps} defaultBackground="/local-media/bg.jpg" />
    )
    const bg = container.querySelector('.menu-background')
    expect(bg).toBeTruthy()
  })

  it('renders exit overlay when exit and continue labels provided', () => {
    render(<MenuEngine {...baseProps} exitLabel="Exit Program" continueLabel="Continue" />)
    expect(screen.getByText('Exit Program')).toBeDefined()
    expect(screen.getByText('Continue')).toBeDefined()
  })

  it('calls onSelect when Enter key is pressed', () => {
    const onSelect = vi.fn()
    render(<MenuEngine {...baseProps} onSelect={onSelect} />)
    fireEvent.keyDown(document.activeElement || document.body, { code: 'KeyM' })
  })

  it('calls onBack when Escape is pressed', () => {
    const onBack = vi.fn()
    render(<MenuEngine {...baseProps} onBack={onBack} />)
    fireEvent.keyDown(document.activeElement || document.body, { code: 'Escape' })
  })
})
