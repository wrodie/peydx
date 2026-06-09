import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAncestorCount, resolveDepartmentId, resolveParentId } from '../../../collections/folder-utils'

describe('getAncestorCount', () => {
  let payload: any

  beforeEach(() => {
    payload = {
      findByID: vi.fn(),
    }
  })

  it('returns 0 for root folder (no parent)', async () => {
    payload.findByID.mockResolvedValue({ parent: null })
    const count = await getAncestorCount(payload, 1)
    expect(count).toBe(0)
  })

  it('returns 1 for direct child of root', async () => {
    payload.findByID
      .mockResolvedValueOnce({ parent: 1 })
      .mockResolvedValueOnce({ parent: null })
    const count = await getAncestorCount(payload, 2)
    expect(count).toBe(1)
  })

  it('returns 2 for depth-2 folder (child of child of root)', async () => {
    payload.findByID
      .mockResolvedValueOnce({ parent: 2 })
      .mockResolvedValueOnce({ parent: 1 })
      .mockResolvedValueOnce({ parent: null })
    const count = await getAncestorCount(payload, 3)
    expect(count).toBe(2)
  })

  it('handles parent as object', async () => {
    payload.findByID
      .mockResolvedValueOnce({ parent: { id: 1 } })
      .mockResolvedValueOnce({ parent: null })
    const count = await getAncestorCount(payload, 2)
    expect(count).toBe(1)
  })
})

describe('resolveDepartmentId', () => {
  it('returns id from object', () => {
    expect(resolveDepartmentId({ id: 5, name: 'Worship' })).toBe(5)
  })

  it('returns primitive value', () => {
    expect(resolveDepartmentId(7)).toBe(7)
  })

  it('returns undefined for null/undefined', () => {
    expect(resolveDepartmentId(null)).toBeUndefined()
    expect(resolveDepartmentId(undefined)).toBeUndefined()
  })
})

describe('resolveParentId', () => {
  it('returns id from object', () => {
    expect(resolveParentId({ id: 10 })).toBe(10)
  })

  it('returns primitive value', () => {
    expect(resolveParentId(15)).toBe(15)
  })

  it('returns undefined for null/undefined', () => {
    expect(resolveParentId(null)).toBeUndefined()
    expect(resolveParentId(undefined)).toBeUndefined()
  })
})
