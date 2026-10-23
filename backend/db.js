
import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL error:', error.message)
})

export async function testDatabaseConnection() {
  const result = await pool.query(
    'SELECT current_database() AS database'
  )

  console.log(
    `PostgreSQL connected: ${result.rows[0].database}`
  )
}
