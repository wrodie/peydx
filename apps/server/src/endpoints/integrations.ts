import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { flattenProgram } from 'signage-core/flatten'
import { getIO } from '../websocket/io'
import { deviceStateStore, getDeviceState } from '../websocket/deviceState'
import { DAY_NAMES } from '../collections/schedule-utils'

const dirname = path.dirname(fileURLToPath(import.meta.url))

function authIntegration(req: any): { deptIds: number[]; isGlobal: boolean } | Response {
  if (req.user?.collection !== 'integrations') {
    return Response.json(
      { error: 'This endpoint requires an integration API key. Use Authorization: integrations API-Key <key>' },
      { status: 403 }
    )
  }
  if (new Date(req.user.expiresAt) < new Date()) {
    return Response.json(
      { error: 'API key has expired', expiredAt: req.user.expiresAt },
      { status: 401 }
    )
  }
  const deptIds: number[] = (req.user.departments || []).map((d: any) =>
    typeof d === 'object' ? d.id : d
  )
  return { deptIds, isGlobal: deptIds.length === 0 }
}

function deptWhere(deptIds: number[], isGlobal: boolean) {
  if (isGlobal) return {}
  return { departments: { in: deptIds } }
}

function extractYoutubeId(raw: string): string | null {
  if (!raw) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw
  try {
    const url = new URL(raw)
    if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
      if (url.pathname === '/watch') return url.searchParams.get('v') || null
      if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null
    }
  } catch {}
  return null
}

function computeSlideThumbnail(slide: any): string | null {
  if (!slide) return null
  switch (slide.blockType) {
    case 'imageBlock': {
      const img = slide.image
      if (!img) return null
      return img.sizes?.thumbnail?.url || img.sizes?.card?.url || img.url || null
    }
    case 'videoBlock': {
      const vid = slide.video
      if (!vid) return null
      return vid.sizes?.thumbnail?.url || null
    }
    case 'youtubeBlock': {
      const ytId = extractYoutubeId(slide.youtubeId)
      return ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null
    }
    default:
      return null
  }
}

export const externalApiEndpoints = [
  {
    path: '/external/v1/devices',
    method: 'get' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const devices = await req.payload.find({
        collection: 'devices',
        depth: 0,
        pagination: false,
        where: deptWhere(deptIds, isGlobal),
      })

      const enriched = await Promise.all(
        (devices.docs || []).map(async (device: any) => {
          const memState = getDeviceState(device.id)
          const result: any = {
            id: device.id,
            name: device.name,
            deviceType: device.deviceType,
            status: device.status || 'offline',
            state: memState?.state || 'idle',
            currentSlideIndex: memState?.slideIndex ?? device.currentSlideIndex ?? 0,
            departments: device.departments || [],
            lastHeartbeat: device.lastHeartbeat || null,
          }

          const programId = memState?.programId || (typeof device.currentProgram === 'object' ? device.currentProgram?.id : device.currentProgram)
          if (programId) {
            try {
              const program = await req.payload.findByID({
                collection: 'programs',
                id: programId,
                depth: 0,
              })
              result.currentProgram = { id: program.id, title: program.title }
              result.totalSlides = (program.slides?.length || 0)
            } catch {}
          } else {
            result.currentProgram = null
            result.totalSlides = 0
          }

          result.currentSlideThumbnail = null
          if (programId && result.state === 'playing') {
            try {
              const program = await req.payload.findByID({
                collection: 'programs',
                id: programId,
                depth: 2,
              })
              const flat = flattenProgram(program)
              const currentSlide = flat.slides[result.currentSlideIndex]
              if (currentSlide) {
                result.currentSlideThumbnail = computeSlideThumbnail(currentSlide)
              }
            } catch {}
          }

          return result
        })
      )

      return Response.json({ devices: enriched })
    },
  },

  {
    path: '/external/v1/devices/:id',
    method: 'get' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const id = parseInt(req.routeParams.id, 10)
      if (isNaN(id)) return Response.json({ error: 'Invalid device ID' }, { status: 400 })

      let device: any
      try {
        device = await req.payload.findByID({
          collection: 'devices',
          id,
          depth: 1,
        })
      } catch {
        return Response.json({ error: 'Device not found' }, { status: 404 })
      }

      if (!isGlobal) {
        const deviceDepts: number[] = (device.departments || []).map((d: any) =>
          typeof d === 'object' ? d.id : d
        )
        if (!deviceDepts.some((d: number) => deptIds.includes(d))) {
          return Response.json({ error: 'Device not found or not accessible with this API key' }, { status: 403 })
        }
      }

      const memState = getDeviceState(device.id)
      const result: any = {
        id: device.id,
        name: device.name,
        deviceType: device.deviceType,
        status: device.status || 'offline',
        state: memState?.state || 'idle',
        currentSlideIndex: memState?.slideIndex ?? device.currentSlideIndex ?? 0,
        departments: device.departments || [],
        lastHeartbeat: device.lastHeartbeat || null,
        controllingDevice: device.controllingDevice || null,
      }

      const programId = memState?.programId || (typeof device.currentProgram === 'object' ? device.currentProgram?.id : device.currentProgram)
      if (programId) {
        try {
          const program = await req.payload.findByID({
            collection: 'programs',
            id: programId,
            depth: 2,
          })
          result.currentProgram = program
          result.totalSlides = (program.slides?.length || 0)

          if (result.state === 'playing') {
            const flat = flattenProgram(program)
            const currentSlide = flat.slides[result.currentSlideIndex]
            if (currentSlide) {
              result.currentSlideThumbnail = computeSlideThumbnail(currentSlide)
            }
          }
        } catch {
          result.currentProgram = null
          result.totalSlides = 0
        }
      } else {
        result.currentProgram = null
        result.currentSlideThumbnail = null
        result.totalSlides = 0
      }

      return Response.json(result)
    },
  },

  {
    path: '/external/v1/devices/:id/program',
    method: 'post' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const deviceId = parseInt(req.routeParams.id, 10)
      if (isNaN(deviceId)) return Response.json({ error: 'Invalid device ID' }, { status: 400 })

      let body: { programId?: number }
      try { body = await req.clone().json() } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      const programId = body.programId
      if (!programId || typeof programId !== 'number') {
        return Response.json({ error: 'programId (number) is required' }, { status: 400 })
      }

      let device: any
      try {
        device = await req.payload.findByID({ collection: 'devices', id: deviceId, depth: 0 })
      } catch {
        return Response.json({ error: 'Device not found' }, { status: 404 })
      }

      if (!isGlobal) {
        const deviceDepts: number[] = (device.departments || []).map((d: any) =>
          typeof d === 'object' ? d.id : d
        )
        if (!deviceDepts.some((d: number) => deptIds.includes(d))) {
          return Response.json({ error: 'Device not found or not accessible with this API key' }, { status: 403 })
        }
      }

      let program: any
      try {
        program = await req.payload.findByID({ collection: 'programs', id: programId, depth: 1 })
      } catch {
        return Response.json({ error: 'Program not found' }, { status: 404 })
      }

      if (!isGlobal) {
        const programDept = typeof program.folder?.department === 'object'
          ? program.folder.department.id
          : program.folder?.department
        if (!programDept || !deptIds.includes(programDept)) {
          return Response.json({ error: 'Program not accessible with this API key' }, { status: 403 })
        }
      }

      try {
        program = await req.payload.findByID({ collection: 'programs', id: programId, depth: 2 })
      } catch {
        return Response.json({ error: 'Failed to load program details' }, { status: 500 })
      }

      const io = getIO()
      if (io) {
        io.to(`device:${deviceId}`).emit('remote:program', {
          program,
          slideIndex: 0,
        })
      }

      deviceStateStore.set(deviceId, { state: 'playing', programId, slideIndex: 0 })

      try {
        await req.payload.update({
          collection: 'devices',
          id: deviceId,
          data: {
            currentProgram: programId,
            currentSlideIndex: 0,
          },
          overrideAccess: true,
        })
      } catch {}

      return Response.json({ success: true })
    },
  },

  {
    path: '/external/v1/devices/:id/advance',
    method: 'post' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const deviceId = parseInt(req.routeParams.id, 10)
      if (isNaN(deviceId)) return Response.json({ error: 'Invalid device ID' }, { status: 400 })

      if (!isGlobal) {
        try {
          const device = await req.payload.findByID({ collection: 'devices', id: deviceId, depth: 0, overrideAccess: true })
          const deviceDepts: number[] = (device.departments || []).map((d: any) =>
            typeof d === 'object' ? d.id : d
          )
          if (!deviceDepts.some((d: number) => deptIds.includes(d))) {
            return Response.json({ error: 'Device not found or not accessible with this API key' }, { status: 403 })
          }
        } catch {
          return Response.json({ error: 'Device not found' }, { status: 404 })
        }
      }

      const io = getIO()
      if (io) io.to(`device:${deviceId}`).emit('remote:advance')

      return Response.json({ success: true })
    },
  },

  {
    path: '/external/v1/devices/:id/previous',
    method: 'post' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const deviceId = parseInt(req.routeParams.id, 10)
      if (isNaN(deviceId)) return Response.json({ error: 'Invalid device ID' }, { status: 400 })

      if (!isGlobal) {
        try {
          const device = await req.payload.findByID({ collection: 'devices', id: deviceId, depth: 0, overrideAccess: true })
          const deviceDepts: number[] = (device.departments || []).map((d: any) =>
            typeof d === 'object' ? d.id : d
          )
          if (!deviceDepts.some((d: number) => deptIds.includes(d))) {
            return Response.json({ error: 'Device not found or not accessible with this API key' }, { status: 403 })
          }
        } catch {
          return Response.json({ error: 'Device not found' }, { status: 404 })
        }
      }

      const io = getIO()
      if (io) io.to(`device:${deviceId}`).emit('remote:previous')

      return Response.json({ success: true })
    },
  },

  {
    path: '/external/v1/devices/:id/goto',
    method: 'post' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const deviceId = parseInt(req.routeParams.id, 10)
      if (isNaN(deviceId)) return Response.json({ error: 'Invalid device ID' }, { status: 400 })

      let body: { slideIndex?: number }
      try { body = await req.clone().json() } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      const slideIndex = body.slideIndex
      if (typeof slideIndex !== 'number' || slideIndex < 0) {
        return Response.json({ error: 'slideIndex (non-negative number) is required' }, { status: 400 })
      }

      if (!isGlobal) {
        try {
          const device = await req.payload.findByID({ collection: 'devices', id: deviceId, depth: 0, overrideAccess: true })
          const deviceDepts: number[] = (device.departments || []).map((d: any) =>
            typeof d === 'object' ? d.id : d
          )
          if (!deviceDepts.some((d: number) => deptIds.includes(d))) {
            return Response.json({ error: 'Device not found or not accessible with this API key' }, { status: 403 })
          }
        } catch {
          return Response.json({ error: 'Device not found' }, { status: 404 })
        }
      }

      const io = getIO()
      if (io) io.to(`device:${deviceId}`).emit('remote:goto', { slideIndex })

      return Response.json({ success: true })
    },
  },

  {
    path: '/external/v1/devices/:id/pause',
    method: 'post' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const deviceId = parseInt(req.routeParams.id, 10)
      if (isNaN(deviceId)) return Response.json({ error: 'Invalid device ID' }, { status: 400 })

      if (!isGlobal) {
        try {
          const device = await req.payload.findByID({ collection: 'devices', id: deviceId, depth: 0, overrideAccess: true })
          const deviceDepts: number[] = (device.departments || []).map((d: any) =>
            typeof d === 'object' ? d.id : d
          )
          if (!deviceDepts.some((d: number) => deptIds.includes(d))) {
            return Response.json({ error: 'Device not found or not accessible with this API key' }, { status: 403 })
          }
        } catch {
          return Response.json({ error: 'Device not found' }, { status: 404 })
        }
      }

      const io = getIO()
      if (io) io.to(`device:${deviceId}`).emit('remote:pause')

      return Response.json({ success: true })
    },
  },

  {
    path: '/external/v1/devices/:id/back',
    method: 'post' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const deviceId = parseInt(req.routeParams.id, 10)
      if (isNaN(deviceId)) return Response.json({ error: 'Invalid device ID' }, { status: 400 })

      if (!isGlobal) {
        try {
          const device = await req.payload.findByID({ collection: 'devices', id: deviceId, depth: 0, overrideAccess: true })
          const deviceDepts: number[] = (device.departments || []).map((d: any) =>
            typeof d === 'object' ? d.id : d
          )
          if (!deviceDepts.some((d: number) => deptIds.includes(d))) {
            return Response.json({ error: 'Device not found or not accessible with this API key' }, { status: 403 })
          }
        } catch {
          return Response.json({ error: 'Device not found' }, { status: 404 })
        }
      }

      const io = getIO()
      if (io) io.to(`device:${deviceId}`).emit('remote:back')

      return Response.json({ success: true })
    },
  },

  {
    path: '/external/v1/programs',
    method: 'get' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const programs = await req.payload.find({
        collection: 'programs',
        depth: 0,
        pagination: false,
        where: isGlobal ? {} : { 'folder.department': { in: deptIds } },
      })

      return Response.json({ programs: programs.docs || [] })
    },
  },

  {
    path: '/external/v1/programs/:id',
    method: 'get' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const id = parseInt(req.routeParams.id, 10)
      if (isNaN(id)) return Response.json({ error: 'Invalid program ID' }, { status: 400 })

      let program: any
      try {
        program = await req.payload.findByID({
          collection: 'programs',
          id,
          depth: 2,
        })
      } catch {
        return Response.json({ error: 'Program not found' }, { status: 404 })
      }

      if (!isGlobal) {
        const programDept = typeof program.folder?.department === 'object'
          ? program.folder.department.id
          : program.folder?.department
        if (!programDept || !deptIds.includes(programDept)) {
          return Response.json({ error: 'Program not found or not accessible with this API key' }, { status: 403 })
        }
      }

      return Response.json(program)
    },
  },

  {
    path: '/external/v1/schedules',
    method: 'get' as const,
    handler: async (req: any) => {
      const auth = authIntegration(req)
      if (auth instanceof Response) return auth
      const { deptIds, isGlobal } = auth

      const fromParam = req.query?.from as string | undefined
      const toParam = req.query?.to as string | undefined
      const now = new Date()
      const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 60 * 60 * 1000)
      const to = toParam ? new Date(toParam) : new Date(now.getTime() + 24 * 60 * 60 * 1000)

      const schedules = await req.payload.find({
        collection: 'schedule',
        depth: 2,
        pagination: false,
        where: isGlobal ? {} : { department: { in: deptIds } },
      })

      const dayName = DAY_NAMES[now.getUTCDay()]
      const activeSchedules = (schedules.docs || []).filter((s: any) => {
        const daysOfWeek: string[] = Array.isArray(s.daysOfWeek) ? s.daysOfWeek : []
        const isOneOff = daysOfWeek.length === 0

        const startTime = new Date(s.startTime)
        const endTime = new Date(s.endTime || s.startTime)

        if (isNaN(startTime.getTime())) return false

        if (!isOneOff && !daysOfWeek.includes(dayName)) return false

        if (s.startDate) {
          const sd = new Date(s.startDate).getTime()
          if (to < new Date(sd)) return false
        }
        if (s.untilDate) {
          const ud = new Date(s.untilDate).getTime()
          if (from > new Date(ud)) return false
        }

        return true
      })

      return Response.json({ schedules: activeSchedules })
    },
  },

  {
    path: '/external/v1/docs',
    method: 'get' as const,
    handler: async (_req: any) => {
      const yamlPath = path.resolve(dirname, '../../../docs/openapi.yaml')
      try {
        const content = await readFile(yamlPath, 'utf-8')
        return Response.json({ spec: content })
      } catch {
        return Response.json({ error: 'OpenAPI spec not found' }, { status: 404 })
      }
    },
  },

  {
    path: '/external/v1/ws-docs',
    method: 'get' as const,
    handler: async (_req: any) => {
      const yamlPath = path.resolve(dirname, '../../../docs/asyncapi.yaml')
      try {
        const content = await readFile(yamlPath, 'utf-8')
        return Response.json({ spec: content })
      } catch {
        return Response.json({ error: 'AsyncAPI spec not found' }, { status: 404 })
      }
    },
  },
]
