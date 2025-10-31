const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://admin:admin123@localhost:5432/custom_web_app';

async function runMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log('开始执行数据库迁移...');

    // 检查role字段是否已存在
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ role字段已存在，跳过迁移');
      return;
    }

    // 开始事务
    await client.query('BEGIN');

    // 添加role字段，默认为'user'
    await client.query(`
      ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user'
    `);
    console.log('✅ 添加role字段');

    // 添加约束确保角色值有效
    await client.query(`
      ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('user', 'admin'))
    `);
    console.log('✅ 添加role约束');

    // 为查询性能添加索引
    await client.query(`
      CREATE INDEX idx_users_role ON users(role)
    `);
    console.log('✅ 创建role索引');

    // 验证修改
    const verifyResult = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    console.log('✅ 验证结果:', verifyResult.rows[0]);

    // 提交事务
    await client.query('COMMIT');
    console.log('🎉 数据库迁移完成！');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);