#!/bin/bash
# Quick script to setup Firebase environment variables

cat > .env.local << 'EOF'
# Firebase Configuration
# Generated from Firebase Console

NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAlW035F2FeUguS_sfcAdD4RoK4JK1EFcA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tradeintelai.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tradeintelai
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tradeintelai.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1094200603774
NEXT_PUBLIC_FIREBASE_APP_ID=1:1094200603774:web:ce65733910c700f0ff142f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-Z04YSNTRJG
EOF

echo "✅ .env.local file created with Firebase configuration"
echo "📝 Please restart your Next.js dev server for changes to take effect"

