
import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

try {
  await pool.query(`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS owner_id INTEGER
    REFERENCES users(id)
  `)

  console.log('Database schema updated successfully.')
} catch (error) {
  console.error('Schema update failed:', error.message)
} finally {
  await pool.end()
}
