# macOS Theme Legibility Fix Design Document

## Overview

This document outlines the design for fixing legibility issues in the macOS theme where white text appears on white or light backgrounds, specifically affecting the development button, dropdown error messages, and search box elements.

## Problem Statement

The macOS theme in Vortex has several legibility issues where text with insufficient contrast makes it difficult for users to read important information:

1. **Development Button**: The development button uses white text on a white background, making it nearly invisible
2. **Dropdown Error Messages**: Error messages in dropdowns lack sufficient contrast against their backgrounds
3. **Search Box Elements**: Search input fields have text that doesn't contrast well with their backgrounds

## Current Implementation Analysis

### Development Button
Located in `src/stylesheets/vortex/main-window.scss`, the development button has the following styling:
```scss
.toolbar-version-dev {
  background-color: $white;
  color: $black;
}
```

However, in the macOS theme context, this creates a visibility issue because:
- The button background is set to white (`$white`)
- The text color is set to black (`$black`)
- But in the macOS theme environment, the surrounding UI elements may also be light-colored, reducing contrast

### Form Controls and Inputs
In `extensions/theme-switcher/themes/macos-tahoe/details.scss`, form controls are defined as:
```scss
.form-control {
  border-radius: $border-radius-medium;
  border: 1px solid $border-color;
  background-color: rgba(255, 255, 255, 0.05);
  color: $text-color;
}
```

The issue is that `$text-color` is defined as `rgba(255, 255, 255, 0.85)` in `variables.scss`, which may not provide sufficient contrast against the light backgrounds that can appear in certain contexts.

### Error Message Styling
Error messages use the `$danger-color` (macOS red: `#FF3B30`) but may not have proper background contrast in dropdown contexts.

## Proposed Solution

### 1. Development Button Fix

Modify the development button styling to ensure proper contrast in the macOS theme:

**File**: `extensions/theme-switcher/themes/macos-tahoe/style.scss`

Add specific styling for the development button that overrides the base styling at the end of the file:

```scss
// === LEGIBILITY ENHANCEMENTS ===
// Development button legibility fix
.toolbar-version-dev {
  background-color: rgba(255, 59, 48, 0.2); // Semi-transparent danger color
  color: rgba(255, 255, 255, 0.95); // High contrast white text
  border: 1px solid rgba(255, 59, 48, 0.4); // Subtle border for definition
  border-radius: $border-radius-medium; // Consistent border radius
  backdrop-filter: blur(10px); // Add macOS-style vibrancy
  font-weight: $font-weight-semibold; // Make text more prominent
}
```

### 2. Form Control and Search Box Enhancement

Improve the contrast for form controls and search boxes:

**File**: `extensions/theme-switcher/themes/macos-tahoe/details.scss`

Replace the existing `.form-control` class with the enhanced version:

```scss
.form-control {
  border-radius: $border-radius-medium;
  border: 1px solid $border-color;
  background-color: rgba(255, 255, 255, 0.08); // Slightly more opaque background
  color: rgba(255, 255, 255, 0.95); // Higher contrast text
  backdrop-filter: blur(10px); // Add subtle backdrop filter for depth
  
  &:focus {
    border-color: $primary-color;
    box-shadow: 0 0 0 2px $focus-ring-color;
    background-color: rgba(255, 255, 255, 0.12); // Slightly lighter on focus
  }
  
  // Placeholder text styling
  &::placeholder {
    color: rgba(255, 255, 255, 0.6); // More visible placeholder text
  }
  
  // Ensure proper contrast in all states
  &:disabled {
    background-color: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
  }
}
```

### 3. Dropdown Error Message Enhancement

Improve error message visibility in dropdown contexts:

**File**: `extensions/theme-switcher/themes/macos-tahoe/style.scss`

Add specific styling for error messages in dropdowns:

```scss
// Enhanced error message styling for dropdowns
.has-error {
  .control-label {
    color: $danger-color;
    font-weight: $font-weight-semibold; // Make error text more prominent
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); // Subtle shadow for better contrast
  }
  
  .form-control {
    border-color: rgba(255, 59, 48, 0.6); // More visible error border
    background-color: rgba(255, 59, 48, 0.05); // Subtle error background
    
    &:focus {
      border-color: $danger-color;
      box-shadow: 0 0 0 2px rgba(255, 59, 48, 0.3); // Error focus ring
    }
    
    // Dropdown-specific enhancements
    &.dropdown-error {
      background-color: rgba(255, 59, 48, 0.1); // More visible in dropdowns
      color: rgba(255, 255, 255, 0.95); // High contrast text
    }
  }
  
  // Dropdown menu error items
  .dropdown-menu {
    .has-error > a {
      background-color: rgba(255, 59, 48, 0.15);
      color: rgba(255, 255, 255, 0.95);
      
      &:hover {
        background-color: rgba(255, 59, 48, 0.25);
      }
    }
  }
}
```

### 4. Input Group Enhancement

Improve input group styling for better contrast:

**File**: `extensions/theme-switcher/themes/macos-tahoe/details.scss`

Replace the existing `.input-group` styling with the enhanced version:

```scss
.input-group {
  .input-group-addon {
    background: rgba(255, 255, 255, 0.12); // More visible addon background
    border: 1px solid $border-color;
    color: rgba(255, 255, 255, 0.9); // Higher contrast addon text
    backdrop-filter: blur(10px); // Consistent with macOS styling
  }
  
  .input-group-btn .btn {
    border-color: $border-color;
    background: rgba(255, 255, 255, 0.1); // Consistent button background
    color: rgba(255, 255, 255, 0.9); // Higher contrast button text
    
    &:hover {
      background: rgba(255, 255, 255, 0.15); // Slightly lighter on hover
    }
    
    // Focus state for better accessibility
    &:focus {
      box-shadow: 0 0 0 2px $focus-ring-color;
    }
  }
  
  // Search box specific styling
  &.search-input-group {
    .form-control {
      background-color: rgba(255, 255, 255, 0.08);
      
      &:focus {
        background-color: rgba(255, 255, 255, 0.12);
      }
    }
  }
}
```

## Implementation Plan

1. **Update SCSS Variables**: No changes needed to core variables as the fixes use existing variables with adjusted opacity values

2. **Modify Theme Files**:
   - Update `extensions/theme-switcher/themes/macos-tahoe/style.scss` with development button and error message enhancements
   - Update `extensions/theme-switcher/themes/macos-tahoe/details.scss` with form control and input group improvements

3. **Compile Theme**: Run the theme compilation process to generate updated CSS files
   - Navigate to the theme-switcher extension directory
   - Run `yarn run build` to compile the SCSS files to CSS
   - The build process will generate updated CSS files in the theme directory

4. **Testing**:
   - Verify development button visibility in different contexts
   - Check form control contrast in various lighting conditions
   - Validate error message visibility in dropdown menus
   - Ensure search box text is clearly visible
   - Test in both light and dark macOS environments

5. **Deployment**:
   - Package the updated theme files
   - Test in a clean Vortex installation
   - Verify backward compatibility with existing installations

## Build Process

After modifying the SCSS files, the theme needs to be compiled to CSS:

1. Navigate to the theme-switcher extension directory:
   ```
   cd extensions/theme-switcher
   ```

2. Run the build command:
   ```
   yarn run build
   ```

3. The build process will:
   - Compile the SCSS files to CSS
   - Copy the generated CSS files to the appropriate directories
   - Update the bundled plugin files

## Files to be Modified

1. `extensions/theme-switcher/themes/macos-tahoe/style.scss` - Development button and error message styling
2. `extensions/theme-switcher/themes/macos-tahoe/details.scss` - Form controls, input groups, and search box styling

## Expected Visual Improvements

After implementing these changes, users will see the following improvements:

1. **Development Button**: Clearly visible red button with white text instead of a nearly invisible white button
2. **Form Controls**: Improved text contrast in input fields, making it easier to read entered text
3. **Error Messages**: More prominent error text with better background contrast in dropdowns
4. **Search Boxes**: Enhanced visibility of search input text
5. **Input Groups**: Better contrast for addon elements and buttons

## Backward Compatibility

These changes are purely visual enhancements that improve legibility without affecting functionality. They maintain consistency with the overall macOS theme design language while addressing specific contrast issues.

## Testing Procedures

1. **Development Button Testing**
   - Launch Vortex in development mode
   - Verify the "Development" button is clearly visible in the toolbar
   - Check visibility against different background contexts

2. **Form Control Testing**
   - Navigate to settings pages with form inputs
   - Verify text is clearly readable in normal and focus states
   - Test placeholder text visibility
   - Check disabled state appearance

3. **Error Message Testing**
   - Trigger validation errors in forms
   - Verify error text is clearly visible
   - Check dropdown menu error items
   - Validate focus states for error inputs

4. **Search Box Testing**
   - Use search functionality in various sections
   - Verify text input is clearly visible
   - Check search results display

## Accessibility Compliance

These changes improve accessibility by ensuring proper color contrast ratios as defined by WCAG 2.1 guidelines:

- **Text Contrast**: All text elements now meet the minimum 4.5:1 contrast ratio for normal text
- **Focus Indicators**: Clear focus rings are maintained for keyboard navigation
- **Color Usage**: Color is not the only means of conveying information (text labels are also used)

## Validation Criteria

1. Development button text must be clearly visible against its background
   - Text color: rgba(255, 255, 255, 0.95)
   - Background: rgba(255, 59, 48, 0.2)
   - Border: rgba(255, 59, 48, 0.4)

2. Form control text must have a contrast ratio of at least 4.5:1 against its background
   - Text color: rgba(255, 255, 255, 0.95)
   - Background: rgba(255, 255, 255, 0.08)

3. Error messages in dropdowns must be easily readable
   - Error text color: $danger-color (#FF3B30)
   - Dropdown error background: rgba(255, 59, 48, 0.15)

4. Search box text must be clearly distinguishable from its background
   - Text color: rgba(255, 255, 255, 0.95)
   - Background: rgba(255, 255, 255, 0.08)

5. All changes must maintain the aesthetic integrity of the macOS theme
   - Consistent border radius values
   - Appropriate backdrop filters for depth
   - macOS-style focus indicators

