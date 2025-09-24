# Implementation Summary: Add Flag to Yarn Clean Command for Removing vortex_devel Directory

## Overview
This implementation adds an optional `--dev-data` flag to the existing `yarn clean` command that removes the `~/Library/Application Support/vortex_devel` directory on macOS systems.

## Changes Made

### 1. Created New Script
- **File**: `scripts/clean-dev-data.js`
- **Purpose**: Parse command line arguments and conditionally remove vortex_devel directory
- **Features**:
  - Maintains all existing clean functionality
  - Adds optional `--dev-data` flag support
  - Cross-platform awareness (only removes directory on macOS)
  - Proper error handling and user feedback

### 2. Updated package.json
- **Modified**: `"clean"` script in `package.json`
- **From**: `"clean": "yarn add rm-local-modules && rm-local-modules && rimraf out && yarn install --check-files"`
- **To**: `"clean": "node scripts/clean-dev-data.js"`

### 3. Added Documentation
- **File**: `docs/clean-command.md`
- **Purpose**: Explains usage of the enhanced clean command

## Usage Examples

### Standard Clean (unchanged behavior)
```bash
yarn clean
```

### Clean with Development Data Removal (new feature)
```bash
yarn clean --dev-data
```

## Implementation Details

### Script Functionality
1. **Argument Parsing**: Detects `--dev-data` flag
2. **Standard Clean Process**: 
   - `yarn add rm-local-modules`
   - `rm-local-modules`
   - `rimraf out`
   - `yarn install --check-files`
3. **Conditional Directory Removal**:
   - Only on macOS systems
   - Only when `--dev-data` flag is provided
   - Safe removal with existence checking

### Cross-Platform Support
- **macOS**: Full functionality including vortex_devel directory removal
- **Other Platforms**: Standard clean functionality with message about macOS-only feature

### Error Handling
- Graceful handling of missing directories
- Detailed error messages with stack traces
- Non-zero exit codes on failure

## Testing Performed
1. ✅ Standard clean command without flag (preserves existing functionality)
2. ✅ Clean command with flag (removes vortex_devel directory)
3. ✅ Clean command with flag when directory doesn't exist (handles gracefully)
4. ✅ Cross-platform compatibility verification

## Files Created/Modified
1. `scripts/clean-dev-data.js` - New script with enhanced functionality
2. `package.json` - Updated clean script reference
3. `docs/clean-command.md` - Documentation for new feature
4. `scripts/test-vortex-dir.js` - Test script (can be removed)
5. `scripts/test-platform.js` - Test script (can be removed)