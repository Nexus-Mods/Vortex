#!/bin/bash

# Script to update .gitmodules to use macOS-specific branches for relevant submodules

echo "Updating .gitmodules for macOS development..."

# Navigate to the root of the repository
cd "$(dirname "$0")"

# List of submodules that should use macOS-specific branches
SUBMODULES_WITH_MACOS_BRANCH=(
  "extensions/changelog-dashlet:macos-experimental"
  "extensions/issue-tracker:macos-experimental"
  "extensions/collections:macos-experimental"
  "extensions/theme-switcher:macos-tahoe-theme"
)

# Update .gitmodules file
for submodule_info in "${SUBMODULES_WITH_MACOS_BRANCH[@]}"; do
  # Split the submodule_info into submodule path and branch name
  IFS=':' read -r submodule branch_name <<< "$submodule_info"
  
  echo "Setting branch=$branch_name for $submodule in .gitmodules"
  
  # Check if the submodule section exists in .gitmodules
  if grep -q "\[submodule \"$submodule\"\]" .gitmodules; then
    # Use sed to update the branch line for this submodule
    # First, find the line number of the submodule section
    section_line=$(grep -n "\[submodule \"$submodule\"\]" .gitmodules | cut -d: -f1)
    
    # Find the next section or end of file
    next_section_line=$(tail -n +$((section_line+1)) .gitmodules | grep -n "\[submodule" | head -1 | cut -d: -f1)
    if [ -z "$next_section_line" ]; then
      # If there's no next section, use the end of file
      next_section_line=$(wc -l < .gitmodules)
      next_section_line=$((next_section_line+1))
    else
      # Adjust for the tail command offset
      next_section_line=$((section_line + next_section_line))
    fi
    
    # Check if branch line already exists in this section
    branch_line=$(sed -n "${section_line},${next_section_line}p" .gitmodules | grep -n "\s*branch = " | head -1 | cut -d: -f1)
    
    if [ -n "$branch_line" ]; then
      # Branch line exists, update it
      branch_line=$((section_line + branch_line - 1))
      sed -i '' "${branch_line}s/branch = .*/branch = $branch_name/" .gitmodules
    else
      # Branch line doesn't exist, add it before the next section
      sed -i '' "${section_line}a\\	branch = $branch_name" .gitmodules
    fi
  else
    echo "Warning: Submodule $submodule not found in .gitmodules"
  fi
done

echo "Updating Git configuration to use the branches specified in .gitmodules"
git config --local submodule.recurse true
git config --local submodule.update checkout

echo ".gitmodules updated for macOS development."
echo "Run 'git fix-submodules' to update submodules to the specified branches."