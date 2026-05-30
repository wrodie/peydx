import { createServer } from 'http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from 'signage-core'
import dotenv from 'dotenv'
import path from 'path'

const envPath = path.resolve(process.cwd(), '../../.env')
dotenv.config({ path: envPath })

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

const API_URL = process.env.API_URL || `http://localhost:${port}/api`

async function verifyDeviceApiKey(apiKey: string): Promise<{ id: number; deviceId: string; departments: string[]; controllingDevice: number | null } | null> {
  try {
    const res = await fetch(`${API_URL}/devices?depth=0&limit=1`, {
      headers: { Authorization: `devices API-Key ${apiKey}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    const device = data.docs?.[0]
    if (!device) return null
    return {
      id: device.id,
      deviceId: device.deviceId,
      departments: device.departments || [],
      controllingDevice: device.controllingDevice || null,
    }
  } catch {
    return null
  }
}

async function verifyBrowserToken(token: string): Promise<{ id: number; deviceId: string; departments: string[]; controllingDevice: number | null } | null> {
  try {
    const res = await fetch(`${API_URL}/devices?where[browserToken][equals]=${token}&depth=0&limit=1`)
    if (!res.ok) return null
    const data = await res.json()
    const device = data.docs?.[0]
    if (!device || device.deviceType !== 'browser') return null
    return {
      id: device.id,
      deviceId: device.deviceId,
      departments: device.departments || [],
      controllingDevice: device.controllingDevice || null,
    }
  } catch {
    return null
  }
}

async function handleDeviceHeartbeat(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: any,
  data: { programId: number | null; slideIndex: number }
) {
  const device = socket.data
  try {
    await fetch(`${API_URL}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `devices API-Key ${socket.handshake.auth?.apiKey || ''}`,
      },
      body: JSON.stringify({
        programId: data.programId,
        slideIndex: data.slideIndex,
      }),
    })

    for (const dep of device.departments) {
      io.to(`department:${dep}`).emit('device:status', {
        deviceId: device.deviceId,
        slideIndex: data.slideIndex,
        programId: data.programId,
        status: 'online',
      })
    }
    io.to('admin').emit('device:status', {
      deviceId: device.deviceId,
      slideIndex: data.slideIndex,
      programId: data.programId,
      status: 'online',
    })
  } catch (err) {
    console.error('Heartbeat handler error:', err)
  }
}

async function handleDeviceSlideChange(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: any,
  data: { slideIndex: number }
) {
  const device = socket.data
  try {
    await fetch(`${API_URL}/devices/${device.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `devices API-Key ${socket.handshake.auth?.apiKey || ''}`,
      },
      body: JSON.stringify({
        currentSlideIndex: data.slideIndex,
        lastHeartbeat: new Date().toISOString(),
        status: 'online',
      }),
    })

    for (const dep of device.departments) {
      io.to(`department:${dep}`).emit('device:status', {
        deviceId: device.deviceId,
        slideIndex: data.slideIndex,
        programId: null,
        status: 'online',
      })
    }
    io.to('admin').emit('device:status', {
      deviceId: device.deviceId,
      slideIndex: data.slideIndex,
      programId: null,
      status: 'online',
    })

    // Mirror forwarding
    const res = await fetch(`${API_URL}/devices?where[controllingDevice][equals]=${device.id}&depth=0`, {
      headers: { Authorization: `devices API-Key ${socket.handshake.auth?.apiKey || ''}` },
    })
    if (res.ok) {
      const result = await res.json()
      for (const controlled of result.docs || []) {
        io.to(`device:${controlled.id}`).emit('remote:goto', { slideIndex: data.slideIndex })
      }
    }
  } catch (err) {
    console.error('Slide change handler error:', err)
  }
}

function handleRemoteAdvance(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  _socket: any,
  data: { deviceId: string }
) {
  io.to(`device:${data.deviceId}`).emit('remote:advance')
}

function handleRemotePrevious(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  _socket: any,
  data: { deviceId: string }
) {
  io.to(`device:${data.deviceId}`).emit('remote:previous')
}

function handleRemoteGoto(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  _socket: any,
  data: { deviceId: string; slideIndex: number }
) {
  io.to(`device:${data.deviceId}`).emit('remote:goto', { slideIndex: data.slideIndex })
}

async function handleRemoteProgram(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: any,
  data: { deviceId: string; programId: number }
) {
  try {
    const res = await fetch(`${API_URL}/programs/${data.programId}?depth=2`, {
      headers: { Authorization: `devices API-Key ${socket.handshake.auth?.apiKey || ''}` },
    })
    if (!res.ok) return
    const program = await res.json()
    io.to(`device:${data.deviceId}`).emit('remote:program', {
      program,
      slideIndex: 0,
    })
  } catch (err) {
    console.error('Remote program handler error:', err)
  }
}

async function handleMirrorInitialState(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: any
) {
  const device = socket.data
  if (!device.controllingDevice) return

  try {
    const res = await fetch(`${API_URL}/devices/${device.controllingDevice}?depth=1`, {
      headers: { Authorization: `devices API-Key ${socket.handshake.auth?.apiKey || ''}` },
    })
    if (!res.ok) return
    const controller = await res.json()

    if (controller.currentProgram) {
      const programId = typeof controller.currentProgram === 'object'
        ? controller.currentProgram.id
        : controller.currentProgram

      const progRes = await fetch(`${API_URL}/programs/${programId}?depth=2`, {
        headers: { Authorization: `devices API-Key ${socket.handshake.auth?.apiKey || ''}` },
      })
      if (!progRes.ok) return
      const program = await progRes.json()

      io.to(`device:${device.id}`).emit('remote:program', {
        program,
        slideIndex: controller.currentSlideIndex || 0,
      })
    }
  } catch (err) {
    console.error('Mirror initial state handler error:', err)
  }
}

app.prepare().then(() => {
  const httpServer = createServer(handle)

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/api/ws',
    cors: {
      origin: dev ? ['http://localhost:5000', 'http://localhost:5173'] : '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization
      const token = socket.handshake.auth?.token || socket.handshake.query?.token as string | undefined

      // Device API key auth
      if (authHeader && authHeader.startsWith('devices API-Key ')) {
        const apiKey = authHeader.slice('devices API-Key '.length)
        const device = await verifyDeviceApiKey(apiKey)
        if (device) {
          socket.data = { type: 'device', ...device }
          next()
          return
        }
      }

      // Browser token auth
      if (token) {
        const device = await verifyBrowserToken(token)
        if (device) {
          socket.data = { type: 'device', ...device }
          next()
          return
        }
      }

      next(new Error('Authentication required'))
    } catch (err) {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    const { type, id, department, departments, controllingDevice } = socket.data

    if (type === 'device') {
      socket.join(`device:${id}`)
      for (const dep of departments || []) {
        socket.join(`department:${dep}`)
      }
    } else if (type === 'user') {
      if (department) socket.join(`department:${department}`)
      if (socket.data.role === 'admin') socket.join('admin')
    }

    socket.on('device:heartbeat', async (data: any, callback: any) => {
      await handleDeviceHeartbeat(io, socket, data)
      callback?.({ ok: true })
    })

    socket.on('device:slideChange', (data: any) => {
      handleDeviceSlideChange(io, socket, data)
    })

    socket.on('remote:advance', (data: any) => {
      handleRemoteAdvance(io, socket, data)
    })

    socket.on('remote:previous', (data: any) => {
      handleRemotePrevious(io, socket, data)
    })

    socket.on('remote:goto', (data: any) => {
      handleRemoteGoto(io, socket, data)
    })

    socket.on('remote:program', (data: any) => {
      handleRemoteProgram(io, socket, data)
    })

    if (type === 'device' && controllingDevice) {
      handleMirrorInitialState(io, socket)
    }
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
