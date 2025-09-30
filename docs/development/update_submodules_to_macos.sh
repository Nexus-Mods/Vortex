#!/bin/bash

echo "🚀 UPDATING SUBMODULES TO MACOS BRANCHES"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
total_updated=0
already_on_macos=0
failed_updates=0

# Get list of all submodules
submodules=$(git submodule status | awk '{print $2}')

for submodule in $submodules; do
    if [ -d "$submodule" ]; then
        echo -e "${BLUE}📁 Processing: $submodule${NC}"
        
        cd "$submodule"
        
        # Get current branch
        current_branch=$(git branch --show-current 2>/dev/null || echo "detached")
        
        # Check if already on a macOS branch
        if [[ "$current_branch" == *"macos"* ]] || [[ "$current_branch" == *"experimental"* ]]; then
            echo -e "   ${GREEN}✅ Already on macOS branch: $current_branch${NC}"
            already_on_macos=$((already_on_macos + 1))
        else
            # Look for available macOS branches (prefer upstream, then erik, then origin)
            macos_branch=""
            
            # Check for upstream/macos-experimental first
            if git branch -r | grep -q "upstream/macos-experimental"; then
                macos_branch="upstream/macos-experimental"
            # Check for upstream/macos-tahoe-theme (for theme-switcher)
            elif git branch -r | grep -q "upstream/macos-tahoe-theme"; then
                macos_branch="upstream/macos-tahoe-theme"
            # Check for erik branches
            elif git branch -r | grep -q "erik/macos-experimental"; then
                macos_branch="erik/macos-experimental"
            elif git branch -r | grep -q "erik/macos-tahoe-theme"; then
                macos_branch="erik/macos-tahoe-theme"
            # Check for origin branches
            elif git branch -r | grep -q "origin/macos-experimental"; then
                macos_branch="origin/macos-experimental"
            fi
            
            if [ ! -z "$macos_branch" ]; then
                echo "   Switching to: $macos_branch"
                
                # Fetch latest changes
                git fetch --all > /dev/null 2>&1
                
                # Create local branch name (remove remote prefix)
                local_branch_name=$(echo "$macos_branch" | sed 's|.*/||')
                
                # Switch to the branch
                if git checkout -B "$local_branch_name" "$macos_branch" > /dev/null 2>&1; then
                    echo -e "   ${GREEN}✅ Successfully switched to $local_branch_name${NC}"
                    total_updated=$((total_updated + 1))
                else
                    echo -e "   ${RED}❌ Failed to switch to $macos_branch${NC}"
                    failed_updates=$((failed_updates + 1))
                fi
            else
                echo -e "   ${YELLOW}⚠️  No macOS branch found${NC}"
            fi
        fi
        
        cd - > /dev/null
        echo ""
    else
        echo -e "${RED}❌ Submodule directory not found: $submodule${NC}"
        echo ""
    fi
done

echo "========================================"
echo -e "${BLUE}📊 UPDATE SUMMARY:${NC}"
echo "   Successfully updated: $total_updated"
echo "   Already on macOS branch: $already_on_macos"
echo "   Failed updates: $failed_updates"
echo ""

if [ $total_updated -gt 0 ]; then
    echo -e "${GREEN}🎉 Updated $total_updated submodules to macOS branches!${NC}"
    echo -e "${YELLOW}💡 You may want to commit these submodule updates to the main repository${NC}"
fi