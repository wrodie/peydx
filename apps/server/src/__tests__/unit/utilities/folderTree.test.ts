import { describe, it, expect } from 'vitest'
import { buildTree, canNestAtDepth, MAX_FOLDER_DEPTH } from '../../../utilities/ui/folderTree'

describe('buildTree', () => {
  it('builds a nested tree with depth', () => {
    const docs = [
      { id: 1, name: 'Root', parent: null },
      { id: 2, name: 'Child', parent: 1 },
      { id: 3, name: 'Grandchild', parent: 2 },
    ]
    const tree = buildTree(docs)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe(1)
    expect(tree[0].depth).toBe(0)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].id).toBe(2)
    expect(tree[0].children[0].depth).toBe(1)
    expect(tree[0].children[0].children[0].id).toBe(3)
    expect(tree[0].children[0].children[0].depth).toBe(2)
  })

  it('handles parent as object reference', () => {
    const docs = [
      { id: 1, name: 'Root', parent: null },
      { id: 2, name: 'Child', parent: { id: 1 } },
    ]
    const tree = buildTree(docs)
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(1)
  })

  it('returns multiple roots when parents are missing', () => {
    const docs = [
      { id: 1, name: 'A', parent: null },
      { id: 2, name: 'B', parent: null },
      { id: 3, name: 'Orphan', parent: 999 },
    ]
    const tree = buildTree(docs)
    expect(tree.map((n) => n.id).sort()).toEqual([1, 2, 3])
  })

  it('returns empty array for no docs', () => {
    expect(buildTree([])).toEqual([])
  })
})

describe('canNestAtDepth', () => {
  it('enforces the 3-level depth limit', () => {
    expect(MAX_FOLDER_DEPTH).toBe(3)
    expect(canNestAtDepth(0)).toBe(true)
    expect(canNestAtDepth(1)).toBe(true)
    expect(canNestAtDepth(2)).toBe(false)
    expect(canNestAtDepth(3)).toBe(false)
  })
})
