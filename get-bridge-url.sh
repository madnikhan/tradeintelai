#!/bin/bash
# Get current bridge ngrok URL and update .env.local

echo "🔍 Checking ngrok tunnels..."

BRIDGE_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[] | select(.name == "bridge") | .public_url')

if [ -z "$BRIDGE_URL" ] || [ "$BRIDGE_URL" = "null" ]; then
  echo "❌ Error: Bridge ngrok tunnel not found!"
  echo "💡 Make sure ngrok is running: ngrok start --config ngrok.yml --all"
  exit 1
fi

echo "✅ Found bridge ngrok URL: $BRIDGE_URL"
echo ""
echo "📝 Updating .env.local..."

# Update .env.local
if [ -f .env.local ]; then
  # Check if NEXT_PUBLIC_BRIDGE_URL exists
  if grep -q "NEXT_PUBLIC_BRIDGE_URL" .env.local; then
    # Update existing line
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "s|NEXT_PUBLIC_BRIDGE_URL=.*|NEXT_PUBLIC_BRIDGE_URL=$BRIDGE_URL|" .env.local
    else
      # Linux
      sed -i "s|NEXT_PUBLIC_BRIDGE_URL=.*|NEXT_PUBLIC_BRIDGE_URL=$BRIDGE_URL|" .env.local
    fi
  else
    # Add new line
    echo "NEXT_PUBLIC_BRIDGE_URL=$BRIDGE_URL" >> .env.local
  fi
else
  # Create new file
  echo "NEXT_PUBLIC_BRIDGE_URL=$BRIDGE_URL" > .env.local
fi

echo "✅ Updated .env.local with: NEXT_PUBLIC_BRIDGE_URL=$BRIDGE_URL"
echo ""
echo "⚠️  IMPORTANT: Restart Next.js for changes to take effect!"
echo "   Stop Next.js (Ctrl+C), then run: npm run dev"
echo ""
echo "📱 For mobile access (no restart needed), use URL parameter:"
echo "   https://your-app-url/dashboard?bridge_url=$BRIDGE_URL"

