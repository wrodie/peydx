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

    const heartbeatData: Record<string, any> = {
      lastHeartbeat: new Date().toISOString(),
      currentSlideIndex: typeof body.slideIndex === 'number' ? body.slideIndex : req.user.currentSlideIndex ?? undefined,
      status: 'online',
    }
    if (body.programId !== undefined) heartbeatData.currentProgram = typeof body.programId === 'number' ? body.programId : null
    if (typeof body.clientVersion === 'string') heartbeatData.clientVersion = body.clientVersion
    await req.payload.update({
      collection: 'devices',
      id: req.user.id,
      data: heartbeatData,
    })

    return Response.json({ ok: true })
  },
}
