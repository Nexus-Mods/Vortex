import { IExtensionApi } from '../../types/IExtensionContext';
import { log } from '../../util/log';

export interface IAggregatedNotification {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  items: string[];
  count: number;
  allowReport?: boolean;
  actions?: any[];
}

export interface IPendingNotification {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  item: string;
  allowReport?: boolean;
  actions?: any[];
}

/**
 * Service for aggregating similar notifications to avoid spam during bulk operations
 * like dependency installations. Collects notifications during an operation and
 * presents them as consolidated notifications at the end.
 */
export class NotificationAggregator {
  private mPendingNotifications: { [key: string]: IPendingNotification[] } = {};
  private mActiveAggregations: Set<string> = new Set();
  private mTimeouts: { [key: string]: NodeJS.Timeout } = {};
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  /**
   * Start aggregating notifications for a specific operation
   * @param aggregationId Unique identifier for the aggregation session
   * @param timeoutMs Optional timeout in milliseconds to auto-flush notifications (default: 10000ms)
   */
  public startAggregation(aggregationId: string, timeoutMs: number = 10000): void {
    if (this.mActiveAggregations.has(aggregationId)) {
      log('warn', 'Aggregation already active', { aggregationId });
      return;
    }

    this.mActiveAggregations.add(aggregationId);
    this.mPendingNotifications[aggregationId] = [];

    // Set up auto-flush timeout
    if (timeoutMs > 0) {
      this.mTimeouts[aggregationId] = setTimeout(() => {
        this.flushAggregation(aggregationId);
      }, timeoutMs);
    }

    log('debug', 'Started notification aggregation', { aggregationId, timeoutMs });
  }

  /**
   * Add a notification to be aggregated
   * @param aggregationId The aggregation session to add to
   * @param type Notification type
   * @param title Notification title
   * @param message Notification message
   * @param item The specific item this notification refers to (e.g., mod name)
   * @param options Additional notification options
   */
  public addNotification(
    aggregationId: string,
    type: 'error' | 'warning' | 'info',
    title: string,
    message: string,
    item: string,
    options: { allowReport?: boolean; actions?: any[] } = {}
  ): void {
    if (!this.mActiveAggregations.has(aggregationId)) {
      // If aggregation is not active, show notification immediately
      this.mApi.showErrorNotification(title, message, {
        message: item,
        allowReport: options.allowReport,
        actions: options.actions,
      });
      return;
    }

    this.mPendingNotifications[aggregationId].push({
      type,
      title,
      message,
      item,
      allowReport: options.allowReport,
      actions: options.actions,
    });

    log('debug', 'Added notification to aggregation', {
      aggregationId,
      type,
      title,
      item,
      totalPending: this.mPendingNotifications[aggregationId].length,
    });
  }

  /**
   * Flush all pending notifications for an aggregation session
   * @param aggregationId The aggregation session to flush
   */
  public flushAggregation(aggregationId: string): void {
    if (!this.mActiveAggregations.has(aggregationId)) {
      return;
    }

    const pending = this.mPendingNotifications[aggregationId] || [];
    if (pending.length === 0) {
      this.cleanupAggregation(aggregationId);
      return;
    }

    const aggregated = this.aggregateNotifications(pending);
    
    // Show aggregated notifications
    aggregated.forEach(notification => {
      this.showAggregatedNotification(notification);
    });

    log('info', 'Flushed aggregated notifications', {
      aggregationId,
      originalCount: pending.length,
      aggregatedCount: aggregated.length,
    });

    this.cleanupAggregation(aggregationId);
  }

  /**
   * Stop aggregation and flush any pending notifications
   * @param aggregationId The aggregation session to stop
   */
  public stopAggregation(aggregationId: string): void {
    this.flushAggregation(aggregationId);
  }

  /**
   * Check if an aggregation is currently active
   * @param aggregationId The aggregation session to check
   */
  public isAggregating(aggregationId: string): boolean {
    return this.mActiveAggregations.has(aggregationId);
  }

  private cleanupAggregation(aggregationId: string): void {
    this.mActiveAggregations.delete(aggregationId);
    delete this.mPendingNotifications[aggregationId];
    
    if (this.mTimeouts[aggregationId]) {
      clearTimeout(this.mTimeouts[aggregationId]);
      delete this.mTimeouts[aggregationId];
    }
  }

  private aggregateNotifications(notifications: IPendingNotification[]): IAggregatedNotification[] {
    const grouped: { [key: string]: IPendingNotification[] } = {};

    // Group notifications by title and message pattern
    notifications.forEach(notification => {
      const key = this.getGroupingKey(notification);
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(notification);
    });

    // Convert groups to aggregated notifications
    return Object.keys(grouped).map(key => {
      const group = grouped[key];
      const first = group[0];
      const items = group.map(n => n.item).filter((item, index, array) => array.indexOf(item) === index);
      
      return {
        id: `aggregated-${key}-${Date.now()}`,
        type: first.type,
        title: first.title,
        message: this.buildAggregatedMessage(first, items),
        items,
        count: group.length,
        allowReport: first.allowReport,
        actions: first.actions,
      };
    });
  }

  private getGroupingKey(notification: IPendingNotification): string {
    // Create a key based on title and normalized message for grouping similar notifications
    const normalizedMessage = this.normalizeMessage(notification.message);
    return `${notification.type}-${notification.title}-${normalizedMessage}`;
  }

  private normalizeMessage(message: string): string {
    // Remove variable parts from messages to enable better grouping
    return message
      .replace(/\{\{[^}]+\}\}/g, 'PLACEHOLDER') // Replace template variables
      .replace(/https?:\/\/[^\s]+/g, 'URL') // Replace URLs
      .replace(/\d+/g, 'NUMBER') // Replace numbers
      .replace(/['""][^'"]*['"]/g, 'QUOTED') // Replace quoted strings
      .toLowerCase()
      .trim();
  }

  private buildAggregatedMessage(notification: IPendingNotification, items: string[]): string {
    const baseMessage = notification.message;
    
    if (items.length === 1) {
      return baseMessage;
    }

    const itemList = items.length <= 5 
      ? items.join(', ')
      : `${items.slice(0, 5).join(', ')} and ${items.length - 5} more`;

    return `${baseMessage}\n\nAffected dependencies: ${itemList}`;
  }

  private showAggregatedNotification(notification: IAggregatedNotification): void {
    const options: any = {
      id: notification.id,
      allowReport: notification.allowReport,
    };

    if (notification.actions) {
      options.actions = notification.actions;
    }

    // Add count information to the title if multiple items
    const displayTitle = notification.count > 1 
      ? `${notification.title} (${notification.count} dependencies)`
      : notification.title;

    switch (notification.type) {
      case 'error':
        this.mApi.showErrorNotification(displayTitle, notification.message, options);
        break;
      case 'warning':
        this.mApi.sendNotification({
          id: notification.id,
          type: 'warning',
          title: displayTitle,
          message: notification.message,
          ...options,
        });
        break;
      case 'info':
        this.mApi.sendNotification({
          id: notification.id,
          type: 'info',
          title: displayTitle,
          message: notification.message,
          ...options,
        });
        break;
    }
  }
}