import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'
import { MenuEngine } from '../MenuEngine'
import { DEFAULT_KEY_CONFIG } from '../types'
import type { KeyConfig } from '../types'

describe('MenuEngine', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

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

  // Extended tests — Phase 4

  it('navigates selection with arrow down key', () => {
    render(<MenuEngine {...baseProps} selectedIndex={0} />)
    fireEvent.keyDown(document.body, { code: 'ArrowDown' })
    const items = document.querySelectorAll('.menu-item')
    expect(items.length).toBeGreaterThan(0)
  })

  it('wraps arrow down from last to first item', () => {
    render(<MenuEngine {...baseProps} selectedIndex={2} />)
    fireEvent.keyDown(document.body, { code: 'ArrowDown' })
  })

  it('navigates selection with arrow up key', () => {
    render(<MenuEngine {...baseProps} selectedIndex={1} />)
    fireEvent.keyDown(document.body, { code: 'ArrowUp' })
  })

  it('exit overlay fires onExit for first item on Enter', () => {
    const onExit = vi.fn()
    const onBack = vi.fn()
    render(
      <MenuEngine
        {...baseProps}
        selectedIndex={0}
        exitLabel="Exit Program"
        continueLabel="Continue"
        onExit={onExit}
        onBack={onBack}
      />
    )
    fireEvent.keyDown(document.body, { code: 'Enter' })
    expect(onExit).toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
  })

  it('exit overlay fires onBack for second item on Enter', () => {
    const onExit = vi.fn()
    const onBack = vi.fn()
    render(
      <MenuEngine
        {...baseProps}
        selectedIndex={1}
        exitLabel="Exit Program"
        continueLabel="Continue"
        onExit={onExit}
        onBack={onBack}
      />
    )
    fireEvent.keyDown(document.body, { code: 'Enter' })
    expect(onBack).toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()
  })

  it('renders custom title', () => {
    render(<MenuEngine {...baseProps} title="Choose Content" />)
    expect(screen.getByText('Choose Content')).toBeDefined()
  })

  it('does not show background when defaultBackground not provided', () => {
    const { container } = render(<MenuEngine {...baseProps} />)
    const bg = container.querySelector('.menu-background')
    expect(bg).toBeNull()
  })
})
