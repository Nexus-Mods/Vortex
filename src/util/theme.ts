export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'vortex-theme-preference';

/**
 * Get the current theme preference from localStorage
 */
export function getThemePreference(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && ['system', 'light', 'dark'].includes(stored)) {
      return stored as ThemeMode;
    }
  } catch (err) {
    // localStorage unavailable
  }
  return 'system';
}

/**
 * Set theme preference and persist to localStorage
 */
export function setThemePreference(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (err) {
    // Ignore storage errors
  }
}

/**
 * Apply theme classes to document and sync with Electron if available
 */
export function applyTheme(mode: ThemeMode): void {
  const html = document.documentElement;

  // Remove existing theme classes
  html.classList.remove('dark');

  if (mode === 'dark') {
    html.classList.add('dark');
  } else if (mode === 'light') {
    // Keep it light (no dark class)
  } else {
    // System mode - check user's OS preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      html.classList.add('dark');
    }
  }

  // Sync with Electron's nativeTheme if available
  syncWithElectron(mode);
}

/**
 * Sync theme with Electron's nativeTheme API
 */
function syncWithElectron(mode: ThemeMode): void {
  try {
    // Try to access Electron's nativeTheme
    const electron = (window as any).require?.('electron');
    if (electron?.nativeTheme) {
      electron.nativeTheme.themeSource = mode;
    }
  } catch (err) {
    // Electron API not available - this is fine for web contexts
  }
}

/**
 * Initialize theme system on app startup
 */
export function initializeTheme(): void {
  const preference = getThemePreference();
  applyTheme(preference);

  // Listen to system theme changes when in system mode
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    const currentPreference = getThemePreference();
    if (currentPreference === 'system') {
      applyTheme('system');
    }
  };

  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  } else {
    // Fallback for older browsers
    mediaQuery.addListener(handleSystemThemeChange);
  }

  // Listen to Electron theme changes if available
  try {
    const electron = (window as any).require?.('electron');
    if (electron?.nativeTheme) {
      electron.nativeTheme.on('updated', () => {
        const currentPreference = getThemePreference();
        if (currentPreference === 'system') {
          applyTheme('system');
        }
      });
    }
  } catch (err) {
    // Electron API not available
  }
}

/**
 * Get the effective theme (what's actually being displayed)
 */
export function getEffectiveTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Check if system prefers dark mode
 */
export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}