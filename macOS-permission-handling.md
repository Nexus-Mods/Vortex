# macOS Permission Handling for Vortex

## Overview
This document describes the implementation of proper macOS permission handling for Vortex, providing appropriate access controls and security scoped bookmarks for file and folder access.

## Implementation Details

### 1. Core Module (src/util/macosPermissions.ts)
- `initializeMacOSPermissions()` - Sets up permission request and check handlers
- `requestDirectoryAccess()` - Requests access to a directory with security scoped bookmarks
- `checkDirectoryAccess()` - Checks if Vortex has access to a specific directory
- `requestSecurityPrivacyAccess()` - Guides users to add Vortex to Security & Privacy settings

### 2. Permission Handlers
- **Media Permissions** - Handles camera/microphone access requests
- **Geolocation Permissions** - Handles location access requests
- **Notification Permissions** - Handles notification access requests
- **Generic Permissions** - Handles other permission requests with appropriate user dialogs
- **File System Access** - Handles restricted file system access with user approval

### 3. Application Integration (Application.ts)
- Added permission initialization during UI startup
- Integrated with existing macOS-specific event handlers
- Proper error handling for permission-related operations

## Features
1. **Permission Request Handling** - Proper handling of various permission requests with user dialogs
2. **Security Scoped Bookmarks** - Automatic handling of security scoped bookmarks for directory access
3. **File System Access Control** - Controlled access to restricted directories with user approval
4. **User Guidance** - Clear instructions for adding Vortex to Security & Privacy settings
5. **Graceful Degradation** - Integration only active on macOS platforms

## Technical Notes
- Permission handling uses Electron's session.setPermissionRequestHandler and setPermissionCheckHandler
- File system access restrictions are handled through the 'file-system-access-restricted' event
- Security scoped bookmarks are automatically managed by Electron's dialog.showOpenDialog
- Integration is only enabled on macOS platforms
- Error handling prevents crashes from permission-related issues

## Configuration
No additional configuration is required. The integration is automatically enabled on macOS platforms when the application starts.

## Testing
The implementation has been tested for:
- Proper permission handler initialization on macOS
- Correct handling of various permission requests
- Graceful degradation on non-macOS platforms
- Integration with existing Vortex functionality
- Error handling for permission-related operations

## Future Enhancements
Potential future enhancements could include:
- More granular permission controls based on specific Vortex features
- Persistent permission storage for frequently accessed directories
- Enhanced user interface for permission management
- Integration with macOS Shortcuts app for automated permission workflows
- Advanced security scoped bookmark management