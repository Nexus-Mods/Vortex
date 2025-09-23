# Legacy Extension Shim for Vortex macOS Port

This extension provides compatibility for older community mods that were designed for earlier versions of Vortex and use legacy API patterns.

## What it does

The shim provides compatibility for:

- **`context.registerGame()`** - Legacy game registration patterns
- **`context.once()`** - Legacy initialization callbacks  
- **Legacy API methods** - Older API methods that may have changed

## How to use

1. **Place legacy extensions** in one of these directories:
   ```
   extensions/legacy-mods/
   extensions/community-mods/
   ```

2. **Extension structure** should be:
   ```
   legacy-mods/
   ├── my-legacy-mod/
   │   ├── index.js          # Main extension file
   │   └── package.json      # Optional metadata
   ```

3. **Legacy extension format** should export a main function:
   ```javascript
   // Option 1: Direct function export
   module.exports = function(context) {
     context.registerGame({
       id: 'mygame',
       name: 'My Game',
       // ... game definition
     });
     
     context.once(() => {
       // Post-initialization code
     });
   };
   
   // Option 2: Named export
   module.exports = {
     main: function(context) {
       // Extension code
     }
   };
   
   // Option 3: ES6 default export
   module.exports = {
     default: function(context) {
       // Extension code
     }
   };
   ```

## Supported Legacy Patterns

### Game Registration
```javascript
context.registerGame({
  id: 'mygame',
  name: 'My Game',
  mergeMods: true,
  queryPath: () => findGame(),
  supportedTools: [],
  executable: () => 'game.exe',
  // ... other game properties
});
```

### Once Callbacks
```javascript
context.once(() => {
  // Code that runs after Vortex is fully initialized
  context.api.ext.someExtensionMethod();
});
```

### Legacy API Access
```javascript
// These legacy patterns are automatically translated:
context.api.getState()           // → context.api.store.getState()
context.api.sendNotification()   // → Updated notification format
context.api.showDialog()         // → Updated dialog format
```

## Troubleshooting

### Extension not loading
1. Check the Vortex log for error messages
2. Ensure the extension has a valid `index.js` file
3. Verify the extension exports a function

### API compatibility issues
1. Check if the extension uses unsupported APIs
2. Look for error messages in the Vortex log
3. Consider updating the extension to use current APIs

### Game not appearing
1. Verify the game definition is complete
2. Check that required game files exist
3. Ensure the game ID is unique

## Logging

The shim logs its activities to the Vortex log file. Look for messages prefixed with "Legacy Extension Shim" to track loading progress and any issues.

## Limitations

- Only supports JavaScript extensions (not TypeScript)
- Some very old API patterns may not be supported
- Performance may be slightly reduced compared to native extensions
- Complex extensions may require manual updates

## Migration Recommendations

For best performance and compatibility, consider migrating legacy extensions to the current Vortex API format. The shim is intended as a temporary compatibility solution.