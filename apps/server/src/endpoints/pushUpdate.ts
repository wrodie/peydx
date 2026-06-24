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

    const io = getIO()
    const payload = getPayload()
    if (!io) {
      return Response.json({ error: 'WebSocket server not available' }, { status: 500 })
    }

    // Get the deployed version from the server-manager (same source as the Deploy button)
    let version = 'latest'
    try {
      const managerUrl = process.env.SERVER_MANAGER_URL || 'http://host.docker.internal:5556'
      const token = process.env.SERVER_MANAGER_TOKEN || ''
      const res = await fetch(`${managerUrl}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.latestVersion) version = data.latestVersion
      }
    } catch {
      // Fall back to 'latest' if server-manager unreachable
    }

    const deviceSockets = [...io.sockets.sockets.values()]
      .filter(s => s.data.type === 'device' && s.data.deviceType === 'hardware' && s.data.id != null)

    const targetSockets = body.deviceId
      ? deviceSockets.filter(s => s.data.id === body.deviceId)
      : deviceSockets

    if (body.deviceId && targetSockets.length === 0) {
      return Response.json({ success: false, error: 'Device not connected', devicesUpdated: 0 })
    }

    let devicesUpdated = 0
    const results: { id: number; ok: boolean }[] = []

    for (const s of targetSockets) {
      try {
        const ack = await Promise.race([
          (s as any).emitWithAck('remote:update', { version }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 15000)
          ),
        ]) as { ok: boolean }

        if (ack?.ok) {
          devicesUpdated++
          results.push({ id: s.data.id, ok: true })

          if (payload) {
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
          for (const dep of (s.data.departments || [])) {
            io.to(`department:${dep}`).emit('device:status', {
              id: s.data.id,
              slideIndex: 0,
              programId: null,
              status: 'updating',
            })
          }
          io.to('admin').emit('device:status', {
            id: s.data.id,
            slideIndex: 0,
            programId: null,
            status: 'updating',
          })
        } else {
          results.push({ id: s.data.id, ok: false })
        }
      } catch {
        results.push({ id: s.data.id, ok: false })
      }
    }

    if (body.deviceId) {
      const deviceResult = results[0]
      if (deviceResult?.ok) {
        return Response.json({ success: true, devicesUpdated: 1 })
      }
      return Response.json({ success: false, error: 'Device did not respond', devicesUpdated: 0 })
    }

    const failed = results.filter(r => !r.ok).length
    if (failed > 0) {
      return Response.json({
        success: true,
        devicesUpdated,
        warning: `${failed} device(s) did not respond`,
      })
    }

    return Response.json({ success: true, devicesUpdated })
  },
}
