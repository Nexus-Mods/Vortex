import { IExtensionApi } from '../types/IExtensionContext';
import { IState } from '../types/IState';
import { getNativeThemeInfo, getRecommendedTheme, setupNativeThemeListener, IPlatformThemeMapping } from './nativeThemeDetector';
import { log } from './log';
import { getCurrentPlatform, isMacOS } from './platform';

export interface INativeThemeManagerOptions {
  autoApplyOnStartup?: boolean;
  followSystemChanges?: boolean;
  customPlatformMappings?: IPlatformThemeMapping;
  fallbackTheme?: string;
  // macOS-specific options
  enableMacOSVibrancy?: boolean;
  enableMacOSTitlebarTheming?: boolean;
}

export class NativeThemeManager {
  private api: IExtensionApi;
  private options: INativeThemeManagerOptions;
  private cleanupListener?: () => void;
  private isInitialized: boolean = false;
  private lastAppliedTheme: string = '';

  constructor(api: IExtensionApi, options: INativeThemeManagerOptions = {}) {
    this.api = api;
    this.options = {
      autoApplyOnStartup: true,
      followSystemChanges: true,
      fallbackTheme: 'default',
      enableMacOSVibrancy: true,
      enableMacOSTitlebarTheming: true,
      ...options
    };
  }

  /**
   * Initialize the native theme manager
   */
  public initialize(): void {
    if (this.isInitialized) {
      log('warn', 'NativeThemeManager already initialized');
      return;
    }

    try {
      // Apply theme on startup if enabled
      if (this.options.autoApplyOnStartup) {
        this.applyNativeTheme();
      }

      // Set up system theme change listener if enabled
      if (this.options.followSystemChanges) {
        this.setupThemeChangeListener();
      }

      // macOS-specific enhancements
      if (isMacOS()) {
        this.setupMacOSEnhancements();
      }

      this.isInitialized = true;
      log('info', 'NativeThemeManager initialized successfully', {
        platform: getCurrentPlatform(),
        autoApply: this.options.autoApplyOnStartup,
        followChanges: this.options.followSystemChanges,
        macOSVibrancy: this.options.enableMacOSVibrancy,
        macOSTitlebarTheming: this.options.enableMacOSTitlebarTheming
      });
    } catch (error) {
      log('error', 'Failed to initialize NativeThemeManager', error);
    }
  }

  /**
   * Apply the recommended native theme based on current OS settings
   */
  public applyNativeTheme(): void {
    try {
      log('debug', 'applyNativeTheme() starting', {
        isInitialized: this.isInitialized,
        options: this.options
      });
      
      const recommendedTheme = getRecommendedTheme(this.options.customPlatformMappings);
      const currentTheme = this.getCurrentTheme();

      log('debug', 'Theme comparison', {
        recommendedTheme,
        currentTheme,
        areEqual: currentTheme === recommendedTheme,
        platform: getCurrentPlatform()
      });

      if (currentTheme !== recommendedTheme) {
        log('info', 'Applying native theme', {
          from: currentTheme,
          to: recommendedTheme,
          platform: getCurrentPlatform()
        });

        this.setTheme(recommendedTheme);
        this.lastAppliedTheme = recommendedTheme;
      } else {
        log('debug', 'Native theme already applied', { theme: currentTheme });
      }
      
      // Apply macOS-specific visual enhancements
      if (isMacOS() && this.options.enableMacOSVibrancy) {
        this.applyMacOSVibrancy(recommendedTheme);
      }
    } catch (error) {
      log('error', 'Failed to apply native theme', error);
      
      // Fallback to default theme
      if (this.options.fallbackTheme) {
        log('warn', 'Applying fallback theme', { fallbackTheme: this.options.fallbackTheme });
        this.setTheme(this.options.fallbackTheme);
      }
    }
  }

  /**
   * Get the current theme from the store
   */
  private getCurrentTheme(): string {
    const state = this.api.getState();
    const currentTheme = (state.settings?.interface as any)?.currentTheme || this.options.fallbackTheme || 'default';
    
    log('debug', 'getCurrentTheme() called', {
      stateExists: !!state,
      settingsExists: !!state?.settings,
      interfaceExists: !!state?.settings?.interface,
      interfaceKeys: state?.settings?.interface ? Object.keys(state.settings.interface) : [],
      currentTheme,
      fallbackTheme: this.options.fallbackTheme,
      fullInterfaceObject: state?.settings?.interface
    });
    
    return currentTheme;
  }

  /**
   * Set the theme in the store
   */
  private setTheme(themeName: string): void {
    try {
      log('debug', 'setTheme() called', {
        themeName,
        storeExists: !!this.api.store,
        eventsExists: !!this.api.events
      });
      
      // Get state before dispatch
      const stateBefore = this.api.getState();
      const themeBeforeDispatch = (stateBefore.settings?.interface as any)?.currentTheme;
      
      log('debug', 'State before theme dispatch', {
        themeBeforeDispatch,
        settingsInterface: stateBefore.settings?.interface
      });
      
      this.api.store.dispatch({
        type: 'SELECT_UI_THEME',
        payload: themeName
      });
      
      // Get state after dispatch
      const stateAfter = this.api.getState();
      const themeAfterDispatch = (stateAfter.settings?.interface as any)?.currentTheme;
      
      log('debug', 'State after theme dispatch', {
        themeAfterDispatch,
        settingsInterface: stateAfter.settings?.interface,
        dispatchSuccessful: themeAfterDispatch === themeName
      });

      // Also trigger the theme-switcher extension if available
      this.api.events.emit('apply-theme', themeName);
      
      log('debug', 'Theme events emitted', {
        eventName: 'apply-theme',
        payload: themeName
      });
      
    } catch (error) {
      log('error', 'Failed to set theme', { theme: themeName, error });
    }
  }

  /**
   * Set up listener for system theme changes
   */
  private setupThemeChangeListener(): void {
    this.cleanupListener = setupNativeThemeListener((themeInfo) => {
      log('info', 'System theme changed', themeInfo);
      
      // Only auto-apply if user hasn't manually overridden
      if (this.shouldAutoApplyTheme()) {
        this.applyNativeTheme();
      }
    });
  }

  /**
   * Check if we should auto-apply theme changes
   */
  private shouldAutoApplyTheme(): boolean {
    // You could add logic here to check user preferences
    // For now, always auto-apply if followSystemChanges is enabled
    return this.options.followSystemChanges || false;
  }

  /**
   * Get current native theme information
   */
  public getNativeThemeInfo() {
    return getNativeThemeInfo();
  }

  /**
   * Get recommended theme for current platform and system settings
   */
  public getRecommendedTheme(): string {
    return getRecommendedTheme(this.options.customPlatformMappings);
  }

  /**
   * Update options after initialization
   */
  public updateOptions(newOptions: Partial<INativeThemeManagerOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    // Re-setup listener if followSystemChanges option changed
    if ('followSystemChanges' in newOptions) {
      if (this.cleanupListener) {
        this.cleanupListener();
        this.cleanupListener = undefined;
      }
      
      if (newOptions.followSystemChanges) {
        this.setupThemeChangeListener();
      }
    }
    
    // Re-apply theme if macOS options changed
    if (('enableMacOSVibrancy' in newOptions || 'enableMacOSTitlebarTheming' in newOptions) && isMacOS()) {
      this.applyNativeTheme();
    }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.cleanupListener) {
      this.cleanupListener();
      this.cleanupListener = undefined;
    }
    
    this.isInitialized = false;
    log('info', 'NativeThemeManager disposed');
  }

  /**
   * Check if a theme is available
   */
  public isThemeAvailable(themeName: string): boolean {
    try {
      // This would need to be implemented based on how themes are stored
      // For now, assume basic themes are always available
      const basicThemes = ['default', 'compact', 'contrast', 'macos-tahoe', 'classic'];
      return basicThemes.includes(themeName);
    } catch (error) {
      log('warn', 'Failed to check theme availability', { theme: themeName, error });
      return false;
    }
  }

  /**
   * Force refresh of native theme
   */
  public refresh(): void {
    if (this.isInitialized) {
      this.applyNativeTheme();
    }
  }

  /**
   * macOS-specific enhancements
   */
  private setupMacOSEnhancements(): void {
    try {
      // Set up titlebar theming
      if (this.options.enableMacOSTitlebarTheming) {
        this.setupMacOSTitlebarTheming();
      }
      
      // Set up vibrancy effects
      if (this.options.enableMacOSVibrancy) {
        this.setupMacOSVibrancy();
      }
      
      log('debug', 'macOS enhancements set up successfully');
    } catch (error) {
      log('warn', 'Failed to set up macOS enhancements', error);
    }
  }

  /**
   * Set up macOS titlebar theming
   */
  private setupMacOSTitlebarTheming(): void {
    try {
      // This would integrate with Electron's titlebar APIs
      // For now, we'll just log that it's enabled
      log('debug', 'macOS titlebar theming enabled');
    } catch (error) {
      log('warn', 'Failed to set up macOS titlebar theming', error);
    }
  }

  /**
   * Set up macOS vibrancy effects
   */
  private setupMacOSVibrancy(): void {
    try {
      // This would integrate with Electron's vibrancy APIs
      // For now, we'll just log that it's enabled
      log('debug', 'macOS vibrancy effects enabled');
    } catch (error) {
      log('warn', 'Failed to set up macOS vibrancy effects', error);
    }
  }

  /**
   * Apply macOS-specific vibrancy effects based on theme
   */
  private applyMacOSVibrancy(themeName: string): void {
    try {
      // Send event to renderer to apply vibrancy effects
      this.api.events.emit('apply-macos-vibrancy', {
        theme: themeName,
        isDark: themeName.includes('dark') || themeName.includes('tahoe'),
        vibrancyType: this.getVibrancyTypeForTheme(themeName)
      });
      
      log('debug', 'macOS vibrancy applied', { theme: themeName });
    } catch (error) {
      log('warn', 'Failed to apply macOS vibrancy', { theme: themeName, error });
    }
  }

  /**
   * Get appropriate vibrancy type for theme
   */
  private getVibrancyTypeForTheme(themeName: string): string {
    if (themeName.includes('dark') || themeName.includes('tahoe')) {
      return 'dark';
    } else if (themeName.includes('light')) {
      return 'light';
    } else {
      // Default to appearance-based vibrancy
      return 'appearance-based';
    }
  }
}

// Singleton instance for global access
let globalNativeThemeManager: NativeThemeManager | null = null;

/**
 * Get or create the global native theme manager instance
 */
export function getNativeThemeManager(api?: IExtensionApi, options?: INativeThemeManagerOptions): NativeThemeManager | null {
  if (!globalNativeThemeManager && api) {
    globalNativeThemeManager = new NativeThemeManager(api, options);
  }
  return globalNativeThemeManager;
}

/**
 * Initialize the global native theme manager
 */
export function initializeNativeThemeManager(api: IExtensionApi, options?: INativeThemeManagerOptions): NativeThemeManager {
  if (globalNativeThemeManager) {
    globalNativeThemeManager.dispose();
  }
  
  globalNativeThemeManager = new NativeThemeManager(api, options);
  globalNativeThemeManager.initialize();
  
  return globalNativeThemeManager;
}