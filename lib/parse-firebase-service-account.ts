/**
 * Parse Firebase service account from env or file.
 * Next.js loadEnvConfig escapes quotes and may turn \n in .env into real newlines.
 */

export function parseFirebaseServiceAccountFromEnv(
  raw: string | undefined
): Record<string, unknown> | null {
  if (!raw?.trim()) return null;

  const attempts: string[] = [raw.trim()];

  // Next.js often stores JSON as {\"type\":...} with literal newlines in private_key
  if (raw.includes('\\"') || raw.includes('\n')) {
    attempts.push(
      raw.replace(/\\"/g, '"').replace(/\r?\n/g, '\\n'),
      raw.replace(/\\"/g, '"')
    );
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && parsed.project_id) {
        if (typeof parsed.private_key === 'string') {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return parsed;
      }
    } catch {
      // try next strategy
    }
  }

  return null;
}

export async function loadFirebaseServiceAccount(): Promise<Record<string, unknown> | null> {
  const fromEnv = parseFirebaseServiceAccountFromEnv(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  );
  if (fromEnv) return fromEnv;

  try {
    const fs = await import('fs');
    const path = await import('path');
    const customPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const candidates = customPath
      ? [customPath]
      : [path.join(process.cwd(), 'firebase-service-account.json')];

    for (const serviceAccountPath of candidates) {
      if (fs.existsSync(serviceAccountPath)) {
        const parsed = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as Record<
          string,
          unknown
        >;
        if (typeof parsed.private_key === 'string') {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return parsed;
      }
    }
  } catch {
    // optional local file
  }

  return null;
}
