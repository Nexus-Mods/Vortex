# Troubleshooting Vortex on macOS

This document provides solutions for common issues encountered when running Vortex on macOS.

## Installation Issues

### App Translocation Problems

**Symptoms:**
- Vortex shows warnings about running from a temporary location
- Performance issues or instability
- "Damaged" app errors

**Solution:**
1. Quit Vortex if it's running
2. Open Finder and navigate to your Downloads folder
3. Drag Vortex.app to your Applications folder
4. Launch Vortex from the Applications folder

**Prevention:**
Always install Vortex to your Applications folder rather than running directly from the DMG or Downloads folder.

### Permission and TCC Prompt Issues

**Symptoms:**
- Unexpected permission prompts at startup
- Access denied errors for game folders
- Mods not installing correctly

**Solution:**
1. Grant access through System Preferences:
   - Open System Preferences > Security & Privacy > Privacy
   - Grant Vortex access to Files and Folders, Desktop, Downloads, etc.
2. Or use the built-in folder picker:
   - When prompted, click "Select Folder" and navigate to your game directory
   - This creates a proper security-scoped bookmark

**Prevention:**
- Always grant access when prompted
- Use the folder picker rather than manually entering paths
- Restart Vortex after granting permissions

### External Disk Access Problems

**Symptoms:**
- Cannot access games installed on external drives
- "Access denied" errors for external storage
- Game discovery failing for external drives

**Solution:**
1. Grant Vortex access to external drives:
   - Open System Preferences > Security & Privacy > Privacy
   - Select "Files and Folders"
   - Grant Vortex access to external drives
2. Or use the folder picker to create security-scoped bookmarks:
   - Go to Settings > Paths
   - Click "Change" next to your game path
   - Navigate to and select the game folder on the external drive

**Prevention:**
- Grant access to external drives during initial setup
- Use folder pickers for all game directories

## Performance Issues

### Slow Startup Times

**Symptoms:**
- Vortex takes a long time to launch
- Beach ball (spinning cursor) during startup

**Solutions:**
1. Clear cache:
   ```bash
   rm -rf ~/Library/Application\ Support/Vortex/cache
   ```
2. Reset settings (as a last resort):
   ```bash
   rm -rf ~/Library/Application\ Support/Vortex/settings.json
   ```

### High CPU Usage

**Symptoms:**
- Vortex uses excessive CPU resources
- Mac fans running loudly
- System slowdown

**Solutions:**
1. Check for background processes:
   - Open Activity Monitor
   - Look for multiple Vortex processes
   - Force quit unnecessary processes
2. Disable unnecessary extensions:
   - Go to Extensions in Vortex
   - Disable extensions you don't use
3. Reduce game discovery frequency:
   - Go to Settings > Mods
   - Increase the "Check for external changes" interval

## Game Discovery Issues

### Steam Game Discovery Failing

**Symptoms:**
- Steam games not being detected
- "Game not found" errors
- Empty game lists

**Solutions:**
1. Verify Steam is installed and running
2. Check Steam library folders:
   - Open Steam > Settings > Downloads > Steam Library Folders
   - Ensure all library folders are listed
3. Manually add game paths:
   - Go to Games > Game List
   - Click the "+" button
   - Browse to your Steam game directory

### Epic Games Store Discovery Issues

**Symptoms:**
- Epic games not detected
- Manifest files not found
- Incorrect game paths

**Solutions:**
1. Verify Epic Games Launcher is installed
2. Check Epic manifest locations:
   - Default: `~/Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests/`
3. Manually add game paths if automatic discovery fails

### GOG Galaxy Discovery Problems

**Symptoms:**
- GOG games not detected
- Authentication issues
- Missing game manifests

**Solutions:**
1. Verify GOG Galaxy is installed
2. Check GOG application data location:
   - Default: `~/Library/Application Support/GOG.com/Galaxy/Applications/`
3. Ensure you're logged into GOG Galaxy
4. Try re-authenticating in Vortex:
   - Go to Games > Game List
   - Find your GOG game
   - Click "Authenticate" if prompted

## Mod Installation Issues

### Mod Installation Failures

**Symptoms:**
- Mods fail to install
- "Installation failed" errors
- Partial installations

**Solutions:**
1. Check available disk space
2. Verify game directory permissions
3. Try installing in safe mode:
   - Hold Shift while starting Vortex
   - Attempt installation again
4. Clear temporary files:
   ```bash
   rm -rf ~/Library/Application\ Support/Vortex/temp
   ```

### Mod Activation Problems

**Symptoms:**
- Mods don't appear to be active
- Game crashes with mods enabled
- Load order issues

**Solutions:**
1. Verify mod deployment:
   - Go to Mods > [Game]
   - Check that mods show as "Deployed"
2. Check for mod conflicts:
   - Use the conflict detector
   - Resolve conflicts as needed
3. Verify game cache:
   - Some games require cache verification after mod changes

## Update Issues

### Auto-Update Failures

**Symptoms:**
- Vortex fails to update automatically
- "Update failed" messages
- Stuck on old versions

**Solutions:**
1. Check internet connection
2. Verify code signing:
   ```bash
   codesign --verify --deep /Applications/Vortex.app
   ```
3. Manually download and install the latest version
4. Check for firewall/proxy issues

### Update Rollback Issues

**Symptoms:**
- Unable to rollback to previous version
- Data loss after failed updates
- Corrupted installations

**Solutions:**
1. Backup Vortex data before major updates:
   ```bash
   cp -r ~/Library/Application\ Support/Vortex ~/Vortex-backup
   ```
2. If update fails, reinstall from scratch:
   - Uninstall current version
   - Download latest version manually
   - Restore data from backup if needed

## Rosetta Compatibility

### Intel-Only Extensions on Apple Silicon

**Symptoms:**
- Extensions fail to load on M1/M2 Macs
- "Architecture not supported" errors
- Missing functionality

**Solutions:**
1. Run Vortex under Rosetta:
   - Right-click Vortex.app in Applications
   - Select "Get Info"
   - Check "Open using Rosetta"
   - Restart Vortex
2. Check for updated extensions that support Apple Silicon
3. Contact extension developers about Apple Silicon support

## Network and Authentication Issues

### Nexus Mods Authentication Failures

**Symptoms:**
- Unable to log in to Nexus Mods
- API connection errors
- Download failures

**Solutions:**
1. Check internet connection
2. Verify firewall settings
3. Try different DNS servers
4. Clear authentication cache:
   - Go to Settings > Nexus
   - Click "Log Out"
   - Log back in
5. Check Nexus Mods status page for service outages

### Download Problems

**Symptoms:**
- Downloads failing or stalling
- Slow download speeds
- "Network error" messages

**Solutions:**
1. Check internet connection speed
2. Verify proxy settings in Vortex
3. Try downloading at a different time
4. Clear download cache:
   ```bash
   rm -rf ~/Library/Application\ Support/Vortex/downloads
   ```

## UI and Display Issues

### Dark Mode Problems

**Symptoms:**
- UI elements not visible
- Text hard to read
- Inconsistent theming

**Solutions:**
1. Switch themes:
   - Go to Settings > Interface
   - Try different themes
2. Toggle dark mode:
   - Go to Settings > Interface
   - Switch between light and dark modes
3. Reset interface settings:
   - Go to Settings > Interface
   - Click "Reset to Defaults"

### Window Management Issues

**Symptoms:**
- Windows appearing off-screen
- Unable to resize windows
- Missing title bars

**Solutions:**
1. Reset window positions:
   - Quit Vortex
   - Delete window state:
     ```bash
     rm ~/Library/Application\ Support/Vortex/windowState.json
     ```
   - Restart Vortex
2. Use keyboard shortcuts:
   - Cmd+M to minimize
   - Cmd+W to close windows
   - Cmd+Option+F to toggle fullscreen

## Technical Support

### Collecting Diagnostic Information

When reporting issues, include this information:

1. Vortex version:
   - Help > About Vortex

2. macOS version:
   - Apple menu > About This Mac

3. System architecture:
   - Apple menu > About This Mac > Chip or Processor

4. Error logs:
   - Help > Show Logs

5. Steps to reproduce the issue

### Contacting Support

- Nexus Mods Support: https://support.nexusmods.com/
- Vortex Discord: https://discord.gg/nexusmods
- GitHub Issues: https://github.com/Nexus-Mods/Vortex/issues

## Advanced Troubleshooting

### Resetting Vortex Completely

**Warning:** This will remove all settings, profiles, and installed mods.

1. Quit Vortex
2. Delete application data:
   ```bash
   rm -rf ~/Library/Application\ Support/Vortex
   ```
3. Delete preferences:
   ```bash
   defaults delete com.nexusmods.vortex
   ```
4. Reinstall Vortex

### Running from Terminal

To get more detailed error output:

```bash
# Navigate to Vortex installation
cd /Applications/Vortex.app/Contents/MacOS

# Run Vortex
./Vortex
```

This will show any errors in the terminal that might not appear in the UI.

## Preventive Maintenance

### Regular Maintenance Tasks

1. **Clear cache monthly:**
   ```bash
   rm -rf ~/Library/Application\ Support/Vortex/cache
   ```

2. **Update extensions regularly:**
   - Go to Extensions
   - Check for updates
   - Update all extensions

3. **Verify game installations:**
   - Go to Games > [Game]
   - Click "Verify" if available

4. **Check for Vortex updates:**
   - Help > Check for Updates

### Performance Optimization

1. **Limit concurrent downloads:**
   - Settings > Downloads
   - Reduce maximum concurrent downloads

2. **Disable unused extensions:**
   - Extensions > Browse
   - Disable extensions not in use

3. **Optimize game discovery:**
   - Settings > Mods
   - Adjust "Check for external changes" interval

## Known Issues

### Current Limitations

1. **Some Windows-only extensions:** Certain extensions designed for Windows may not work on macOS
2. **Performance with large mod collections:** Very large mod collections may impact performance
3. **External tool integration:** Some external tools may require additional configuration on macOS

### Workarounds

1. **For Windows-only extensions:** Look for cross-platform alternatives or run under Parallels/CrossOver
2. **For performance issues:** Use mod filtering and organize mods into profiles
3. **For external tools:** Check documentation for macOS-specific instructions

## Additional Resources

- [Vortex BUILD_MAC.md](./BUILD_MAC.md)
- [Vortex RELEASING_MAC.md](./RELEASING_MAC.md)
- [Apple Support Documentation](https://support.apple.com/)
- [Nexus Mods Support](https://support.nexusmods.com/)