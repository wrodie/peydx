export interface TreeNode {
  id: number
  name: string
  parent: number | { id: number } | null
  children: TreeNode[]
  depth: number
}

export const MAX_FOLDER_DEPTH = 3

export function canNestAtDepth(depth: number): boolean {
  return depth < MAX_FOLDER_DEPTH - 1
}

export function buildTree(docs: any[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  for (const doc of docs) {
    map.set(doc.id, { ...doc, children: [], depth: 0 })
  }

  for (const doc of docs) {
    const parentId = doc.parent
      ? typeof doc.parent === 'object'
        ? doc.parent.id
        : doc.parent
      : null
    const node = map.get(doc.id)!
    if (parentId != null && map.has(parentId)) {
      const parent = map.get(parentId)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      node.depth = 0
      roots.push(node)
    }
  }

  return roots
}
