#!/bin/bash
# Monitor all Docker containers

echo "🐳 Docker Container Status"
echo "=========================="
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running!"
  echo "   Start Docker Desktop first"
  exit 1
fi

# Count containers
TOTAL=$(docker ps -a --filter "name=mt5-account" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')
RUNNING=$(docker ps --filter "name=mt5-account" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')
STOPPED=$((TOTAL - RUNNING))

echo "📊 Overall Status:"
echo "   Total Accounts: $TOTAL"
echo "   Running: $RUNNING"
echo "   Stopped: $STOPPED"
echo ""

# Check bridge services
echo "🌉 Bridge Services:"
if docker ps --format "{{.Names}}" | grep -q bridge-manager; then
  echo "   ✅ Bridge Manager: Running"
else
  echo "   ❌ Bridge Manager: Stopped"
fi

if docker ps --format "{{.Names}}" | grep -q bridge-router; then
  echo "   ✅ Bridge Router: Running"
else
  echo "   ❌ Bridge Router: Stopped"
fi
echo ""

# Resource usage (top 10)
echo "💻 Resource Usage (Top 10):"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -11 || echo "   No containers running"

echo ""
echo "💡 Commands:"
echo "   View logs: docker-compose logs -f"
echo "   Restart: docker-compose restart"
echo "   Stop all: docker-compose down"

