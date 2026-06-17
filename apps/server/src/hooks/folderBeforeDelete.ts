import type { CollectionBeforeDeleteHook } from 'payload'

export const folderBeforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const [childFolders, childMedia, childPrograms] = await Promise.all([
    req.payload.find({
      collection: 'folders',
      depth: 0,
      pagination: false,
      where: { parent: { equals: id } },
    }),
    req.payload.find({
      collection: 'media',
      depth: 0,
      pagination: false,
      where: { folder: { equals: id } },
    }),
    req.payload.find({
      collection: 'programs',
      depth: 0,
      pagination: false,
      where: { folder: { equals: id } },
    }),
  ])

  const blockers: string[] = []
  if (childFolders.totalDocs > 0)
    blockers.push(`${childFolders.totalDocs} sub-folder(s)`)
  if (childMedia.totalDocs > 0)
    blockers.push(`${childMedia.totalDocs} media item(s)`)
  if (childPrograms.totalDocs > 0)
    blockers.push(`${childPrograms.totalDocs} program(s)`)

  if (blockers.length > 0) {
    throw new Error(
      `Cannot delete folder: it contains ${blockers.join(', ')}. ` +
        'Move or delete the contents first.'
    )
  }
}
