export const deploy = {
  path: '/deploy',
  method: 'post' as const,
  handler: async (req: any) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 })
    }

    let body: { version?: string } = {}
    try {
      body = await req.clone().json()
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const version = body.version
    if (!version || typeof version !== 'string') {
      return Response.json({ error: 'Version is required' }, { status: 400 })
    }

    const managerUrl = process.env.SERVER_MANAGER_URL || 'http://host.docker.internal:5556'
    const token = process.env.SERVER_MANAGER_TOKEN || ''

    await req.payload
      .updateGlobal({
        slug: 'settings',
        data: { clientVersion: version },
      })
      .catch((err: any) => {
        console.error('Failed to update clientVersion:', err)
      })

    try {
      const res = await fetch(`${managerUrl}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version }),
      })
      if (!res.ok) {
        const text = await res.text()
        return Response.json({ error: `Server manager error: ${text}` }, { status: 502 })
      }
      return Response.json({ success: true, message: `Deploying ${version}` })
    } catch (err: any) {
      console.error('Deploy trigger failed:', err)
      return Response.json({ error: `Server manager unreachable: ${err.message}` }, { status: 502 })
    }
  },
}
