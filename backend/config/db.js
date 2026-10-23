
import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is missing. Check your backend .env file.'
  )
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // For hosted PostgreSQL requiring SSL, configure SSL
  // according to your provider's instructions.
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL error:', error.message)
})

export async function testDatabaseConnection() {
  const result = await pool.query(`
    SELECT current_database() AS database
  `)

  console.log(
    `PostgreSQL connected: ${result.rows[0].database}`
  )
}
