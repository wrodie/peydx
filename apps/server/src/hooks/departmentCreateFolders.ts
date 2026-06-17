import type { CollectionAfterChangeHook } from 'payload'

export const departmentCreateFolders: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return
  const name = (doc as any).name
  const deptId = doc.id
  await Promise.all([
    req.payload.create({
      collection: 'folders',
      data: { name, type: 'media', department: deptId, order: 0 },
      req,
    }),
    req.payload.create({
      collection: 'folders',
      data: { name, type: 'programs', department: deptId, order: 0 },
      req,
    }),
  ])
}
