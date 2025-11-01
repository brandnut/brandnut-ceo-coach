import { Pool } from 'pg'
import { guestMode } from '@/config/app'

let pool: Pool | null = null

if (!guestMode.enabled && process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
}

export default pool
