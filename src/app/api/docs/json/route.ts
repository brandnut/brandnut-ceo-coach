import { NextRequest, NextResponse } from 'next/server'

/**
 * @swagger
 * /api/docs/json:
 *   get:
 *     summary: OpenAPI Specification
 *     description: Get the OpenAPI 3.0 specification in JSON format
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI JSON specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET(request: NextRequest) {
  try {
    // 动态生成的OpenAPI规范
    const swaggerSpec = {
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
      },
      paths: {
        '/api/users/me': {
          get: {
            summary: 'Get current user information',
            description: 'Retrieve the current authenticated user\'s profile information and roles',
            tags: ['Users'],
            security: [{ bearerAuth: [] }],
            responses: {
              200: {
                description: 'User information retrieved successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/UserMeResponse' }
                  }
                }
              },
              401: {
                description: 'Authentication failed',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                  }
                }
              },
              403: {
                description: 'Account inactive',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                  }
                }
              }
            }
          }
        },
        '/api/users/me/organizations': {
          get: {
            summary: 'Get user organizations',
            description: 'Retrieve the organizations the current user belongs to',
            tags: ['Users'],
            security: [{ bearerAuth: [] }],
            responses: {
              200: {
                description: 'User organizations retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Organization' }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/auth/refresh': {
          post: {
            summary: 'Refresh access token',
            description: 'Use a refresh token to get a new access token',
            tags: ['Authentication'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      refreshToken: { type: 'string' }
                    },
                    required: ['refreshToken']
                  }
                }
              }
            },
            responses: {
              200: {
                description: 'Token refreshed successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              },
              401: {
                description: 'Refresh token failed',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                  }
                }
              }
            }
          }
        }
      }
    };

    return NextResponse.json(swaggerSpec, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to generate API documentation' },
      { status: 500 }
    );
  }
}