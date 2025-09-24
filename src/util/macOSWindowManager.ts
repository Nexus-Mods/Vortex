import { BrowserWindow, nativeTheme } from 'electron';
import { log } from './log';
import { isMacOS } from './platform';

export interface IWindowOptions {
  vibrancy?: 'appearance-based' | 'light' | 'dark' | 'titlebar' | 'selection' | 'menu' | 'popover' | 'sidebar' | 'medium-light' | 'ultra-dark';
  titleBarStyle?: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover';
  trafficLightPosition?: { x: number; y: number };
  fullscreenWindowTitle?: boolean;
  enableLargerThanScreen?: boolean;
  hasShadow?: boolean;
  opacity?: number;
}

export class MacOSWindowManager {
  private windows: Map<number, BrowserWindow> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    // Empty constructor
  }

  /**
   * Initialize the macOS window manager
   */
  public initialize(): void {
    if (!isMacOS()) {
      log('debug', 'MacOSWindowManager: Not on macOS, skipping initialization');
      return;
    }

    if (this.isInitialized) {
      log('warn', 'MacOSWindowManager already initialized');
      return;
    }

    try {
      this.setupThemeListener();
      this.isInitialized = true;
      log('info', 'MacOSWindowManager initialized successfully');
    } catch (error) {
      log('error', 'Failed to initialize MacOSWindowManager', error);
    }
  }

  /**
   * Configure a window with macOS-specific enhancements
   */
  public configureWindow(window: BrowserWindow, options: IWindowOptions = {}): void {
    if (!isMacOS() || !window) {
      return;
    }

    try {
      const windowId = window.id;
      this.windows.set(windowId, window);

      // Apply vibrancy effect
      if (options.vibrancy) {
        this.setVibrancy(window, options.vibrancy);
      } else {
        // Default vibrancy based on system theme
        const defaultVibrancy = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
        this.setVibrancy(window, defaultVibrancy);
      }

      // Configure title bar style
      if (options.titleBarStyle) {
        this.setTitleBarStyle(window, options.titleBarStyle);
      }

      // Set traffic light position
      if (options.trafficLightPosition) {
        this.setTrafficLightPosition(window, options.trafficLightPosition);
      } else {
        // Default position for better visual alignment
        this.setTrafficLightPosition(window, { x: 20, y: 20 });
      }

      // Configure fullscreen behavior
      if (options.fullscreenWindowTitle !== undefined) {
        window.setFullScreenable(true);
      }

      // Enable larger than screen if specified
      if (options.enableLargerThanScreen) {
        window.setResizable(true);
      }

      // Set shadow
      if (options.hasShadow !== undefined) {
        window.setHasShadow(options.hasShadow);
      }

      // Set opacity
      if (options.opacity !== undefined) {
        window.setOpacity(options.opacity);
      }

      // Setup window event listeners
      this.setupWindowEventListeners(window);

      log('debug', 'Window configured with macOS enhancements', { windowId, options });
    } catch (error) {
      log('error', 'Failed to configure window', error);
    }
  }

  /**
   * Set vibrancy effect for a window
   */
  public setVibrancy(window: BrowserWindow, vibrancy: IWindowOptions['vibrancy']): void {
    if (!isMacOS() || !window) {
      return;
    }

    try {
      (window as any).setVibrancy(vibrancy);
      log('debug', 'Vibrancy set', { windowId: window.id, vibrancy });
    } catch (error) {
      log('error', 'Failed to set vibrancy', error);
    }
  }

  /**
   * Set title bar style
   */
  public setTitleBarStyle(window: BrowserWindow, style: IWindowOptions['titleBarStyle']): void {
    if (!isMacOS() || !window) {
      return;
    }

    try {
      // Note: Title bar style is typically set during window creation
      // This method is for reference and future enhancements
      log('debug', 'Title bar style configured', { windowId: window.id, style });
    } catch (error) {
      log('error', 'Failed to set title bar style', error);
    }
  }

  /**
   * Set traffic light position
   */
  public setTrafficLightPosition(window: BrowserWindow, position: { x: number; y: number }): void {
    if (!isMacOS() || !window) {
      return;
    }

    try {
      (window as any).setWindowButtonPosition(position);
      log('debug', 'Traffic light position set', { windowId: window.id, position });
    } catch (error) {
      log('debug', 'Traffic light position not supported in this Electron version');
    }
  }

  /**
   * Setup theme change listener
   */
  private setupThemeListener(): void {
    nativeTheme.on('updated', () => {
      this.updateAllWindowsForTheme();
    });
  }

  /**
   * Update all windows when theme changes
   */
  private updateAllWindowsForTheme(): void {
    const isDark = nativeTheme.shouldUseDarkColors;
    const vibrancy = isDark ? 'dark' : 'light';

    this.windows.forEach((window, windowId) => {
      if (window && !window.isDestroyed()) {
        this.setVibrancy(window, vibrancy);
        log('debug', 'Window updated for theme change', { windowId, vibrancy });
      } else {
        // Clean up destroyed windows
        this.windows.delete(windowId);
      }
    });
  }

  /**
   * Setup window event listeners
   */
  private setupWindowEventListeners(window: BrowserWindow): void {
    // Handle window close
    window.on('closed', () => {
      this.windows.delete(window.id);
      log('debug', 'Window removed from manager', { windowId: window.id });
    });

    // Handle enter/leave fullscreen
    window.on('enter-full-screen', () => {
      log('debug', 'Window entered fullscreen', { windowId: window.id });
    });

    window.on('leave-full-screen', () => {
      log('debug', 'Window left fullscreen', { windowId: window.id });
    });

    // Handle window focus changes
    window.on('focus', () => {
      log('debug', 'Window focused', { windowId: window.id });
    });

    window.on('blur', () => {
      log('debug', 'Window blurred', { windowId: window.id });
    });
  }

  /**
   * Enable split view support for a window
   */
  public enableSplitView(window: BrowserWindow): void {
    if (!isMacOS() || !window) {
      return;
    }

    try {
      // Enable split view by setting appropriate window properties
      window.setResizable(true);
      window.setMaximizable(true);
      window.setFullScreenable(true);
      
      log('debug', 'Split view enabled for window', { windowId: window.id });
    } catch (error) {
      log('error', 'Failed to enable split view', error);
    }
  }

  /**
   * Configure window for better macOS integration
   */
  public optimizeForMacOS(window: BrowserWindow): void {
    if (!isMacOS() || !window) {
      return;
    }

    const options: IWindowOptions = {
      vibrancy: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 20, y: 20 },
      fullscreenWindowTitle: true,
      enableLargerThanScreen: false,
      hasShadow: true,
      opacity: 1.0
    };

    this.configureWindow(window, options);
    this.enableSplitView(window);
  }

  /**
   * Get all managed windows
   */
  public getManagedWindows(): BrowserWindow[] {
    return Array.from(this.windows.values()).filter(window => !window.isDestroyed());
  }

  /**
   * Clean up destroyed windows
   */
  public cleanup(): void {
    this.windows.forEach((window, windowId) => {
      if (window.isDestroyed()) {
        this.windows.delete(windowId);
      }
    });
  }
}

export default MacOSWindowManager;