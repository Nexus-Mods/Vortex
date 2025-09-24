import { Notification, app, shell } from 'electron';
import { log } from './log';
import { isMacOS } from './platform';
import * as path from 'path';

export interface INotificationAction {
  type: 'button';
  text: string;
  id: string;
}

export interface IEnhancedNotificationOptions {
  title: string;
  subtitle?: string;
  body: string;
  icon?: string;
  sound?: string;
  urgency?: 'normal' | 'critical' | 'low';
  silent?: boolean;
  hasReply?: boolean;
  replyPlaceholder?: string;
  actions?: INotificationAction[];
  closeButtonText?: string;
  timeoutType?: 'default' | 'never';
  tag?: string;
  group?: string;
  data?: any;
}

export interface INotificationResponse {
  actionIdentifier: string;
  userText?: string;
  notification: Notification;
}

export class MacOSNotificationManager {
  private isInitialized: boolean = false;
  private notificationHistory: Map<string, Notification> = new Map();
  private actionHandlers: Map<string, (response: INotificationResponse) => void> = new Map();

  constructor() {
    // Empty constructor
  }

  /**
   * Initialize the macOS notification manager
   */
  public initialize(): void {
    if (!isMacOS()) {
      log('debug', 'MacOSNotificationManager: Not on macOS, skipping initialization');
      return;
    }

    if (this.isInitialized) {
      log('warn', 'MacOSNotificationManager already initialized');
      return;
    }

    try {
      this.setupNotificationHandlers();
      this.isInitialized = true;
      log('info', 'MacOSNotificationManager initialized successfully');
    } catch (error) {
      log('error', 'Failed to initialize MacOSNotificationManager', error);
    }
  }

  /**
   * Show an enhanced notification
   */
  public showNotification(options: IEnhancedNotificationOptions): Promise<Notification> {
    return new Promise((resolve, reject) => {
      if (!isMacOS()) {
        reject(new Error('Not on macOS'));
        return;
      }

      try {
        const notificationOptions: Electron.NotificationConstructorOptions = {
          title: options.title,
          body: options.body,
          silent: options.silent || false,
          timeoutType: options.timeoutType || 'default'
        };

        // Add subtitle if provided
        if (options.subtitle) {
          notificationOptions.subtitle = options.subtitle;
        }

        // Add icon
        if (options.icon) {
          notificationOptions.icon = options.icon;
        } else {
          // Use app icon as default
          notificationOptions.icon = this.getAppIcon();
        }

        // Add sound
        if (options.sound) {
          notificationOptions.sound = options.sound;
        }

        // Add urgency (maps to different notification styles)
        if (options.urgency === 'critical') {
          notificationOptions.urgency = 'critical';
        } else if (options.urgency === 'low') {
          notificationOptions.urgency = 'low';
        }

        // Add reply capability
        if (options.hasReply) {
          notificationOptions.hasReply = true;
          if (options.replyPlaceholder) {
            notificationOptions.replyPlaceholder = options.replyPlaceholder;
          }
        }

        // Add actions
        if (options.actions && options.actions.length > 0) {
          notificationOptions.actions = options.actions;
        }

        // Add close button text
        if (options.closeButtonText) {
          notificationOptions.closeButtonText = options.closeButtonText;
        }

        const notification = new Notification(notificationOptions);

        // Store notification for tracking
        const notificationId = options.tag || `notification_${Date.now()}`;
        this.notificationHistory.set(notificationId, notification);

        // Setup event handlers
        this.setupNotificationEventHandlers(notification, options);

        // Show the notification
        notification.show();

        log('debug', 'Enhanced notification shown', { 
          title: options.title, 
          hasActions: !!options.actions?.length,
          hasReply: !!options.hasReply 
        });

        resolve(notification);
      } catch (error) {
        log('error', 'Failed to show enhanced notification', error);
        reject(error);
      }
    });
  }

  /**
   * Show a progress notification
   */
  public showProgressNotification(
    title: string, 
    progress: number, 
    subtitle?: string
  ): Promise<Notification> {
    const options: IEnhancedNotificationOptions = {
      title,
      subtitle: subtitle || `${Math.round(progress * 100)}% complete`,
      body: this.createProgressBar(progress),
      silent: true,
      timeoutType: 'never',
      tag: 'progress_notification'
    };

    return this.showNotification(options);
  }

  /**
   * Show an action notification with buttons
   */
  public showActionNotification(
    title: string,
    body: string,
    actions: INotificationAction[],
    onAction: (response: INotificationResponse) => void
  ): Promise<Notification> {
    const actionId = `action_${Date.now()}`;
    this.actionHandlers.set(actionId, onAction);

    const options: IEnhancedNotificationOptions = {
      title,
      body,
      actions,
      tag: actionId,
      data: { actionId }
    };

    return this.showNotification(options);
  }

  /**
   * Show a grouped notification
   */
  public showGroupedNotification(
    group: string,
    title: string,
    body: string,
    count?: number
  ): Promise<Notification> {
    const options: IEnhancedNotificationOptions = {
      title: count ? `${title} (${count})` : title,
      body,
      group,
      tag: `group_${group}`,
      actions: [
        { type: 'button', text: 'View All', id: 'view_all' },
        { type: 'button', text: 'Dismiss', id: 'dismiss' }
      ]
    };

    return this.showNotification(options);
  }

  /**
   * Update an existing notification
   */
  public updateNotification(tag: string, options: Partial<IEnhancedNotificationOptions>): void {
    const existingNotification = this.notificationHistory.get(tag);
    if (existingNotification) {
      existingNotification.close();
    }

    if (options.title && options.body) {
      this.showNotification({
        title: options.title,
        body: options.body,
        tag,
        ...options
      } as IEnhancedNotificationOptions);
    }
  }

  /**
   * Clear notification by tag
   */
  public clearNotification(tag: string): void {
    const notification = this.notificationHistory.get(tag);
    if (notification) {
      notification.close();
      this.notificationHistory.delete(tag);
    }
  }

  /**
   * Clear all notifications
   */
  public clearAllNotifications(): void {
    this.notificationHistory.forEach((notification, tag) => {
      notification.close();
    });
    this.notificationHistory.clear();
    this.actionHandlers.clear();
  }

  /**
   * Setup notification event handlers
   */
  private setupNotificationEventHandlers(
    notification: Notification, 
    options: IEnhancedNotificationOptions
  ): void {
    // Handle click
    notification.on('click', () => {
      log('debug', 'Notification clicked', { title: options.title });
      
      // Bring app to front
      if (app.dock) {
        app.dock.show();
      }
      
      // Focus main window if available
      const windows = require('electron').BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        const mainWindow = windows[0];
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });

    // Handle action
    notification.on('action', (event, index) => {
      const action = options.actions?.[index];
      if (action && options.data?.actionId) {
        const handler = this.actionHandlers.get(options.data.actionId);
        if (handler) {
          handler({
            actionIdentifier: action.id,
            notification
          });
        }
      }
      log('debug', 'Notification action triggered', { actionId: action?.id });
    });

    // Handle reply
    notification.on('reply', (event, reply) => {
      if (options.data?.actionId) {
        const handler = this.actionHandlers.get(options.data.actionId);
        if (handler) {
          handler({
            actionIdentifier: 'reply',
            userText: reply,
            notification
          });
        }
      }
      log('debug', 'Notification reply received', { replyLength: reply.length });
    });

    // Handle close
    notification.on('close', () => {
      // Clean up from history
      this.notificationHistory.forEach((notif, tag) => {
        if (notif === notification) {
          this.notificationHistory.delete(tag);
        }
      });
      log('debug', 'Notification closed', { title: options.title });
    });
  }

  /**
   * Setup global notification handlers
   */
  private setupNotificationHandlers(): void {
    // Handle notification permission
    if (Notification.isSupported()) {
      log('info', 'Notifications are supported');
    } else {
      log('warn', 'Notifications are not supported');
    }
  }

  /**
   * Get app icon path
   */
  private getAppIcon(): string {
    try {
      // Try to get the app icon from the app bundle
      const iconPath = path.join(__dirname, '..', '..', 'assets', 'images', 'vortex.png');
      return iconPath;
    } catch (error) {
      log('debug', 'Could not find app icon, using default');
      return '';
    }
  }

  /**
   * Create a text-based progress bar
   */
  private createProgressBar(progress: number, length: number = 20): string {
    const filled = Math.round(progress * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Check if Do Not Disturb is enabled
   */
  public isDoNotDisturbEnabled(): boolean {
    // This would require native macOS API access
    // For now, return false as a placeholder
    return false;
  }

  /**
   * Respect Do Not Disturb settings
   */
  public shouldShowNotification(urgency: 'normal' | 'critical' | 'low' = 'normal'): boolean {
    if (this.isDoNotDisturbEnabled()) {
      // Only show critical notifications when DND is enabled
      return urgency === 'critical';
    }
    return true;
  }

  /**
   * Get notification history
   */
  public getNotificationHistory(): Array<{ tag: string; notification: Notification }> {
    return Array.from(this.notificationHistory.entries()).map(([tag, notification]) => ({
      tag,
      notification
    }));
  }
}

export default MacOSNotificationManager;