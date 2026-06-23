import { getIO, getPayload } from '../websocket/io'

export const pushUpdate = {
  path: '/push-update',
  method: 'post' as const,
  handler: async (req: any) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 })
    }

    let body: { deviceId?: number } = {}
    try {
      body = await req.clone().json()
    } catch {
      // body is optional
    }

    const version = 'latest'

    const io = getIO()
    const payload = getPayload()
    if (!io) {
      return Response.json({ error: 'WebSocket server not available' }, { status: 500 })
    }

    const allSockets = (await io.in('devices').fetchSockets())
      .filter(s => s.data.deviceType === 'hardware')

    const targetSockets = body.deviceId
      ? allSockets.filter(s => s.data.id === body.deviceId)
      : allSockets

    if (body.deviceId && targetSockets.length === 0) {
      return Response.json({ success: true, devicesUpdated: 0 })
    }

    let devicesUpdated = 0
    const results = await Promise.allSettled(
      targetSockets.map(async (s) => {
        try {
          await s.emitWithAck('remote:update', { version })
          devicesUpdated++

          if (payload && s.data.id) {
            await payload.update({
              collection: 'devices',
              id: s.data.id,
              data: { status: 'updating' },
              overrideAccess: true,
            })
          }

          io.to(`device:${s.data.id}`).emit('device:status', {
            id: s.data.id,
            slideIndex: 0,
            programId: null,
            status: 'updating',
          })
        } catch {
          // Device didn't ACK — skip
        }
      })
    )

    return Response.json({ success: true, devicesUpdated })
  },
}
