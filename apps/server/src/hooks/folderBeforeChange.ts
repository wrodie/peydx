import type { CollectionBeforeChangeHook } from 'payload'
import { getAncestorCount } from '../collections/folder-utils'

export const folderBeforeChange: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  const user = req.user as any

  if (data.parent) {
    const parentId =
      typeof data.parent === 'object' ? data.parent.id : data.parent
    const parent = await req.payload.findByID({
      collection: 'folders',
      id: parentId,
      depth: 0,
    })
    if (parent?.department) {
      data.department =
        typeof parent.department === 'object'
          ? parent.department.id
          : parent.department
    }
  }

  if (user && user.role !== 'admin') {
    const deptIds = (user.departments || []).map((d: any) =>
      typeof d === 'object' ? d.id : d
    )
    if (deptIds.length > 0 && !data.department) {
      data.department = deptIds[0]
    }
  }

  if (data.parent) {
    const parentId =
      typeof data.parent === 'object' ? data.parent.id : data.parent

    if (operation === 'update' && parentId === (data as any).id) {
      throw new Error('A folder cannot be its own parent')
    }

    const ancestorCount = await getAncestorCount(req.payload, parentId)
    if (ancestorCount >= 2) {
      throw new Error(
        'Maximum folder nesting depth is 3 levels. The selected parent is already at depth 3.'
      )
    }
  }

  return data
}
