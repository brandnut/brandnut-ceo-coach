const Redis = require('ioredis');

// Redis 连接配置
const redis = new Redis({
  host: process.env.REDIS_HOST || 'brand-agent-redis-1.redis.rds.aliyuncs.com',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'WjHgUuTB6sRXu8n',
  db: parseInt(process.env.REDIS_DB || '0'),
});

// Token 哈希函数
function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjMyNjU4MDYsInN1YiI6ImJmODZhZTliLTQ3NWItNDRmYi04MzYyLTIzM2FiMTQ0ZWY3MCIsInR5cGUiOiJhY2Nlc3MiLCJ1c2VybmFtZSI6ImpveXUiLCJlbWFpbCI6ImlrZWl0aGNoZW5AbWUuY29tIiwicm9sZSI6InVzZXIifQ.IwVoa3t-ckNyOujjnVit14L8Q2P0B5DIXo7o3dKwZ5U';

async function checkToken() {
  try {
    console.log('🔍 Checking exact token data...');

    const tokenHash = hashToken(accessToken);
    const accessKey = `access_token:${tokenHash}`;

    console.log('\n📋 Token Details:');
    console.log('Token:', accessToken);
    console.log('Hash:', tokenHash);
    console.log('Expected Key:', accessKey);

    // 检查这个确切的 key
    const tokenData = await redis.get(accessKey);
    console.log('\n📊 Token Data:', tokenData);

    if (tokenData) {
      const parsed = JSON.parse(tokenData);
      console.log('\n🔓 Parsed Token Data:');
      console.log(JSON.stringify(parsed, null, 2));
    }

    // 检查用户会话集合
    const userId = 'bf86ae9b-475b-44fb-8362-233ab144ef70';
    const userAccessTokensKey = `user_session:${userId}:access_tokens`;
    const userTokensKey = `user_session:${userId}:tokens`;

    console.log('\n🔍 User Session Keys:');
    console.log('Access Tokens Key:', userAccessTokensKey);
    console.log('Tokens Key:', userTokensKey);

    const userAccessTokens = await redis.smembers(userAccessTokensKey);
    const userTokens = await redis.smembers(userTokensKey);

    console.log('\n📝 User Access Tokens:', userAccessTokens);
    console.log('📝 User Tokens:', userTokens);
    console.log('Our Token Hash in Set:', userTokens.includes(tokenHash));

    // 检查所有 access_token keys 看看是否有匹配的
    console.log('\n🔍 Checking all access_token keys...');
    const allAccessKeys = await redis.keys('access_token:*');
    console.log('Total access_token keys:', allAccessKeys.length);

    // 找到包含我们用户 ID 的所有 keys
    const userRelatedKeys = allAccessKeys.filter(key => {
      return key.includes('7134e243d89b4e11e81aff539f53d95a49a32f740114d4b8c2da1340130a7ec5');
    });

    console.log('\n🎯 Matching Keys:', userRelatedKeys);

    redis.quit();
  } catch (error) {
    console.error('❌ Check failed:', error);
    redis.quit();
  }
}

checkToken();