# Community Mods Directory

This directory is for placing community-developed extensions that may use legacy or non-standard API patterns.

## Purpose

This directory serves as an alternative location for:
- Community-developed extensions
- Third-party extensions
- Extensions that haven't been updated to current API standards
- Experimental or unofficial extensions

## How to add extensions

1. **Create a subdirectory** for each extension:
   ```
   community-mods/
   ├── community-extension-name/
   │   ├── index.js          # Main extension file
   │   └── package.json      # Optional metadata
   ```

2. **Extension requirements**:
   - Must have an `index.js` file that exports a function
   - Should be compatible with Vortex extension API
   - May use legacy patterns (handled by the Legacy Extension Shim)

## Compatibility

The Legacy Extension Shim automatically scans this directory and provides compatibility for:
- Legacy `context.registerGame()` patterns
- Legacy `context.once()` callbacks
- Older API method signatures

## Installation

Simply place the extension folder in this directory and restart Vortex. The Legacy Extension Shim will automatically detect and load compatible extensions.

## Support

For community extensions:
- Check with the original extension author for support
- Refer to the Legacy Extension Shim documentation
- Consider updating extensions to current Vortex API standards