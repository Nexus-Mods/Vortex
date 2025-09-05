# SASS Compilation Error Fix Design

## Overview

This document outlines the solution for fixing SASS compilation errors that occur during the Vortex application runtime. The errors are caused by undefined variables in extension stylesheets, specifically:

1. `Undefined variable: $popover-title-bg` in documentation extension
2. `Undefined variable: $half-gutter` in collections extension

These errors prevent proper CSS compilation and affect the UI rendering of these extensions.

## Architecture

The Vortex application uses a centralized SASS compilation system through the `StyleManager` class. The system works as follows:

1. Core stylesheets are loaded and compiled first
2. Extension stylesheets are dynamically added and compiled
3. Variables from core stylesheets should be available to extensions
4. The compilation process uses `sass.render()` with include paths

```
graph TD
    A[StyleManager] --> B[Core Styles]
    A --> C[Extension Styles]
    B --> D[SASS Compiler]
    C --> D
    D --> E[Compiled CSS]
```

## Problem Analysis

### Root Cause

The SASS compilation errors occur because extension stylesheets are referencing variables that are not in scope:

1. **$popover-title-bg**: Defined in `src/stylesheets/details.scss` but not accessible in extension context
2. **$half-gutter**: Defined in `src/stylesheets/variables.scss` but not accessible in extension context

### Why This Happens

1. Extension stylesheets are compiled separately from core stylesheets
2. Variable definitions from core stylesheets are not automatically imported into extension stylesheets
3. The include paths configuration may not be sufficient for resolving variable dependencies

## Solution Design

### Approach 1: Import Core Variables in Extension Stylesheets

Modify extension stylesheets to explicitly import required core variables:

```
// At the top of extension SCSS files
@import "../../../src/stylesheets/variables.scss";
@import "../../../src/stylesheets/details.scss";
```

This approach directly imports the core variable definitions into each extension stylesheet, ensuring that all required variables are available during compilation.

### Approach 2: Update StyleManager Include Paths

Modify the `StyleManager.ts` to ensure all necessary paths are included for variable resolution:

```typescript
const includePaths = [
  assetsPath, 
  modulesPath, 
  srcStylesPath,
  rootPath,
  appPath,
  assetsRootPath,
  assetsBasePath,
  path.join(srcStylesPath, 'bootstrap'),
  path.join(srcStylesPath, 'bootstrap/bootstrap'),
  path.join(srcStylesPath, 'vortex')
];
```

This approach enhances the SASS compiler's ability to resolve imports by adding additional search paths.

### Approach 3: Create Global Variable Imports

Create a global variables file that extensions can import:

1. Create `src/stylesheets/_extension-variables.scss`
2. Import all necessary variables
3. Reference this file in extension stylesheets

This approach centralizes variable imports for all extensions, making maintenance easier.

## Implementation Plan

### Phase 1: Fix Documentation Extension

File: `extensions/documentation/src/stylesheets/documentation.scss`

Add the following import statements at the very beginning of the file, before any other content:

```scss
@import "../../../src/stylesheets/variables.scss";
@import "../../../src/stylesheets/details.scss";
```

This will ensure that the `$popover-title-bg` variable is available when the stylesheet is compiled.

### Phase 2: Fix Collections Extension

File: `extensions/collections/src/stylesheets/style.scss`

Add the following import statements at the very beginning of the file, before any other content:

```scss
@import "../../../src/stylesheets/variables.scss";
@import "../../../src/stylesheets/details.scss";
```

This will ensure that the `$half-gutter` variable is available when the stylesheet is compiled.

### Phase 3: Update StyleManager

File: `src/util/StyleManager.ts`

In the `renderSASSCB` function, enhance the `includePaths` array to ensure all necessary paths are included:

```typescript
const includePaths = [
  assetsPath, 
  modulesPath, 
  srcStylesPath,
  rootPath,
  appPath,
  assetsRootPath,
  assetsBasePath,
  path.join(srcStylesPath, 'bootstrap'),
  path.join(srcStylesPath, 'bootstrap/bootstrap'),
  path.join(srcStylesPath, 'vortex')
];
```

### Phase 4: Verify Extension Build Process

1. Check that extension webpack configurations properly handle SASS imports
2. Ensure that the build process copies necessary stylesheet dependencies
3. Validate that bundled extensions have access to required variables

## Testing Strategy

### Unit Tests

1. Compile each extension stylesheet independently to verify variable resolution
2. Check that all referenced variables are properly defined
3. Validate that the compiled CSS contains expected styles

### Integration Tests

1. Run the full application with extensions enabled
2. Verify that UI elements using the affected styles render correctly
3. Check browser console for any remaining SASS compilation errors

### Validation Steps

1. Start Vortex with `yarn start --user-data=/tmp/vortex-temp-logs`
2. Enable documentation and collections extensions
3. Verify that no SASS compilation errors appear in logs
4. Confirm that UI elements render with correct styling

### Post-Fix Verification

After implementing the fixes:

1. Check the application logs for SASS compilation errors
2. Verify that the documentation extension's tutorial footer renders correctly with the proper background color
3. Confirm that the collections extension's rule separator displays correctly
4. Test with different themes to ensure compatibility

## Data Models

No data model changes are required for this fix.

## Business Logic

The fix involves updating the SASS compilation process to ensure proper variable scoping between core stylesheets and extension stylesheets.

### Before Fix

```
sequenceDiagram
    participant E as Extension Stylesheet
    participant S as StyleManager
    participant C as SASS Compiler
    
    E->>S: Request compilation
    S->>C: Compile with current paths
    C-->>S: Error: Undefined variable
    S-->>E: Compilation failed
```

### After Fix

```
sequenceDiagram
    participant E as Extension Stylesheet
    participant S as StyleManager
    participant C as SASS Compiler
    
    E->>S: Request compilation
    S->>C: Compile with updated paths and imports
    C-->>S: Successful compilation
    S-->>E: Compiled CSS
```

## Middleware & Interceptors

No middleware or interceptor changes are required for this fix.

## Error Handling

The fix addresses the root cause of the errors rather than implementing additional error handling. However, the StyleManager should continue to log compilation errors for debugging purposes.

## Conclusion

The SASS compilation errors in the Vortex application are caused by extension stylesheets referencing variables that are not in scope. By importing the core variable definitions into each extension stylesheet and enhancing the StyleManager's include paths, we can resolve these errors and ensure proper CSS compilation. This approach maintains the existing architecture while fixing the variable scoping issues that prevent proper UI rendering in the documentation and collections extensions.