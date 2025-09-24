import { app, Menu, MenuItem } from 'electron';
import { IExtensionApi } from '../types/IExtensionContext';
import { log } from './log';
import { isMacOS } from './platform';

export interface IDockProgress {
  progress: number; // 0.0 to 1.0
  mode?: 'normal' | 'indeterminate' | 'error' | 'paused';
}

export interface IDockBadge {
  count?: number;
  text?: string;
}

export interface IDockMenuItem {
  label?: string;
  click?: () => void;
  enabled?: boolean;
  type?: 'normal' | 'separator' | 'submenu';
  submenu?: IDockMenuItem[];
}

export class MacOSDockManager {
  private api: IExtensionApi;
  private isInitialized: boolean = false;
  private currentBadge: string = '';
  private currentProgress: number = -1;

  constructor(api: IExtensionApi) {
    this.api = api;
  }

  /**
   * Initialize the macOS Dock manager
   */
  public initialize(): void {
    if (!isMacOS()) {
      log('debug', 'MacOSDockManager: Not on macOS, skipping initialization');
      return;
    }

    if (this.isInitialized) {
      log('warn', 'MacOSDockManager already initialized');
      return;
    }

    try {
      // Set up default dock menu
      this.setupDefaultDockMenu();
      
      // Listen for download/installation events
      this.setupProgressListeners();
      
      // Listen for notification events for badge updates
      this.setupBadgeListeners();

      this.isInitialized = true;
      log('info', 'MacOSDockManager initialized successfully');
    } catch (error) {
      log('error', 'Failed to initialize MacOSDockManager', error);
    }
  }

  /**
   * Set progress indicator on dock icon
   */
  public setProgress(options: IDockProgress): void {
    if (!isMacOS() || !this.isInitialized) return;

    try {
      if (options.progress < 0) {
        // Hide progress - clear any progress indicators
        this.clearBadge();
        this.currentProgress = -1;
      } else {
        // Show progress
        const progress = Math.max(0, Math.min(1, options.progress));
        
        // Electron doesn't have built-in dock progress, so we'll use badge as fallback
        // and potentially create a custom icon with progress overlay
        if (options.mode === 'indeterminate') {
          this.setBadge({ text: '⏳' });
        } else if (options.mode === 'error') {
          this.setBadge({ text: '❌' });
        } else if (options.mode === 'paused') {
          this.setBadge({ text: '⏸️' });
        } else {
          // Normal progress - show percentage
          const percentage = Math.round(progress * 100);
          if (percentage > 0 && percentage < 100) {
            this.setBadge({ text: `${percentage}%` });
          } else if (percentage >= 100) {
            this.setBadge({ text: '✅' });
            // Clear after a delay
            setTimeout(() => this.clearBadge(), 2000);
          }
        }
        
        this.currentProgress = progress;
      }
    } catch (error) {
      log('error', 'Failed to set dock progress', error);
    }
  }

  /**
   * Set badge on dock icon
   */
  public setBadge(options: IDockBadge): void {
    if (!isMacOS() || !this.isInitialized) return;

    try {
      let badgeText = '';
      
      if (options.count !== undefined && options.count > 0) {
        badgeText = options.count > 99 ? '99+' : options.count.toString();
      } else if (options.text) {
        badgeText = options.text;
      }

      app.dock.setBadge(badgeText);
      this.currentBadge = badgeText;
      
      log('debug', 'Dock badge set', { badge: badgeText });
    } catch (error) {
      log('error', 'Failed to set dock badge', error);
    }
  }

  /**
   * Clear badge from dock icon
   */
  public clearBadge(): void {
    if (!isMacOS() || !this.isInitialized) return;

    try {
      app.dock.setBadge('');
      this.currentBadge = '';
      log('debug', 'Dock badge cleared');
    } catch (error) {
      log('error', 'Failed to clear dock badge', error);
    }
  }

  /**
   * Bounce dock icon to get attention
   */
  public bounce(type: 'critical' | 'informational' = 'informational'): number {
    if (!isMacOS() || !this.isInitialized) return -1;

    try {
      const bounceId = app.dock.bounce(type);
      log('debug', 'Dock icon bounced', { type, bounceId });
      return bounceId;
    } catch (error) {
      log('error', 'Failed to bounce dock icon', error);
      return -1;
    }
  }

  /**
   * Cancel dock icon bounce
   */
  public cancelBounce(bounceId: number): void {
    if (!isMacOS() || !this.isInitialized || bounceId < 0) return;

    try {
      app.dock.cancelBounce(bounceId);
      log('debug', 'Dock bounce cancelled', { bounceId });
    } catch (error) {
      log('error', 'Failed to cancel dock bounce', error);
    }
  }

  /**
   * Set custom dock menu
   */
  public setDockMenu(menuItems: IDockMenuItem[]): void {
    if (!isMacOS() || !this.isInitialized) return;

    try {
      const menu = this.buildMenuFromItems(menuItems);
      app.dock.setMenu(menu);
      log('debug', 'Dock menu updated', { itemCount: menuItems.length });
    } catch (error) {
      log('error', 'Failed to set dock menu', error);
    }
  }

  /**
   * Get current badge text
   */
  public getCurrentBadge(): string {
    return this.currentBadge;
  }

  /**
   * Get current progress
   */
  public getCurrentProgress(): number {
    return this.currentProgress;
  }

  /**
   * Set up default dock menu with common actions
   */
  private setupDefaultDockMenu(): void {
    const defaultMenuItems: IDockMenuItem[] = [
      {
        label: 'Quick Launch Last Game',
        click: () => this.api.events.emit('quick-launch'),
        enabled: true
      },
      {
        label: 'Check for Updates',
        click: () => this.api.events.emit('check-for-updates'),
        enabled: true
      },
      {
        type: 'separator'
      },
      {
        label: 'Show Main Window',
        click: () => this.api.events.emit('show-main-window'),
        enabled: true
      },
      {
        label: 'Open Downloads Folder',
        click: () => this.api.events.emit('open-downloads-folder'),
        enabled: true
      }
    ];

    this.setDockMenu(defaultMenuItems);
  }

  /**
   * Set up listeners for download/installation progress
   */
  private setupProgressListeners(): void {
    // Listen for download progress
    this.api.events.on('download-progress', (progress: number, total: number) => {
      if (total > 0) {
        this.setProgress({
          progress: progress / total,
          mode: 'normal'
        });
      }
    });

    // Listen for installation progress
    this.api.events.on('install-progress', (progress: number) => {
      this.setProgress({
        progress: progress,
        mode: 'normal'
      });
    });

    // Listen for download/installation completion
    this.api.events.on('download-finished', () => {
      this.setProgress({ progress: 1.0, mode: 'normal' });
      setTimeout(() => this.setProgress({ progress: -1 }), 2000);
    });

    this.api.events.on('install-finished', () => {
      this.setProgress({ progress: 1.0, mode: 'normal' });
      setTimeout(() => this.setProgress({ progress: -1 }), 2000);
    });

    // Listen for errors
    this.api.events.on('download-error', () => {
      this.setProgress({ progress: 0.5, mode: 'error' });
      setTimeout(() => this.setProgress({ progress: -1 }), 3000);
    });

    this.api.events.on('install-error', () => {
      this.setProgress({ progress: 0.5, mode: 'error' });
      setTimeout(() => this.setProgress({ progress: -1 }), 3000);
    });
  }

  /**
   * Set up listeners for badge updates
   */
  private setupBadgeListeners(): void {
    // Listen for notification count changes
    this.api.onStateChange(['session', 'notifications'], (oldState, newState) => {
      const notificationCount = Object.keys(newState || {}).length;
      if (notificationCount > 0) {
        this.setBadge({ count: notificationCount });
      } else {
        this.clearBadge();
      }
    });

    // Listen for update availability
    this.api.events.on('update-available', () => {
      this.setBadge({ text: '🔄' });
      this.bounce('informational');
    });

    // Listen for critical errors
    this.api.events.on('critical-error', () => {
      this.setBadge({ text: '⚠️' });
      this.bounce('critical');
    });
  }

  /**
   * Build Electron menu from menu items
   */
  private buildMenuFromItems(items: IDockMenuItem[]): Menu {
    const menuItems = items.map(item => {
      if (item.type === 'separator') {
        return new MenuItem({ type: 'separator' });
      }

      const menuItem: Electron.MenuItemConstructorOptions = {
        label: item.label || '',
        enabled: item.enabled !== false,
        type: item.type || 'normal'
      };

      if (item.click) {
        menuItem.click = item.click;
      }

      if (item.submenu) {
        menuItem.submenu = this.buildMenuFromItems(item.submenu);
      }

      return new MenuItem(menuItem);
    });

    return Menu.buildFromTemplate(menuItems);
  }
}

export default MacOSDockManager;