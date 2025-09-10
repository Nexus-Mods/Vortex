# Add Untracked Files Across Project and macOS Branches

## Overview

This document outlines the process for identifying, committing, and pushing all untracked files across the Vortex project and its macOS-specific branches. The process involves scanning the main repository and all submodules for untracked files, committing them with appropriate messages, and pushing changes to origin repositories where permissions allow.

## Architecture

The solution involves a multi-step process that works with the existing Git submodule structure of the Vortex project:

1. **Repository Analysis** - Scan main repository and all submodules for untracked files
2. **Branch Management** - Ensure submodules are on correct macOS-specific branches
3. **Change Committing** - Commit untracked files with descriptive messages
4. **Change Pushing** - Push commits to origin repositories where possible

## Process Flow

The process follows this workflow:

1. Start with main repository analysis
2. Check for untracked files in main repository
3. Commit untracked files with descriptive messages
4. Push changes to origin if permissions allow
5. Process each submodule:
   - Check current branch status
   - Switch to appropriate macOS branch if needed
   - Identify untracked files
   - Commit with descriptive messages
   - Push changes to origin if permitted
6. Complete process after all repositories are processed

## Implementation Details

### Branch Management

Submodules should be on the correct branches based on the configuration:

- `extensions/changelog-dashlet`: `macos-experimental`
- `extensions/issue-tracker`: `macos-experimental`
- `extensions/collections`: `macos-experimental`
- `extensions/theme-switcher`: `macos-tahoe-theme`

Other submodules will remain on their default branches unless specific macOS branches are required.

### Git Commands

The process will use the following Git commands:

1. `git status --porcelain` - Identify untracked files
2. `git add .` - Stage all untracked files
3. `git commit -m "message"` - Commit staged files with descriptive message
4. `git push origin branch-name` - Push commits to origin repository
5. `git checkout branch-name` - Switch to correct branch
6. `git fetch origin` - Update remote references

## Commit Message Standards

Commit messages should follow these standards:

1. **Descriptive but Concise** - Clearly describe what changes are being committed
2. **Consistent Format** - Use consistent format across all commits
3. **Reference Context** - Include references to macOS development where relevant

Example commit messages:
- "Add macOS compatibility updates for theme switching"
- "Fix file path handling for macOS platform"
- "Update build configuration for macOS development"

## Error Handling

The process should handle common error scenarios:

1. **Permission Denied** - Log when push permissions are not available
2. **Network Issues** - Handle network connectivity problems during push operations
3. **Merge Conflicts** - Address any merge conflicts that arise during branch switching
4. **File Locks** - Handle file locking issues on Windows platforms

## Testing

The implementation should be tested with the following scenarios:

1. **Clean Repository** - Verify behavior when no untracked files exist
2. **Multiple Untracked Files** - Test with various types of untracked files
3. **Submodule Branch Switching** - Verify correct branch switching behavior
4. **Permission Scenarios** - Test behavior with and without push permissions

## Security Considerations

1. **File Filtering** - Ensure sensitive files are not accidentally committed
2. **Gitignore Compliance** - Respect existing `.gitignore` configurations
3. **Credential Handling** - Use secure credential management for Git operations

## Dependencies

This process depends on the following existing tools and configurations:

1. **Git** - Version control system for repository operations
2. **fix_submodules.sh** - Existing script for submodule management
3. **update_gitmodules_for_macos.sh** - Script for updating macOS branch configurations
4. **submodule-branch-check.js** - Script for checking and fixing submodule branches
