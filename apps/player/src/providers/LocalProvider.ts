import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'
import type { DeviceProvider, ResolvedSchedule } from 'signage-core'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function createLocalProvider(): DeviceProvider {
  let socket: TypedSocket | null = null

  return {
    connectSocket() {
      socket = io(window.location.origin, {
        path: '/ws',
        transports: ['websocket', 'polling'],
        reconnection: true,
      })
      return socket
    },

    async fetchSchedule(): Promise<ResolvedSchedule> {
      const res = await fetch('/schedule.json')
      if (!res.ok) throw new Error('Failed to fetch schedule')
      return res.json()
    },

    resolveMediaUrl(url: string): string {
      if (!url) return url
      if (url.startsWith('/local-media/')) return url
      const filename = url.split('/').pop() || ''
      return `/local-media/${filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`
    },

    getDeviceId(): string | number {
      return 'local'
    },

    disconnect() {
      socket?.disconnect()
      socket = null
    },
  }
}
