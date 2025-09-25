# macOS Admin Access Implementation for Deployment Methods

## Overview

This implementation adds macOS administrator access functionality to Vortex's deployment methods, allowing the application to request elevated privileges when needed for mod deployment operations.

## Files Modified

### 1. Core Admin Access Module
- **File**: `src/util/macOSAdminAccess.ts`
- **Purpose**: Provides the core functionality for checking and requesting admin access on macOS
- **Key Features**:
  - Singleton pattern for consistent access management
  - Caching of admin access results (5-minute TTL)
  - Prevention of concurrent admin requests for the same path
  - Uses AppleScript (`osascript`) to prompt for admin privileges
  - Comprehensive error handling and logging

### 2. Move Activator Integration
- **File**: `src/extensions/move_activator/index.ts`
- **Changes**:
  - Added imports for `MacOSAdminAccessManager` and `isMacOS`
  - Modified `isSupported()` method to allow deployment on macOS even without initial write access
  - Enhanced `createLink()` method to request admin access when file move operations fail due to permissions
  - Automatic fallback to copy deployment if admin access is denied

### 3. Hardlink Activator Integration
- **File**: `src/extensions/hardlink_activator/index.ts`
- **Changes**:
  - Added imports for `MacOSAdminAccessManager` and `isMacOS`
  - Modified `isSupported()` method to allow deployment on macOS even without initial write access
  - Enhanced `linkFile()` method to request admin access when hardlink creation fails due to permissions
  - Automatic fallback to copy deployment if admin access is denied

## Implementation Details

### Admin Access Flow

1. **Initial Check**: Deployment methods check for write access using standard filesystem permissions
2. **macOS Handling**: On macOS, if write access is denied, the method proceeds with lower priority instead of immediately failing
3. **Runtime Request**: During actual deployment, if file operations fail due to permissions:
   - The system detects permission errors (`EACCES` or `EPERM`)
   - Requests admin access using AppleScript dialog
   - Retries the operation if access is granted
   - Falls back to copy deployment if access is denied

### Error Handling

- **Permission Errors**: Specifically handles `EACCES` and `EPERM` error codes
- **Graceful Fallback**: If admin access is denied, the original error is re-thrown to trigger fallback mechanisms
- **Logging**: Comprehensive logging at all stages for debugging and user feedback

### Caching Strategy

- **Duration**: Admin access results are cached for 5 minutes
- **Scope**: Cache is per-directory path to avoid unnecessary re-prompts
- **Concurrency**: Prevents multiple simultaneous admin requests for the same path

## Testing

### Automated Tests
- **Integration Test**: Verifies that deployment methods include the necessary imports and admin logic
- **Platform Detection**: Confirms macOS-specific code paths are properly implemented

### Manual Testing Scenarios
1. **Admin Granted**: Deploy mods to protected directory, grant admin access when prompted
2. **Admin Denied**: Deploy mods to protected directory, deny admin access, verify fallback to copy
3. **No Admin Needed**: Deploy mods to user-accessible directory, verify normal operation
4. **Cache Testing**: Multiple operations to same protected directory should only prompt once

## Benefits

1. **Improved User Experience**: Users can deploy mods to protected game directories without manual permission changes
2. **Automatic Fallback**: If admin access is denied, the system gracefully falls back to copy deployment
3. **Security Conscious**: Only requests admin access when actually needed, not preemptively
4. **Performance Optimized**: Caching prevents repeated admin prompts for the same operations

## Usage

The implementation is transparent to end users. When deploying mods:

1. Vortex will attempt the preferred deployment method (move or hardlink)
2. If permission errors occur on macOS, a system dialog will prompt for admin access
3. If granted, deployment continues with the preferred method
4. If denied, deployment automatically falls back to copy method
5. Future operations to the same directory may use cached admin access

## Platform Compatibility

- **macOS**: Full functionality with admin access prompts
- **Windows/Linux**: No changes to existing behavior
- **Cross-platform**: All code includes proper platform detection to avoid issues on other systems

## Security Considerations

- Uses system-native AppleScript for admin prompts (trusted by macOS)
- Only requests access to specific directories, not system-wide privileges
- Caching is memory-only and expires automatically
- No persistent storage of admin credentials or tokens