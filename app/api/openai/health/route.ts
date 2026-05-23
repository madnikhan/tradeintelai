import { NextResponse } from 'next/server';
import { checkOpenAIKeyHealth } from '@/lib/openai-health';

export async function GET() {
  const result = await checkOpenAIKeyHealth();
  return NextResponse.json(
    {
      ok: result.ok,
      message: result.message,
      reason: result.reason,
      keyFingerprint: result.keyFingerprint
        ? {
            length: result.keyFingerprint.length,
            prefix: result.keyFingerprint.prefix,
            suffix: result.keyFingerprint.suffix,
            hasQuotes: result.keyFingerprint.hasQuotes,
            hasWhitespace: result.keyFingerprint.hasWhitespace,
          }
        : null,
    },
    { status: result.ok ? 200 : result.httpStatus }
  );
}
