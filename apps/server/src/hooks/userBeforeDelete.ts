import type { CollectionBeforeDeleteHook } from 'payload'
import { APIError } from 'payload'

export const userBeforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const user = req.user as any
  if (!user) return
  if (user.role === 'admin') return

  if (user.role === 'manager') {
    if (id === user.id) {
      throw new APIError('Managers cannot delete themselves', 400)
    }

    const target = await req.payload.findByID({
      collection: 'users',
      id,
      overrideAccess: true,
    })

    if (target.role !== 'standard') {
      throw new APIError('Managers can only delete Standard users', 403)
    }

    return
  }

  return
}
