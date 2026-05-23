# 🐳 Docker Setup Guide for 50 MT5 Accounts

## Prerequisites

- macOS (or Linux)
- Docker Desktop installed
- At least 16GB RAM
- 20GB+ free disk space

---

## Step 1: Install Docker Desktop

### macOS

1. **Download Docker Desktop**
   ```bash
   # Option 1: Download from website
   open https://www.docker.com/products/docker-desktop
   
   # Option 2: Install via Homebrew
   brew install --cask docker
   ```

2. **Start Docker Desktop**
   - Open Docker Desktop from Applications
   - Wait for it to start (whale icon in menu bar)
   - Verify it's running:
     ```bash
     docker --version
     docker-compose --version
     ```

3. **Configure Docker Desktop**
   - Go to Settings → Resources
   - **Memory**: Set to 12GB+ (for 50 accounts)
   - **CPUs**: Use at least 6 cores
   - **Disk**: Ensure 20GB+ available

---

## Step 2: Prepare Project Structure

```bash
cd /Users/muhammadmadni/trading/tradeintelai/mt5-bridge

# Create necessary directories
mkdir -p docker
mkdir -p docker/mt5-data
mkdir -p docker/configs
```

---

## Step 3: Create Docker Files

### 3.1 Dockerfile for MT5

Create `docker/Dockerfile.mt5`:

```dockerfile
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Wine and dependencies
RUN apt-get update && apt-get install -y \
    wine64 \
    winetricks \
    xvfb \
    wget \
    curl \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set up Wine
ENV WINEPREFIX=/root/.wine
ENV WINEARCH=win64
ENV DISPLAY=:99

# Initialize Wine
RUN winecfg

# Install Windows dependencies
RUN winetricks -q corefonts vcrun2019

# Create MT5 directories
RUN mkdir -p /mt5/data /mt5/experts

# Copy startup script
COPY start-mt5.sh /start-mt5.sh
RUN chmod +x /start-mt5.sh

CMD ["/start-mt5.sh"]
```

### 3.2 Dockerfile for Bridge

Create `docker/Dockerfile.bridge`:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir requests

# Copy bridge files
COPY ../wine-mt5-connector.py /app/
COPY ../multi-bridge-manager.py /app/
COPY ../bridge-router.py /app/

CMD ["python3", "multi-bridge-manager.py"]
```

---

## Step 4: Create docker-compose.yml

Create `docker/docker-compose.yml`:

```yaml
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

  # MT5 Account Template (repeat for each account)
  # Example for account 123456
  mt5-account-123456:
    build:
      context: ..
      dockerfile: docker/Dockerfile.mt5
    container_name: mt5-account-123456
    environment:
      - ACCOUNT_LOGIN=123456
      - ACCOUNT_PASSWORD=${ACCOUNT_PASSWORD_123456}
      - ACCOUNT_SERVER=${ACCOUNT_SERVER_123456}
      - COMMANDS_DIR=mt5-commands-123456
      - RESPONSES_DIR=mt5-responses-123456
      - BRIDGE_PORT=8081
    volumes:
      - mt5-data-123456:/root/.wine
      - ../mt5-commands-123456:/mt5-commands
      - ../mt5-responses-123456:/mt5-responses
    ports:
      - "8081:8081"
    network_mode: host
    restart: unless-stopped
    mem_limit: 512m
    cpus: '0.5'
    shm_size: 256m

networks:
  mt5-network:
    driver: bridge

volumes:
  mt5-data-123456:
  # Add volumes for all accounts
```

---

## Step 5: Create Environment File

Create `docker/.env`:

```bash
# Account 123456
ACCOUNT_PASSWORD_123456=your_password_here
ACCOUNT_SERVER_123456=your_server_here

# Account 123457
ACCOUNT_PASSWORD_123457=your_password_here
ACCOUNT_SERVER_123457=your_server_here

# ... add for all 50 accounts
```

**⚠️ Important**: Add `.env` to `.gitignore` to keep passwords secure!

---

## Step 6: Create Helper Scripts

### 6.1 Generate docker-compose.yml for All Accounts

Create `docker/generate-compose.sh`:

```bash
#!/bin/bash
# Generate docker-compose.yml for all accounts

ACCOUNTS_FILE="../accounts.txt"
OUTPUT_FILE="docker-compose.yml"
BASE_PORT=8081

echo "version: '3.8'" > $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "services:" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Add bridge manager and router
cat >> $OUTPUT_FILE << 'EOF'
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

while read account; do
  cat >> $OUTPUT_FILE << EOF

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
done < $ACCOUNTS_FILE

# Add networks and volumes
cat >> $OUTPUT_FILE << 'EOF'

networks:
  mt5-network:
    driver: bridge

volumes:
EOF

# Add volumes for each account
while read account; do
  echo "  mt5-data-$account:" >> $OUTPUT_FILE
done < $ACCOUNTS_FILE

echo "✅ Generated $OUTPUT_FILE for $(wc -l < $ACCOUNTS_FILE) accounts"
```

---

## Step 7: Build and Start

### 7.1 Build Images

```bash
cd docker

# Build MT5 image
docker build -f Dockerfile.mt5 -t mt5-wine:latest ..

# Build bridge image
docker build -f Dockerfile.bridge -t mt5-bridge:latest ..
```

### 7.2 Generate docker-compose.yml

```bash
# Make script executable
chmod +x generate-compose.sh

# Generate compose file
./generate-compose.sh
```

### 7.3 Start Services

```bash
# Start bridge manager and router first
docker-compose up -d bridge-manager bridge-router

# Wait a bit
sleep 5

# Start all MT5 accounts
docker-compose up -d

# Or start specific account
docker-compose up -d mt5-account-123456
```

---

## Step 8: Verify Setup

### 8.1 Check Running Containers

```bash
# List all containers
docker ps

# Check specific container
docker ps | grep mt5-account-123456

# View logs
docker logs mt5-account-123456
docker logs bridge-manager
```

### 8.2 Check Resource Usage

```bash
# Monitor resource usage
docker stats

# Check specific container
docker stats mt5-account-123456 --no-stream
```

### 8.3 Test Bridge

```bash
# Check bridge manager
curl http://localhost:8079/status

# Check bridge router
curl http://localhost:8080/health

# Check specific account bridge
curl http://localhost:8081/health
```

---

## Step 9: Management Commands

### Start/Stop

```bash
# Start all
docker-compose up -d

# Stop all
docker-compose down

# Start specific account
docker-compose up -d mt5-account-123456

# Stop specific account
docker-compose stop mt5-account-123456

# Restart specific account
docker-compose restart mt5-account-123456
```

### View Logs

```bash
# All logs
docker-compose logs -f

# Specific account
docker-compose logs -f mt5-account-123456

# Last 100 lines
docker-compose logs --tail=100 mt5-account-123456
```

### Execute Commands

```bash
# Execute command in container
docker exec -it mt5-account-123456 bash

# Check Wine
docker exec mt5-account-123456 wine --version

# Check MT5
docker exec mt5-account-123456 ls -la /root/.wine
```

### Clean Up

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (⚠️ deletes MT5 data)
docker-compose down -v

# Remove specific account
docker-compose stop mt5-account-123456
docker-compose rm mt5-account-123456
```

---

## Step 10: Monitoring Script

Create `docker/monitor.sh`:

```bash
#!/bin/bash
# Monitor all Docker containers

echo "🐳 Docker Container Status"
echo "=========================="
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running!"
  exit 1
fi

# Count containers
TOTAL=$(docker ps -a | grep mt5-account | wc -l | tr -d ' ')
RUNNING=$(docker ps | grep mt5-account | wc -l | tr -d ' ')
STOPPED=$((TOTAL - RUNNING))

echo "📊 Overall Status:"
echo "   Total Accounts: $TOTAL"
echo "   Running: $RUNNING"
echo "   Stopped: $STOPPED"
echo ""

# Check bridge services
echo "🌉 Bridge Services:"
if docker ps | grep -q bridge-manager; then
  echo "   ✅ Bridge Manager: Running"
else
  echo "   ❌ Bridge Manager: Stopped"
fi

if docker ps | grep -q bridge-router; then
  echo "   ✅ Bridge Router: Running"
else
  echo "   ❌ Bridge Router: Stopped"
fi
echo ""

# Resource usage
echo "💻 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -10
```

---

## Troubleshooting

### Problem: Docker won't start

**Solution:**
```bash
# Check Docker Desktop is running
open -a Docker

# Check Docker daemon
docker info
```

### Problem: Out of memory

**Solution:**
- Increase Docker Desktop memory limit
- Reduce number of accounts
- Lower memory limit per container:
  ```yaml
  mem_limit: 256m  # Instead of 512m
  ```

### Problem: Container keeps restarting

**Solution:**
```bash
# Check logs
docker logs mt5-account-123456

# Check exit code
docker inspect mt5-account-123456 | grep -A 10 State
```

### Problem: Port conflicts

**Solution:**
```bash
# Check what's using the port
lsof -i :8081

# Change port in docker-compose.yml
ports:
  - "9081:8081"  # Use different host port
```

### Problem: MT5 not starting in container

**Solution:**
```bash
# Check Wine is working
docker exec mt5-account-123456 wine --version

# Check display
docker exec mt5-account-123456 echo $DISPLAY

# Check logs
docker logs mt5-account-123456
```

---

## Next Steps

1. ✅ Install Docker Desktop
2. ✅ Create Docker files
3. ✅ Generate docker-compose.yml
4. ✅ Build images
5. ✅ Start services
6. ✅ Verify setup
7. ✅ Configure MT5 in containers
8. ✅ Attach EA to each MT5 instance

---

## Quick Reference

```bash
# Start all
docker-compose up -d

# Stop all
docker-compose down

# View logs
docker-compose logs -f

# Monitor resources
docker stats

# Restart account
docker-compose restart mt5-account-123456

# Check status
docker ps
```

---

**Last Updated**: December 2025
**Status**: ✅ Complete Docker setup guide

