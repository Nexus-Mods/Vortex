#!/bin/bash

echo "🔍 SUBMODULE BRANCH SWEEP - Checking all submodules for macOS branches"
echo "=================================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
total_submodules=0
on_macos_branch=0
needs_update=0
no_macos_branch=0

# Get list of all submodules
submodules=$(git submodule status | awk '{print $2}')

for submodule in $submodules; do
    if [ -d "$submodule" ]; then
        total_submodules=$((total_submodules + 1))
        echo -e "${BLUE}📁 Checking: $submodule${NC}"
        
        cd "$submodule"
        
        # Get current branch
        current_branch=$(git branch --show-current 2>/dev/null || echo "detached")
        
        # Check for available macOS branches
        macos_branches=$(git branch -r | grep -E "(macos|experimental)" | head -5)
        
        echo "   Current branch: $current_branch"
        
        if [ ! -z "$macos_branches" ]; then
            echo "   Available macOS/experimental branches:"
            echo "$macos_branches" | sed 's/^/     /'
            
            # Check if already on a macOS branch
            if [[ "$current_branch" == *"macos"* ]] || [[ "$current_branch" == *"experimental"* ]]; then
                echo -e "   ${GREEN}✅ Already on macOS branch${NC}"
                on_macos_branch=$((on_macos_branch + 1))
            else
                echo -e "   ${YELLOW}⚠️  Could be switched to macOS branch${NC}"
                needs_update=$((needs_update + 1))
            fi
        else
            echo -e "   ${RED}❌ No macOS/experimental branches found${NC}"
            no_macos_branch=$((no_macos_branch + 1))
        fi
        
        cd - > /dev/null
        echo ""
    else
        echo -e "${RED}❌ Submodule directory not found: $submodule${NC}"
        echo ""
    fi
done

echo "=================================================================="
echo -e "${BLUE}📊 SUMMARY:${NC}"
echo "   Total submodules checked: $total_submodules"
echo -e "   ${GREEN}✅ Already on macOS branch: $on_macos_branch${NC}"
echo -e "   ${YELLOW}⚠️  Could be updated to macOS branch: $needs_update${NC}"
echo -e "   ${RED}❌ No macOS branch available: $no_macos_branch${NC}"
echo ""

if [ $needs_update -gt 0 ]; then
    echo -e "${YELLOW}💡 Run with --update flag to switch submodules to macOS branches${NC}"
fi