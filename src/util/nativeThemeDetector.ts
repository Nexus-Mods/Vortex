import { nativeTheme } from 'electron';
import { getCurrentPlatform } from './platform';
import { log } from './log';

export interface INativeThemeInfo {
  shouldUseDarkColors: boolean;
  shouldUseHighContrastColors: boolean;
  shouldUseInvertedColorScheme: boolean;
  platform: string;
  themeSource: 'system' | 'light' | 'dark';
}

export interface IPlatformThemeMapping {
  [platform: string]: {
    light: string;
    dark: string;
    highContrast?: string;
  };
}

// Default theme mappings for each platform - prioritizing macOS
const DEFAULT_PLATFORM_THEMES: IPlatformThemeMapping = {
  darwin: {
    light: 'macos-tahoe',
    dark: 'macos-tahoe'
  },
  win32: {
    light: 'default',
    dark: 'classic',
    highContrast: 'contrast'
  },
  linux: {
    light: 'default',
    dark: 'classic'
  }
};

/**
 * Detects the current native theme information from the OS
 */
export function getNativeThemeInfo(): INativeThemeInfo {
  try {
    return {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
      shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors,
      shouldUseInvertedColorScheme: nativeTheme.shouldUseInvertedColorScheme,
      platform: getCurrentPlatform(),
      themeSource: nativeTheme.themeSource
    };
  } catch (error) {
    log('warn', 'Failed to get native theme info, falling back to defaults', error);
    return {
      shouldUseDarkColors: false,
      shouldUseHighContrastColors: false,
      shouldUseInvertedColorScheme: false,
      platform: getCurrentPlatform(),
      themeSource: 'system'
    };
  }
}

/**
 * Determines the appropriate theme based on native OS theme and platform
 */
export function getRecommendedTheme(customMappings?: IPlatformThemeMapping): string {
  const themeInfo = getNativeThemeInfo();
  const mappings = customMappings || DEFAULT_PLATFORM_THEMES;
  const platformMapping = mappings[themeInfo.platform];
  
  if (!platformMapping) {
    log('warn', `No theme mapping found for platform: ${themeInfo.platform}`);
    return 'default';
  }

  // Check for high contrast first (Windows specific)
  if (themeInfo.shouldUseHighContrastColors && platformMapping.highContrast) {
    return platformMapping.highContrast;
  }

  // Return dark or light theme based on system preference
  return themeInfo.shouldUseDarkColors ? platformMapping.dark : platformMapping.light;
}

/**
 * Sets up a listener for native theme changes
 */
export function setupNativeThemeListener(callback: (themeInfo: INativeThemeInfo) => void): () => void {
  const listener = () => {
    const themeInfo = getNativeThemeInfo();
    callback(themeInfo);
  };

  try {
    nativeTheme.on('updated', listener);
    
    // Return cleanup function
    return () => {
      nativeTheme.removeListener('updated', listener);
    };
  } catch (error) {
    log('warn', 'Failed to setup native theme listener', error);
    return () => {}; // No-op cleanup
  }
}

/**
 * Forces the theme source (useful for testing or user preference override)
 */
export function setThemeSource(source: 'system' | 'light' | 'dark'): void {
  try {
    nativeTheme.themeSource = source;
  } catch (error) {
    log('warn', 'Failed to set theme source', error);
  }
}

/**
 * Gets platform-specific theme recommendations
 */
export function getPlatformThemeRecommendations(): string[] {
  const platform = getCurrentPlatform();
  const mapping = DEFAULT_PLATFORM_THEMES[platform];
  
  if (!mapping) {
    return ['default', 'compact'];
  }

  const themes = [mapping.light, mapping.dark];
  if (mapping.highContrast) {
    themes.push(mapping.highContrast);
  }
  
  return [...new Set(themes)]; // Remove duplicates
}