import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: instanceId } = await params;

  if (!instanceId) {
    return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
  }

  const apiKey = process.env.BRANDNUT_MEMORY_API_KEY;

  if (!apiKey) {
    console.error('BRANDNUT_MEMORY_API_KEY is not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    console.log(`🔍 Proxying instance request for: ${instanceId}`);
    console.log(`🔑 Using API Key: ${apiKey.substring(0, 10)}...`);

    const response = await fetch(
      `https://brandnut.cn/memory/api/v1/instance/${instanceId}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`❌ Brandnut API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch instance data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('📋 Brandnut API Response received');
    console.log(JSON.stringify(data, null, 2));

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error fetching instance config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch instance data' },
      { status: 500 }
    );
  }
}