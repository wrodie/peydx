import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export const serverStatus = {
  path: '/server-status',
  method: 'get' as const,
  handler: async (req: any) => {
    if (!req.user || (req.user as any).role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 })
    }

    const managerUrl = process.env.SERVER_MANAGER_URL || 'http://host.docker.internal:5556'
    const token = process.env.SERVER_MANAGER_TOKEN || ''

    try {
      const res = await fetch(`${managerUrl}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error('Server manager not available')
      }
      const data = await res.json()
      return Response.json(data)
    } catch {
      let currentVersion = 'dev'
      try {
        const dirname = path.dirname(fileURLToPath(import.meta.url))
        const rootPkgPath = path.resolve(dirname, '../../../../package.json')
        const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'))
        currentVersion = rootPkg.version || 'dev'
      } catch {}

      return Response.json(
        { currentVersion, latestVersion: 'unknown', updateAvailable: false, serverManager: false },
        { status: 200 },
      )
    }
  },
}
