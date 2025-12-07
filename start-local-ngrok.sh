#!/bin/bash
# Start Next.js dev server and ngrok tunnel for local development

echo "🚀 Starting Next.js dev server..."
npm run dev &
DEV_PID=$!

echo "⏳ Waiting for server to start (5 seconds)..."
sleep 5

echo "🌐 Starting ngrok tunnel for localhost:3000..."
echo ""
echo "📋 Next steps:"
echo "1. Copy the 'Forwarding' URL from ngrok (e.g., https://abc123.ngrok-free.app)"
echo "2. Open that URL on your iPhone"
echo "3. The app will be accessible from your phone!"
echo ""
echo "⚠️  Note: Keep this terminal open. Press Ctrl+C to stop both services."
echo ""

# Start ngrok
ngrok http 3000

# Cleanup on exit
echo ""
echo "🛑 Stopping services..."
kill $DEV_PID 2>/dev/null
echo "✅ Done!"

