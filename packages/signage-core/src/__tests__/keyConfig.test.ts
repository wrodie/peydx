import { describe, it, expect } from 'vitest'
import { mergeKeyConfig } from '../keyConfig'
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
  })

  it('overrides all keys when fully specified', () => {
    const custom = {
      menu: 'KeyX',
      up: 'KeyW',
      down: 'KeyS',
      enter: 'Space',
      exit: 'Backspace',
      pause: 'KeyZ',
    }
    expect(mergeKeyConfig(custom)).toEqual(custom)
  })

  it('overrides a subset of keys', () => {
    const result = mergeKeyConfig({ up: 'KeyW', down: 'KeyS' })
    expect(result.up).toBe('KeyW')
    expect(result.down).toBe('KeyS')
    expect(result.menu).toBe(DEFAULT_KEY_CONFIG.menu)
  })
})
