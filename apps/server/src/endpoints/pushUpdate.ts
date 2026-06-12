import { getIO } from '../websocket/io'

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

    const settings = await req.payload.findGlobal({ slug: 'settings' })
    const version = settings?.clientVersion || 'v0.1.0'

    const io = getIO()
    if (!io) {
      return Response.json({ error: 'WebSocket server not available' }, { status: 500 })
    }

    if (body.deviceId) {
      io.to(`device:${body.deviceId}`).emit('remote:update', { version })
      return Response.json({ success: true, devicesUpdated: 1 })
    }

    const sockets = await io.in('devices').fetchSockets()
    io.to('devices').emit('remote:update', { version })
    return Response.json({ success: true, devicesUpdated: sockets.length })
  },
}
