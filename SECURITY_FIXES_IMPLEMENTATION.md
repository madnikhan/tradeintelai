# 🔒 Security Fixes Implementation Guide

**Step-by-step guide to secure your application before deployment**

---

## 🚨 Phase 1: Critical Fixes (MUST DO BEFORE DEPLOYMENT)

### 1. Remove Hardcoded API Keys

**File:** `config/api-keys.ts`

**Action:**
1. Move all API keys to environment variables
2. Create server-side API routes to proxy requests
3. Remove `config/api-keys.ts` from repository

**Implementation:**

Create `.env.local` (already in .gitignore):
```bash
# Server-side only (NOT NEXT_PUBLIC_)
FINNHUB_API_KEY_1=d4pkc3pr01qjpnavsjngd4pkc3pr01qjpnavsjo0
FINNHUB_API_KEY_2=d4pkcj1r01qjpnavsmq0d4pkcj1r01qjpnavsmqg
# ... etc

TWELVE_DATA_API_KEY_1=e51a952f311147e19de6cb729936add5
# ... etc

NEWSDATA_API_KEY_1=pub_2bfe5fe8fe9d4ad690fcad0b8500b11a
# ... etc

FIXER_API_KEY_1=c8998d52162967494b23d56bd756c0fb
# ... etc

ALPHA_VANTAGE_API_KEY_1=W1URSCEOYIWOEKSK
# ... etc
```

Create server-side API routes for each service:
- `app/api/finnhub/route.ts`
- `app/api/twelve-data/route.ts`
- `app/api/newsdata/route.ts`
- `app/api/fixer/route.ts`
- `app/api/alpha-vantage/route.ts`

---

### 2. Secure OpenAI API Key

**Files:** `lib/openai-service.ts`, `app/api/openai/chat/route.ts`

**Action:**
1. Remove `NEXT_PUBLIC_OPENAI_API_KEY` from client-side
2. Use server-side only `OPENAI_API_KEY`
3. Add authentication to `/api/openai/chat` route

**Implementation:**

Update `.env.local`:
```bash
# Remove NEXT_PUBLIC_ prefix - server-side only
OPENAI_API_KEY=sk-your-key-here
```

Update `app/api/openai/chat/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth'; // Or use Firebase client SDK

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    // Verify Firebase Auth token
    const decodedToken = await verifyIdToken(token);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // 2. Rate limiting (implement with Redis or Upstash)
    const userId = decodedToken.uid;
    const rateLimitResult = await checkRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // 3. Get API key from server-side env
    const apiKey = process.env.OPENAI_API_KEY; // NOT NEXT_PUBLIC_
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // 4. Forward request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('OpenAI proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

Update `lib/openai-service.ts`:
```typescript
// Remove client-side API key access
// Always call server-side API route instead

export async function generateAnalysisExplanation(
  analysis: MarketAnalysis,
  symbol: string
): Promise<GPTResponse | null> {
  // Get Firebase Auth token
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const token = await user.getIdToken();

  // Call server-side API route
  const response = await fetch('/api/openai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`, // Add auth token
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [/* ... */],
      max_completion_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error('OpenAI API error');
  }

  return response.json();
}
```

---

### 3. Add Authentication to All API Routes

**Action:**
Create a middleware to verify Firebase Auth tokens on all API routes.

**Implementation:**

Create `lib/api-auth.ts`:
```typescript
import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';

export async function verifyApiAuth(request: NextRequest): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authorized: false, error: 'Missing authorization header' };
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    
    return {
      authorized: true,
      userId: decodedToken.uid,
    };
  } catch (error) {
    return {
      authorized: false,
      error: 'Invalid token',
    };
  }
}
```

Use in all API routes:
```typescript
import { verifyApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // Proceed with authenticated request
  // Use auth.userId for user-specific data
}
```

---

### 4. Implement Rate Limiting

**Action:**
Add rate limiting to prevent API abuse.

**Implementation:**

Install rate limiting library:
```bash
npm install @upstash/ratelimit @upstash/redis
```

Create `lib/rate-limit.ts`:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const openaiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
});

export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});
```

Use in API routes:
```typescript
import { openaiRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit check
  const { success, limit, remaining } = await openaiRateLimit.limit(auth.userId!);
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', limit, remaining },
      { status: 429 }
    );
  }

  // Proceed with request
}
```

---

## 🛡️ Phase 2: Enhanced Security (RECOMMENDED)

### 5. Move Sensitive Logic Server-Side

**Action:**
Create server-side API for AI trading engine calculations.

**Implementation:**

Create `app/api/ai/analyze/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { AITradingEngine } from '@/lib/ai-trading-engine';

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { symbol, openTrades } = await request.json();
  
  // Run analysis server-side
  const engine = new AITradingEngine();
  const analysis = await engine.analyzeMarket(symbol, openTrades);
  
  return NextResponse.json(analysis);
}
```

Update client to call server-side API:
```typescript
// Instead of: aiTradingEngine.analyzeMarket()
// Use: fetch('/api/ai/analyze', { ... })
```

---

### 6. Update Firestore Security Rules

**Action:**
Ensure all Firestore rules use `request.auth.uid`.

**Current Rules Check:**
```javascript
// ❌ BAD - Allows anyone
allow read, write: if true;

// ✅ GOOD - Requires authentication
allow read, write: if request.auth != null && request.auth.uid == userId;
```

**Implementation:**

Update Firestore rules in Firebase Console:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Trades - users can only access their own
    match /trades/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
    
    // Analysis - users can only access their own
    match /analysis/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
    
    // Analytics - users can only access their own
    match /analytics/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
  }
}
```

---

### 7. Add Security Headers

**Action:**
Add security headers to Next.js configuration.

**Implementation:**

Update `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

---

## 📋 Deployment Checklist

Before deploying to production:

- [ ] Remove all hardcoded API keys
- [ ] Move API keys to server-side environment variables
- [ ] Remove `NEXT_PUBLIC_` from sensitive keys
- [ ] Add authentication to all API routes
- [ ] Implement rate limiting
- [ ] Update Firestore security rules
- [ ] Add security headers
- [ ] Test authentication flows
- [ ] Test rate limiting
- [ ] Review error messages (don't leak sensitive info)
- [ ] Enable HTTPS only
- [ ] Set up monitoring and alerting
- [ ] Perform security testing
- [ ] Review and remove debug code
- [ ] Document security measures

---

## 🚀 Quick Start

1. **Immediate (30 minutes):**
   - Remove hardcoded keys from `config/api-keys.ts`
   - Move to environment variables
   - Secure OpenAI API key

2. **Short-term (2-3 hours):**
   - Add authentication to API routes
   - Implement rate limiting
   - Update Firestore rules

3. **Long-term (1-2 days):**
   - Move sensitive logic server-side
   - Add comprehensive monitoring
   - Perform security audit

---

**⚠️ DO NOT DEPLOY UNTIL PHASE 1 IS COMPLETE**

