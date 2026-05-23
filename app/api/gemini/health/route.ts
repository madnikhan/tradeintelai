import { NextResponse } from 'next/server';
import { checkGeminiKeyHealth } from '@/lib/gemini-health';

export async function GET() {
  const result = await checkGeminiKeyHealth();
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
