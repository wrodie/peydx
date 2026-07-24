import type { CollectionBeforeChangeHook } from 'payload'

export const slidesFolderAutoAssign: CollectionBeforeChangeHook = async ({ data, req, context }) => {
  if ((context as any)?.skipFolderAutoAssign) return data
  if (!data.folder && req.user) {
    const user = req.user as any
    const prefs = await req.payload.find({
      collection: 'payload-preferences',
      depth: 0,
      pagination: false,
      where: {
        and: [
          { key: { equals: 'current-folder-slides' } },
          { 'user.value': { equals: req.user.id } },
        ],
      },
    })
    const prefValue = (prefs.docs?.[0]?.value as any)?.value as number | null
    if (prefValue) {
      data.folder = prefValue
    } else if (user.departments) {
      const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
      if (deptIds.length > 0) {
        const rootFolder = await req.payload.find({
          collection: 'folders',
          depth: 0,
          limit: 1,
          pagination: false,
          where: {
            type: { equals: 'slides' },
            department: { equals: deptIds[0] },
            parent: { exists: false },
          },
        })
        if (rootFolder.docs?.[0]) {
          data.folder = rootFolder.docs[0].id
        }
      }
    }
  }
  return data
}
