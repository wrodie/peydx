import type { CollectionConfig } from 'payload'
import { userBeforeChange } from '../hooks/userBeforeChange'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // This tells Payload to bake these specific fields into the secure cookie JWT
    // @ts-ignore - typegen doesn't include custom JWT fields
    saveToJWT: ['role', 'departments'],
  },
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
    hidden: ({ user }) => {
      const role = (user as any)?.role
      return role !== 'admin' && role !== 'manager'
    },
  },
  access: {
    read: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'manager') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { departments: { in: deptIds } } as any
      }
      if (user.role === 'standard') return { id: { equals: user.id } } as any
      return false
    },
    create: ({ req: { user: u } }) => {
      const user = u as any
      return user?.role === 'admin' || user?.role === 'manager'
    },
    update: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'manager') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { departments: { in: deptIds } } as any
      }
      return false
    },
    delete: ({ req: { user: u } }) => {
      const user = u as any
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'manager') {
        const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
        return { departments: { in: deptIds } } as any
      }
      return false
    },
  },
  hooks: {
    beforeChange: [userBeforeChange],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'standard',
      admin: {
        condition: (_, __, { user }) => (user as any)?.role === 'admin',
      },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Manager', value: 'manager' },
        { label: 'Standard', value: 'standard' },
      ],
    },
    {
      name: 'departments',
      type: 'relationship',
      relationTo: 'departments',
      hasMany: true,
      required: true,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) => {
          const role = (user as any)?.role
          return role === 'admin' || role === 'manager'
        },
      },
      filterOptions: ({ user: u }) => {
        const user = u as any
        if (!user) return false
        if (user.role === 'admin') return true
        if (user.role === 'manager') {
          const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
          return { id: { in: deptIds } }
        }
        return false
      },
    },
  ],
}


