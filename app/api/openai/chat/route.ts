import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { generateOpenAIText, generateOpenAIWithImage } from '@/lib/openai-client';
import { getOpenAIKeyFromEnv } from '@/lib/openai-key-fingerprint';
import type { AIChatBody } from '@/lib/ai-types';

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized', source: 'firebase' },
      { status: 401 }
    );
  }

  let body: AIChatBody;
  try {
    const text = await request.text();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }
    body = JSON.parse(text) as AIChatBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.user?.trim()) {
    return NextResponse.json({ error: 'user prompt is required' }, { status: 400 });
  }

  if (!getOpenAIKeyFromEnv()) {
    return NextResponse.json(
      {
        error: 'OpenAI API key not configured. Set OPENAI_API_KEY in .env.local.',
        source: 'openai',
      },
      { status: 500 }
    );
  }

  try {
    const mode = body.mode || (body.imageBase64 ? 'vision' : 'text');
    const result =
      mode === 'vision' && body.imageBase64
        ? await generateOpenAIWithImage({
            system: body.system,
            user: body.user,
            imageBase64: body.imageBase64,
            json: body.json,
          })
        : await generateOpenAIText({
            system: body.system,
            user: body.user,
            json: body.json,
          });

    return NextResponse.json({ text: result.text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('OpenAI proxy error:', message);
    const lower = message.toLowerCase();
    const isAuth = lower.includes('incorrect api key') || lower.includes('invalid api key');
    const isQuota = lower.includes('quota') || lower.includes('rate limit');
    const status = isAuth ? 401 : isQuota ? 429 : 500;
    return NextResponse.json({ error: message, source: 'openai' }, { status });
  }
}
