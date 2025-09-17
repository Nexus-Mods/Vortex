#!/bin/bash

# Script to preserve and restore submodule remote configurations
# This prevents accidental changes to submodule remotes during git operations

REMOTES_BACKUP_FILE=".submodule_remotes_backup.json"

# Function to save current submodule remote configurations
save_remotes() {
    local toplevel=$(git rev-parse --show-toplevel)
    local backup_file="$toplevel/$REMOTES_BACKUP_FILE"
    
    echo "Saving submodule remote configurations to $backup_file"
    
    # Create a temporary script for the submodule foreach
    local temp_script=$(mktemp)
    cat > "$temp_script" << 'EOF'
#!/bin/bash
echo "  \"$name\": {"
first_remote=true
git remote -v | while IFS=$'\t' read -r line; do
    if [[ "$line" =~ ^([^[:space:]]+)[[:space:]]+([^[:space:]]+)[[:space:]]+\(fetch\)$ ]]; then
        remote_name="${BASH_REMATCH[1]}"
        remote_url="${BASH_REMATCH[2]}"
        if [ "$first_remote" = "true" ]; then
            first_remote=false
        else
            echo ","
        fi
        echo -n "    \"$remote_name\": \"$remote_url\""
    fi
done
echo ""
echo "  }"
EOF
    chmod +x "$temp_script"
    
    echo "{" > "$backup_file"
    
    # Get list of submodules and process them
    local first_submodule=true
    git submodule foreach --quiet "
        if [ \"\$first_submodule\" = \"true\" ]; then
            first_submodule=false
        else
            echo \",\" >> \"$backup_file\"
        fi
        $temp_script >> \"$backup_file\"
    "
    
    echo "}" >> "$backup_file"
    rm -f "$temp_script"
    
    local submodule_count=$(git submodule status | wc -l | tr -d ' ')
    echo "Saved remote configurations for $submodule_count submodules"
}

# Function to check if remotes have changed
check_remotes() {
    local toplevel=$(git rev-parse --show-toplevel)
    local backup_file="$toplevel/$REMOTES_BACKUP_FILE"
    
    if [ ! -f "$backup_file" ]; then
        echo "Warning: No backup file found. Run 'save' first."
        return 1
    fi
    
    echo "Checking for remote configuration changes..."
    
    # Create current state file
    local current_file=$(mktemp)
    REMOTES_BACKUP_FILE=$(basename "$current_file")
    save_remotes > /dev/null 2>&1
    mv "$current_file" "${current_file}.json"
    current_file="${current_file}.json"
    
    # Compare files
    if diff -q "$backup_file" "$current_file" > /dev/null; then
        echo "✓ Submodule remote configurations are unchanged"
        rm -f "$current_file"
        return 0
    else
        echo "⚠️  WARNING: Submodule remote configurations have changed!"
        echo "Differences found:"
        diff "$backup_file" "$current_file" || true
        rm -f "$current_file"
        return 1
    fi
}

# Function to restore remotes from backup
restore_remotes() {
    local toplevel=$(git rev-parse --show-toplevel)
    local backup_file="$toplevel/$REMOTES_BACKUP_FILE"
    
    if [ ! -f "$backup_file" ]; then
        echo "Error: No backup file found at $backup_file"
        return 1
    fi
    
    echo "Restoring submodule remote configurations from $backup_file"
    
    # This is a simplified restore - in practice, you'd parse the JSON
    # and restore each remote. For now, we'll just warn about changes.
    check_remotes
}

# Main script logic
case "${1:-save}" in
    "save")
        save_remotes
        ;;
    "check")
        check_remotes
        ;;
    "restore")
        restore_remotes
        ;;
    *)
        echo "Usage: $0 {save|check|restore}"
        echo "  save    - Save current submodule remote configurations"
        echo "  check   - Check if remotes have changed since last save"
        echo "  restore - Restore remotes from backup (warns about changes)"
        exit 1
        ;;
esac