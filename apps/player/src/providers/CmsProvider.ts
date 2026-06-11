import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'signage-core'
import type { DeviceProvider, ResolvedSchedule } from 'signage-core'
import { normalizeApiSchedule } from 'signage-core'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function createCmsProvider(deviceId: string, token: string): DeviceProvider {
  let socket: TypedSocket | null = null

  return {
    connectSocket() {
      socket = io(window.location.origin, {
        path: '/api/ws',
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
      })
      return socket
    },

    async fetchSchedule(): Promise<ResolvedSchedule> {
      const [scheduleRes, programsRes] = await Promise.all([
        fetch(`/api/schedule?where[devices][contains]=${deviceId}&depth=3&sort=startTime&token=${token}`),
        fetch(`/api/programs?depth=2&token=${token}`),
      ])
      const [scheduleData, programsData] = await Promise.all([
        scheduleRes.json(),
        programsRes.json(),
      ])

      let bgUrl: string | null = null
      let deviceName: string | null = null
      try {
        const deviceRes = await fetch(`/api/devices/${deviceId}?depth=1&token=${token}`)
        const device = await deviceRes.json()
        const bg = device?.defaultBackground
        bgUrl = bg ? (bg.sizes?.fullHD?.url || bg.url || null) : null
        deviceName = device?.name || null
      } catch {}

      return normalizeApiSchedule(scheduleData, programsData, {
        deviceId,
        defaultBackgroundUrl: bgUrl,
        deviceName,
      })
    },

    resolveMediaUrl(url: string): string {
      return url
    },

    getDeviceId(): string | number {
      return deviceId
    },

    disconnect() {
      socket?.disconnect()
      socket = null
    },
  }
}
