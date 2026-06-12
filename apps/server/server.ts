import { createServer } from 'http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from 'signage-core'
import './src/load-env'
import { getPayload as initPayload } from 'payload'

import config from './src/payload.config'
import { setPayload, getPayload, setIO } from './src/websocket/io'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

const API_URL = process.env.API_URL || `http://localhost:${port}/api`

const deviceStateStore = new Map<number, { state: string; programId: number | null; slideIndex: number }>()

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
  const payload = getPayload()
  if (!payload) return
  try {
    await payload.update({
      collection: 'devices',
      id: device.id,
      data: {
        lastHeartbeat: new Date().toISOString(),
        currentProgram: data.programId ?? null,
        currentSlideIndex: data.slideIndex,
        status: 'online',
      },
      overrideAccess: true,
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
    deviceStateStore.set(device.id, { state: 'playing', programId: data.programId, slideIndex: data.slideIndex })
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
  const payload = getPayload()
  if (!payload) return
  const existing = deviceStateStore.get(device.id)
  deviceStateStore.set(device.id, { state: 'playing', programId: existing?.programId ?? null, slideIndex: data.slideIndex })
  try {
    await payload.update({
      collection: 'devices',
      id: device.id,
      data: {
        currentSlideIndex: data.slideIndex,
        lastHeartbeat: new Date().toISOString(),
        status: 'online',
      },
      overrideAccess: true,
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
    const controlled = await payload.find({
      collection: 'devices',
      depth: 0,
      where: { controllingDevice: { equals: device.id } },
      overrideAccess: true,
    })
    for (const controlledDevice of controlled.docs || []) {
      io.to(`device:${controlledDevice.id}`).emit('remote:goto', { slideIndex: data.slideIndex })
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
  const payload = getPayload()
  if (!payload) return
  try {
    const program = await payload.findByID({
      collection: 'programs',
      id: data.programId,
      depth: 2,
    })
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

  const payload = getPayload()
  if (!payload) return

  try {
    const controller = await payload.findByID({
      collection: 'devices',
      id: device.controllingDevice,
      depth: 1,
      overrideAccess: true,
    })

    if (controller.currentProgram) {
      const programId = typeof controller.currentProgram === 'object'
        ? controller.currentProgram.id
        : controller.currentProgram

      const program = await payload.findByID({
        collection: 'programs',
        id: programId,
        depth: 2,
      })

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
  const payload = getPayload()
  if (!payload) return
  deviceStateStore.set(device.id, { state: data.state, programId: data.programId ?? null, slideIndex: data.menuIndex ?? 0 })
  try {
    await payload.update({
      collection: 'devices',
      id: device.id,
      data: {
        lastHeartbeat: new Date().toISOString(),
        currentProgram: data.programId ?? null,
        currentSlideIndex: data.menuIndex ?? 0,
        status: 'online',
      },
      overrideAccess: true,
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

function handleRemotePause(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  _socket: any,
  data: { id: number }
) {
  io.to(`device:${data.id}`).emit('remote:pause')
}

app.prepare().then(async () => {
  const payload = await initPayload({ config })
  setPayload(payload)

  const httpServer = createServer(async (req, res) => {
    // Device state store endpoint (in-memory, instant)
    if (req.url?.startsWith('/api/device-state/')) {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const token = url.searchParams.get('token')
      const authHeader = req.headers.authorization || ''
      const cookie = req.headers.cookie || ''
      let authenticated = false

      if (authHeader.startsWith('devices API-Key ')) {
        const apiKey = authHeader.slice('devices API-Key '.length)
        const device = await verifyDeviceApiKey(apiKey)
        if (device) authenticated = true
      } else if (token) {
        const device = await verifyBrowserToken(token)
        if (device) authenticated = true
      } else if (cookie) {
        try {
          const meRes = await fetch(`${API_URL}/users/me`, { headers: { Cookie: cookie } })
          if (meRes.ok) { const me = await meRes.json(); if (me.user) authenticated = true }
        } catch {}
      }

      if (!authenticated) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }

      const id = parseInt(req.url.split('/').pop()?.split('?')[0] || '', 10)
      const state = deviceStateStore.get(id)
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(state || null))
      return
    }
    handle(req, res)
  })

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/api/ws',
    cors: {
      origin: dev ? ['http://localhost:5000', 'http://localhost:5173'] : '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  setIO(io)

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
                departments: (me.user.departments || []).map((d: any) =>
                  typeof d === 'object' ? d.id : d
                ),
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

  io.on('connection', async (socket) => {
    const { type, id, departments, controllingDevice } = socket.data

    if (type === 'device') {
      socket.join(`device:${id}`)
      socket.join('devices')
      for (const dep of departments || []) {
        socket.join(`department:${dep}`)
      }

      // Set device online on connect
      const payload = getPayload()
      if (payload) {
        try {
          await payload.update({
            collection: 'devices',
            id,
            data: { status: 'online', lastHeartbeat: new Date().toISOString() },
            overrideAccess: true,
          })
        } catch (err) {
          console.error('Failed to set device online:', err)
        }
      }

      // Notify admin/departments
      for (const dep of departments || []) {
        io.to(`department:${dep}`).emit('device:status', {
          id,
          slideIndex: 0,
          programId: null,
          status: 'online',
        })
      }
      io.to('admin').emit('device:status', {
        id,
        slideIndex: 0,
        programId: null,
        status: 'online',
      })

      socket.on('disconnect', async () => {
        const payload = getPayload()
        if (payload) {
          try {
            await payload.update({
              collection: 'devices',
              id,
              data: { status: 'offline' },
              overrideAccess: true,
            })
          } catch (err) {
            console.error('Failed to set device offline:', err)
          }
        }
        for (const dep of departments || []) {
          io.to(`department:${dep}`).emit('device:status', {
            id,
            slideIndex: 0,
            programId: null,
            status: 'offline',
          })
        }
        io.to('admin').emit('device:status', {
          id,
          slideIndex: 0,
          programId: null,
          status: 'offline',
        })
      })
    } else if (type === 'user') {
      for (const dep of departments || []) {
        socket.join(`department:${dep}`)
      }
      if (socket.data.role === 'admin') socket.join('admin')
    }

    socket.on('device:heartbeat', async (data: any, callback: any) => {
      await handleDeviceHeartbeat(io, socket, data)
      callback?.({ ok: true })
    })

    socket.on('device:slideChange', async (data: any, callback: any) => {
      await handleDeviceSlideChange(io, socket, data)
      callback?.({ ok: true })
    })

    socket.on('device:stateChange', async (data: any, callback: any) => {
      await handleDeviceStateChange(io, socket, data)
      callback?.({ ok: true })
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

    socket.on('remote:pause', (data: any) => {
      handleRemotePause(io, socket, data)
    })

    if (type === 'device' && controllingDevice) {
      handleMirrorInitialState(io, socket)
    }
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
