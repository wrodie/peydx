import type { Server as SocketIOServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from 'signage-core'

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null

export function setIO(server: SocketIOServer<ClientToServerEvents, ServerToClientEvents>) {
  io = server
}

export function getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null {
  return io
}
