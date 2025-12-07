/**
 * API Authentication Middleware
 * Verifies Firebase Auth tokens for API route protection
 */

import { NextRequest } from 'next/server';

// Firebase Admin types (optional - will work without it in dev)
type FirebaseAdminAuth = any;
type FirebaseAdminApp = any;

// Initialize Firebase Admin (server-side only)
// Note: For production, install firebase-admin: npm install firebase-admin
let adminApp: FirebaseAdminApp | null = null;
let adminAuth: FirebaseAdminAuth | null = null;

async function getAdminAuth(): Promise<FirebaseAdminAuth | null> {
  // Try to use Firebase Admin SDK (requires firebase-admin package)
  try {
    // Dynamic import to avoid errors if package not installed
    const admin = await import('firebase-admin');
    
    if (!adminApp) {
      // Check if already initialized
      if (admin.apps.length > 0) {
        adminApp = admin.apps[0];
      } else {
        let serviceAccount: any = null;
        
        // Try to load service account from file (if exists in root)
        try {
          const fs = await import('fs');
          const path = await import('path');
          const serviceAccountPath = path.join(process.cwd(), 'tradeintelai-firebase-adminsdk-fbsvc-56a34bc401.json');
          
          if (fs.existsSync(serviceAccountPath)) {
            const serviceAccountData = fs.readFileSync(serviceAccountPath, 'utf8');
            serviceAccount = JSON.parse(serviceAccountData);
            console.log('✅ Loaded Firebase service account from file');
          }
        } catch (fileError) {
          // File not found or error reading - try environment variable
        }
        
        // Try environment variable if file not found
        if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          console.log('✅ Loaded Firebase service account from environment variable');
        }
        
        // Initialize with service account if available
        if (serviceAccount) {
          adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          });
        } else {
          // Fallback: Initialize without credentials (for development)
          console.warn('⚠️ No Firebase service account found. Using basic auth validation.');
          adminApp = admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          }, 'admin');
        }
      }
    }
    
    if (!adminAuth) {
      adminAuth = adminApp.auth();
    }
    
    return adminAuth;
  } catch (error) {
    // Firebase Admin not installed or initialization failed
    console.warn('⚠️ Firebase Admin not available:', error);
    // Will use fallback verification
    return null;
  }
}

/**
 * Verify Firebase Auth token from request
 * Returns user ID if valid, null if invalid
 */
export async function verifyApiAuth(request: NextRequest): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { 
        authorized: false, 
        error: 'Missing or invalid authorization header. Expected: Bearer <token>' 
      };
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return { 
        authorized: false, 
        error: 'Token not provided' 
      };
    }

    // Try to verify token using Firebase Admin (if available)
    const adminAuthInstance = await getAdminAuth();
    
    if (adminAuthInstance) {
      try {
        const decodedToken = await adminAuthInstance.verifyIdToken(token);
        return {
          authorized: true,
          userId: decodedToken.uid,
        };
      } catch (error: any) {
        return {
          authorized: false,
          error: error.message || 'Invalid token',
        };
      }
    }
    
    // Fallback: Basic token validation (development only)
    // In production, install firebase-admin and configure FIREBASE_SERVICE_ACCOUNT_KEY
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Firebase Admin not configured. Using development auth bypass.');
      console.warn('⚠️ For production, install firebase-admin and set FIREBASE_SERVICE_ACCOUNT_KEY');
      
      // Basic token validation - check it's a JWT-like token
      if (token.length > 20 && token.includes('.')) {
        // Try to decode JWT (basic check)
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            // Looks like a valid JWT structure
            return {
              authorized: true,
              userId: 'dev-user', // Placeholder for development
            };
          }
        } catch {
          // Invalid JWT structure
        }
      }
    }
    
    return {
      authorized: false,
      error: 'Invalid token or Firebase Admin not configured',
    };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return {
      authorized: false,
      error: error.message || 'Authentication failed',
    };
  }
}

/**
 * Check if request is authenticated (simple boolean check)
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const auth = await verifyApiAuth(request);
  return auth.authorized;
}

