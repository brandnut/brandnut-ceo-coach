const Redis = require('ioredis');

// Redis 连接配置
const redis = new Redis(process.env.REDIS_URL || 'redis://:WjHgUuTB6sRXu8n@brand-agent-redis-1.redis.rds.aliyuncs.com:6379/0');

function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjMyNjU4MDYsInN1YiI6ImJmODZhZTliLTQ3NWItNDRmYi04MzYyLTIzM2FiMTQ0ZWY3MCIsInR5cGUiOiJhY2Nlc3MiLCJ1c2VybmFtZSI6ImpveXUiLCJlbWFpbCI6ImlrZWl0aGNoZW5AbWUuY29tIiwicm9sZSI6InVzZXIifQ.IwVoa3t-ckNyOujjnVit14L8Q2P0B5DIXo7o3dKwZ5U';

async function checkLogoutIssue() {
  try {
    console.log('🔍 检查logout逻辑问题...\n');

    const tokenHash = hashToken(accessToken);
    const userId = 'bf86ae9b-475b-44fb-8362-233ab144ef70';
    const userTokenKey = `user_session:${userId}:access_tokens`;

    console.log('📋 Token信息:');
    console.log('原始Token:', accessToken);
    console.log('Token Hash:', tokenHash);
    console.log('用户Token Key:', userTokenKey);

    // 1. 检查用户集合中有什么
    console.log('\n🔍 检查用户集合中的内容:');
    const userTokens = await redis.smembers(userTokenKey);
    console.log('集合中的tokens:', userTokens);
    console.log('包含原始token?', userTokens.includes(accessToken));
    console.log('包含token hash?', userTokens.includes(tokenHash));

    // 2. 检查具体的token keys
    console.log('\n🔍 检查具体的token keys:');
    const accessKey = `access_token:${tokenHash}`;
    const tokenData = await redis.get(accessKey);
    console.log('access_token key数据:', tokenData);

    redis.quit();
  } catch (error) {
    console.error('❌ 检查失败:', error);
    redis.quit();
  }
}

checkLogoutIssue();