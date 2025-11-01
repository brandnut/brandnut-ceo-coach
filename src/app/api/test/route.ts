import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 Test API endpoint called');

  return NextResponse.json({
    success: true,
    message: 'API routes are working',
    timestamp: new Date().toISOString(),
    envVars: {
      BRANDNUT_MEMORY_API_KEY: process.env.BRANDNUT_MEMORY_API_KEY ? '✅ Set' : '❌ Missing'
    }
  });
}