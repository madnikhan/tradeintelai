#!/bin/bash

# Test Calendar Parsers Script
# Tests all calendar parsers and displays results

echo "🧪 Testing Calendar Parsers..."
echo "================================"
echo ""

# Test 1: Raw HTML/XML fetch
echo "1️⃣ Testing raw source fetches..."
curl -s "http://localhost:3000/api/test/calendar-raw?source=all" | jq '.'
echo ""
echo "---"
echo ""

# Test 2: Parser execution
echo "2️⃣ Testing parser execution..."
curl -s "http://localhost:3000/api/test/calendar-parsers" | jq '.'
echo ""
echo "---"
echo ""

# Test 3: Parser statistics
echo "3️⃣ Getting parser statistics..."
curl -s "http://localhost:3000/api/monitor/parser-stats" | jq '.'
echo ""
echo "================================"
echo "✅ Tests complete!"

