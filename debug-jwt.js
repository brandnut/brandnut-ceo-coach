const jwt = require('jsonwebtoken');

// 从环境变量读取SECRET_KEY
const SECRET_KEY = process.env.SECRET_KEY || 'your-super-secret-key-change-in-production';

// 你提供的keith的token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MzQwMDc4MjAsInN1YiI6IjU0NWI4ZmRhLTliYWEtNDMwYi05NDVmLWEyNzQ3NGMzYTQ0NSIsInR5cGUiOiJhY2Nlc3MiLCJ1c2VybmFtZSI6ImtlaXRoIiwiZW1haWwiOiJrZWl0aEBicmFuZG51dC5jb20iLCJyb2xlIjoic3RhZmYifQ.Hs0P3Sn1qf5kHJtUYrPjAqqbsKZiMffZxHZqi4JPkXQ';

console.log('Token:', token);
console.log('SECRET_KEY:', SECRET_KEY);

try {
  // 先解析payload（不验证签名）
  const decoded = jwt.decode(token);
  console.log('\n📋 Token payload (未验证签名):');
  console.log(JSON.stringify(decoded, null, 2));
  console.log('用户ID (sub):', decoded.sub);

  // 再验证签名
  const payload = jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] });
  console.log('\n✅ JWT验证成功!');
  console.log('解析的payload:', JSON.stringify(payload, null, 2));
} catch (error) {
  console.error('\n❌ JWT验证失败:');
  console.error('错误类型:', error.name);
  console.error('错误信息:', error.message);
}