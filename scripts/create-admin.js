const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const DATABASE_URL = 'postgresql://admin:admin123@localhost:5432/custom_web_app';

async function createFirstAdmin() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log('创建第一个admin用户...');

    // 检查是否已有admin用户
    const existingAdmin = await client.query(
      'SELECT id, username FROM users WHERE role = $1',
      ['admin']
    );

    if (existingAdmin.rows.length > 0) {
      console.log('✅ 已存在admin用户:');
      existingAdmin.rows.forEach(user => {
        console.log(`  - ${user.username} (ID: ${user.id})`);
      });
      return;
    }

    // 创建默认admin用户
    const adminUsername = 'admin';
    const adminPassword = 'admin123'; // 生产环境应该要求用户输入

    // 检查admin用户名是否已存在
    const adminExists = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [adminUsername]
    );

    if (adminExists.rows.length > 0) {
      // 如果admin用户存在但不是admin角色，更新为admin
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await client.query(
        'UPDATE users SET role = $1, password_hash = $2 WHERE username = $3',
        ['admin', passwordHash, adminUsername]
      );
      console.log('✅ 已将现有admin用户升级为管理员');
    } else {
      // 创建新的admin用户
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await client.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        [adminUsername, passwordHash, 'admin']
      );
      console.log('✅ 创建了新的admin用户');
    }

    console.log(`📋 登录信息:`);
    console.log(`  用户名: ${adminUsername}`);
    console.log(`  密码: ${adminPassword}`);
    console.log(`  ⚠️  请立即修改默认密码！`);

  } catch (error) {
    console.error('❌ 创建admin用户失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createFirstAdmin().catch(console.error);