import { describe, it, expect, vi, beforeEach } from 'vitest'
import { folderBeforeChange } from '../../../hooks/folderBeforeChange'

describe('folderBeforeChange', () => {
  function makeReq(payloadOverrides: any = {}, userOverrides: any = {}) {
    return {
      payload: {
        findByID: vi.fn(),
        ...payloadOverrides,
      },
      user: { id: 1, role: 'standard', departments: [{ id: 10 }, { id: 20 }], ...userOverrides },
    } as any
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('department inheritance from parent', () => {
    it('inherits department from parent folder', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ department: 10 })

      const data = { parent: 5 }
      const result = await folderBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBe(10)
    })

    it('handles parent department as object', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ department: { id: 10 } })

      const data = { parent: 5 }
      const result = await folderBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBe(10)
    })

    it('handles parent as object', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ department: 10 })

      const data = { parent: { id: 5 } }
      const result = await folderBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBe(10)
    })

    it('parent department overrides explicit data.department', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ department: 10 })

      const data = { parent: 5, department: 20 }
      const result = await folderBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBe(10)
    })
  })

  describe('nesting depth enforcement', () => {
    it('allows 3rd level (parent at depth 1)', async () => {
      const req = makeReq()
      req.payload.findByID
        .mockResolvedValueOnce({ department: 10, parent: 1 })
        .mockResolvedValueOnce({ parent: null })

      const data = { parent: 5 }
      await expect(
        folderBeforeChange({ data, req, operation: 'create' } as any)
      ).resolves.not.toThrow()
    })

    it('rejects 4th level (parent at depth 2+)', async () => {
      const req = makeReq()
      req.payload.findByID
        .mockResolvedValueOnce({ department: 10, parent: 3 })
        .mockResolvedValueOnce({ parent: 2 })
        .mockResolvedValueOnce({ parent: 1 })
        .mockResolvedValueOnce({ parent: null })

      const data = { parent: 5 }
      await expect(
        folderBeforeChange({ data, req, operation: 'create' } as any)
      ).rejects.toThrow('Maximum folder nesting depth is 3 levels')
    })

    it('allows no parent (root folder)', async () => {
      const req = makeReq()
      const data = { name: 'Root' }
      const result = await folderBeforeChange({ data, req, operation: 'create' } as any)
      expect(result).toEqual(data)
    })
  })

  describe('self-parenting prevention', () => {
    it('prevents a folder from being its own parent on update', async () => {
      const req = makeReq()
      req.payload.findByID.mockResolvedValue({ department: 10 })

      const data = { parent: 5, id: 5 }
      await expect(
        folderBeforeChange({ data, req, operation: 'update' } as any)
      ).rejects.toThrow('A folder cannot be its own parent')
    })

    it('allows parent on create even if parent id matches data.id', async () => {
      const req = makeReq()
      req.payload.findByID
        .mockResolvedValueOnce({ department: 10, parent: 1 })
        .mockResolvedValueOnce({ parent: null })

      const data = { parent: 5, id: 5 }
      await expect(
        folderBeforeChange({ data, req, operation: 'create' } as any)
      ).resolves.not.toThrow()
    })
  })

  describe('non-admin default department', () => {
    it('assigns first department to non-admin user without data.department', async () => {
      const req = makeReq()
      const data = {}
      const result = await folderBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBe(10)
    })

    it('does not override data.department for non-admin user', async () => {
      const req = makeReq()
      const data = { department: 20 }
      const result = await folderBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBe(20)
    })

    it('admin user without parent does not get auto-assigned department', async () => {
      const req = makeReq({}, { role: 'admin', departments: [{ id: 10 }] })
      const data = {}
      const result = await folderBeforeChange({ data, req, operation: 'create' } as any)
      expect(result.department).toBeUndefined()
    })
  })
})
