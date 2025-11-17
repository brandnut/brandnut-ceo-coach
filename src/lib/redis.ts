import Redis from 'ioredis'

// Redis 连接配置 - 照搬 brandnut-ops
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/0', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('Redis connection error:', err)
})

redis.on('connect', () => {
  console.log('Connected to Redis successfully')
})

export { redis }