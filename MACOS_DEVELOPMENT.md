# macOS Development Guide for Vortex

## Automated Submodule Management

This repository has been configured with automated tools to help manage submodules for macOS development. These tools ensure that submodules stay on the correct branches and that macOS-specific files (like `.DS_Store`) don't cause issues.

### Setup

The following setup has already been completed in this repository:

1. Git hooks have been installed to automatically run `fix_submodules.sh` after checkout, merge, and rewrite operations
2. The `.gitmodules` file has been updated to use macOS-specific branches for relevant submodules
3. Git has been configured to use the branches specified in `.gitmodules` when updating submodules
4. A Git alias `git fix-submodules` has been created to easily run the fix script manually

### How It Works

- When you switch branches, pull changes, or rebase, the Git hooks will automatically run `fix_submodules.sh`
- The `fix_submodules.sh` script will:
  - Clean up `.DS_Store` and `yarn-error.log` files
  - Check out the correct branch for each submodule (e.g., `macos-experimental` or `macos-tahoe-theme`)
  - Commit any actual changes to the macOS-specific branches
  - Try to push changes to the remote repositories (if you have permission)
  - Update and commit submodule references in the main project

### Manual Operations

If you need to manually update submodules, you can use the following commands:

```bash
# Run the fix_submodules.sh script using the Git alias
git fix-submodules

# Or run the script directly
./fix_submodules.sh

# Update all submodules to use the branches specified in .gitmodules
git submodule update --remote

# Update the .gitmodules file if new submodules need macOS-specific branches
./update_gitmodules_for_macos.sh
```

### Adding New Submodules with macOS-Specific Branches

If you add a new submodule that needs a macOS-specific branch:

1. Edit both `update_gitmodules_for_macos.sh` and `fix_submodules.sh` to add the submodule path and branch name
2. Run `./update_gitmodules_for_macos.sh` to update the `.gitmodules` file
3. Run `git fix-submodules` to update the submodule to use the specified branch

### Troubleshooting

If you encounter issues with submodules:

1. Run `git fix-submodules` manually to clean up any issues
2. Check the output of `git status` to see if any submodules still have modified content
3. If `.DS_Store` files are still causing issues, make sure your global `.gitignore` includes them:
   ```bash
   echo ".DS_Store" >> ~/.gitignore_global
   git config --global core.excludesfile ~/.gitignore_global
   ```

## Global Git Configuration for macOS

For the best experience developing on macOS, consider adding these settings to your global Git configuration:

```bash
# Ignore .DS_Store files globally
echo ".DS_Store" >> ~/.gitignore_global
echo "yarn-error.log" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global

# Configure Git to handle line endings properly
git config --global core.autocrlf input
```