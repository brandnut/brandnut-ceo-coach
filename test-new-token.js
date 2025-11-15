const jwt = require('jsonwebtoken');

const SECRET_KEY = 'your-super-secret-key-change-in-production';
const ALGORITHM = 'HS256';

const userId = 'bf86ae9b-475b-44fb-8362-233ab144ef70';
const username = 'joyou';
const email = 'ikeithchen@me.com';
const role = 'user';

// 创建一个新的访问令牌
const accessToken = jwt.sign({
  exp: Math.floor(Date.now() / 1000) + (30 * 60), // 30分钟
  sub: userId,
  type: 'access',
  username: username,
  email: email,
  role: role
}, SECRET_KEY, { algorithm: ALGORITHM });

console.log('New Access Token:');
console.log(accessToken);

console.log('\nToken Payload:');
const decoded = jwt.decode(accessToken);
console.log(JSON.stringify(decoded, null, 2));