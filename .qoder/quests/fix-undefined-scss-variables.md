# Fix for Undefined SCSS Variables in Vortex Extensions

## Overview

This document outlines the approach to fix undefined SCSS variables that are causing compilation errors in Vortex extensions. The primary issue is that extension SCSS files are referencing variables defined in the core application's `variables.scss` file and Bootstrap variables, but these variables are not being imported or made available during the SCSS compilation process.

## Problem Analysis

### Error Details
```
Error: Undefined variable.
   ╷
89 │       padding: $half-gutter;\r
   │                ^^^^^^^^^^^^\n
   ╵
  out/bundledPlugins/collections/style.scss 89:16  @import
```

### Root Cause
1. Extension SCSS files (e.g., `collections/style.scss`) reference variables like `$half-gutter`, `$gutter-width` defined in the core `src/stylesheets/variables.scss`
2. These variables are not imported or made available during the SCSS compilation of extension stylesheets
3. The StyleManager loads core stylesheets in a specific order, but extension stylesheets are processed separately

### Affected Files
- `extensions/collections/style.scss` - Uses `$half-gutter`, `$gutter-width`, and other core variables
- `extensions/titlebar-launcher/titlebar-launcher.scss` - Uses `$half-gutter` and other core variables
- `extensions/issue-tracker/src/issue_tracker.scss` - Uses `$half-gutter`, `$gutter-width`, `$border-width`, `$border-color`, and other core variables
- And potentially other extension SCSS files that use core variables without importing them

## Solution Approach

### 1. Extension SCSS File Modification
Each extension SCSS file that references core variables should explicitly import the core variables file:

```scss
@import '../../src/stylesheets/variables.scss';

// Rest of the extension's SCSS content
```

For extensions that also need Bootstrap variables (like panel variables), they should import both:

```scss
@import '../../src/stylesheets/variables.scss';
@import '../../src/stylesheets/bootstrap/bootstrap/variables';

// Rest of the extension's SCSS content
```

### 2. Build Process Enhancement
Modify the extension build process to ensure core variables are available during SCSS compilation:

1. Update webpack configurations to include core SCSS paths
2. Ensure proper resolution of variable dependencies during compilation

### 3. StyleManager Enhancement
Enhance the StyleManager to better handle extension SCSS compilation by:
1. Prepending core variables to extension SCSS content before compilation
2. Ensuring proper import resolution for extension stylesheets

## Core Variables Reference

The following core variables are available to extensions through the main variables import:

### Spacing Variables
- `$gutter-width`: 24px
- `$half-gutter`: math.div($gutter-width, 2)
- `$slim-gutter`: math.div($gutter-width, 4)

### Color Variables
- `$white`: #F4F4F5
- `$black`: #09090B
- `$gray-darker`: #D4D4D8
- `$gray-dark`: #A1A1AA
- `$gray`: #3F3F46
- `$gray-light`: #27272A
- `$gray-lighter`: #18181B
- `$brand-primary`: #C87B28
- `$brand-highlight`: #1D4ED8
- `$brand-success`: #166534
- `$brand-success-lighter`: #22C55E
- `$brand-info`: #1D4ED8
- `$brand-info-lighter`: #60A5FA
- `$brand-warning`: #FACC15
- `$brand-warning-lighter`: #FEF08A
- `$brand-danger`: #991B1B
- `$brand-danger-lighter`: #EF4444
- `$brand-bg`: $gray-lighter
- `$brand-menu`: $gray-light
- `$brand-clickable`: $brand-primary
- `$brand-secondary`: $brand-primary

### Border Variables
- `$border-color`: rgba(255, 255, 255, 0.1)
- `$border-width`: 1px

### Bootstrap Panel Variables (from bootstrap/_variables.scss)
- `$panel-body-padding`: 15px
- `$panel-border-radius`: $border-radius-base (4px)
- `$panel-default-border`: #ddd

Extensions should import the necessary variables files to access these values and ensure consistent styling across the application.

## Implementation Plan

### Phase 1: Immediate Fix
1. Modify `collections/style.scss` to import core variables
2. Modify `titlebar-launcher/titlebar-launcher.scss` to import core variables
3. Modify `issue-tracker/src/issue_tracker.scss` to import core variables
4. Test compilation to verify fixes

### Phase 2: Systematic Solution
1. Update extension build processes to handle variable dependencies
2. Enhance StyleManager for better extension SCSS compilation
3. Document the approach for future extension developers
4. Create a linting rule to detect undefined variables in extension SCSS files

## Detailed Implementation

### Collections Extension Fix
In `extensions/collections/style.scss`, add at the top of the file:
```scss
@import '../../src/stylesheets/variables.scss';

// Existing content continues here...
```
This will make available all the core variables including:
- `$half-gutter`
- `$gutter-width`
- `$panel-body-padding`
- `$panel-border-radius`
- `$panel-default-border`
- `$border-width`
- `$border-color`
- `$gray-lighter`
- `$brand-danger-lighter`
- `$brand-success-lighter`
- And all other variables defined in the core variables.scss file

Additionally, the collections SCSS file references Bootstrap panel variables which are defined in `src/stylesheets/bootstrap/bootstrap/_variables.scss`:
- `$panel-body-padding` (value: 15px)
- `$panel-border-radius` (value: $border-radius-base)
- `$panel-default-border` (value: #ddd)

### Titlebar Launcher Extension Fix
In `extensions/titlebar-launcher/titlebar-launcher.scss`, add at the top of the file:
```scss
@import '../../src/stylesheets/variables.scss';

// Existing content continues here...
```
This will make available all the core variables including:
- `$half-gutter`
- `$brand-menu`
- `$border-width`
- `$border-color`
- And all other variables defined in the core variables.scss file

### Issue Tracker Extension Fix
In `extensions/issue-tracker/src/issue_tracker.scss`, add at the top of the file:
```scss
@import '../../../src/stylesheets/variables.scss';

// Existing content continues here...
```
This will make available all the core variables including:
- `$half-gutter`
- `$gutter-width`
- `$border-width`
- `$border-color`
- `$table-bg-active`
- And all other variables defined in the core variables.scss file

## Alternative Approaches

### Approach 1: Build-Time Variable Injection
Modify the build process to automatically prepend variable imports to extension SCSS files during the build process.

### Approach 2: StyleManager Preprocessing
Enhance the StyleManager to automatically prepend core variables to extension SCSS content before compilation.

### Approach 3: Shared Variables Package
Create a shared package that extensions can import to access core variables, making the dependency explicit.

### Approach 4: Extension Template Standardization
Create a standardized extension template that includes the proper variable imports, ensuring all new extensions have the correct setup from the beginning.

## Recommended Solution

The recommended approach is to modify the extension SCSS files to explicitly import the core variables file. This approach:
1. Makes dependencies explicit and clear
2. Follows standard SCSS practices
3. Is the most straightforward to implement
4. Provides immediate resolution to the compilation errors
5. Ensures all necessary variables (including Bootstrap panel variables) are available to extensions
6. Maintains consistency across all extension stylesheets

## Testing Strategy

1. Compile all extensions with modified SCSS files
2. Verify that no undefined variable errors occur
3. Test the visual appearance of affected UI components
4. Ensure no regression in existing functionality

## Rollout Plan

1. Implement fixes in development branch
2. Test with sample extensions
3. Verify compilation success
4. Merge to main branch
5. Update extension documentation with best practices

## Future Considerations

1. Establish coding standards for extension SCSS development
2. Create a linting rule to detect undefined variables in extension SCSS files
3. Develop a shared SCSS library for common extension styling patterns
4. Implement automated testing for extension SCSS compilation
5. Create comprehensive documentation for extension developers on SCSS best practices
6. Implement a style guide for consistent UI/UX across all extensions
7. Develop a mechanism for versioning SCSS variables to ensure backward compatibility