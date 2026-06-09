import type { Server as SocketIOServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from 'signage-core'

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null
let payload: any = null

export function setIO(server: SocketIOServer<ClientToServerEvents, ServerToClientEvents>) {
  io = server
}

export function getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null {
  return io
}

export function setPayload(p: any) {
  payload = p
}

export function getPayload() {
  return payload
}
