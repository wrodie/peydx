import type { CollectionConfig } from 'payload'

async function getAncestorCount(payload: any, folderId: number): Promise<number> {
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

export const Folders: CollectionConfig = {
  slug: 'folders',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'department', 'order', 'parent'],
    group: 'Admin',
    hidden: ({ user }) => (user as any)?.role !== 'admin',
  },
  access: {
    read: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return { department: { exists: false } }
      if (user.role === 'admin') return true
      if (user.role === 'basic') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { department: { in: deptIds } }
      }
      if (user.collection === 'devices') {
        const deptIds = (user.departments || []).map((d: any) =>
          typeof d === 'object' ? d.id : d
        )
        return { department: { in: deptIds } }
      }
      return { department: { exists: false } }
    },
    create: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'basic') return true
      return false
    },
    update: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'basic') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { department: { in: deptIds } }
      }
      return false
    },
    delete: ({ req: { user: u } }) => (u as any)?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
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
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
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
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'folders',
      required: false,
      filterOptions: ({ data }) => {
        const filters: any = {}
        if (data?.type) {
          filters.type = { equals: data.type }
        }
        if (data?.department) {
          const deptId =
            typeof data.department === 'object'
              ? data.department.id
              : data.department
          filters.department = { equals: deptId }
        }
        return filters
      },
      admin: {
        description: 'Parent folder. Leave empty to create a top-level folder.',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Media', value: 'media' },
        { label: 'Programs', value: 'programs' },
      ],
      admin: {
        description: 'Which collection this folder belongs to.',
      },
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      required: false,
      admin: {
        condition: (_, __, { user }) => (user as any)?.role === 'admin',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Sort order within sibling folders (lower = first).',
      },
    },
  ],
}
