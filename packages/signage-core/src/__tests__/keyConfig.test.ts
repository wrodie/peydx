import { describe, it, expect } from 'vitest'
import { mergeKeyConfig, normalizeKeyCode } from '../keyConfig'
import { DEFAULT_KEY_CONFIG } from '../types'

describe('mergeKeyConfig', () => {
  it('returns DEFAULT_KEY_CONFIG when called with undefined', () => {
    expect(mergeKeyConfig(undefined)).toEqual(DEFAULT_KEY_CONFIG)
  })

  it('returns DEFAULT_KEY_CONFIG when called with empty object', () => {
    expect(mergeKeyConfig({})).toEqual(DEFAULT_KEY_CONFIG)
  })

  it('overrides only the menu key when partial config provided', () => {
    const result = mergeKeyConfig({ menu: 'KeyQ' })
    expect(result.menu).toBe('KeyQ')
    expect(result.up).toBe(DEFAULT_KEY_CONFIG.up)
    expect(result.down).toBe(DEFAULT_KEY_CONFIG.down)
    expect(result.enter).toBe(DEFAULT_KEY_CONFIG.enter)
    expect(result.exit).toBe(DEFAULT_KEY_CONFIG.exit)
    expect(result.pause).toBe(DEFAULT_KEY_CONFIG.pause)
    expect(result.next).toBe(DEFAULT_KEY_CONFIG.next)
    expect(result.prev).toBe(DEFAULT_KEY_CONFIG.prev)
  })

  it('overrides all keys when fully specified', () => {
    const custom = {
      menu: 'KeyX',
      up: 'KeyW',
      down: 'KeyS',
      enter: 'Space',
      exit: 'Backspace',
      pause: 'KeyZ',
      next: 'ArrowRight',
      prev: 'ArrowLeft',
    }
    expect(mergeKeyConfig(custom)).toEqual(custom)
  })

  it('overrides a subset of keys', () => {
    const result = mergeKeyConfig({ up: 'KeyW', down: 'KeyS' })
    expect(result.up).toBe('KeyW')
    expect(result.down).toBe('KeyS')
    expect(result.menu).toBe(DEFAULT_KEY_CONFIG.menu)
  })

  it('accepts array values for key codes', () => {
    const result = mergeKeyConfig({ next: ['Space', 'ArrowRight', 'Numpad6'] })
    expect(result.next).toEqual(['Space', 'ArrowRight', 'Numpad6'])
    expect(result.prev).toBe(DEFAULT_KEY_CONFIG.prev)
  })
})

describe('normalizeKeyCode', () => {
  it('returns empty array for undefined', () => {
    expect(normalizeKeyCode(undefined)).toEqual([])
  })

  it('wraps a single string in an array', () => {
    expect(normalizeKeyCode('Space')).toEqual(['Space'])
  })

  it('returns the array as-is', () => {
    expect(normalizeKeyCode(['Space', 'ArrowRight'])).toEqual(['Space', 'ArrowRight'])
  })
})
