/**
 * Distinguish Gemini API key errors from Firebase auth errors on /api/gemini/chat.
 */

export type GeminiProxyErrorSource = 'gemini' | 'firebase' | 'unknown';

export function isGeminiKeyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('api key') ||
    lower.includes('api_key') ||
    lower.includes('gemini_api_key') ||
    lower.includes('permission denied') ||
    lower.includes('verify:gemini')
  );
}

export function isFirebaseAuthErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('authorization header') ||
    lower.includes('token not provided') ||
    lower.includes('invalid token') ||
    lower.includes('firebase admin not configured') ||
    lower.includes('authentication failed') ||
    lower.includes('sign in')
  );
}

export function parseGeminiProxyError(
  status: number,
  body: { error?: unknown; source?: string; message?: string }
): { message: string; source: GeminiProxyErrorSource } {
  const rawError = body.error;
  const message =
    typeof rawError === 'string'
      ? rawError
      : rawError && typeof rawError === 'object' && 'message' in rawError
        ? String((rawError as { message: unknown }).message)
        : body.message || `HTTP ${status}`;

  let source: GeminiProxyErrorSource = 'unknown';
  if (body.source === 'gemini' || body.source === 'firebase') {
    source = body.source;
  } else if (isGeminiKeyErrorMessage(message)) {
    source = 'gemini';
  } else if (isFirebaseAuthErrorMessage(message)) {
    source = 'firebase';
  } else if (status === 401 && !isFirebaseAuthErrorMessage(message)) {
    source = 'gemini';
  }

  return { message, source };
}

export function formatGeminiProxyErrorForUser(
  status: number,
  body: { error?: unknown; source?: string; message?: string }
): string {
  const { message, source } = parseGeminiProxyError(status, body);

  if (status === 401 && (source === 'gemini' || isGeminiKeyErrorMessage(message))) {
    return 'Gemini API key rejected — run npm run verify:gemini and update GEMINI_API_KEY in .env.local';
  }

  if (status === 401 && source === 'firebase') {
    return 'Authentication failed. Please sign in again to use AI features.';
  }

  if (status === 429 || message.toLowerCase().includes('quota')) {
    return 'Gemini rate limit exceeded. Wait a few minutes or enable billing at https://aistudio.google.com';
  }

  return `Gemini API error (${status}): ${message}`;
}
