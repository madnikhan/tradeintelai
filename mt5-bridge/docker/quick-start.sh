#!/bin/bash
# Quick start script for Docker setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🐳 Docker Quick Start for MT5 Accounts"
echo "======================================"
echo ""

# Step 1: Check Docker
echo "1️⃣ Checking Docker..."
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed!"
  echo "   Install Docker Desktop: https://www.docker.com/products/docker-desktop"
  exit 1
fi

if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running!"
  echo "   Please start Docker Desktop first"
  exit 1
fi

echo "✅ Docker is installed and running"
echo ""

# Step 2: Check accounts file
echo "2️⃣ Checking accounts file..."
ACCOUNTS_FILE="$PROJECT_DIR/accounts.txt"
if [ ! -f "$ACCOUNTS_FILE" ]; then
  echo "⚠️  Accounts file not found: $ACCOUNTS_FILE"
  echo "   Creating example file..."
  cat > "$ACCOUNTS_FILE" << EOF
123456
123457
123458
EOF
  echo "   ✅ Created $ACCOUNTS_FILE"
  echo "   ⚠️  Please edit it with your actual account numbers"
  read -p "   Press Enter to continue..."
fi

echo "✅ Accounts file found: $(wc -l < "$ACCOUNTS_FILE") accounts"
echo ""

# Step 3: Generate docker-compose.yml
echo "3️⃣ Generating docker-compose.yml..."
cd "$SCRIPT_DIR"
if [ -f "generate-compose.sh" ]; then
  ./generate-compose.sh
else
  echo "❌ generate-compose.sh not found!"
  exit 1
fi
echo ""

# Step 4: Create .env file
echo "4️⃣ Setting up .env file..."
if [ ! -f ".env" ]; then
  echo "⚠️  .env file not found"
  echo "   Creating from template..."
  
  # Generate .env from accounts
  cat > .env << 'EOF'
# Environment variables for Docker Compose
# Fill in your account credentials below
# ⚠️ DO NOT commit .env to git!

EOF
  
  while read account; do
    account=$(echo "$account" | tr -d '[:space:]')
    if [ -n "$account" ]; then
      echo "ACCOUNT_PASSWORD_$account=your_password_here" >> .env
      echo "ACCOUNT_SERVER_$account=your_server_here" >> .env
      echo "" >> .env
    fi
  done < "$ACCOUNTS_FILE"
  
  echo "   ✅ Created .env file"
  echo "   ⚠️  Please edit .env and add your account credentials"
  read -p "   Press Enter to continue..."
else
  echo "✅ .env file exists"
fi
echo ""

# Step 5: Build images
echo "5️⃣ Building Docker images..."
echo "   This may take a few minutes..."
echo ""

# Build MT5 image
echo "   Building MT5 image..."
docker build -f Dockerfile.mt5 -t mt5-wine:latest "$PROJECT_DIR" || {
  echo "❌ Failed to build MT5 image"
  exit 1
}

# Build bridge image
echo "   Building bridge image..."
docker build -f Dockerfile.bridge -t mt5-bridge:latest "$PROJECT_DIR" || {
  echo "❌ Failed to build bridge image"
  exit 1
}

echo "✅ Images built successfully"
echo ""

# Step 6: Start services
echo "6️⃣ Starting services..."
echo "   Starting bridge manager and router..."
docker-compose up -d bridge-manager bridge-router || {
  echo "❌ Failed to start bridge services"
  exit 1
}

sleep 3

echo "   Starting MT5 accounts..."
docker-compose up -d || {
  echo "⚠️  Some containers may have failed to start"
  echo "   Check logs: docker-compose logs"
}

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Next steps:"
echo "   1. Check status: ./monitor.sh"
echo "   2. View logs: docker-compose logs -f"
echo "   3. Check bridge: curl http://localhost:8079/status"
echo ""
echo "💡 Useful commands:"
echo "   - Monitor: ./monitor.sh"
echo "   - Logs: docker-compose logs -f"
echo "   - Stop: docker-compose down"
echo "   - Restart: docker-compose restart"

