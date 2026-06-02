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
import { heartbeat } from './endpoints/heartbeat'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || '',
  admin: {
    user: Users.slug,
    components: {
      afterNavLinks: ['/components/RemoteNavLink#RemoteNavLink'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  i18n: {
    translations: {
      en: {
        general: {
          collections: 'Menu',
        },
      },
    },
  },
  collections: [
    Programs,
    Devices,
    Schedule,
    Media,
    Users,
    Departments,
  ],
  endpoints: [heartbeat],
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
