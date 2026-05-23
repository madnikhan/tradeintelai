# Firebase Auth Troubleshooting

## "Invalid email or password" (400 from identitytoolkit)

When you see a **400** from `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` and the message **"Invalid email or password"**, Firebase is rejecting the credentials. Check the following.

### 1. Enable Email/Password in Firebase Console

- Open [Firebase Console](https://console.firebase.google.com) → your project.
- Go to **Authentication** → **Sign-in method**.
- Enable **Email/Password** (and optionally **Email link** if you use it).

If Email/Password is disabled, you may get errors like `auth/operation-not-allowed` or a generic 400.

### 2. Create an account first

- If you have never signed up, use **Sign up** on the login form to create an account.
- Then sign in with that same email and password.

### 3. Check email and password

- Confirm the email has no typos and is the one you used to sign up.
- Passwords are case-sensitive; ensure no extra spaces.

### 4. Forgot password

- Use **Forgot password?** on the login form, enter your email, and click **Send link**.
- Check your inbox (and spam) for the reset email from Firebase.

### 5. Google Sign-in

- If email/password keeps failing, try **Sign in with Google** (ensure Google is enabled under Authentication → Sign-in method in Firebase Console).

---

## Vercel / production: "domain is not authorized for OAuth operations"

Console warning:

```text
The current domain is not authorized for OAuth operations...
Add your domain (tradeintelai.vercel.app) to the OAuth redirect domains list
```

Email/password and **Google Sign-in** will fail on production until the domain is allowlisted.

### Fix (Firebase Console)

1. Open [Firebase Console](https://console.firebase.google.com) → project **tradeintelai**
2. **Authentication** → **Settings** → **Authorized domains**
3. Click **Add domain**
4. Add:
   - `tradeintelai.vercel.app` (production)
   - Any custom domain you use later (e.g. `app.tradeintelai.com`)
5. Save and retry sign-in (hard refresh or incognito)

`localhost` and `*.firebaseapp.com` are added by default; **Vercel URLs are not**.

### Google Sign-in still fails?

In [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials** → your OAuth 2.0 Web client:

- **Authorized JavaScript origins:** add `https://tradeintelai.vercel.app`
- **Authorized redirect URIs:** usually `https://tradeintelai.firebaseapp.com/__/auth/handler` (Firebase default)

---

## Console error codes (for debugging)

The app logs the Firebase error code in the console, e.g. `(auth/invalid-credential)`. Common codes:

| Code | Meaning |
|------|--------|
| `auth/invalid-credential` | Wrong email or password (or user not found). |
| `auth/operation-not-allowed` | Email/Password sign-in is not enabled in Firebase. |
| `auth/user-disabled` | Account was disabled in Firebase Console. |
| `auth/too-many-requests` | Too many failed attempts; try again later. |

Fix the cause (enable method, correct credentials, or reset password) and try again.

---

## Firestore `UNAUTHENTICATED` on subscribe / checkout (production)

Error in UI or logs:

```text
16 UNAUTHENTICATED: Request had invalid authentication credentials...
```

The **Firebase service account private key is invalid, corrupted, or revoked**. Token verification (login) still works; **Firestore Admin** does not.

### Fix

1. [Firebase Console](https://console.firebase.google.com) → **tradeintelai** → ⚙️ **Project settings** → **Service accounts**
2. Click **Generate new private key** → download JSON
3. Save as `firebase-service-account.json` in the project root (gitignored)
4. Verify locally:

   ```bash
   npm run verify:firebase-admin
   ```

5. Sync to Vercel:

   ```bash
   npm run vercel:env-sync
   ```

6. Redeploy on Vercel

**Do not** paste multi-line JSON into Vercel UI by hand — use the sync script or a single minified line. If the key was exposed in git/chat, **delete the old key** in Firebase Console after rotating.

Checkout can proceed to Stripe even when Firestore is down, but **subscription access after payment** requires a working service account (webhook writes to Firestore).

---
