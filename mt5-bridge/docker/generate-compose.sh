#!/bin/bash
# Generate docker-compose.yml for all accounts
# Usage: ./generate-compose.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ACCOUNTS_FILE="$PROJECT_DIR/accounts.txt"
OUTPUT_FILE="$SCRIPT_DIR/docker-compose.yml"
BASE_PORT=8081

if [ ! -f "$ACCOUNTS_FILE" ]; then
  echo "❌ Accounts file not found: $ACCOUNTS_FILE"
  echo "   Create it first with all account logins"
  exit 1
fi

echo "🚀 Generating docker-compose.yml for all accounts..."

# Start compose file
cat > "$OUTPUT_FILE" << 'EOF'
version: '3.8'

services:
  # Multi-Bridge Manager
  bridge-manager:
    build:
      context: ..
      dockerfile: docker/Dockerfile.bridge
    container_name: bridge-manager
    ports:
      - "8079:8079"
    volumes:
      - ../multi-bridge-manager.py:/app/multi-bridge-manager.py
      - ../bridge-config.json:/app/bridge-config.json
      - ../mt5-commands:/app/mt5-commands
      - ../mt5-responses:/app/mt5-responses
    environment:
      - PYTHONUNBUFFERED=1
    restart: unless-stopped
    networks:
      - mt5-network

  # Bridge Router
  bridge-router:
    build:
      context: ..
      dockerfile: docker/Dockerfile.bridge
    container_name: bridge-router
    ports:
      - "8080:8080"
    depends_on:
      - bridge-manager
    volumes:
      - ../bridge-router.py:/app/bridge-router.py
    environment:
      - MANAGER_API_URL=http://bridge-manager:8079
      - PYTHONUNBUFFERED=1
    restart: unless-stopped
    networks:
      - mt5-network

EOF

# Generate services for each account
port=$BASE_PORT
account_num=1
total_accounts=$(wc -l < "$ACCOUNTS_FILE")

while read account; do
  # Remove whitespace
  account=$(echo "$account" | tr -d '[:space:]')
  
  if [ -z "$account" ]; then
    continue
  fi
  
  cat >> "$OUTPUT_FILE" << EOF

  # Account $account_num/$total_accounts
  mt5-account-$account:
    build:
      context: ..
      dockerfile: docker/Dockerfile.mt5
    container_name: mt5-account-$account
    environment:
      - ACCOUNT_LOGIN=$account
      - ACCOUNT_PASSWORD=\${ACCOUNT_PASSWORD_$account}
      - ACCOUNT_SERVER=\${ACCOUNT_SERVER_$account}
      - COMMANDS_DIR=mt5-commands-$account
      - RESPONSES_DIR=mt5-responses-$account
      - BRIDGE_PORT=$port
    volumes:
      - mt5-data-$account:/root/.wine
      - ../mt5-commands-$account:/mt5-commands
      - ../mt5-responses-$account:/mt5-responses
    ports:
      - "$port:$port"
    network_mode: host
    restart: unless-stopped
    mem_limit: 512m
    cpus: '0.5'
    shm_size: 256m

EOF
  ((port++))
  ((account_num++))
done < "$ACCOUNTS_FILE"

# Add networks and volumes
cat >> "$OUTPUT_FILE" << 'EOF'

networks:
  mt5-network:
    driver: bridge

volumes:
EOF

# Add volumes for each account
while read account; do
  account=$(echo "$account" | tr -d '[:space:]')
  if [ -n "$account" ]; then
    echo "  mt5-data-$account:" >> "$OUTPUT_FILE"
  fi
done < "$ACCOUNTS_FILE"

echo "✅ Generated $OUTPUT_FILE for $total_accounts accounts"
echo "   Ports: $BASE_PORT - $((port - 1))"
echo ""
echo "Next steps:"
echo "1. Create .env file with account credentials"
echo "2. Build images: docker-compose build"
echo "3. Start services: docker-compose up -d"

