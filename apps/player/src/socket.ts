import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function createBrowserSocket(url: string, token: string): TypedSocket {
  return io(url, {
    path: '/api/ws',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  })
}

export function createHardwareSocket(url: string, apiKey: string): TypedSocket {
  return io(url, {
    path: '/ws',
    auth: { apiKey },
    extraHeaders: { Authorization: `devices API-Key ${apiKey}` },
    transports: ['websocket', 'polling'],
    reconnection: true,
  })
}
