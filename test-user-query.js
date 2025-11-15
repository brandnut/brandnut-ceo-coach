const { Pool } = require('pg');

// 使用相同的数据库连接
const pool = new Pool({
  connectionString: 'postgresql://backend_1:WjHgUuTB6sRXu8n@pgm-bp1yg4b6lcg1taou2o.pg.rds.aliyuncs.com:5432/market_mind'
});

async function testUserQuery() {
  try {
    console.log('🔗 Testing database connection...');
    await pool.connect();
    console.log('✅ Connected to database successfully');

    const userId = '545b8fda-9baa-430b-945f-a27474c3a445';

    console.log('\n📋 Testing user query for ID:', userId);

    const query = `
      SELECT
        id,
        username,
        email,
        full_name,
        avatar_url,
        phone,
        is_active,
        is_verified,
        is_superuser,
        created_at,
        updated_at,
        last_login_at
      FROM users
      WHERE id = $1
    `;

    const result = await pool.query(query, [userId]);

    console.log('\n📊 Query result:');
    console.log('Rows found:', result.rows.length);

    if (result.rows.length > 0) {
      console.log('User data:', JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('❌ No user found with ID:', userId);
    }

    pool.end();
  } catch (error) {
    console.error('❌ Query failed:', error);
    pool.end();
  }
}

testUserQuery();