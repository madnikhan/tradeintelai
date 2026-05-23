# 🐳 Docker Setup for MT5 Accounts

Quick start guide for Docker setup.

## Prerequisites

1. **Install Docker Desktop**
   ```bash
   # macOS
   brew install --cask docker
   
   # Or download from https://www.docker.com/products/docker-desktop
   ```

2. **Start Docker Desktop**
   - Open Docker Desktop
   - Wait for it to start (whale icon in menu bar)

3. **Verify Installation**
   ```bash
   docker --version
   docker-compose --version
   ```

## Quick Start

### 1. Generate docker-compose.yml

```bash
cd mt5-bridge/docker
./generate-compose.sh
```

This reads `../accounts.txt` and generates `docker-compose.yml` for all accounts.

### 2. Create .env file

```bash
cp .env.example .env
# Edit .env and add your account credentials
```

### 3. Build Images

```bash
# Build MT5 image
docker build -f Dockerfile.mt5 -t mt5-wine:latest ..

# Build bridge image
docker build -f Dockerfile.bridge -t mt5-bridge:latest ..
```

### 4. Start Services

```bash
# Start bridge manager and router
docker-compose up -d bridge-manager bridge-router

# Start all MT5 accounts
docker-compose up -d
```

### 5. Monitor

```bash
# Check status
./monitor.sh

# View logs
docker-compose logs -f

# Check resources
docker stats
```

## Management

### Start/Stop

```bash
# Start all
docker-compose up -d

# Stop all
docker-compose down

# Start specific account
docker-compose up -d mt5-account-123456

# Restart account
docker-compose restart mt5-account-123456
```

### View Logs

```bash
# All logs
docker-compose logs -f

# Specific account
docker-compose logs -f mt5-account-123456
```

### Execute Commands

```bash
# Enter container
docker exec -it mt5-account-123456 bash

# Check Wine
docker exec mt5-account-123456 wine --version
```

## Troubleshooting

### Docker not running
```bash
open -a Docker
```

### Out of memory
- Increase Docker Desktop memory limit (Settings → Resources)
- Reduce number of accounts
- Lower memory limit per container

### Container keeps restarting
```bash
docker logs mt5-account-123456
```

## Files

- `Dockerfile.mt5` - MT5 container image
- `Dockerfile.bridge` - Bridge container image
- `docker-compose.yml` - Generated compose file
- `.env` - Account credentials (create from .env.example)
- `generate-compose.sh` - Generate compose file
- `monitor.sh` - Monitor containers

## Next Steps

1. Configure MT5 in each container
2. Attach EA to each MT5 instance
3. Test trade execution
4. Set up monitoring

See `DOCKER_SETUP_GUIDE.md` for detailed instructions.

