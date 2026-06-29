import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Programs } from './collections/Programs'
import { Devices } from './collections/Devices'
import { Schedule } from './collections/Schedule'
import { Departments } from './collections/Departments'
import { Folders } from './collections/Folders'
import { Integrations } from './collections/Integrations'
import { Config as ConfigGlobal } from './globals/Config'
import { deploy } from './endpoints/deploy'
import { deployStatus } from './endpoints/deployStatus'
import { heartbeat } from './endpoints/heartbeat'
import { pushUpdate } from './endpoints/pushUpdate'
import { serverStatus } from './endpoints/serverStatus'
import { youtubeInfo } from './endpoints/youtubeInfo'
import { timezone } from './endpoints/timezone'
import { mediaImportYoutube } from './endpoints/mediaImportYoutube'
import { exportProgram } from './endpoints/exportProgram'
import { externalApiEndpoints } from './endpoints/integrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET!,
  admin: {
    user: Users.slug,
    meta: {
      title: 'PeydX',
      icons: [
        { url: '/favicon.png', type: 'image/png' },
      ],
    },
    timezones: {
      defaultTimezone: process.env.TIMEZONE || 'UTC',
    },
    components: {
      Nav: '/components/HiddenSidebar#HiddenSidebar',
      header: ['/components/TopNavHeader#TopNavHeader'],
      graphics: {
        Icon: '/components/LoginLogo',
        Logo: '/components/LoginLogo',
      },
      views: {
        dashboard: {
          Component: '/components/DashboardView#DashboardView',
        },
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    toast: {
      position: 'top-right',
    },
  },
  collections: [
    Media,
    Programs,
    Schedule,
    Departments,
    Folders,
    Users,
    Devices,
    Integrations,
  ].map(c => ({
    ...c,
    admin: {
      ...((c as any).admin || {}),
      hideAPIURL: true,
    },
  })),
  globals: [
    ConfigGlobal,
  ].map(g => ({
    ...g,
    admin: {
      ...((g as any).admin || {}),
      hideAPIURL: true,
    },
  })),
  endpoints: [deploy, deployStatus, heartbeat, pushUpdate, serverStatus, youtubeInfo, timezone, mediaImportYoutube, ...externalApiEndpoints, exportProgram],
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI!,
    },
  }),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
