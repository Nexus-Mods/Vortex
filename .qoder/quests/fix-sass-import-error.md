# Fix SASS Import Error for Meta-Editor Extension

## Overview

This document outlines the solution to fix SASS compilation errors occurring during the build process of the Vortex application. The error is specifically related to the meta-editor extension, which is failing to compile its SCSS stylesheet due to missing variable imports.

## Problem Description

When running `yarn start`, the application fails to compile SASS stylesheets with the following error:

```
Error: Can't find stylesheet to import.
  ╷
1 │ @import '../../../../src/stylesheets/variables.scss';
  │         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  ╵
  out/bundledPlugins/meta-editor/metaeditor.scss 1:9  @import
```

The error indicates that the meta-editor extension's stylesheet is trying to import variables from a path that doesn't exist in the bundled plugin structure.

## Root Cause Analysis

After analyzing the codebase, the issue is identified as:

1. The meta-editor extension's SCSS file (`metaeditor.scss`) contains an import statement that references a path that doesn't exist in the bundled plugin structure
2. The bundled plugin directory structure differs from the source directory structure, causing path resolution issues
3. The build process copies the SCSS file to the bundled plugin directory but doesn't adjust the import paths accordingly

## Solution Approach

The solution involves updating the meta-editor extension's stylesheet to use the correct import paths that work in the bundled plugin environment. Based on the patterns used in other extensions that have been successfully fixed, we need to:

1. Update the import path in `metaeditor.scss` to correctly reference the core stylesheets
2. Ensure all required variables and mixins are imported for successful compilation

## Detailed Fix Implementation

### 1. Update Meta-Editor SCSS File

Modify the `extensions/meta-editor/src/stylesheets/metaeditor.scss` file to use the correct import paths:

```scss
@import '../../../src/stylesheets/variables.scss';
@import '../../../src/stylesheets/details.scss';

.rule-actions>.btn {
  padding: 1px 5px;
  border: 0px;
  color: currentColor;
  background-color: transparent;
}

.rule-actions>.btn:hover {
  background-color: $gray;
}
```

The file to modify is located at:
`/Users/veland/Downloads/vortex/extensions/meta-editor/src/stylesheets/metaeditor.scss`

Current incorrect content:
```scss
@import '../../../../src/stylesheets/variables.scss';

.rule-actions>.btn {
  padding: 1px 5px;
  border: 0px;
  color: currentColor;
  background-color: transparent;
}

.rule-actions>.btn:hover {
  background-color: $gray;
}
```

Corrected content should be:
```scss
@import '../../../src/stylesheets/variables.scss';
@import '../../../src/stylesheets/details.scss';

.rule-actions>.btn {
  padding: 1px 5px;
  border: 0px;
  color: currentColor;
  background-color: transparent;
}

.rule-actions>.btn:hover {
  background-color: $gray;
}
```

### 2. Path Explanation

The updated import paths:
- `../../../src/stylesheets/variables.scss` - Points to the variables stylesheet from the meta-editor extension's perspective
- `../../../src/stylesheets/details.scss` - Provides additional UI component variables that may be needed

This path structure accounts for:
- The extension's SCSS file location: `extensions/meta-editor/src/stylesheets/`
- The relative path to the core stylesheets: `../../../src/stylesheets/`

### 3. Why This Fix Works

1. **Consistent with Other Extensions**: This approach follows the same pattern used in other extensions like documentation and collections that have been successfully fixed
2. **Correct Relative Pathing**: The path correctly navigates from the extension's SCSS directory to the core stylesheets
3. **Complete Dependency Inclusion**: Both variables and details stylesheets are imported to ensure all required dependencies are available

## Testing Strategy

### 1. Unit Testing

- Verify that the meta-editor SCSS file compiles without errors
- Confirm that all required variables are properly resolved
- Test that the compiled CSS produces the expected output

### 2. Integration Testing

- Run the complete build process to ensure no SASS compilation errors occur
- Verify that the meta-editor extension functions correctly in the application
- Confirm that the UI styling appears as expected

### 3. Validation Script

Use the existing SASS validation scripts to test the fix:

```bash
node test-all-extensions-sass.js
```

## Implementation Instructions

Since automated file modification tools are restricted, you'll need to manually apply this fix:

1. Open the file `/Users/veland/Downloads/vortex/extensions/meta-editor/src/stylesheets/metaeditor.scss`
2. Replace the incorrect import statement:
   ```scss
   @import '../../../../src/stylesheets/variables.scss';
   ```
   
   With the correct import statements:
   ```scss
   @import '../../../src/stylesheets/variables.scss';
   @import '../../../src/stylesheets/details.scss';
   ```

## Expected Outcomes

After implementing this fix:

1. The SASS compilation error for the meta-editor extension will be resolved
2. The `yarn start` command will complete successfully without SASS-related errors
3. The meta-editor extension will display properly with correct styling
4. All other extensions will continue to function as expected

## Rollback Plan

If issues arise from this change:

1. Revert the changes to `metaeditor.scss`
2. Restore the previous import statement
3. Investigate alternative path structures if needed

## Related Work

This fix is part of a broader effort to resolve SASS compilation issues across all Vortex extensions. Similar fixes have been implemented for:
- Documentation extension
- Collections extension
- Issue tracker extension
- And 18 other extensions

These fixes follow a consistent pattern of ensuring proper import paths and including all necessary dependencies.