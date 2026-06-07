import type { CollectionConfig } from 'payload'

export const Departments: CollectionConfig = {
  slug: 'departments',
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
    hidden: ({ user }) => (user as any)?.role !== 'admin',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => (user as any)?.role === 'admin',
    update: ({ req: { user } }) => (user as any)?.role === 'admin',
    delete: ({ req: { user } }) => (user as any)?.role === 'admin',
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
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
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
