import { Pool } from 'pg'
import { guestMode } from '@/config/app'

let pool: Pool | null = null

// 优先使用环境变量覆盖，然后检查guestMode
const guestModeEnabled = process.env.GUEST_MODE_ENABLED === 'false' ? false : guestMode.enabled

if (!guestModeEnabled && process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // 最大连接数 - 增加以支持更高并发
    min: 2, // 最小连接数 - 保持两个常连接
    idleTimeoutMillis: 30000, // 空闲连接超时时间
    connectionTimeoutMillis: 10000, // 连接超时时间
    allowExitOnIdle: false, // 保持连接池活跃
  })
}

export { pool }
export default pool
