import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

export const userBeforeChange: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  const user = req.user as any

  // First-registration flow: no authenticated user, check if this is the first user
  if (!user && operation === 'create') {
    const { totalDocs } = await req.payload.count({ collection: 'users', req })
    if (totalDocs === 0) {
      data.role = 'admin'
    }
    return data
  }

  if (user.role === 'admin') return data

  if (user.role === 'manager') {
    const targetRole = data.role
    if (targetRole && targetRole !== 'standard') {
      throw new APIError('Managers can only create users with the Standard role', 403)
    }

    const managerDeptIds = (user.departments || []).map((d: any) =>
      typeof d === 'object' ? d.id : d,
    )
    const newDeptIds = (data.departments || []).map((d: any) =>
      typeof d === 'object' ? d.id : d,
    )
    if (newDeptIds.some((id: number) => !managerDeptIds.includes(id))) {
      throw new APIError('Managers can only assign users to their own departments', 403)
    }
  }

  return data
}
