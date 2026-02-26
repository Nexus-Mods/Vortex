import { createHash } from "crypto";
import type {
  IErrorOptions,
  IExtensionApi,
} from "../../types/IExtensionContext";
import type { INotificationAction } from "../../types/INotification";
import { log } from "../../util/log";
import {
  getErrorMessageOrDefault,
  unknownToError,
} from "../../../shared/errors";

// In test environment, use synchronous execution to avoid timing issues with Jest fake timers
// Check for jest global or NODE_ENV to detect test environment reliably
const isTestEnvironment = (): boolean =>
  typeof jest !== "undefined" || process?.env?.NODE_ENV === "test";

const setImmediatePolyfill = (fn: () => void): void => {
  if (isTestEnvironment()) {
    fn(); // Synchronous in tests
  } else if (typeof setImmediate !== "undefined") {
    setImmediate(fn);
  } else {
    setTimeout(fn, 0);
  }
};

export interface IAggregatedNotification {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  details: string | Error;
  text: string;
  items: string[];
  count: number;
  allowReport?: boolean;
  actions?: INotificationAction[];
}

export interface IPendingNotification {
  type: "error" | "warning" | "info";
  title: string;
  details: string | Error;
  item: string;
  allowReport?: boolean;
  actions?: INotificationAction[];
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
  private mNormalizedMessageCache: Map<string, string> = new Map();
  private mAddNotificationQueue: { [aggregationId: string]: NodeJS.Timeout } =
    {};

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  /**
   * Start aggregating notifications for a specific operation
   * @param aggregationId Unique identifier for the aggregation session
   * @param timeoutMs Optional timeout in milliseconds to auto-flush notifications (default: 1000ms)
   */
  public startAggregation(
    aggregationId: string,
    timeoutMs: number = 1000,
  ): void {
    if (this.mActiveAggregations.has(aggregationId)) {
      return;
    }

    this.mActiveAggregations.add(aggregationId);
    this.mPendingNotifications[aggregationId] = [];

    // Set up auto-flush timeout
    if (timeoutMs > 0) {
      this.mTimeouts[aggregationId] = setTimeout(() => {
        this.flushPendingNotifications(aggregationId, timeoutMs);
      }, timeoutMs);
    }
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
    type: "error" | "warning" | "info",
    title: string,
    details: string | Error,
    item: string,
    options: { allowReport?: boolean; actions?: INotificationAction[] } = {},
  ): void {
    if (!this.mActiveAggregations.has(aggregationId)) {
      setImmediatePolyfill(() => {
        this.mApi.showErrorNotification(title, details, {
          message: item,
          allowReport: options.allowReport,
          actions: options.actions,
        });
      });
      return;
    }

    // Batch notifications to prevent UI blocking on rapid additions
    this.addNotificationBatched(aggregationId, {
      type,
      title,
      details,
      item,
      allowReport: options.allowReport,
      actions: options.actions,
    });
  }

  private addNotificationBatched(
    aggregationId: string,
    notification: IPendingNotification,
  ): void {
    this.mPendingNotifications[aggregationId].push(notification);
  }

  /**
   * Flush pending notifications without stopping the aggregation
   * Used by the auto-flush timeout to periodically flush notifications while keeping aggregation active
   * @param aggregationId The aggregation session to flush
   * @param timeoutMs Timeout to set for the next auto-flush
   */
  private flushPendingNotifications(
    aggregationId: string,
    timeoutMs: number,
  ): void {
    // log('info', 'flushPendingNotifications called', {
    //   aggregationId,
    //   isActive: this.mActiveAggregations.has(aggregationId),
    //   pendingCount: this.mPendingNotifications[aggregationId]?.length || 0
    // });

    if (!this.mActiveAggregations.has(aggregationId)) {
      // log('warn', 'flushPendingNotifications called for inactive aggregation', { aggregationId });
      return;
    }

    const pending = this.mPendingNotifications[aggregationId] || [];
    if (pending.length === 0) {
      // Reset timeout for next batch
      this.mTimeouts[aggregationId] = setTimeout(() => {
        this.flushPendingNotifications(aggregationId, timeoutMs);
      }, timeoutMs);
      return;
    }

    log("info", "processing pending notifications without cleanup", {
      aggregationId,
      count: pending.length,
      notifications: pending.map((n) => ({
        type: n.type,
        title: n.title,
        item: n.item,
      })),
    });

    // Clear current pending notifications and process them
    this.mPendingNotifications[aggregationId] = [];

    // Process notifications asynchronously
    this.processNotificationsAsync(pending, aggregationId)
      .then(() => {
        // Schedule next auto-flush if aggregation is still active
        if (this.mActiveAggregations.has(aggregationId)) {
          this.mTimeouts[aggregationId] = setTimeout(() => {
            this.flushPendingNotifications(aggregationId, timeoutMs);
          }, timeoutMs);
        }
      })
      .catch((err) => {
        log("error", "error processing notifications", {
          aggregationId,
          error: getErrorMessageOrDefault(err),
        });
        // Schedule next auto-flush even on error
        if (this.mActiveAggregations.has(aggregationId)) {
          this.mTimeouts[aggregationId] = setTimeout(() => {
            this.flushPendingNotifications(aggregationId, timeoutMs);
          }, timeoutMs);
        }
      });
  }

  /**
   * Flush all pending notifications for an aggregation session
   * @param aggregationId The aggregation session to flush
   * @returns Promise that resolves when all notifications have been processed
   */
  public async flushAggregation(aggregationId: string): Promise<void> {
    if (!this.mActiveAggregations.has(aggregationId)) {
      log("warn", "flushAggregation called for inactive aggregation", {
        aggregationId,
      });
      return;
    }

    const pending = this.mPendingNotifications[aggregationId] || [];
    if (pending.length === 0) {
      log("debug", "no pending notifications to flush", { aggregationId });
      this.cleanupAggregation(aggregationId);
      return;
    }

    try {
      await this.processNotificationsAsync(pending, aggregationId);
      log("debug", "notification processing complete, cleaning up", {
        aggregationId,
      });
    } catch (err) {
      log("error", "error processing notifications", {
        aggregationId,
        error: getErrorMessageOrDefault(err),
      });
    } finally {
      this.cleanupAggregation(aggregationId);
    }
  }

  private async processNotificationsAsync(
    notifications: IPendingNotification[],
    aggregationId: string,
  ): Promise<void> {
    try {
      // Process aggregation in next tick to prevent blocking
      // Skip the delay in test environment for predictable timing
      if (!isTestEnvironment()) {
        await new Promise<void>((resolve) => setImmediatePolyfill(resolve));
      }

      // Circuit breaker: For very large batches, show a simple summary instead of processing all
      if (notifications.length > 500) {
        log(
          "warn",
          "Very large notification batch detected, showing summary instead",
          {
            aggregationId,
            count: notifications.length,
          },
        );

        const errorCount = notifications.filter(
          (n) => n.type === "error",
        ).length;
        const warningCount = notifications.filter(
          (n) => n.type === "warning",
        ).length;

        if (errorCount > 0) {
          this.mApi.showErrorNotification(
            `Multiple dependency errors (${errorCount} errors)`,
            `${errorCount} dependencies failed to install. Check the log for details.`,
            { id: `bulk-errors-${aggregationId}` },
          );
        }

        if (warningCount > 0) {
          this.mApi.sendNotification({
            id: `bulk-warnings-${aggregationId}`,
            type: "warning",
            title: `Multiple dependency warnings (${warningCount} warnings)`,
            message: `${warningCount} dependencies had warnings. Check the log for details.`,
          });
        }

        return;
      }

      const aggregated = this.aggregateNotifications(notifications);

      // Show notifications one by one with brief delays to prevent UI blocking
      for (let i = 0; i < aggregated.length; i++) {
        this.showAggregatedNotification(aggregated[i]);

        // Add small delay between notifications to prevent UI blocking (skip in tests)
        if (i < aggregated.length - 1 && !isTestEnvironment()) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1));
        }
      }
    } catch (err) {
      log("error", "Failed to process aggregated notifications", {
        aggregationId,
        error: getErrorMessageOrDefault(err),
      });
    }
  }

  /**
   * Stop aggregation and flush any pending notifications
   * @param aggregationId The aggregation session to stop
   * @returns Promise that resolves when all notifications have been processed
   */
  public async stopAggregation(aggregationId: string): Promise<void> {
    await this.flushAggregation(aggregationId);
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

    if (this.mAddNotificationQueue[aggregationId]) {
      clearTimeout(this.mAddNotificationQueue[aggregationId]);
      delete this.mAddNotificationQueue[aggregationId];
    }

    // Clean up message cache periodically to prevent memory leaks
    if (this.mNormalizedMessageCache.size > 500) {
      this.mNormalizedMessageCache.clear();
    }
  }

  private aggregateNotifications(
    notifications: IPendingNotification[],
  ): IAggregatedNotification[] {
    const grouped: { [key: string]: IPendingNotification[] } = {};

    // Group notifications by title and message pattern
    notifications.forEach((notification) => {
      const key = this.getGroupingKey(notification);
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(notification);
    });

    // Convert groups to aggregated notifications
    return Object.keys(grouped).map((key) => {
      const group = grouped[key];
      const first = group[0];
      const uniqueItems = Array.from(new Set(group.map((n) => n.item)));

      // Use the first available stack trace from the group (if any notification has an Error)
      const errorNotification = group.find((n) => n.details instanceof Error);
      const stack =
        errorNotification !== undefined
          ? unknownToError(errorNotification.details)?.stack
          : undefined;

      const message = this.buildAggregatedMessage(first, uniqueItems);

      let details: string | Error = message;
      if (stack !== undefined) {
        const originalError = unknownToError(errorNotification.details);
        const aggregatedError = new Error(message);
        aggregatedError.name = originalError.name;
        // Preserve the stack trace but with the aggregated error's name and message at the top
        const stackLines = stack.split("\n");
        const frameStartIndex = stackLines.findIndex((line) =>
          /^\s+at\s/.test(line),
        );
        if (frameStartIndex > 0) {
          aggregatedError.stack = `${aggregatedError.name}: ${message}\n${stackLines.slice(frameStartIndex).join("\n")}`;
        } else {
          // Fallback: just use the original stack
          aggregatedError.stack = stack;
        }
        details = aggregatedError;
      }

      return {
        id: `aggregated-${key}-${Date.now()}`,
        type: first.type,
        title: first.title,
        details,
        text: uniqueItems.join("\n"),
        items: uniqueItems,
        count: group.length,
        allowReport: first.allowReport,
        actions: first.actions,
      };
    });
  }

  private getGroupingKey(notification: IPendingNotification): string {
    // For performance, use a simpler grouping key that avoids expensive normalization
    // Only normalize if we have time (small batches)
    const messageText =
      notification.details instanceof Error
        ? notification.details.message
        : notification.details;
    let simpleKey = `${notification.type}-${notification.title}-${messageText}`;

    // For errors, include a hash of the stack trace so errors from different code paths
    // are kept separate (preserving debugging info)
    if (notification.details instanceof Error && notification.details.stack) {
      const stackHash = this.hashStack(notification.details.stack);
      simpleKey += `-${stackHash}`;
    }

    // Only do expensive normalization for smaller batches to avoid UI blocking
    if (
      this.mPendingNotifications &&
      Object.keys(this.mPendingNotifications).length < 100
    ) {
      const normalizedMessage = this.normalizeMessage(messageText);
      return `${simpleKey}-${normalizedMessage}`;
    }

    return simpleKey;
  }

  private hashStack(stack: string): string {
    const frames = stack
      .split("\n")
      .filter((line) => /^\s+at\s/.test(line))
      .slice(0, 5) // Only use first 5 frames for grouping
      .join("");

    return createHash("sha1").update(frames).digest("hex").slice(0, 8);
  }

  private normalizeMessage(message: string): string {
    // Check cache first to avoid expensive regex operations
    if (this.mNormalizedMessageCache.has(message)) {
      return this.mNormalizedMessageCache.get(message)!;
    }

    // Remove variable parts from messages to enable better grouping
    const normalized = message
      .replace(/\{\{[^}]+\}\}/g, "PLACEHOLDER") // Replace template variables
      .replace(/https?:\/\/[^\s]+/g, "URL") // Replace URLs
      .replace(/\d+/g, "NUMBER") // Replace numbers
      .replace(/['""][^'"]*['"]/g, "QUOTED") // Replace quoted strings
      .toLowerCase()
      .trim();

    // Cache the result (limit cache size to prevent memory leaks)
    if (this.mNormalizedMessageCache.size < 1000) {
      this.mNormalizedMessageCache.set(message, normalized);
    }

    return normalized;
  }

  private buildAggregatedMessage(
    notification: IPendingNotification,
    items: string[],
  ): string {
    const baseMessage =
      notification.details instanceof Error
        ? notification.details.message
        : notification.details;

    let result = baseMessage;

    if (items.length > 1) {
      const itemList =
        items.length <= 5
          ? items.join(", ")
          : `${items.slice(0, 5).join(", ")} and ${items.length - 5} more`;
      result += `\n\nAffected dependencies: ${itemList}`;
    }

    return result;
  }

  private showAggregatedNotification(
    notification: IAggregatedNotification,
  ): void {
    setImmediatePolyfill(() => {
      const options: IErrorOptions = {
        id: notification.id,
        allowReport: notification.allowReport,
        actions: notification.actions,
      };

      // Add count information to the title if multiple items
      const displayTitle =
        notification.count > 1
          ? `${notification.title} (${notification.count} dependencies)`
          : notification.title;

      switch (notification.type) {
        case "error":
          this.mApi.showErrorNotification(
            displayTitle,
            notification.details,
            options,
          );
          break;
        case "warning":
          this.mApi.sendNotification({
            id: notification.id,
            type: "warning",
            title: displayTitle,
            message: notification.text,
            actions: notification.actions,
            allowSuppress: options.allowReport,
          });
          break;
        case "info":
          this.mApi.sendNotification({
            id: notification.id,
            type: "info",
            title: displayTitle,
            message: notification.text,
            actions: notification.actions,
            allowSuppress: options.allowReport,
          });
          break;
      }
    });
  }
}
