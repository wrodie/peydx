import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Baked at build time — won't change until the container restarts
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPkgPath = path.resolve(dirname, '../../../../package.json')
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'))
const OWN_VERSION: string = rootPkg.version || 'dev'

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
      return Response.json({
        currentVersion: OWN_VERSION,
        latestVersion: data.latestVersion,
        updateAvailable: OWN_VERSION !== data.latestVersion,
      })
    } catch {
      return Response.json(
        { currentVersion: OWN_VERSION, latestVersion: 'unknown', updateAvailable: false, serverManager: false },
        { status: 200 },
      )
    }
  },
}