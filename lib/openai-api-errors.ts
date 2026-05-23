export type OpenAIProxyErrorSource = 'openai' | 'firebase' | 'unknown';

export function isOpenAIKeyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('incorrect api key') ||
    lower.includes('invalid api key') ||
    lower.includes('openai_api_key') ||
    lower.includes('verify:openai')
  );
}

export function isFirebaseAuthErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('authorization header') ||
    lower.includes('token not provided') ||
    lower.includes('invalid token') ||
    lower.includes('firebase admin not configured') ||
    lower.includes('sign in')
  );
}

export function formatOpenAIProxyErrorForUser(
  status: number,
  body: { error?: unknown; source?: string; message?: string }
): string {
  const rawError = body.error;
  const message =
    typeof rawError === 'string'
      ? rawError
      : rawError && typeof rawError === 'object' && 'message' in rawError
        ? String((rawError as { message: unknown }).message)
        : body.message || `HTTP ${status}`;

  if (status === 401 && (body.source === 'openai' || isOpenAIKeyErrorMessage(message))) {
    return 'OpenAI API key rejected — run npm run verify:openai';
  }
  if (status === 401 && body.source === 'firebase') {
    return 'Authentication failed. Please sign in again to use AI features.';
  }
  if (status === 429) {
    return 'OpenAI rate limit or quota exceeded — wait or check billing at platform.openai.com';
  }
  return `OpenAI API error (${status}): ${message}`;
}
