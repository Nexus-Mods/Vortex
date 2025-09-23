# macOS Accessibility Enhancements for Vortex

## Overview
This document describes the implementation of accessibility enhancements for macOS in Vortex, improving the experience for users with assistive technologies and special needs.

## Implementation Details

### 1. Main Process Integration (main.ts)
- Added systemPreferences import from Electron for macOS accessibility features
- Implemented accessibility support detection and monitoring:
  - Subscribed to AXManualAccessibility notifications
  - Checked if accessibility support is currently enabled
- Enhanced the application menu with accessibility options:
  - Added "Enable Accessibility Features" checkbox that toggles Electron's accessibility support
  - Added "Increase Contrast" checkbox for high contrast mode
- Integrated with existing Touch Bar and dock menu implementations

### 2. Application Class Enhancements (Application.ts)
- Added `getMainWindow()` method to provide access to the main window instance for accessibility features
- Extended existing touch bar methods with proper error handling

### 3. Renderer Process Integration (renderer.tsx)
- Added IPC event listener for high contrast toggle:
  - Toggles a CSS class on the body element for styling
  - Emits events that can be handled by application components
- Integrated with existing touch bar event handlers

### 4. UI Component Integration (MainWindow.tsx)
- Added event handler for high contrast toggle:
  - Updates the DOM with appropriate CSS classes
  - Forces re-render to apply new styling
- Extended existing touch bar event handlers

## Features
1. **Automatic Accessibility Detection** - Vortex automatically enables accessibility features when VoiceOver or other assistive technologies are detected
2. **Manual Accessibility Toggle** - Users can manually enable accessibility features through the View menu
3. **High Contrast Mode** - Users can toggle high contrast mode for better visibility
4. **System Integration** - Properly integrates with macOS accessibility APIs and notifications

## Technical Notes
- Accessibility support is only enabled on macOS platforms
- Implementation gracefully handles cases where accessibility APIs are not available
- All accessibility interactions are properly integrated with the existing Vortex event system
- Error handling is implemented to prevent crashes if accessibility initialization fails
- High contrast mode uses CSS classes for styling, making it easy to customize

## Testing
The implementation has been tested for:
- Proper accessibility detection on macOS
- Correct event handling for all accessibility features
- Graceful degradation on systems without accessibility support
- Integration with existing Vortex functionality
- High contrast mode styling

## Future Enhancements
Potential future enhancements could include:
- Additional accessibility options in the menu (font size, color themes, etc.)
- Better integration with specific assistive technologies
- Keyboard navigation improvements
- Screen reader optimizations
- Customizable accessibility profiles