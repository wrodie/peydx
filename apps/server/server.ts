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

async function verifyDeviceApiKey(apiKey: string): Promise<{ id: number; departments: string[]; controllingDevice: number | null } | null> {
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
      departments: device.departments || [],
      controllingDevice: device.controllingDevice || null,
    }
  } catch {
    return null
  }
}

async function verifyBrowserToken(token: string): Promise<{ id: number; departments: string[]; controllingDevice: number | null } | null> {
  try {
    const res = await fetch(`${API_URL}/devices?where[browserToken][equals]=${token}&depth=0&limit=1`)
    if (!res.ok) return null
    const data = await res.json()
    const device = data.docs?.[0]
    if (!device || device.deviceType !== 'browser') return null
    return {
      id: device.id,
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
        Authorization: `devices API-Key ${socket.data.apiKey || ''}`,
      },
      body: JSON.stringify({
        programId: data.programId,
        slideIndex: data.slideIndex,
      }),
    })

    for (const dep of device.departments) {
      io.to(`department:${dep}`).emit('device:status', {
        id: device.id,
        slideIndex: data.slideIndex,
        programId: data.programId,
        status: 'online',
      })
    }
    io.to('admin').emit('device:status', {
      id: device.id,
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
        Authorization: `devices API-Key ${socket.data.apiKey || ''}`,
      },
      body: JSON.stringify({
        currentSlideIndex: data.slideIndex,
        lastHeartbeat: new Date().toISOString(),
        status: 'online',
      }),
    })

    for (const dep of device.departments) {
      io.to(`department:${dep}`).emit('device:status', {
        id: device.id,
        slideIndex: data.slideIndex,
        programId: null,
        status: 'online',
      })
    }
    io.to('admin').emit('device:status', {
      id: device.id,
      slideIndex: data.slideIndex,
      programId: null,
      status: 'online',
    })

    // Mirror forwarding
    const res = await fetch(`${API_URL}/devices?where[controllingDevice][equals]=${device.id}&depth=0`, {
      headers: { Authorization: `devices API-Key ${socket.data.apiKey || ''}` },
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
  data: { id: number }
) {
  io.to(`device:${data.id}`).emit('remote:advance')
}

function handleRemotePrevious(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  _socket: any,
  data: { id: number }
) {
  io.to(`device:${data.id}`).emit('remote:previous')
}

function handleRemoteGoto(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  _socket: any,
  data: { id: number; slideIndex: number }
) {
  io.to(`device:${data.id}`).emit('remote:goto', { slideIndex: data.slideIndex })
}

async function handleRemoteProgram(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: any,
  data: { id: number; programId: number }
) {
  try {
    const headers: Record<string, string> = {}
    if (socket.data.apiKey) {
      headers.Authorization = `devices API-Key ${socket.data.apiKey}`
    } else if (socket.handshake.headers.cookie) {
      headers.Cookie = socket.handshake.headers.cookie as string
    }
    const res = await fetch(`${API_URL}/programs/${data.programId}?depth=2`, { headers })
    if (!res.ok) return
    const program = await res.json()
    io.to(`device:${data.id}`).emit('remote:program', {
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
      headers: { Authorization: `devices API-Key ${socket.data.apiKey || ''}` },
    })
    if (!res.ok) return
    const controller = await res.json()

    if (controller.currentProgram) {
      const programId = typeof controller.currentProgram === 'object'
        ? controller.currentProgram.id
        : controller.currentProgram

      const progRes = await fetch(`${API_URL}/programs/${programId}?depth=2`, {
        headers: { Authorization: `devices API-Key ${socket.data.apiKey || ''}` },
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

async function handleDeviceStateChange(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: any,
  data: { state: 'idle' | 'menu' | 'playing'; programId?: number; menuIndex?: number }
) {
  const device = socket.data
  try {
    await fetch(`${API_URL}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `devices API-Key ${socket.data.apiKey || ''}`,
      },
      body: JSON.stringify({
        programId: data.programId ?? null,
        slideIndex: data.menuIndex ?? 0,
      }),
    })

    for (const dep of device.departments) {
      io.to(`department:${dep}`).emit('device:status', {
        id: device.id,
        slideIndex: data.menuIndex ?? 0,
        programId: data.programId ?? null,
        status: 'online',
      })
      io.to(`department:${dep}`).emit('device:stateChange', {
        id: device.id,
        state: data.state,
        programId: data.programId,
      })
    }
    io.to('admin').emit('device:status', {
      id: device.id,
      slideIndex: data.menuIndex ?? 0,
      programId: data.programId ?? null,
      status: 'online',
    })
    io.to('admin').emit('device:stateChange', {
      id: device.id,
      state: data.state,
      programId: data.programId,
    })
  } catch (err) {
    console.error('State change handler error:', err)
  }
}

function handleRemoteMenu(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  _socket: any,
  data: { id: number }
) {
  io.to(`device:${data.id}`).emit('remote:menu')
}

function handleRemoteBack(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  _socket: any,
  data: { id: number }
) {
  io.to(`device:${data.id}`).emit('remote:back')
}

function handleRemoteSelect(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  _socket: any,
  data: { id: number }
) {
  io.to(`device:${data.id}`).emit('remote:select')
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
      const authApiKey =
        (authHeader && authHeader.startsWith('devices API-Key ')
          ? authHeader.slice('devices API-Key '.length)
          : null) || socket.handshake.auth?.apiKey

      if (authApiKey) {
        const device = await verifyDeviceApiKey(authApiKey)
        if (device) {
          socket.data = { type: 'device', apiKey: authApiKey, ...device }
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

      // Try user JWT cookie auth (admin UI)
      const cookie = socket.handshake.headers.cookie || ''
      if (cookie) {
        try {
          const meRes = await fetch(`${API_URL}/users/me`, {
            headers: { Cookie: cookie },
          })
          if (meRes.ok) {
            const me = await meRes.json()
            if (me.user) {
              socket.data = {
                type: 'user',
                id: me.user.id,
                role: me.user.role,
                department: me.user.department,
              }
              next()
              return
            }
          }
        } catch {
          // Fall through
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

    socket.on('device:stateChange', (data: any) => {
      handleDeviceStateChange(io, socket, data)
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

    socket.on('remote:menu', (data: any) => {
      handleRemoteMenu(io, socket, data)
    })

    socket.on('remote:back', (data: any) => {
      handleRemoteBack(io, socket, data)
    })

    socket.on('remote:select', (data: any) => {
      handleRemoteSelect(io, socket, data)
    })

    if (type === 'device' && controllingDevice) {
      handleMirrorInitialState(io, socket)
    }
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
