/**
 * Edge-safe API route path guards (no firebase-admin).
 */

export function isTestApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/test');
}

export function isProtectedApiRoute(pathname: string): boolean {
  if (!pathname.startsWith('/api')) return false;
  if (isTestApiRoute(pathname)) return false;
  if (pathname === '/api/stripe/webhook') return false;
  if (pathname === '/api/telegram/webhook') return false;
  if (pathname.startsWith('/api/gemini/health')) return false;
  if (pathname.startsWith('/api/openai/health')) return false;
  if (pathname.startsWith('/api/health/')) return false;
  return true;
}
