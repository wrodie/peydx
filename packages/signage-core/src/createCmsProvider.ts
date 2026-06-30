import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from './events'
import type { DeviceProvider, ResolvedSchedule } from './types'
import { normalizeApiSchedule } from './normalizeApiSchedule'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function createCmsProvider(deviceId: string, token: string): DeviceProvider {
  let socket: TypedSocket | null = null

  const authHeaders: Record<string, string> = {
    'X-Browser-Token': token,
  }

  const resolveMediaUrl = (url: string): string => {
    if (!url) return url
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}token=${token}`
  }

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
        fetch(`/api/schedule?where[devices][contains]=${deviceId}&depth=3&sort=startTime`, { headers: authHeaders }),
        fetch(`/api/programs?depth=2`, { headers: authHeaders }),
      ])
      const [scheduleData, programsData] = await Promise.all([
        scheduleRes.json(),
        programsRes.json(),
      ])

      let bgUrl: string | null = null
      let deviceName: string | null = null
      let hideProgramList: boolean = false
      try {
        const deviceRes = await fetch(`/api/devices/${deviceId}?depth=1`, { headers: authHeaders })
        const device = await deviceRes.json()
        const bg = device?.defaultBackground
        const rawUrl = bg ? (bg.sizes?.fullHD?.url || bg.url || null) : null
        bgUrl = rawUrl ? resolveMediaUrl(rawUrl) : null
        deviceName = device?.name || null
        hideProgramList = device?.hideProgramList || false
      } catch {}

      return normalizeApiSchedule(scheduleData, programsData, {
        deviceId,
        defaultBackgroundUrl: bgUrl,
        deviceName,
        hideProgramList,
        resolveMediaUrl,
      })
    },

    resolveMediaUrl,

    getDeviceId(): string | number {
      return deviceId
    },

    disconnect() {
      socket?.disconnect()
      socket = null
    },
  }
}
