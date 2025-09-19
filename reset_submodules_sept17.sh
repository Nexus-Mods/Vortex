#!/bin/bash

# Script to reset all submodules to their state as of September 17, 2025
# This will find the latest commit before or on September 17, 2025 for each submodule

echo "Resetting all submodules to September 17, 2025 state..."

# Get list of all submodules
submodules=$(git submodule foreach --quiet 'echo $sm_path')

for submodule in $submodules; do
    echo "Processing submodule: $submodule"
    
    # Enter the submodule directory
    cd "$submodule"
    
    # Find the latest commit as of September 17, 2025
    target_commit=$(git log --oneline --until="2025-09-17 23:59:59" | head -1 | cut -d' ' -f1)
    
    if [ -n "$target_commit" ]; then
        echo "  Found target commit: $target_commit"
        
        # Reset to that commit
        git reset --hard "$target_commit"
        
        if [ $? -eq 0 ]; then
            echo "  ✓ Successfully reset $submodule to $target_commit"
        else
            echo "  ✗ Failed to reset $submodule"
        fi
    else
        echo "  ⚠ No commits found before September 17, 2025 in $submodule"
    fi
    
    # Return to main directory
    cd - > /dev/null
    echo ""
done

echo "Submodule reset complete!"
echo "Don't forget to commit the updated submodule references in the main repository."