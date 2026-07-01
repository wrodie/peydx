import type { CollectionBeforeDeleteHook } from 'payload'

export const userBeforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const user = req.user as any
  if (!user) return
  if (user.role === 'admin') return

  if (user.role === 'manager') {
    if (id === user.id) {
      throw new Error('Managers cannot delete themselves')
    }

    const target = await req.payload.findByID({
      collection: 'users',
      id,
      overrideAccess: true,
    })

    if (target.role !== 'standard') {
      throw new Error('Managers can only delete Standard users')
    }

    return
  }

  return
}
