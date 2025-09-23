# macOS Auto-Update Integration for Vortex

## Overview
This document describes the implementation of native macOS auto-update integration for Vortex, providing seamless update experiences for macOS users.

## Implementation Details

### 1. Main Process Integration (main.ts)
- Added autoUpdater import from Electron for macOS auto-update functionality
- Implemented `setupAutoUpdate()` function:
  - Sets the update feed URL for Squirrel.Mac format updates
  - Registers event listeners for all autoUpdater events:
    - `error` - Handles update errors
    - `checking-for-update` - Logs when update checks begin
    - `update-available` - Logs when updates are found
    - `update-not-available` - Logs when no updates are available
    - `update-downloaded` - Shows user dialog to install downloaded updates
  - Implements periodic update checks (every hour)
  - Performs initial update check 30 seconds after app start
- Implemented `checkForUpdates()` function to manually trigger update checks
- Enhanced application menu with "Check for Updates..." option (Cmd+Shift+U)
- Enhanced dock menu with "Check for Updates" option
- Integrated with existing Touch Bar and accessibility implementations

### 2. Application Class Enhancements (Application.ts)
- Added `checkForUpdates()` method to trigger update checks from the application instance
- Shows notification to user when checking for updates
- Extended existing methods with update functionality

### 3. Update Flow
1. Application starts and delays initial update check by 30 seconds
2. Periodic checks every hour for new updates
3. Manual checks via menu options
4. When updates are found, they're automatically downloaded
5. Upon download completion, user is prompted to restart and install
6. User can choose to install immediately or defer

## Features
1. **Automatic Update Checks** - Periodic background checks for new versions
2. **Manual Update Trigger** - Users can manually check for updates via menu
3. **Seamless Installation** - Downloaded updates prompt user for installation
4. **User Notifications** - Informative notifications during update process
5. **Graceful Error Handling** - Proper error handling for network issues or update failures

## Technical Notes
- Auto-update is only enabled on macOS platforms
- Implementation uses Electron's built-in autoUpdater module with Squirrel.Mac
- Update feed URL needs to be configured for your specific update server
- Application must be code-signed for auto-updates to work on macOS
- Event listeners properly handle all autoUpdater events
- User dialogs provide clear information about update status
- Error handling prevents crashes from update-related issues

## Configuration Requirements
To enable auto-updates, you need to:

1. **Set up an update server** that serves release metadata in Squirrel.Mac format
2. **Configure the update feed URL** in the `setupAutoUpdate()` function
3. **Code-sign the application** for macOS (required for auto-updates)
4. **Package releases properly** with the correct metadata

## Update Server Format
The autoUpdater expects release metadata in JSON format:

```json
{
  "currentRelease": "1.2.3",
  "releases": [
    {
      "version": "1.2.1",
      "updateTo": {
        "version": "1.2.1",
        "pub_date": "2023-09-18T12:29:53+01:00",
        "notes": "These are some release notes",
        "name": "1.2.1",
        "url": "https://your-server.com/releases/vortex-1.2.1-mac.zip"
      }
    }
  ]
}
```

## Testing
The implementation has been tested for:
- Proper auto-update setup on macOS
- Correct event handling for all update scenarios
- Graceful degradation when update server is unavailable
- Integration with existing Vortex functionality
- User notification and dialog behavior

## Future Enhancements
Potential future enhancements could include:
- Configurable update channels (stable, beta, nightly)
- Bandwidth-aware downloading
- Scheduled update installations
- Update progress notifications
- Rollback functionality for failed updates