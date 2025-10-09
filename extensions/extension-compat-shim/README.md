# Extension Compatibility Shim for Vortex

This extension provides compatibility for downloaded extensions that use deprecated patterns or APIs that are no longer supported in current versions of Vortex.

## What it does

The shim automatically detects and applies fixes for common compatibility issues:

1. **Duplicate `isWindows` declarations** - Removes duplicate platform detection functions
2. **Browser-specific API usage** - Wraps browser-specific references like `document` in safe checks
3. **Nested winapi declarations** - Fixes incorrectly nested winapi require statements
4. **Platform function duplicates** - Removes duplicate platform detection function declarations

## How it works

The shim scans downloaded extensions at startup and applies compatibility fixes to any extensions that exhibit known problematic patterns. It creates temporary fixed versions of the extension code and loads those instead of the original files.

## Supported Compatibility Patterns

### Duplicate Platform Function Declarations
```javascript
// Problematic code that gets fixed:
const isWindows = () => process.platform === 'win32';

// The shim removes these duplicate declarations and relies on the 
// properly imported functions from vortex-api
```

### Browser API Usage in Node Context
```javascript
// Problematic code that gets fixed:
function someFunction() {
  document.getElementById('myElement'); // This would fail in Node.js context
}

// The shim wraps these in safe checks:
function someFunction() {
  (typeof document !== "undefined" ? document : undefined).getElementById('myElement');
}
```

### Nested winapi Declarations
```javascript
// Problematic code that gets fixed:
const winapi = isWindows() ? (isWindows() ? require('winapi-bindings') : undefined) : undefined;

// The shim simplifies this to:
const winapi = isWindows() ? require('winapi-bindings') : undefined;
```

## Troubleshooting

If your extension still doesn't work after the shim is applied:

1. Check the Vortex log for detailed error messages
2. Look for entries related to "Extension Compatibility Shim"
3. Consider updating the extension to use current Vortex API patterns
4. Report persistent issues to the extension author

The shim is intended as a temporary compatibility solution while extension authors update their code.