export async function getAncestorCount(payload: any, folderId: number): Promise<number> {
  let count = 0
  let currentId: number | null = folderId

  while (currentId) {
    const result: { parent?: number | { id: number } | null } = await payload.findByID({
      collection: 'folders',
      id: currentId,
      depth: 0,
    })
    const parent = result?.parent
    if (!parent) break
    count++
    currentId = typeof parent === 'object' ? parent.id : parent
  }

  return count
}

export function resolveDepartmentId(department: any): number | undefined {
  if (department == null) return undefined
  return typeof department === 'object' ? department.id : department
}

export function resolveParentId(parent: any): number | undefined {
  if (parent == null) return undefined
  return typeof parent === 'object' ? parent.id : parent
}
