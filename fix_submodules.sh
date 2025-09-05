#!/bin/bash

# Script to fix submodule issues for macOS development
# This script will:
# 1. Checkout the macos-experimental branch for all submodules that have it
# 2. Clean up .DS_Store files
# 3. Commit any actual changes to the macos-experimental branch
# 4. Push changes where possible

echo "Fixing submodule issues for macOS development..."

# Navigate to the root of the repository
cd "$(dirname "$0")"

# Clean up .DS_Store files from all submodules
echo "Cleaning up .DS_Store files..."
find . -name ".DS_Store" -delete

# For each submodule, check if it's in detached HEAD state and has actual changes
echo "Checking submodules..."

# List of submodules with actual changes (based on previous analysis)
SUBMODULES_WITH_CHANGES=(
  "extensions/changelog-dashlet"
  "extensions/issue-tracker"
  "extensions/collections"
)

# For submodules with changes, switch to macos-experimental branch if it exists
for submodule in "${SUBMODULES_WITH_CHANGES[@]}"; do
  if [ -d "$submodule" ]; then
    echo "Processing $submodule..."
    cd "$submodule"
    
    # Check current branch
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    
    if [ "$current_branch" = "HEAD" ]; then
      echo "  Submodule is in detached HEAD state"
      
      # Check if macos-experimental branch exists
      if git show-ref --verify --quiet refs/heads/macos-experimental; then
        echo "  Checking out macos-experimental branch"
        git checkout macos-experimental
      elif git show-ref --verify --quiet refs/remotes/origin/macos-experimental; then
        echo "  Creating local macos-experimental branch from origin/macos-experimental"
        git checkout -b macos-experimental origin/macos-experimental
      else
        echo "  No macos-experimental branch found, staying on current commit"
      fi
    else
      echo "  Already on branch: $current_branch"
    fi
    
    # Check for actual changes (excluding .DS_Store and yarn-error.log)
    changes=$(git status --porcelain | grep -v "\.DS_Store" | grep -v "yarn-error\.log" | wc -l)
    
    if [ $changes -gt 0 ]; then
      echo "  Found actual changes, staging and committing..."
      # Add all changes except .DS_Store and yarn-error.log
      git status --porcelain | grep -v "\.DS_Store" | grep -v "yarn-error\.log" | awk '{print $2}' | xargs git add
      
      # Commit changes
      git commit -m "macOS compatibility updates"
    else
      echo "  No actual changes to commit"
    fi
    
    cd ../..
  fi
done

echo "Submodule fix process completed."
echo "Please manually verify and push changes as needed."