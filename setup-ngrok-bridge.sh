#!/bin/bash
# Quick setup script for ngrok tunnel to MT5 bridge

echo "🚀 Setting up ngrok tunnel for MT5 Bridge"
echo "=========================================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed"
    echo ""
    echo "Install with:"
    echo "  brew install ngrok"
    echo ""
    echo "Or download from: https://ngrok.com/download"
    exit 1
fi

# Check if bridge is running on port 8080
if ! lsof -ti:8080 &> /dev/null; then
    echo "⚠️  Warning: Nothing is running on port 8080"
    echo ""
    echo "Start your MT5 bridge first:"
    echo "  npm run bridge"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ ngrok found"
echo "✅ Port 8080 check passed"
echo ""

# Get ngrok URL
echo "📡 Starting ngrok tunnel..."
echo ""
echo "Your ngrok URL will appear below. Copy the HTTPS URL."
echo ""
echo "Example: https://abc123.ngrok.io"
echo ""
echo "Then set in Vercel Dashboard → Environment Variables:"
echo "  NEXT_PUBLIC_BRIDGE_URL=https://your-ngrok-url.ngrok.io"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""

# Start ngrok
ngrok http 8080

