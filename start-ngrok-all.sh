#!/bin/bash
# Start ngrok with multiple tunnels (Next.js + MT5 Bridge)

echo "🚀 Starting ngrok with multiple tunnels..."
echo ""

# Check if ngrok.yml exists
if [ ! -f "ngrok.yml" ]; then
    echo "❌ ngrok.yml not found!"
    echo ""
    echo "Creating ngrok.yml template..."
    echo "You need to:"
    echo "1. Get your ngrok authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "2. Update ngrok.yml with your authtoken"
    echo "3. Run this script again"
    exit 1
fi

# Check if authtoken is set
if grep -q "YOUR_NGROK_AUTHTOKEN_HERE" ngrok.yml; then
    echo "❌ Please update ngrok.yml with your authtoken!"
    echo ""
    echo "1. Get your authtoken: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "2. Edit ngrok.yml and replace YOUR_NGROK_AUTHTOKEN_HERE"
    echo "3. Run this script again"
    exit 1
fi

# Start ngrok with all tunnels
echo "Starting ngrok with configuration..."
ngrok start --all --config=ngrok.yml

