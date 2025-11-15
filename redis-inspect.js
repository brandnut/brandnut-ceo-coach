const Redis = require('ioredis');

// Redis 连接配置 - 照搬 brandnut-ops
const redis = new Redis({
  host: process.env.REDIS_HOST || 'brand-agent-redis-1.redis.rds.aliyuncs.com',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'WjHgUuTB6sRXu8n',
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
});

// Token 哈希函数
function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjMyNjU4MDYsInN1YiI6ImJmODZhZTliLTQ3NWItNDRmYi04MzYyLTIzM2FiMTQ0ZWY3MCIsInR5cGUiOiJhY2Nlc3MiLCJ1c2VybmFtZSI6ImpveXUiLCJlbWFpbCI6ImlrZWl0aGNoZW5AbWUuY29tIiwicm9sZSI6InVzZXIifQ.IwVoa3t-ckNyOujjnVit14L8Q2P0B5DIXo7o3dKwZ5U';

async function inspectRedis() {
  try {
    console.log('🔗 Connecting to Redis...');
    await redis.connect();
    console.log('✅ Connected to Redis successfully');

    const tokenHash = hashToken(accessToken);
    const accessKey = `access_token:${tokenHash}`;

    console.log('\n📋 Token Info:');
    console.log('Token Hash:', tokenHash);
    console.log('Access Key:', accessKey);

    console.log('\n🔍 Checking Redis data...');

    // 检查访问令牌
    const accessTokenData = await redis.get(accessKey);
    console.log('Access Token Data:', accessTokenData);

    // 检查用户会话
    const userId = 'bf86ae9b-475b-44fb-8362-233ab144ef70';
    const userSessionKey = `user_session:${userId}:access_tokens`;
    const userTokens = await redis.smembers(userSessionKey);
    console.log('User Access Tokens:', userTokens);

    console.log('\n🔍 Listing all keys in Redis...');
    const keys = await redis.keys('*');
    console.log('Total keys:', keys.length);

    // 显示所有相关的 key
    const relevantKeys = keys.filter(key =>
      key.includes('access_token') ||
      key.includes('refresh_token') ||
      key.includes('user_session')
    );

    console.log('\n📝 Relevant Keys:');
    for (const key of relevantKeys) {
      console.log(`- ${key}`);
    }

    if (relevantKeys.length > 0) {
      console.log('\n📊 Detailed data for relevant keys:');
      for (const key of relevantKeys.slice(0, 5)) { // 只显示前5个
        const value = await redis.get(key);
        if (value) {
          console.log(`\n${key}:`);
          try {
            const parsed = JSON.parse(value);
            console.log(JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.log(value);
          }
        }
      }
    }

    console.log('\n✅ Redis inspection completed!');

  } catch (error) {
    console.error('❌ Redis inspection failed:', error);
  } finally {
    await redis.quit();
  }
}

inspectRedis();