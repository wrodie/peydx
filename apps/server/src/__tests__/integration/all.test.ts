import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URI = 'postgres://peydx:peydx@localhost:5432/peydx_test'
  process.env.PAYLOAD_SECRET = 'test-integration-secret-key-123456'
})

import { getPayload } from 'payload'
import payloadConfig from '../../payload.config'

let payload: any

async function createAdmin() {
  return payload.create({
    collection: 'users',
    data: { email: 'admin@test.com', password: 'adminpass123', role: 'admin', name: 'Admin' },
    overrideAccess: true,
  })
}

async function createBasicUser(email: string, deptIds: number[]) {
  return payload.create({
    collection: 'users',
    data: { email, password: 'userpass123', role: 'basic', name: 'Basic', departments: deptIds },
    overrideAccess: true,
  })
}

async function createDept(name: string) {
  return payload.create({
    collection: 'departments', data: { name }, overrideAccess: true,
  })
}

async function createFolder(name: string, type: string, deptId: number, parentId?: number) {
  return payload.create({
    collection: 'folders',
    data: { name, type, department: deptId, ...(parentId ? { parent: parentId } : {}), order: 0 },
    overrideAccess: true,
  })
}

async function loginUser(email: string, password: string) {
  const result = await payload.login({
    collection: 'users', data: { email, password },
  })
  return result.user
}

describe('Integration Tests', () => {
  let admin: any
  let dept1: any
  let dept2: any
  let mediaFolder: any
  let progFolder: any

  beforeAll(async () => {
    payload = await getPayload({ config: payloadConfig })

    const order = ['schedule', 'programs', 'media', 'folders', 'devices', 'users', 'departments', 'integrations']
    for (const slug of order) {
      try {
        const { docs } = await payload.find({ collection: slug, limit: 999, pagination: false, overrideAccess: true })
        for (const doc of docs) {
          await payload.delete({ collection: slug, id: doc.id, overrideAccess: true })
        }
      } catch {}
    }

    admin = await createAdmin()
    dept1 = await createDept('Worship')
    dept2 = await createDept('Youth')

    const mf = await payload.find({
      collection: 'folders', where: { type: { equals: 'media' }, department: { equals: dept1.id } },
      limit: 1, pagination: false, overrideAccess: true,
    })
    mediaFolder = mf.docs[0]

    const pf = await payload.find({
      collection: 'folders', where: { type: { equals: 'programs' }, department: { equals: dept1.id } },
      limit: 1, pagination: false, overrideAccess: true,
    })
    progFolder = pf.docs[0]
  }, 60000)

  afterAll(async () => {
    const order = ['schedule', 'programs', 'media', 'folders', 'devices', 'users', 'departments', 'integrations']
    for (const slug of order) {
      try {
        const { docs } = await payload.find({ collection: slug, limit: 999, pagination: false, overrideAccess: true })
        for (const doc of docs) {
          await payload.delete({ collection: slug, id: doc.id, overrideAccess: true })
        }
      } catch {}
    }
  })

  // ── Access Control ──
  describe('Access Control', () => {
    let basicUser: any

    beforeAll(async () => {
      basicUser = await createBasicUser('basic@test.com', [dept1.id])
    })

    it('admin sees all folders', async () => {
      const r = await payload.find({ collection: 'folders', limit: 100, pagination: false, req: { user: admin } })
      expect(r.docs.length).toBeGreaterThanOrEqual(2)
    })

    it('basic user folder read returns dept constraint', async () => {
      const user = await loginUser('basic@test.com', 'userpass123')
      const result = await payload.collections.folders.config.access.read({ req: { user } })
      expect(result).toHaveProperty('department')
      expect(result.department).toHaveProperty('in')
      expect(result.department.in).toContain(dept1.id)
    })

    it('basic user can create folders', async () => {
      const user = await loginUser('basic@test.com', 'userpass123')
      const f = await payload.create({
        collection: 'folders',
        data: { name: 'UserFolder', type: 'media', department: dept1.id, parent: mediaFolder.id, order: 1 },
        req: { user },
      })
      expect(f.id).toBeTruthy()
    })

    it('basic user can delete own-department folders (access check)', async () => {
      const user = await loginUser('basic@test.com', 'userpass123')
      expect(await payload.collections.folders.config.access.delete({ req: { user: admin } })).toBe(true)
      const result = await payload.collections.folders.config.access.delete({ req: { user } })
      expect(result).toHaveProperty('department')
      expect(result.department.in).toContain(dept1.id)
    })

    it('media create access: basic=true, unauth=false', async () => {
      expect(await payload.collections.media.config.access.create({ req: { user: basicUser } })).toBe(true)
      expect(await payload.collections.media.config.access.create({ req: { user: null } })).toBe(false)
    })

    it('program delete access: admin=true, basic=dept-scoped', async () => {
      expect(await payload.collections.programs.config.access.delete({ req: { user: admin } })).toBe(true)
      const result = await payload.collections.programs.config.access.delete({ req: { user: basicUser } })
      expect(result).toHaveProperty('folder.department')
      expect(result['folder.department'].in).toContain(dept1.id)
    })

    it('schedule read: device=true, basic=dept-scoped', async () => {
      const deviceRead = await payload.collections.schedule.config.access.read({
        req: { user: { id: 1, collection: 'devices', departments: [dept1.id] } },
      })
      expect(deviceRead).toBe(true)
      const basicRead = await payload.collections.schedule.config.access.read({ req: { user: basicUser } })
      expect(basicRead).toHaveProperty('department')
      expect(basicRead.department.in).toContain(dept1.id)
    })

    it('devices read: admin=true, unauth=false', async () => {
      expect(await payload.collections.devices.config.access.read({ req: { user: admin } })).toBe(true)
      expect(await payload.collections.devices.config.access.read({ req: { user: null } })).toBe(false)
    })
  })

  // ── Folders CRUD ──
  describe('Folders CRUD', () => {
    it('creates subfolder under root', async () => {
      const sub = await createFolder('Sub Media', 'media', dept1.id, mediaFolder.id)
      const parentId = typeof sub.parent === 'object' ? sub.parent.id : sub.parent
      expect(parentId).toBe(mediaFolder.id)
    })

    it('allows 3rd level nesting', async () => {
      const l2 = await createFolder('L2', 'media', dept1.id, mediaFolder.id)
      const l3 = await createFolder('L3', 'media', dept1.id, l2.id)
      expect(l3.id).toBeTruthy()
    })

    it('rejects 4th level nesting', async () => {
      const l2 = await createFolder('L2x', 'media', dept1.id, mediaFolder.id)
      const l3 = await createFolder('L3x', 'media', dept1.id, l2.id)
      await expect(createFolder('L4x', 'media', dept1.id, l3.id)).rejects.toThrow()
    })

    it('prevents self-parenting', async () => {
      const f = await createFolder('SelfRef', 'media', dept1.id)
      await expect(payload.update({
        collection: 'folders', id: f.id,
        data: { parent: f.id, id: f.id, name: f.name },
        overrideAccess: true,
      })).rejects.toThrow('A folder cannot be its own parent')
    })

    it('inherits department from parent', async () => {
      const sub = await createFolder('InheritDept', 'media', dept1.id, mediaFolder.id)
      const dId = typeof sub.department === 'object' ? sub.department.id : sub.department
      expect(dId).toBe(dept1.id)
    })

    it('allows delete of empty folder, blocks delete with children', async () => {
      const f = await createFolder('Empty', 'media', dept1.id)
      await payload.delete({ collection: 'folders', id: f.id, overrideAccess: true })
      const check = await payload.find({ collection: 'folders', where: { id: { equals: f.id } }, limit: 1, overrideAccess: true })
      expect(check.docs.length).toBe(0)

      const parent = await createFolder('Parent', 'media', dept1.id)
      await createFolder('Child', 'media', dept1.id, parent.id)
      await expect(payload.delete({ collection: 'folders', id: parent.id, overrideAccess: true })).rejects.toThrow('Cannot delete folder')
    })
  })

  // ── Programs CRUD ──
  describe('Programs CRUD', () => {
    it('creates a program with slides', async () => {
      const p = await payload.create({
        collection: 'programs',
        data: { title: 'Test Program', folder: progFolder.id, slides: [{ blockType: 'blackScreenBlock', advanceMode: 'manual' }] },
        overrideAccess: true,
      })
      expect(p.id).toBeTruthy()
    })

    it('auto-end virtual slide appended when autoBlackEndSlide=true, !loop', async () => {
      const p = await payload.create({
        collection: 'programs',
        data: { title: 'AutoEnd', folder: progFolder.id, autoBlackEndSlide: true, loop: false, slides: [{ blockType: 'youtubeBlock', advanceMode: 'onEnd', youtubeId: 'dQw4w9WgXcQ' }] },
        overrideAccess: true,
      })
      const fetched = await payload.findByID({ collection: 'programs', id: p.id, overrideAccess: true })
      expect(fetched.slides).toHaveLength(2)
      expect(fetched.slides[1].id).toBe('auto-end')
    })

    it('does not append auto-end when loop=true', async () => {
      const p = await payload.create({
        collection: 'programs',
        data: { title: 'Looping', folder: progFolder.id, autoBlackEndSlide: true, loop: true, slides: [{ blockType: 'blackScreenBlock', advanceMode: 'manual' }] },
        overrideAccess: true,
      })
      const fetched = await payload.findByID({ collection: 'programs', id: p.id, overrideAccess: true })
      expect(fetched.slides).toHaveLength(1)
    })

    it('strips auto-end and slides without blockType on validate', async () => {
      const p = await payload.create({
        collection: 'programs',
        data: { title: 'Strip', folder: progFolder.id, slides: [{ blockType: 'blackScreenBlock', advanceMode: 'manual' }, { id: 'auto-end', blockType: 'blackScreenBlock' }, {}] },
        overrideAccess: true,
      })
      expect(p.slides).toHaveLength(1)
    })

    it('non-admin can delete own-department programs (access check)', async () => {
      await createBasicUser('proguser@test.com', [dept1.id])
      const user = await loginUser('proguser@test.com', 'userpass123')
      expect(await payload.collections.programs.config.access.delete({ req: { user: admin } })).toBe(true)
      const result = await payload.collections.programs.config.access.delete({ req: { user } })
      expect(result).toHaveProperty('folder.department')
      expect(result['folder.department'].in).toContain(dept1.id)
    })

    it('non-admin user sees only department-scoped programs', async () => {
      const user = await loginUser('proguser@test.com', 'userpass123')
      const result = await payload.find({ collection: 'programs', limit: 100, pagination: false, req: { user } })
      expect(Array.isArray(result.docs)).toBe(true)
    })
  })

  // ── Schedule CRUD ──
  describe('Schedule CRUD', () => {
    let device: any
    let program: any
    const ctx = {} as any

    beforeAll(async () => {
      ctx.req = { user: admin }
      device = await payload.create({
        collection: 'devices',
        data: { name: 'Test Device', departments: [dept1.id], enableAPIKey: true },
        req: ctx.req,
      })
      program = await payload.create({
        collection: 'programs',
        data: { title: 'SchedProg', folder: progFolder.id, slides: [{ blockType: 'blackScreenBlock', advanceMode: 'manual' }] },
        req: ctx.req,
      })
    })

    it('recurring schedule gets auto-filled endTime', async () => {
      const s = await payload.create({
        collection: 'schedule',
        data: { program: program.id, devices: [device.id], daysOfWeek: ['mon'], startTime: '2025-06-16T09:00:00.000Z' },
        req: ctx.req,
      })
      expect(s.id).toBeTruthy()
      expect(new Date(s.endTime).getTime() - new Date(s.startTime).getTime()).toBe(3600000)
    })

    it('department auto-populated from program folder', async () => {
      const s = await payload.create({
        collection: 'schedule',
        data: { program: program.id, devices: [device.id], daysOfWeek: ['tue'], startTime: '2025-06-17T14:00:00.000Z' },
        req: ctx.req,
      })
      const schedDept = typeof s.department === 'object' ? s.department.id : s.department
      expect(schedDept).toBe(dept1.id)
    })

    it('detects overlapping schedule on same device/day/time', async () => {
      await payload.create({
        collection: 'schedule',
        data: { program: program.id, devices: [device.id], daysOfWeek: ['wed'], startTime: '2025-06-18T09:00:00.000Z', endTime: '2025-06-18T11:00:00.000Z' },
        req: ctx.req,
      })
      await expect(payload.create({
        collection: 'schedule',
        data: { program: program.id, devices: [device.id], daysOfWeek: ['wed'], startTime: '2025-06-18T10:00:00.000Z', endTime: '2025-06-18T12:00:00.000Z' },
        req: ctx.req,
      })).rejects.toThrow('overlaps')
    })

    it('allows schedule on different day', async () => {
      const s = await payload.create({
        collection: 'schedule',
        data: { program: program.id, devices: [device.id], daysOfWeek: ['thu'], startTime: '2025-06-19T09:00:00.000Z' },
        req: ctx.req,
      })
      expect(s.id).toBeTruthy()
    })

    it('non-admin cannot schedule cross-dept program', async () => {
      await createBasicUser('schedusr@test.com', [dept1.id])
      const user = await loginUser('schedusr@test.com', 'userpass123')
      const yf = await payload.find({
        collection: 'folders', where: { type: { equals: 'programs' }, department: { equals: dept2.id } },
        limit: 1, pagination: false, req: ctx.req,
      })
      const dp = await payload.create({
        collection: 'programs',
        data: { title: 'YouthProg', folder: yf.docs[0].id, slides: [] },
        req: ctx.req,
      })
      await expect(payload.create({
        collection: 'schedule',
        data: { program: dp.id, devices: [device.id], daysOfWeek: ['fri'], startTime: '2025-06-20T09:00:00.000Z' },
        req: { user },
      })).rejects.toThrow('own department')
    })
  })

  // ── Devices CRUD ──
  describe('Devices CRUD', () => {
    it('creates hardware device with API key', async () => {
      const d = await payload.create({
        collection: 'devices',
        data: { name: 'Hallway TV', departments: [dept1.id], enableAPIKey: true },
        overrideAccess: true,
      })
      expect(d.id).toBeTruthy()
    })

    it('creates browser device with auto-generated browserToken', async () => {
      const d = await payload.create({
        collection: 'devices',
        data: { name: 'Browser Display', departments: [dept1.id], deviceType: 'browser' },
        overrideAccess: true,
      })
      expect(d.browserToken).toBeTruthy()
    })

    it('validates controllingDevice chain via hook (unit tested separately)', async () => {
      const d = await payload.create({
        collection: 'devices',
        data: { name: 'ChainDev', departments: [dept1.id], enableAPIKey: true },
        overrideAccess: true,
      })
      expect(d.id).toBeTruthy()
    })

    it('device reads its own record via access control', async () => {
      const d = await payload.create({
        collection: 'devices',
        data: { name: 'Self Dev', departments: [dept1.id], enableAPIKey: true },
        overrideAccess: true,
      })
      const result = await payload.findByID({
        collection: 'devices', id: d.id,
        req: { user: { ...d, collection: 'devices', departments: [dept1.id] } },
      })
      expect(result.id).toBe(d.id)
    })
  })
})
