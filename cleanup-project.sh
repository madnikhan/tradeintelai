#!/bin/bash

# Project Cleanup Script
# This script removes unnecessary files from the project

set -e

echo "🧹 Starting project cleanup..."

# Files to KEEP (essential documentation)
KEEP_FILES=(
    "README.md"
    "PROJECT_STRUCTURE_AND_ARCHITECTURE.md"
    "SETUP_50_ACCOUNTS_GUIDE.md"
    "DOCKER_SETUP_GUIDE.md"
    "DOCKER_VS_WINE_COMPARISON.md"
    "QA_DEBUG_SHEET.md"
    "QA_DEBUG_REPORT.md"
    "GATED_ENGINE_DECISION_FLOW.md"
)

# Patterns to DELETE (old/duplicate documentation)
DELETE_PATTERNS=(
    "*_AUDIT*.md"
    "*_FIX*.md"
    "*_FIXES*.md"
    "*_APPLIED*.md"
    "*_SUMMARY*.md"
    "*_REPORT*.md"
    "*_ANALYSIS*.md"
    "*_ACCURACY*.md"
    "*_COMPLETE*.md"
    "*_GUIDE.md"
    "*_SETUP*.md"
    "*_STATUS*.md"
    "*_TROUBLESHOOTING*.md"
    "*_IMPLEMENTATION*.md"
    "*_INTEGRATION*.md"
    "*_VERIFICATION*.md"
    "*_TEST*.md"
    "*_DEBUG*.md"
    "*_INSTRUCTIONS*.md"
    "*_SOLUTION*.md"
    "*_PLAN*.md"
    "*_OVERVIEW*.md"
    "*_ARCHITECTURE*.md"
    "*_WORKFLOW*.md"
    "*_SYSTEM*.md"
    "*_COMPREHENSIVE*.md"
    "*_FINAL*.md"
    "*_CURRENT*.md"
    "*_COMPLETE*.md"
    "*_QUICK*.md"
    "*_FRESH*.md"
    "*_DEPLOYMENT*.md"
    "*_SECURITY*.md"
    "*_CRITICAL*.md"
    "*_ROOT*.md"
    "*_WHEN*.md"
    "*_WHY*.md"
    "*_HOW*.md"
    "*_WHAT*.md"
    "*_WHERE*.md"
    "*_FIND*.md"
    "*_CHECK*.md"
    "*_DIAGNOSE*.md"
    "*_START*.md"
    "*_STOP*.md"
    "*_KILL*.md"
    "*_GET*.md"
    "*_SETUP*.md"
    "*_CONFIGURATION*.md"
    "*_RULES*.md"
    "*_ASSESSMENT*.md"
    "*_RESULTS*.md"
    "*_SUITE*.md"
    "*_GUIDE*.md"
    "*_MANUAL*.md"
    "*_AUTO*.md"
    "*_SYMLINK*.md"
    "*_BRIDGE*.md"
    "*_MT5*.md"
    "*_EA*.md"
    "*_FIREBASE*.md"
    "*_FIRESTORE*.md"
    "*_NGROK*.md"
    "*_CLOUDFLARE*.md"
    "*_VERCEL*.md"
    "*_OPENAI*.md"
    "*_GPT*.md"
    "*_DEEPSEEK*.md"
    "*_PWA*.md"
    "*_GOOGLE*.md"
    "*_CORS*.md"
    "*_BALANCE*.md"
    "*_TRADING*.md"
    "*_POSITION*.md"
    "*_ATR*.md"
    "*_COT*.md"
    "*_SENTIMENT*.md"
    "*_FUNDAMENTAL*.md"
    "*_TECHNICAL*.md"
    "*_REGIME*.md"
    "*_SCORING*.md"
    "*_VALIDATION*.md"
    "*_IMPROVEMENTS*.md"
    "*_FEATURE*.md"
    "*_PAIR*.md"
    "*_CURRENCY*.md"
    "*_DATA*.md"
    "*_MISSING*.md"
    "*_PARSER*.md"
    "*_CALENDAR*.md"
    "*_ECONOMIC*.md"
    "*_NEWS*.md"
    "*_RSS*.md"
    "*_PROVIDERS*.md"
    "*_SOLUTIONS*.md"
    "*_CAPACITY*.md"
    "*_ISSUES*.md"
    "*_QUICK*.md"
    "*_API*.md"
    "*_KEY*.md"
    "*_MODEL*.md"
    "*_VISION*.md"
    "*_HYBRID*.md"
    "*_MIGRATION*.md"
    "*_COST*.md"
    "*_ROLE*.md"
    "*_ACCURACY*.md"
    "*_EXPLANATION*.md"
    "*_CONSISTENCY*.md"
    "*_INTEGRITY*.md"
    "*_BINDING*.md"
    "*_STRICT*.md"
    "*_HARD*.md"
    "*_LOCK*.md"
    "*_ENFORCEMENT*.md"
    "*_REFACTOR*.md"
    "*_STRUCTURE*.md"
    "*_BASED*.md"
    "*_DECOUPLING*.md"
    "*_EXECUTION*.md"
    "*_ANALYSIS*.md"
    "*_BIAS*.md"
    "*_CONTRADICTION*.md"
    "*_UNIVERSAL*.md"
    "*_APPLICATION*.md"
    "*_VERIFICATION*.md"
    "*_CHECKLIST*.md"
    "*_EURUSD*.md"
    "*_USDJPY*.md"
    "*_GBPUSD*.md"
    "*_EURJPY*.md"
    "*_AUDJPY*.md"
    "*_AUDUSD*.md"
    "*_GBPJPY*.md"
    "*_CHART*.md"
    "*_REALTIME*.md"
    "*_SOURCE*.md"
    "*_BROWSER*.md"
    "*_CACHE*.md"
    "*_MOBILE*.md"
    "*_DESIGN*.md"
    "*_FRIDAY*.md"
    "*_PRIME*.md"
    "*_TIME*.md"
    "*_SMALL*.md"
    "*_ACCOUNT*.md"
    "*_WINE*.md"
    "*_PATH*.md"
    "*_DISCOVERY*.md"
    "*_ACCESS*.md"
    "*_ALGO*.md"
    "*_AUTOTRADING*.md"
    "*_ENABLE*.md"
    "*_HISTORICAL*.md"
    "*_MULTI*.md"
    "*_SOURCE*.md"
    "*_IMPACT*.md"
    "*_READINESS*.md"
    "*_BLOCKED*.md"
    "*_LOGICAL*.md"
    "*_SYSTEM*.md"
    "*_WIDE*.md"
    "*_EXPLANATION*.md"
    "*_BUY*.md"
    "*_VS*.md"
    "*_BEARISH*.md"
    "*_RESISTANCE*.md"
    "*_EXECUTED*.md"
    "*_TRADE*.md"
    "*_VERIFICATION*.md"
)

# Function to check if file should be kept
should_keep() {
    local file="$1"
    for keep in "${KEEP_FILES[@]}"; do
        if [[ "$file" == "$keep" ]]; then
            return 0
        fi
    done
    
    # Keep GATE1_* and GATED_ENGINE_* files (except duplicates)
    if [[ "$file" =~ ^GATE1_.*\.md$ ]] || [[ "$file" =~ ^GATED_ENGINE_.*\.md$ ]]; then
        # But delete if it's a duplicate pattern
        if [[ "$file" =~ (AUDIT|FIX|APPLIED|SUMMARY|REPORT|ANALYSIS|ACCURACY|COMPLETE) ]]; then
            return 1
        fi
        return 0
    fi
    
    return 1
}

# Function to check if file should be deleted
should_delete() {
    local file="$1"
    
    # Never delete keep files
    if should_keep "$file"; then
        return 1
    fi
    
    # Check against delete patterns
    for pattern in "${DELETE_PATTERNS[@]}"; do
        if [[ "$file" == $pattern ]]; then
            return 0
        fi
    done
    
    return 1
}

# Count files before
BEFORE=$(find . -maxdepth 1 -name "*.md" -type f | wc -l | tr -d ' ')
echo "📊 Found $BEFORE markdown files in root directory"

# Delete markdown files matching patterns
DELETED=0
for file in *.md; do
    if [ -f "$file" ] && should_delete "$file"; then
        echo "🗑️  Deleting: $file"
        rm -f "$file"
        ((DELETED++))
    elif [ -f "$file" ] && should_keep "$file"; then
        echo "✅ Keeping: $file"
    fi
done

echo ""
echo "📊 Deleted $DELETED markdown files"

# Delete archive folder
if [ -d "mt5-bridge/archive" ]; then
    echo "🗑️  Deleting archive folder..."
    rm -rf mt5-bridge/archive
    echo "✅ Archive folder deleted"
fi

# Delete log files
echo "🗑️  Deleting log files..."
find . -name "*.log" -type f -delete
echo "✅ Log files deleted"

# Delete build artifacts
echo "🗑️  Deleting build artifacts..."
rm -f tsconfig.tsbuildinfo
rm -rf .next
echo "✅ Build artifacts deleted"

# Count files after
AFTER=$(find . -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "📊 Remaining markdown files: $AFTER"
echo "✨ Cleanup complete!"

