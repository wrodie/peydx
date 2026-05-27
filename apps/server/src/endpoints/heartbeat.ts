export const heartbeat = {
  path: '/heartbeat',
  method: 'post' as const,
  handler: async (req: any) => {
    if (!req.user || req.user.collection !== 'devices') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, unknown> = {}
    try {
      body = await req.clone().json()
    } catch {
      // body is optional
    }

    await req.payload.update({
      collection: 'devices',
      id: req.user.id,
      data: {
        lastHeartbeat: new Date().toISOString(),
        currentProgram: typeof body.programId === 'number' ? body.programId : body.currentProgram ?? undefined,
        status: 'online',
      },
    })

    return Response.json({ ok: true })
  },
}
