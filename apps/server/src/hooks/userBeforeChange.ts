import type { CollectionBeforeChangeHook } from 'payload'

export const userBeforeChange: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  const user = req.user as any
  if (!user) return data

  if (user.role === 'admin') return data

  if (user.role === 'manager') {
    const targetRole = data.role
    if (targetRole && targetRole !== 'standard') {
      throw new Error('Managers can only create users with the Standard role')
    }

    const managerDeptIds = (user.departments || []).map((d: any) =>
      typeof d === 'object' ? d.id : d,
    )
    const newDeptIds = (data.departments || []).map((d: any) =>
      typeof d === 'object' ? d.id : d,
    )
    if (newDeptIds.some((id: number) => !managerDeptIds.includes(id))) {
      throw new Error('Managers can only assign users to their own departments')
    }
  }

  return data
}
