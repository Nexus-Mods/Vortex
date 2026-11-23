import type { INotification } from "@/types/INotification";

// Any other type, activity included, pops up for 10s.
const DEFAULT_DISPLAY_MS: Record<string, number> = {
  success: 5000,
  info: 5000,
};

export interface INotificationHideAtOptions {
  /**
   * Whether the view shows the notification's actions and dismiss button. Only a
   * view that does can keep a notification up until the user acts on it.
   */
  interactive: boolean;
}

/**
 * How long a notification pops up for, or `null` to keep it up until the user
 * dismisses it.
 */
function displayTime(
  item: INotification,
  { interactive }: INotificationHideAtOptions,
): number | null {
  if (item.displayMS !== undefined) {
    return item.displayMS;
  }

  // A notification with actions but no explicit displayMS requires the
  // user to choose. Auto-hiding it would silently strand the choice
  // (see INotification displayMS contract).
  if (interactive && item.actions !== undefined && item.actions.length > 0) {
    return null;
  }

  return DEFAULT_DISPLAY_MS[item.type] ?? 10000;
}

/**
 * When a popped-up notification hides again, or `null` if it stays up until the
 * user dismisses it. The time counts from the notification's last update, so one
 * that replaces an older notification with the same id gets its full time (an
 * activity counts from when it started).
 */
export function notificationHideAt(
  item: INotification,
  options: INotificationHideAtOptions,
): number | null {
  const ms = displayTime(item, options);
  if (ms === null) {
    return null;
  }
  const from = item.type === "activity" ? item.createdTime : (item.updatedTime ?? item.createdTime);
  return from + ms;
}
