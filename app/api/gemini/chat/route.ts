/**
 * Gemini API Proxy Route
 * Proxies requests to Google Gemini with Firebase authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { generateGeminiText, generateGeminiWithImage } from '@/lib/gemini-client';
import { getGeminiKeyFromEnv } from '@/lib/gemini-key-fingerprint';

type GeminiChatBody = {
  mode?: 'text' | 'vision';
  system?: string;
  user?: string;
  imageBase64?: string;
  json?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized', source: 'firebase' },
      { status: 401 }
    );
  }

  let body: GeminiChatBody;
  try {
    const text = await request.text();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }
    body = JSON.parse(text) as GeminiChatBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.user?.trim()) {
    return NextResponse.json({ error: 'user prompt is required' }, { status: 400 });
  }

  if (!getGeminiKeyFromEnv()) {
    return NextResponse.json(
      {
        error: 'Gemini API key not configured. Set GEMINI_API_KEY in .env.local and restart npm run dev.',
        source: 'gemini',
      },
      { status: 500 }
    );
  }

  try {
    const mode = body.mode || (body.imageBase64 ? 'vision' : 'text');
    const result =
      mode === 'vision' && body.imageBase64
        ? await generateGeminiWithImage({
            system: body.system,
            user: body.user,
            imageBase64: body.imageBase64,
            json: body.json,
          })
        : await generateGeminiText({
            system: body.system,
            user: body.user,
            json: body.json,
          });

    return NextResponse.json({ text: result.text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Gemini proxy error:', message);
    const isAuth =
      message.toLowerCase().includes('api key') ||
      message.toLowerCase().includes('permission');
    return NextResponse.json(
      { error: message, source: 'gemini' },
      { status: isAuth ? 401 : 500 }
    );
  }
}
