export const deployStatus = {
  path: '/deploy-status',
  method: 'get' as const,
  handler: async (req: any) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 })
    }

    const managerUrl = process.env.SERVER_MANAGER_URL || 'http://host.docker.internal:5556'
    const token = process.env.SERVER_MANAGER_TOKEN || ''

    try {
      const res = await fetch(`${managerUrl}/deploy-status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        return Response.json({ step: null })
      }
      const data = await res.json()
      return Response.json(data)
    } catch {
      return Response.json({ step: null })
    }
  },
}