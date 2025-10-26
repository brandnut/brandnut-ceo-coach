import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const DEFAULT_API_BASE = 'https://api.cloud.llamaindex.ai/api/v1';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.LLAMAINDEX_API_KEY;
  const pipelineId = process.env.LLAMAINDEX_PIPELINE_ID;
  const apiBase = process.env.LLAMAINDEX_API_BASE_URL || DEFAULT_API_BASE;

  if (!apiKey || !pipelineId) {
    return NextResponse.json(
      { error: 'Missing LlamaIndex credentials' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${apiBase}/pipelines/${pipelineId}/files2`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        cache: 'no-store',
      }
    );

    return response;
  } catch (error) {
    console.error('Knowledge documents fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
