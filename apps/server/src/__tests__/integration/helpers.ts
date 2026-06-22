import { getPayload } from 'payload'
import payloadConfig from '../../payload.config'

async function getSharedPayload(): Promise<any> {
  return getPayload({ config: payloadConfig })
}

async function clearAllData(payload: any): Promise<void> {
  const order = ['schedule', 'programs', 'media', 'folders', 'devices', 'users', 'departments', 'integrations']
  for (const slug of order) {
    try {
      const { docs } = await payload.find({ collection: slug, limit: 999, pagination: false, overrideAccess: true })
      for (const doc of docs) {
        await payload.delete({ collection: slug, id: doc.id, overrideAccess: true })
      }
    } catch {}
  }
}

async function createAdmin(payload: any) {
  return payload.create({
    collection: 'users',
    data: { email: 'admin@test.com', password: 'adminpass123', role: 'admin', name: 'Admin' },
    overrideAccess: true,
  })
}

async function createStandardUser(payload: any, email: string, deptIds: number[]) {
  return payload.create({
    collection: 'users',
    data: { email, password: 'userpass123', role: 'standard', name: 'Standard User', departments: deptIds },
    overrideAccess: true,
  })
}

async function createManagerUser(payload: any, email: string, deptIds: number[]) {
  return payload.create({
    collection: 'users',
    data: { email, password: 'userpass123', role: 'manager', name: 'Manager', departments: deptIds },
    overrideAccess: true,
  })
}

async function createDepartment(payload: any, name: string) {
  return payload.create({
    collection: 'departments',
    data: { name },
    overrideAccess: true,
  })
}

async function createFolder(payload: any, name: string, type: string, deptId: number, parentId?: number) {
  return payload.create({
    collection: 'folders',
    data: {
      name,
      type,
      department: deptId,
      ...(parentId ? { parent: parentId } : {}),
      order: 0,
    },
    overrideAccess: true,
  })
}

async function loginUser(payload: any, email: string, password: string) {
  const result = await payload.login({
    collection: 'users',
    data: { email, password },
  })
  return result.user
}

export {
  getSharedPayload,
  clearAllData,
  createAdmin,
  createStandardUser,
  createManagerUser,
  createDepartment,
  createFolder,
  loginUser,
}
