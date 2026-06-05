import type { Migration } from 'payload'

export const migration: Migration = {
  up: async ({ payload }) => {
    const db = payload.db as any
    const drizzle = db?.drizzle || db

    if (!drizzle) {
      // Fallback: direct pg query
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: process.env.DATABASE_URI })
      try {
        // Create users_rels table (mirroring devices_rels)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users_rels (
            id SERIAL PRIMARY KEY,
            "order" INTEGER NOT NULL,
            parent_id INTEGER NOT NULL,
            path VARCHAR NOT NULL,
            departments_id INTEGER
          )
        `)

        // Copy existing single department_id to the rels table
        await pool.query(`
          INSERT INTO users_rels ("order", parent_id, path, departments_id)
          SELECT 0, id, 'departments', department_id
          FROM users
          WHERE department_id IS NOT NULL
        `)

        // Drop the old column
        await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS department_id')

        console.log('Migration 20260605_000000: departments → departments hasMany completed')
      } finally {
        await pool.end()
      }
      return
    }

    // Use drizzle for migration
    await drizzle.execute(`
      CREATE TABLE IF NOT EXISTS users_rels (
        id SERIAL PRIMARY KEY,
        "order" INTEGER NOT NULL,
        parent_id INTEGER NOT NULL,
        path VARCHAR NOT NULL,
        departments_id INTEGER
      )
    `)

    await drizzle.execute(`
      INSERT INTO users_rels ("order", parent_id, path, departments_id)
      SELECT 0, id, 'departments', department_id
      FROM users
      WHERE department_id IS NOT NULL
    `)

    await drizzle.execute('ALTER TABLE users DROP COLUMN IF EXISTS department_id')
  },
  down: async ({ payload }) => {
    const db = payload.db as any
    const drizzle = db?.drizzle || db

    if (!drizzle) {
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: process.env.DATABASE_URI })
      try {
        // Add the department_id column back
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER')

        // Restore data from rels table
        await pool.query(`
          UPDATE users u
          SET department_id = r.departments_id
          FROM users_rels r
          WHERE r.parent_id = u.id
            AND r.path = 'departments'
            AND r."order" = 0
        `)

        // Remove migrated rows
        await pool.query("DELETE FROM users_rels WHERE path = 'departments'")

        console.log('Migration 20260526_020612: departments hasMany → departments reverted')
      } finally {
        await pool.end()
      }
      return
    }

    await drizzle.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER')

    await drizzle.execute(`
      UPDATE users u
      SET department_id = r.departments_id
      FROM users_rels r
      WHERE r.parent_id = u.id
        AND r.path = 'departments'
        AND r."order" = 0
    `)

    await drizzle.execute("DELETE FROM users_rels WHERE path = 'departments'")
  },
}
