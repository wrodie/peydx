import type { Migration } from 'payload'

export const migration: Migration = {
  name: 'remove_duration_minutes',
  up: async (args: any) => {
    const { payload } = args || {}
    const db = payload.db as any
    const drizzle = db?.drizzle || db

    if (!drizzle) {
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: process.env.DATABASE_URI })
      try {
        await pool.query('ALTER TABLE programs DROP COLUMN IF EXISTS duration_minutes')
        console.log('Migration 20260607_000000: dropped duration_minutes column')
      } finally {
        await pool.end()
      }
      return
    }

    await drizzle.execute('ALTER TABLE programs DROP COLUMN IF EXISTS duration_minutes')
  },
  down: async (args: any) => {
    const { payload } = args || {}
    const db = payload.db as any
    const drizzle = db?.drizzle || db

    if (!drizzle) {
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: process.env.DATABASE_URI })
      try {
        await pool.query('ALTER TABLE programs ADD COLUMN duration_minutes numeric DEFAULT 5 NOT NULL')
        console.log('Migration 20260607_000000: restored duration_minutes column')
      } finally {
        await pool.end()
      }
      return
    }

    await drizzle.execute('ALTER TABLE programs ADD COLUMN duration_minutes numeric DEFAULT 5 NOT NULL')
  },
}
