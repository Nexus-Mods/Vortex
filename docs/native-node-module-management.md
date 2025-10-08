## Overview

This document explains how to manage all C++ and C# projects in the Vortex solution, including native Node.js modules and .NET libraries that have their own Git repositories.

The Vortex project includes multiple types of projects maintained as separate repositories:

### **Core .NET Projects**
- **dotnetprobe** - Local C# utility for .NET detection (part of main Vortex repository)

### **FOMOD Installer (.NET Libraries)**  
- **fomod-installer** - Complete FOMOD installer framework with 8 C# projects
  - FomodInstaller.Interface, ModInstaller, ModInstallerIPC, Utils
  - Scripting, XmlScript, CSharpScript, AntlrUtil

### **Native C++ Addon Projects**
- **winapi-bindings** - Windows API bindings for Node.js
- **xxhash-addon** - xxHash algorithm implementation (third-party)

### **Gamebryo Extension C++ Projects**
- **bsatk** - BSA (Bethesda Softworks Archive) toolkit  
- **esptk** - ESP (Elder Scrolls Plugin) toolkit
- **loot** - LOOT (Load Order Optimization Tool) bindings
- **gamebryo-savegame** - Gamebryo savegame management library
- **bsdiff-node** - Binary diff/patch library for collections

## Quick Start

### 0. Convert npm Packages to Git Repositories (First Time Only)

When modules are installed via npm/yarn, they need to be converted to Git repositories:

```bash
# See what would be converted
yarn modules:convert-dry

# Convert all C++ projects to Git repositories
node scripts/convert-to-git.js convert cpp

# Or convert all Git repositories at once
yarn modules:convert
```

**⚠️ Important**: This process removes npm-installed packages and replaces them with Git clones. Backups are created automatically.

### 1. Project Overview

Get a complete overview of all projects:

```bash
# Show project summary and statistics
yarn modules:summary

# Check status of all projects
yarn modules:status

# Check only C++ projects
yarn modules:cpp

# Check only C# projects  
yarn modules:csharp
```

### 2. Repository Setup

Set up Git remotes for all repositories:

```bash
# Setup all Git repositories
yarn modules:setup

# Setup only Nexus-Mods repositories (skip third-party)
node scripts/manage-node-modules.js setup-remotes nexus
```

### 3. Targeted Workflows

Work with specific project types:

```bash
# Complete workflow for C++ projects only
node scripts/manage-node-modules.js workflow "Add missing header files to Visual Studio projects" cpp

# Commit changes to C# projects only
node scripts/manage-node-modules.js commit "Update .NET 9 dependencies" csharp

# Create branch for Nexus-Mods repositories only
node scripts/manage-node-modules.js create-branch "fix-build-issues" nexus
```

## Repository Conversion Process

### Why Conversion is Needed

When you install Vortex dependencies with `yarn install`, the native modules are installed as packaged npm distributions rather than Git repositories. To use the repository management system, these packages need to be converted to proper Git repositories.

### Conversion Process

The conversion process:
1. **Creates automatic backups** of existing npm packages
2. **Removes** the npm-installed versions
3. **Clones** the actual Git repositories
4. **Checks out** the correct branch (if specified)
5. **Reinstalls** dependencies with `npm install`  
6. **Rebuilds** native modules if needed
7. **Cleans up** backups on success

### Step-by-Step Conversion

#### 1. Preview Changes
```bash
# See what would be converted for C++ projects
node scripts/convert-to-git.js dry-run cpp

# See all projects that would be converted
yarn modules:convert-dry
```

#### 2. Convert Projects
```bash
# Convert C++ projects only (recommended first step)
node scripts/convert-to-git.js convert cpp

# Convert C# projects
node scripts/convert-to-git.js convert csharp

# Convert all Git repositories at once
yarn modules:convert

# Convert only Nexus-Mods repositories (exclude third-party)
node scripts/convert-to-git.js convert nexus
```

#### 3. Verify Conversion
```bash
# Check that projects are now Git repositories
yarn modules:status

# Should now show Git status instead of "Not a Git repository"
```

### Conversion Examples

#### Example 1: Convert All C++ Projects
```bash
# 1. Preview what will be converted
node scripts/convert-to-git.js dry-run cpp

# 2. Convert C++ projects
node scripts/convert-to-git.js convert cpp

# 3. Verify conversion worked
yarn modules:cpp

# 4. Now you can use Git operations
node scripts/manage-node-modules.js workflow "Add missing header files" cpp
```

#### Example 2: Convert Only Nexus-Mods Projects
```bash
# 1. Convert only Nexus-Mods repositories (exclude third-party)
node scripts/convert-to-git.js convert nexus

# 2. Setup Git remotes
node scripts/manage-node-modules.js setup-remotes nexus

# 3. Use normal Git workflow
node scripts/manage-node-modules.js workflow "Vortex integration updates" nexus
```

### What Gets Converted

| Project | From | To | Notes |
|---------|------|----|----- |
| winapi-bindings | npm package | Git clone | Nexus-Mods repository |
| xxhash-addon | npm package | Git clone | Third-party repository |
| bsatk | npm package | Git clone | Nexus-Mods repository |
| esptk | npm package | Git clone | Nexus-Mods repository |
| loot | npm package | Git clone | Nexus-Mods repository |
| gamebryo-savegame | npm package | Git clone | Nexus-Mods repository |
| bsdiff-node | npm package | Git clone | Nexus-Mods repository |
| fomod-installer | npm package | Git clone | Nexus-Mods repository |
| dotnetprobe | N/A | N/A | Already local project |

### Safety Features

- **Automatic backups**: Created before any changes
- **Graceful failure**: If conversion fails, original package remains
- **Selective conversion**: Convert only specific project types
- **Dry run mode**: Preview changes without making them
- **Dependency restoration**: Automatically reinstalls npm dependencies
- **Native module rebuilding**: Rebuilds C++ modules after cloning

### After Conversion

Once converted, you can use all repository management features:

```bash
# Full Git workflow now works
yarn modules:workflow "Your changes"

# Targeted operations work
node scripts/manage-node-modules.js commit "Fix header files" cpp

# All Git operations available
yarn modules:status     # Shows Git status
yarn modules:setup      # Sets up remotes
```

### Troubleshooting Conversion

#### If Conversion Fails
```bash
# Check what failed
yarn modules:status

# Manual cleanup if needed
rm -rf node_modules/package-name
yarn install  # Reinstalls npm version

# Try converting individual modules
node scripts/convert-to-git.js convert cpp
```

#### Build Issues After Conversion
```bash
# Rebuild native modules
cd node_modules/module-name
npm run rebuild

# Or rebuild all
yarn install
```

## Detailed Usage

### Project Filters

All commands support filtering by project type:

| Filter | Description | Projects Included |
|--------|-------------|------------------|
| `all` | All projects (default) | All 9 projects |
| `git` | Only Git repositories | All except dotnetprobe |
| `local` | Local projects only | dotnetprobe |
| `csharp` | C# projects | dotnetprobe, fomod-installer |
| `cpp` | C++ projects | All native addons |
| `nexus` | Nexus-Mods repos only | Excludes xxhash-addon |
| `third-party` | Third-party libraries | xxhash-addon |

### Available Commands

#### Project Overview
```bash
# Complete project summary with statistics
node scripts/manage-node-modules.js summary

# Status of all projects
node scripts/manage-node-modules.js status [filter]

# Status of specific project types
yarn modules:cpp      # C++ projects only
yarn modules:csharp   # C# projects only
```

#### Repository Conversion
```bash
# Convert npm packages to Git repositories  
node scripts/convert-to-git.js convert [filter]

# Dry run to see what would be converted
node scripts/convert-to-git.js dry-run [filter]

# Using yarn shortcuts
yarn modules:convert-dry    # See what would be converted
yarn modules:convert        # Convert all Git repositories
```

#### Repository Management
```bash
# Setup Git remotes
node scripts/manage-node-modules.js setup-remotes [filter]

# Create feature branch
node scripts/manage-node-modules.js create-branch "branch-name" [filter]

# Delete branch (safe delete - fails if unmerged)
node scripts/manage-node-modules.js delete-branch "branch-name" [filter]

# Force delete branch (deletes even if unmerged)
node scripts/manage-node-modules.js delete-branch "branch-name" [filter] --force

# Delete local and remote branch
node scripts/manage-node-modules.js delete-branch "branch-name" [filter] --force --remote

# Commit changes
node scripts/manage-node-modules.js commit "commit message" [filter]

# Push changes
node scripts/manage-node-modules.js push [branch-name] [filter]

# Generate PR links
node scripts/manage-node-modules.js pr-links "branch-name" [filter]
```

#### Complete Workflows
```bash
# Complete workflow (branch + commit + push + PR links)
node scripts/manage-node-modules.js workflow "commit message" [filter]

# Using yarn shortcuts
yarn modules:workflow "Your commit message"
```

## Example Workflows

### Scenario 1: Header Files Fix (C++ Projects Only)

```bash
# 1. Check current status of C++ projects
yarn modules:cpp

# 2. Complete workflow for C++ projects only
node scripts/manage-node-modules.js workflow "Add missing header files to Visual Studio projects" cpp

# 3. Result: Creates branches, commits, and pushes to all C++ project repositories
```

### Scenario 2: FOMOD Installer Updates (C# Only)

```bash
# 1. Create branch for C# projects
node scripts/manage-node-modules.js create-branch "update-dotnet9" csharp

# 2. Make your changes to FOMOD installer projects
# (Edit files in node_modules/fomod-installer/)

# 3. Commit and push C# changes only
node scripts/manage-node-modules.js commit "Update to .NET 9 compatibility" csharp
node scripts/manage-node-modules.js push csharp

# 4. Generate PR links for C# projects
node scripts/manage-node-modules.js pr-links "update-dotnet9" csharp
```

### Scenario 3: Nexus-Mods Repositories Only

```bash
# 1. Work only with Nexus-Mods repositories (exclude third-party)
node scripts/manage-node-modules.js status nexus

# 2. Create branch for Nexus-Mods repos only
node scripts/manage-node-modules.js create-branch "vortex-integration-fix" nexus

# 3. Complete workflow for Nexus-Mods repositories
node scripts/manage-node-modules.js workflow "Integrate with Vortex solution" nexus
```

### Scenario 4: All Projects Workflow

```bash
# 1. Show complete project overview
yarn modules:summary

# 2. Check status of all projects
yarn modules:status

# 3. Complete workflow for all Git repositories
yarn modules:workflow "Update Visual Studio integration"
```

## Project Details

### Git Repository Mapping

| Project | Type | Repository | Branch |
|---------|------|------------|--------|
| dotnetprobe | Local C# | N/A (local) | N/A |
| fomod-installer | C# | Nexus-Mods/fomod-installer | master |
| winapi-bindings | C++ | Nexus-Mods/node-winapi-bindings | master |
| xxhash-addon | C++ | jdarpinian/xxhash-addon | master |
| bsatk | C++ | Nexus-Mods/node-bsatk | master |
| esptk | C++ | Nexus-Mods/node-esptk | master |
| loot | C++ | Nexus-Mods/node-loot | master |
| gamebryo-savegame | C++ | Nexus-Mods/node-gamebryo-savegames | master |
| bsdiff-node | C++ | Nexus-Mods/bsdiff-node | master |

### Visual Studio Integration

All projects are included in `vortex.sln`:

- **Core Solution Folder**: dotnetprobe
- **FOMOD Installer Folder**: 8 C# projects from fomod-installer
- **Native Addons Folder**: winapi-bindings, xxhash-addon
- **Gamebryo Extensions Folder**: bsatk, esptk, loot, gamebryo-savegame, bsdiff-node

Changes to `.vcxproj`, `.csproj`, source files, and configurations are all managed through this system.

## Yarn Script Reference

```bash
# Conversion (first-time setup)
yarn modules:convert-dry     # Preview conversion changes
yarn modules:convert         # Convert npm packages to Git repos

# Quick status checks
yarn modules:status          # All projects
yarn modules:cpp             # C++ projects only  
yarn modules:csharp          # C# projects only
yarn modules:summary         # Project overview

# Repository management
yarn modules:setup           # Setup Git remotes
yarn modules:workflow        # Complete workflow
yarn modules:commit          # Commit changes
yarn modules:push            # Push changes
```

## Advanced Usage

### Custom Filters

```bash
# Multiple operations with specific filters
node scripts/manage-node-modules.js create-branch "feature-x" nexus
node scripts/manage-node-modules.js commit "Add feature X" nexus  
node scripts/manage-node-modules.js push nexus

# Check third-party dependencies
node scripts/manage-node-modules.js status third-party
```

### Branch Management

The repository management system provides comprehensive branch operations:

#### Creating Branches
```bash
# Create branch across all Git repositories
yarn modules:create-branch "feature-name"

# Create branch for specific project types
node scripts/manage-node-modules.js create-branch "cpp-fixes" cpp
node scripts/manage-node-modules.js create-branch "csharp-updates" csharp
```

#### Deleting Branches  
```bash
# Safe delete (fails if branch has unmerged changes)
yarn modules:delete-branch "old-feature"

# Safe delete for specific project types
node scripts/manage-node-modules.js delete-branch "deprecated-feature" cpp

# Force delete branch (even with unmerged changes)
node scripts/manage-node-modules.js delete-branch "experimental-branch" git --force

# Delete both local and remote branches
node scripts/manage-node-modules.js delete-branch "feature-branch" git --force --remote

# Delete only from specific repositories
node scripts/manage-node-modules.js delete-branch "test-branch" nexus --force
```

#### Branch Deletion Options
- **No flags**: Safe delete - will fail if branch has unmerged changes
- **--force**: Force delete - removes branch even if it has unmerged changes  
- **--remote**: Also delete the branch from remote repository
- **Combine flags**: `--force --remote` to force delete both local and remote

#### Branch Management Workflow
```bash
# 1. Create feature branch
yarn modules:create-branch "new-feature"

# 2. Work on changes and commit
yarn modules:commit "Implement new feature"

# 3. Push changes
yarn modules:push

# 4. After feature is merged, clean up
yarn modules:delete-branch "new-feature" --force --remote
```

## Testing with Feature Branches

When developing changes across multiple repositories, you'll want to test them together. The branch updater script makes this easy:

### Update Dependencies to Use Feature Branches

```bash
# Scan workspace to see which package.json files contain managed dependencies
yarn modules:scan-deps

# Update all dependencies to use your feature branch
yarn modules:update-branch my-feature-branch

# Or use the script directly
node scripts/update-package-branches.js update my-feature-branch

# Update only specific modules
yarn modules:update-branch fix-headers bsatk esptk

# Preview what would be updated (dry run)
node scripts/update-package-branches.js generate my-feature-branch
```

### Testing Workflow

1. **Create feature branches in repositories:**
   ```bash
   yarn modules:workflow "Create feature branch" cpp
   # Follow the workflow to create branches and push changes
   ```

2. **Update package.json to use feature branches:**
   ```bash
   yarn modules:update-branch my-feature-branch
   ```

3. **Test your changes:**
   ```bash
   yarn start
   # Test your application with the feature branch dependencies
   ```

4. **Restore original dependencies when done:**
   ```bash
   yarn modules:restore-deps
   ```

### Branch Management Commands

```bash
# Show current branches for all Git repositories
yarn modules:show-branches

# Show only C++ project branches
yarn modules:show-branches cpp

# Reinstall dependencies after changes
yarn modules:reinstall
```

### Safety Features

- **Automatic Backups**: Original package.json files are backed up before changes
- **Workspace Scanning**: Automatically finds all package.json files in the workspace
- **Selective Updates**: Update only specific modules if needed
- **Preview Mode**: See what would be updated without making changes
- **Easy Restoration**: Restore original dependencies with one command
- **Smart Filtering**: Only processes files that contain managed dependencies

### Example: Testing Header File Changes

```bash
# 1. Create and push changes to repositories
yarn modules:workflow "Add missing header files" cpp

# 2. Update dependencies to use your feature branches
yarn modules:update-branch add-missing-headers

# 3. Rebuild with the new dependencies
yarn modules:reinstall
yarn build

# 4. Test the application
yarn start

# 5. When testing is complete, restore original dependencies
yarn modules:restore-deps
yarn modules:reinstall
```

## Important Notes

### Project Types
- **Local projects** (dotnetprobe) are part of the main Vortex repository
- **Git repositories** can be modified and pushed back to their origins
- **Third-party libraries** (xxhash-addon) should be forked before modification

### Branch Strategy
- Feature branches are created from the appropriate default branch

### Integration Benefits
- Seamless Visual Studio development experience
- Centralized management of all project dependencies
- Automated workflow for contributing back to upstream repositories
- Type-specific operations for targeted development workflows

This system provides comprehensive management for all C++ and C# projects in the Vortex ecosystem, enabling efficient development and contribution workflows across multiple repositories.