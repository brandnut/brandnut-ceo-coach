const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

// Swagger 配置
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BrandNut Coach API',
      version: '1.0.0',
      description: 'BrandNut AI CEO Coach API Documentation',
      contact: {
        name: 'API Support',
        email: 'support@brandnut.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.brandnut.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            full_name: { type: 'string' },
            avatar_url: { type: 'string' },
            phone: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            last_login_at: { type: 'string', format: 'date-time' }
          }
        },
        Organization: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            logo_url: { type: 'string' },
            is_active: { type: 'boolean' },
            max_members: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        UserRole: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            role_id: { type: 'string', format: 'uuid' },
            role_name: { type: 'string' },
            scope: { type: 'string' },
            scope_id: { type: 'string' },
            granted_at: { type: 'string', format: 'date-time' },
            granted_by: { type: 'string', format: 'uuid' },
            expires_at: { type: 'string', format: 'date-time' },
            assignment_reason: { type: 'string' },
            is_active: { type: 'boolean' }
          }
        },
        UserMeResponse: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            full_name: { type: 'string' },
            id: { type: 'string', format: 'uuid' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            last_login_at: { type: 'string', format: 'date-time' },
            avatar_url: { type: 'string' },
            phone: { type: 'string' },
            roles: { type: 'array', items: { $ref: '#/components/schemas/UserRole' } },
            subscriptions: { type: 'array', items: {} }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            code: {
              type: 'string',
              enum: ['INVALID_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_REVOKED', 'ACCOUNT_INACTIVE']
            }
          }
        }
      }
    }
  },
  apis: [
    './src/app/api/**/*.ts', // API路由文件
    './src/lib/models/user.ts'  // 类型定义文件
  ]
};

// 生成 Swagger JSON
const specs = swaggerJsdoc(options);

// 写入文件
fs.writeFileSync(
  path.join(__dirname, 'swagger.json'),
  JSON.stringify(specs, null, 2)
);

console.log('✅ Swagger documentation generated successfully!');
console.log('📄 Available at: http://localhost:3001/api/docs');
console.log('📋 JSON file: docs/swagger.json');