import { IExtensionApi } from '../types/IExtensionContext';
import { IState } from '../types/IState';
import { getNativeThemeInfo, getRecommendedTheme, setupNativeThemeListener, IPlatformThemeMapping } from './nativeThemeDetector';
import { log } from './log';
import { getCurrentPlatform } from './platform';

export interface INativeThemeManagerOptions {
  autoApplyOnStartup?: boolean;
  followSystemChanges?: boolean;
  customPlatformMappings?: IPlatformThemeMapping;
  fallbackTheme?: string;
}

export class NativeThemeManager {
  private api: IExtensionApi;
  private options: INativeThemeManagerOptions;
  private cleanupListener?: () => void;
  private isInitialized: boolean = false;

  constructor(api: IExtensionApi, options: INativeThemeManagerOptions = {}) {
    this.api = api;
    this.options = {
      autoApplyOnStartup: true,
      followSystemChanges: true,
      fallbackTheme: 'default',
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

      this.isInitialized = true;
      log('info', 'NativeThemeManager initialized successfully', {
        platform: getCurrentPlatform(),
        autoApply: this.options.autoApplyOnStartup,
        followChanges: this.options.followSystemChanges
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
      } else {
        log('debug', 'Native theme already applied', { theme: currentTheme });
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