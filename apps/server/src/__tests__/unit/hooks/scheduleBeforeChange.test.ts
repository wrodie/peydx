import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scheduleBeforeChange } from '../../../hooks/scheduleBeforeChange'

function makeReq(payloadOverrides: any = {}, userOverrides: any = {}) {
  return {
    payload: {
      findByID: vi.fn(),
      find: vi.fn(),
      ...payloadOverrides,
    },
    user: { id: 1, role: 'standard', departments: [{ id: 10 }], ...userOverrides },
  } as any
}

describe('scheduleBeforeChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('endTime auto-fill', () => {
    it('defaults endTime to startTime + 1 hour', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = { startTime: '2025-06-15T09:00:00.000Z', daysOfWeek: ['mon'], devices: [1], program: 5 }
      const result = await scheduleBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.endTime).toBeDefined()
      const end = new Date(result.endTime).getTime()
      const start = new Date(result.startTime).getTime()
      expect(end - start).toBe(3600000)
    })

    it('preserves endTime when already set', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = {
        startTime: '2025-06-15T09:00:00.000Z',
        endTime: '2025-06-15T11:00:00.000Z',
        daysOfWeek: ['mon'],
        devices: [1],
        program: 5,
      }
      const result = await scheduleBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.endTime).toBe('2025-06-15T11:00:00.000Z')
    })

    it('uses originalDoc startTime for endTime fallback on update', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = { daysOfWeek: ['mon'], devices: [1], program: 5 }
      const originalDoc = { startTime: '2025-06-15T09:00:00.000Z' }
      const result = await scheduleBeforeChange({ data, req, originalDoc, operation: 'update' } as any)
      expect(result.endTime).toBeDefined()
    })
  })

  describe('department inference', () => {
    it('auto-populates department from program folder.department', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = { startTime: '2025-06-15T09:00:00.000Z', daysOfWeek: ['mon'], devices: [1], program: 5 }
      const result = await scheduleBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBe(10)
    })

    it('preserves department when already set', async () => {
      const req = makeReq()
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = {
        startTime: '2025-06-15T09:00:00.000Z',
        daysOfWeek: ['mon'],
        devices: [1],
        program: 5,
        department: 20,
      }
      const result = await scheduleBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBe(20)
    })

    it('handles program as object', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: { id: 10 } } })
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = { startTime: '2025-06-15T09:00:00.000Z', daysOfWeek: ['mon'], devices: [1], program: { id: 5 } }
      const result = await scheduleBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBe(10)
    })
  })

  describe('createdBy', () => {
    it('auto-sets createdBy from user.id', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = { startTime: '2025-06-15T09:00:00.000Z', daysOfWeek: ['mon'], devices: [1], program: 5 }
      const result = await scheduleBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.createdBy).toBe(1)
    })

    it('preserves createdBy when already set', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = { startTime: '2025-06-15T09:00:00.000Z', daysOfWeek: ['mon'], devices: [1], program: 5, createdBy: 2 }
      const result = await scheduleBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.createdBy).toBe(2)
    })
  })

  describe('department enforcement', () => {
    it('standard user scheduling program outside department throws', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 30 } })

      const data = { startTime: '2025-06-15T09:00:00.000Z', daysOfWeek: ['mon'], devices: [1], program: 5 }
      await expect(
        scheduleBeforeChange({ data, req, operation: 'create' } as any)
      ).rejects.toThrow('You can only schedule programs from your own department.')
    })

    it('admin can schedule any program', async () => {
      const req = makeReq({}, { role: 'admin', departments: [{ id: 10 }] })
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = { startTime: '2025-06-15T09:00:00.000Z', daysOfWeek: ['mon'], devices: [1], program: 5 }
      const result = await scheduleBeforeChange({ data, req, operation: 'create' } as any)
      expect(result).toBeDefined()
    })
  })

  describe('overlap detection', () => {
    it('overlapping time on same device/day throws', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({
        docs: [{
          id: 2,
          daysOfWeek: ['mon'],
          startTime: '2025-06-15T09:30:00.000Z',
          endTime: '2025-06-15T11:00:00.000Z',
          devices: [1],
        }],
      })

      const data = {
        startTime: '2025-06-15T09:00:00.000Z',
        daysOfWeek: ['mon'],
        devices: [1],
        program: 5,
      }
      await expect(
        scheduleBeforeChange({ data, req, operation: 'create' } as any)
      ).rejects.toThrow('overlaps with an existing schedule')
    })

    it('different device same time succeeds', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({
        docs: [{
          id: 2,
          daysOfWeek: ['mon'],
          startTime: '2025-06-15T09:00:00.000Z',
          endTime: '2025-06-15T10:00:00.000Z',
          devices: [2],
        }],
      })

      const data = {
        startTime: '2025-06-17T09:00:00.000Z',
        daysOfWeek: [],
        devices: [1],
        program: 5,
      }
      await expect(
        scheduleBeforeChange({ data, req, operation: 'create' } as any)
      ).resolves.not.toThrow()
    })

    it('non-overlapping times on same device succeeds', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({
        docs: [{
          id: 2,
          daysOfWeek: ['mon'],
          startTime: '2025-06-15T11:00:00.000Z',
          endTime: '2025-06-15T12:00:00.000Z',
          devices: [1],
        }],
      })

      const data = {
        startTime: '2025-06-15T09:00:00.000Z',
        daysOfWeek: ['mon'],
        devices: [1],
        program: 5,
      }
      await expect(
        scheduleBeforeChange({ data, req, operation: 'create' } as any)
      ).resolves.not.toThrow()
    })

    it('different days on same device succeeds', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({
        docs: [{
          id: 2,
          daysOfWeek: ['tue'],
          startTime: '2025-06-15T09:00:00.000Z',
          endTime: '2025-06-15T10:00:00.000Z',
          devices: [1],
        }],
      })

      const data = {
        startTime: '2025-06-15T09:00:00.000Z',
        daysOfWeek: ['mon'],
        devices: [1],
        program: 5,
      }
      await expect(
        scheduleBeforeChange({ data, req, operation: 'create' } as any)
      ).resolves.not.toThrow()
    })

    it('one-off overlaps with recurring', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({
        docs: [{
          id: 2,
          daysOfWeek: ['mon'],
          startTime: '2025-06-15T09:30:00.000Z',
          endTime: '2025-06-15T11:00:00.000Z',
          devices: [1],
        }],
      })

      const data = {
        startTime: '2025-06-16T09:00:00.000Z',
        daysOfWeek: [],
        devices: [1],
        program: 5,
      }
      await expect(
        scheduleBeforeChange({ data, req, operation: 'create' } as any)
      ).rejects.toThrow('overlaps with an existing schedule')
    })

    it('update excludes self from overlap check', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({ docs: [] })

      const data = {
        startTime: '2025-06-15T09:00:00.000Z',
        daysOfWeek: ['mon'],
        devices: [1],
        program: 5,
      }
      const originalDoc = { id: 1 }
      await expect(
        scheduleBeforeChange({ data, req, originalDoc, operation: 'update' } as any)
      ).resolves.not.toThrow()
      expect(req.payload.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([{ id: { not_equals: 1 } }]),
        }),
      }))
    })

    it('untilDate prevents overlap for one-off schedules', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ folder: { department: 10 } })
      req.payload.find.mockResolvedValue({
        docs: [{
          id: 2,
          daysOfWeek: [],
          startTime: '2025-06-15T09:00:00.000Z',
          endTime: '2025-06-15T10:00:00.000Z',
          untilDate: '2025-06-01',
          devices: [1],
        }],
      })

      const data = {
        startTime: '2025-06-15T09:00:00.000Z',
        daysOfWeek: [],
        devices: [1],
        program: 5,
      }
      await expect(
        scheduleBeforeChange({ data, req, operation: 'create' } as any)
      ).resolves.not.toThrow()
    })
  })
})
