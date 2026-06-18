import type { Migration } from 'payload'

export const migration: Migration = {
  name: 'hide_program_list',
  up: async (args: any) => {
    const { payload } = args || {}
    const db = payload.db as any
    const drizzle = db?.drizzle || db

    if (!drizzle) {
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: process.env.DATABASE_URI })
      try {
        await pool.query("ALTER TABLE devices ADD COLUMN IF NOT EXISTS hide_program_list BOOLEAN DEFAULT FALSE NOT NULL")
        console.log('Migration 20260618_000000: added hide_program_list column')
      } finally {
        await pool.end()
      }
      return
    }

    await drizzle.execute("ALTER TABLE devices ADD COLUMN IF NOT EXISTS hide_program_list BOOLEAN DEFAULT FALSE NOT NULL")
    console.log('Migration 20260618_000000: added hide_program_list column')
  },
  down: async (args: any) => {
    const { payload } = args || {}
    const db = payload.db as any
    const drizzle = db?.drizzle || db

    if (!drizzle) {
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: process.env.DATABASE_URI })
      try {
        await pool.query("ALTER TABLE devices DROP COLUMN IF EXISTS hide_program_list")
        console.log('Migration 20260618_000000: dropped hide_program_list column')
      } finally {
        await pool.end()
      }
      return
    }

    await drizzle.execute("ALTER TABLE devices DROP COLUMN IF EXISTS hide_program_list")
    console.log('Migration 20260618_000000: dropped hide_program_list column')
  },
}
