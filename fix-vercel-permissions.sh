#!/bin/bash
# Fix Vercel Deployment Permissions
# This script helps resolve the git author permission issue

echo "🔧 Vercel Deployment Permission Fix"
echo "===================================="
echo ""

echo "📋 Current Git Configuration:"
echo "   Email: $(git config user.email)"
echo "   Name: $(git config user.name)"
echo ""

echo "❌ Issue: Git author email needs access to Vercel team"
echo ""

echo "✅ Solution Options:"
echo ""
echo "Option 1: Add Email to Vercel Team (Recommended)"
echo "   1. Go to: https://vercel.com/teams/madnikhan1-5255/settings/members"
echo "   2. Click 'Add Member'"
echo "   3. Add email: madnikhan791@icloud.com"
echo "   4. Set role: Member or Developer"
echo "   5. Then run: npx vercel --prod --yes"
echo ""

echo "Option 2: Deploy via Vercel Dashboard (Easiest - No Permissions Needed)"
echo "   1. Go to: https://vercel.com/dashboard"
echo "   2. Click project: tradeintelai"
echo "   3. Click 'Deployments' → 'Create Deployment'"
echo "   4. Select branch: main"
echo "   5. Click 'Deploy'"
echo ""

echo "Option 3: Change Git Author (Temporary Workaround)"
echo "   This will change the author for new commits only"
echo "   Run: git config user.email 'your-vercel-email@example.com'"
echo "   Then commit and push, then deploy"
echo ""

echo "🔍 To check your Vercel account email:"
echo "   Run: npx vercel whoami"
echo ""

echo "💡 Recommended: Use Option 2 (Dashboard) - it's the easiest and doesn't require permission changes!"

