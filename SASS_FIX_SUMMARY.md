# SASS Compilation Error Fixes

## Overview
This document summarizes the changes made to fix SASS compilation errors in the Vortex extensions that were caused by undefined variables.

## Issues Fixed

### 1. Documentation Extension
**Error**: `Undefined variable: $popover-title-bg`
**File**: `extensions/documentation/src/stylesheets/documentation.scss`

**Fix**: Added imports for core stylesheets at the top of the file:
```scss
@import "../../../src/stylesheets/variables.scss";
@import "../../../src/stylesheets/details.scss";
```

### 2. Collections Extension
**Error**: `Undefined variable: $half-gutter`
**File**: `extensions/collections/style.scss`

**Fix**: Updated imports to include all necessary core stylesheets:
```scss
@import '../../src/stylesheets/variables.scss';
@import '../../src/stylesheets/details.scss';
@import '../../src/stylesheets/style.scss';
@import '../../src/stylesheets/bootstrap/bootstrap/variables';
@import '../../src/stylesheets/bootstrap/bootstrap/mixins';
@import '../../src/stylesheets/bootstrap/bootstrap/type';
```

### 3. Issue Tracker Extension
**Error**: `Undefined variable: $table-bg-active`
**File**: `extensions/issue-tracker/src/issue_tracker.scss`

**Fix**: Added imports for core stylesheets at the top of the file:
```scss
@import '../../../src/stylesheets/variables.scss';
@import '../../../src/stylesheets/details.scss';
@import '../../../src/stylesheets/style.scss';
```

## Root Cause
The SASS compilation errors occurred because extension stylesheets were referencing variables and mixins that were not in scope. Extension stylesheets are compiled separately from core stylesheets, so they need to explicitly import any core dependencies they use.

## Solution Approach
The solution involved updating the extension stylesheets to explicitly import the core stylesheets that contain the required variables and mixins:

1. **Variables**: Import `variables.scss` for basic SASS variables like `$half-gutter`
2. **Details**: Import `details.scss` for UI component variables like `$popover-title-bg` and `$table-bg-active`
3. **Styles**: Import `style.scss` for additional component definitions like `.btn-embed`
4. **Bootstrap**: Import necessary Bootstrap components for mixins and type definitions

## Testing
All extensions now compile successfully with no errors. There are some deprecation warnings about division operations, but these don't prevent compilation and can be addressed separately.

## Validation
Test scripts were created and run to verify that all extensions compile successfully:
- Documentation extension: ✓ Compiles successfully (1102 bytes CSS output)
- Collections extension: ✓ Compiles successfully (187675 bytes CSS output)
- Issue-tracker extension: ✓ Compiles successfully (153035 bytes CSS output)