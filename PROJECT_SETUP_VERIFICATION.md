# Project Setup Verification for macOS Development

This document provides instructions for verifying and maintaining the correct setup of the Vortex project for macOS development.

## Overview

The project setup verification system ensures that:

1. All Git submodules are on the correct branches for macOS development
2. No submodules are in a detached HEAD state
3. All SCSS files compile without errors
4. The project is properly configured for macOS development

## Scripts

The verification system includes the following scripts:

1. `scripts/project-setup-verification.js` - Main verification script
2. `scripts/update-gitmodules-macos.sh` - Updates .gitmodules for macOS branches
3. `scripts/macos-branch-mapping.json` - Configuration file for branch mapping

## Usage

### Running the Complete Verification

To run the complete project setup verification:

```bash
yarn verify-setup
```

This command will:
1. Verify all submodules are on the correct branches
2. Check for detached HEAD states
3. Verify SCSS compilation for all extensions and core stylesheets
4. Provide a summary of the verification results

### Updating .gitmodules for macOS Development

To update the .gitmodules file to use macOS-specific branches:

```bash
yarn update-gitmodules-macos
```

This command will:
1. Backup the current .gitmodules file
2. Update submodule branches according to the mapping configuration
3. Sync and update all submodules

### Manual Submodule Verification

To run only the submodule verification:

```bash
yarn check-submodules
```

## Branch Mapping Configuration

The branch mapping is configured in `scripts/macos-branch-mapping.json`:

```json
{
  "submoduleBranchMapping": {
    "extensions/changelog-dashlet": "macos-experimental",
    "extensions/issue-tracker": "macos-experimental",
    "extensions/collections": "macos-experimental",
    "extensions/theme-switcher": "macos-tahoe-theme"
  },
  "defaultBranch": "master"
}
```

## Expected Branches

For macOS development, the following branch mapping is used:

| Submodule | Branch |
|-----------|--------|
| extensions/changelog-dashlet | macos-experimental |
| extensions/issue-tracker | macos-experimental |
| extensions/collections | macos-experimental |
| extensions/theme-switcher | macos-tahoe-theme |
| All other submodules | master (or as specified in .gitmodules) |

## Verification Output

The verification script provides detailed output:

### Submodule Verification Section
- Lists all submodules found
- Shows current branch for each submodule
- Identifies detached HEAD states
- Reports uncommitted changes
- Indicates whether submodules are on expected branches

### SCSS Compilation Section
- Tests all extension SCSS files
- Tests core SCSS files
- Reports compilation success/failure for each file
- Shows detailed error messages for failed compilations

### Final Results
- Overall pass/fail status
- Summary of submodule verification
- Summary of SCSS compilation verification

## Troubleshooting

### Detached HEAD States

If submodules are in detached HEAD state, the verification script will attempt to fix them by:
1. Fetching the latest changes
2. Checking if the expected branch exists locally
3. Creating the branch locally from remote if needed
4. Switching to the correct branch

### SCSS Compilation Errors

If SCSS files fail to compile:
1. Check the error message for the specific file
2. Verify include paths are correct
3. Check for syntax errors in the SCSS file
4. Ensure all dependencies are installed

### Missing Submodules

If submodules are missing:
1. Run `git submodule update --init --recursive`
2. Check the .gitmodules file for correct URLs
3. Verify network connectivity to submodule repositories

## Testing

Unit tests and integration tests are provided:

```bash
# Run unit tests
yarn test __tests__/project-setup-verification.test.js

# Run integration tests
yarn test __tests__/project-setup-integration.test.js
```

## Maintenance

To maintain the verification system:

1. Update the branch mapping configuration as needed
2. Add new SCSS files to the verification list
3. Update tests when modifying the verification logic
4. Review and update documentation periodically

## Common Issues

### Permission Errors

If you encounter permission errors:
1. Ensure you have write access to the repository
2. Check that Git is properly configured
3. Verify SSH keys are set up correctly for GitHub access

### Network Issues

If submodule updates fail due to network issues:
1. Check internet connectivity
2. Verify access to GitHub
3. Try running the command again after a short delay

### Branch Not Found

If the expected branch doesn't exist:
1. Verify the branch name in the configuration
2. Check if the branch exists in the remote repository
3. Contact the repository maintainers if needed