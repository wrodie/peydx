import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

// Import our custom collections
import { Users } from './apps/server/src/collections/Users'
import { Media } from './apps/server/src/collections/Media'
import { Programs } from './apps/server/src/collections/Programs'
import { Devices } from './apps/server/src/collections/Devices'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug, // Tells Payload which collection is used for Admin login
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  // Registering our logic
  collections: [
    Programs,
    Devices,
    Media,
    Users,
  ],
  // Use Lexical for any rich text needs (Description fields, etc.)
  editor: lexicalEditor({}),
  
  // Database Configuration for Lightsail
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),

  // Paths for generated TypeScript types (helpful for your SvelteKit frontend)
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  // Sharp is used for the image resizing/processing we discussed
  sharp: require('sharp'),
})
