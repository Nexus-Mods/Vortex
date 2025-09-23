# Legacy Mods Directory

This directory is for placing older community extensions that use legacy Vortex API patterns.

## How to add legacy extensions

1. **Create a subdirectory** for each legacy extension:
   ```
   legacy-mods/
   ├── my-legacy-mod/
   │   ├── index.js          # Main extension file
   │   └── package.json      # Optional metadata
   ```

2. **Extension structure** - Your legacy extension should have:
   - `index.js` - Main extension file that exports a function
   - `package.json` - Optional metadata file

3. **Example legacy extension**:
   ```javascript
   // index.js
   module.exports = function(context) {
     context.registerGame({
       id: 'mygame',
       name: 'My Game',
       mergeMods: true,
       queryPath: () => findGame(),
       executable: () => 'game.exe'
     });
     
     context.once(() => {
       // Post-initialization code
       console.log('My legacy extension loaded!');
     });
   };
   ```

## Supported patterns

- `context.registerGame()` - Game registration
- `context.once()` - Post-initialization callbacks
- Legacy API methods - Older API patterns

## Troubleshooting

If your legacy extension doesn't load:

1. Check the Vortex log for error messages
2. Ensure your `index.js` exports a function
3. Verify the extension uses supported API patterns
4. Consider updating to current Vortex API format

The Legacy Extension Shim will automatically scan this directory and load compatible extensions.