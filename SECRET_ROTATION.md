# Secret rotation checklist

If API keys or service account credentials were exposed (chat, screenshots, git commit, etc.), rotate them immediately.

## Google Gemini

1. Go to [Google AI Studio API keys](https://aistudio.google.com/apikey)
2. **Delete** compromised keys
3. Create a new API key
4. Update `.env.local`:
   ```bash
   GEMINI_API_KEY=AIza...paste-full-key...
   ```
   No quotes. No spaces.
5. Verify before starting the app:
   ```bash
   npm run verify:gemini
   ```
6. Update the same variable on **Vercel** → Settings → Environment Variables → Redeploy

## OpenAI

1. Go to [OpenAI API keys](https://platform.openai.com/api-keys)
2. **Revoke** compromised keys
3. Create a new API key
4. Update `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-proj-...paste-full-key...
   ```
   No quotes. No spaces.
5. Verify before starting the app:
   ```bash
   npm run verify:openai
   ```
6. Update the same variable on **Vercel** → Redeploy

## Firebase Admin

1. Firebase Console → Project Settings → Service accounts → Generate new private key
2. Save as `firebase-service-account.json` in project root (gitignored)
3. Set in `.env.local`:
   ```bash
   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   ```
4. Remove inline `FIREBASE_SERVICE_ACCOUNT_KEY=...` from `.env.local` if present
5. Update `FIREBASE_SERVICE_ACCOUNT_KEY` on Vercel with the new JSON string

## Other keys in `.env.local`

Rotate any key that was exposed: Finnhub, Twelve Data, Newsdata, Fixer, Alpha Vantage, etc.

## After rotation

```bash
npm run verify:gemini
npm run verify:openai
npm run dev
```

Open dashboard → **Status** → Gemini and OpenAI rows show independently. Use **Settings → AI Provider → Auto** when one provider hits quota.
