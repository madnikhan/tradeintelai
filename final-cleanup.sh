#!/bin/bash

# Final cleanup - keep only essential documentation

KEEP=(
    "README.md"
    "PROJECT_STRUCTURE_AND_ARCHITECTURE.md"
    "SETUP_50_ACCOUNTS_GUIDE.md"
    "DOCKER_SETUP_GUIDE.md"
    "DOCKER_VS_WINE_COMPARISON.md"
    "QA_DEBUG_SHEET.md"
    "QA_DEBUG_REPORT.md"
    "GATED_ENGINE_DECISION_FLOW.md"
    "GATE1_STRUCTURE_BASED_REFACTOR.md"
    "GATE1_HARD_ENFORCEMENT_COMPLETE.md"
    "GATE1_STRICT_BINDING_ENFORCEMENT.md"
)

echo "🧹 Final cleanup - keeping only essential files..."

# Delete all markdown files except keep list
for file in *.md; do
    if [ -f "$file" ]; then
        KEEP_THIS=0
        for keep_file in "${KEEP[@]}"; do
            if [ "$file" == "$keep_file" ]; then
                KEEP_THIS=1
                echo "✅ Keeping: $file"
                break
            fi
        done
        
        if [ $KEEP_THIS -eq 0 ]; then
            echo "🗑️  Deleting: $file"
            rm -f "$file"
        fi
    fi
done

echo ""
echo "✨ Cleanup complete!"
echo "📊 Remaining files:"
ls -1 *.md 2>/dev/null | wc -l

