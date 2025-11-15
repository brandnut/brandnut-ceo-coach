import { Pool } from 'pg'
import { guestMode } from '@/config/app'

let pool: Pool | null = null

// 优先使用环境变量覆盖，然后检查guestMode
const guestModeEnabled = process.env.GUEST_MODE_ENABLED === 'false' ? false : guestMode.enabled

if (!guestModeEnabled && process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
}

export default pool
