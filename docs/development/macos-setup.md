# macOS Development Guide for Vortex

## Submodule Management (macOS)

This repository provides Yarn scripts to help manage submodules for macOS development. These ensure submodules stay on the correct branches and that macOS-specific files (like `.DS_Store`) don't cause issues.

### Setup

The following setup is available via scripts:

1. Use `yarn update-gitmodules-macos` to update `.gitmodules` for macOS-specific branches/remotes
2. Keep submodules aligned by running `yarn sweep:all:dry` (dry-run) or `yarn sweep:all`
3. Push macOS branches with `yarn push:macos`

### How It Works

- When you switch branches, pull changes, or rebase, ensure submodules are clean and aligned by running the provided Yarn scripts.
- The submodule utilities will:
  - Clean up `.DS_Store` and `yarn-error.log` files
  - Check out the correct branch for each submodule as configured
  - Commit any actual changes to the macOS-specific branches
  - Try to push changes to the remote repositories (if you have permission)
  - Update and commit submodule references in the main project

### Manual Operations

If you need to manually update submodules, you can use the following commands:

```bash
# Update submodules to the branches specified in .gitmodules
git submodule update --remote

# Update all submodules to use the branches specified in .gitmodules
git submodule update --remote

# Update the .gitmodules file if new submodules need macOS-specific branches
yarn update-gitmodules-macos
```

### Adding New Submodules with macOS-Specific Branches

If you add a new submodule that needs a macOS-specific branch:

1. Update the submodule path and branch name in `.gitmodules`
2. Run `yarn update-gitmodules-macos` to apply the changes
3. Run `git submodule update --remote` to sync locally

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