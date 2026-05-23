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

## Console error codes (for debugging)

The app logs the Firebase error code in the console, e.g. `(auth/invalid-credential)`. Common codes:

| Code | Meaning |
|------|--------|
| `auth/invalid-credential` | Wrong email or password (or user not found). |
| `auth/operation-not-allowed` | Email/Password sign-in is not enabled in Firebase. |
| `auth/user-disabled` | Account was disabled in Firebase Console. |
| `auth/too-many-requests` | Too many failed attempts; try again later. |

Fix the cause (enable method, correct credentials, or reset password) and try again.
