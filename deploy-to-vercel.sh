#!/bin/bash
# Vercel Deployment Script
# Run this script to deploy to Vercel

echo "🚀 Deploying to Vercel..."
echo ""

# Check if logged in
if ! npx vercel whoami &>/dev/null; then
    echo "❌ Not logged in to Vercel"
    echo "Please run: npx vercel login"
    exit 1
fi

# Deploy to production
echo "📤 Deploying to production..."
npx vercel --prod --yes

echo ""
echo "✅ Deployment complete!"
