# Platform-Specific Text Usage Guide

This document explains how to use the platform text utilities to create help text that adapts to different operating systems, particularly showing "Cmd" instead of "Ctrl" on macOS.

## Platform Text Utilities

The platform text utilities are located in `src/util/platformText.ts` and provide functions to automatically adapt text based on the current platform.

### Available Functions

1. `getPlatformText(text: string, platform?: Platform): string`
   - Simple function that replaces "Ctrl" with "Cmd" on macOS
   - Takes a string and returns a platform-appropriate version

2. `getStructuredPlatformText(options: IPlatformTextOptions, t: TFunction): string`
   - Allows for completely different text per platform
   - Falls back to automatic replacement if no platform-specific text is provided

3. `processPlatformText(text: string, t: TFunction): string`
   - Processes text with platform-specific keyboard shortcut replacements
   - Recommended for use in text files

### Usage Examples

#### Simple Text Processing
```typescript
import { processPlatformText } from '../../util/platformText';

// In a text file
case 'example-text': {
  const text = t('Press Ctrl+C to copy selected items');
  return processPlatformText(text, t);
}
```

#### Structured Platform Text
```typescript
import { getStructuredPlatformText } from '../../util/platformText';

// In a component
const platformText = getStructuredPlatformText({
  win32: 'Press Ctrl+C to copy',
  darwin: 'Press Cmd+C to copy',
  linux: 'Press Ctrl+C to copy'
}, t);
```

#### Direct Platform Text Replacement
```typescript
import { getPlatformText } from '../../util/platformText';

// In a component
const text = getPlatformText('Press Ctrl+C to copy');
```

## Best Practices

1. **Use `processPlatformText` in text files**: This is the recommended approach for text files as it integrates well with the existing translation system.

2. **Be specific with keyboard shortcuts**: Only use automatic replacement for simple cases. For complex help text, provide platform-specific versions.

3. **Test on all platforms**: Always verify that your text looks correct on all supported platforms.

4. **Consider context**: Not all instances of "Ctrl" should be replaced. Only replace it when it refers to a keyboard shortcut.

## Implementation Details

The platform detection uses the existing `src/util/platform.ts` utilities, ensuring consistency with the rest of the application.

On macOS, "Ctrl" is automatically replaced with "Cmd" in text processed by these utilities. On Windows and Linux, text remains unchanged.

## CSS Changes for Window Draggability

The window draggability on macOS is implemented through CSS changes in `src/stylesheets/vortex/main-window.scss`:

1. The `.dragbar` element is now visible on macOS even without a custom titlebar
2. The dragbar is positioned to avoid overlapping with macOS traffic lights
3. The dragbar uses `-webkit-app-region: drag` to make it draggable

These changes ensure that users can drag the window by clicking and dragging the top area on macOS, consistent with native macOS application behavior.