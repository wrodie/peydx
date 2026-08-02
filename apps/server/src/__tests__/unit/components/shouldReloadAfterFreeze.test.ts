import { describe, it, expect } from 'vitest'
import { shouldReloadAfterFreeze } from '../../../components/shouldReloadAfterFreeze'

const FIVE_MINUTES = 5 * 60 * 1000

describe('shouldReloadAfterFreeze', () => {
  it('returns true when gap exceeds threshold, playing, and visible', () => {
    expect(shouldReloadAfterFreeze(FIVE_MINUTES + 1, FIVE_MINUTES, true, true)).toBe(true)
  })

  it('returns false when gap is within threshold', () => {
    expect(shouldReloadAfterFreeze(FIVE_MINUTES - 1, FIVE_MINUTES, true, true)).toBe(false)
  })

  it('returns false when gap is exactly threshold', () => {
    expect(shouldReloadAfterFreeze(FIVE_MINUTES, FIVE_MINUTES, true, true)).toBe(false)
  })

  it('returns false when not playing', () => {
    expect(shouldReloadAfterFreeze(FIVE_MINUTES + 1, FIVE_MINUTES, false, true)).toBe(false)
  })

  it('returns false when not visible', () => {
    expect(shouldReloadAfterFreeze(FIVE_MINUTES + 1, FIVE_MINUTES, true, false)).toBe(false)
  })

  it('returns false when not visible and not playing', () => {
    expect(shouldReloadAfterFreeze(FIVE_MINUTES + 1, FIVE_MINUTES, false, false)).toBe(false)
  })

  it('returns false for zero gap', () => {
    expect(shouldReloadAfterFreeze(0, FIVE_MINUTES, true, true)).toBe(false)
  })
})
