import type { INotification } from "@/types/INotification";

// Any other type, activity included, pops up for 10s.
const DEFAULT_DISPLAY_MS: Record<string, number> = {
  success: 5000,
  info: 5000,
};

/**
 * How long a notification pops up for, or `null` to keep it up until the user
 * dismisses it.
 */
function displayTime(item: INotification): number | null {
  if (item.displayMS !== undefined) {
    return item.displayMS;
  }

  // A notification with actions but no explicit displayMS requires the
  // user to choose. Auto-hiding it would silently strand the choice
  // (see INotification displayMS contract).
  if (item.actions !== undefined && item.actions.length > 0) {
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
export function notificationHideAt(item: INotification): number | null {
  const ms = displayTime(item);
  if (ms === null) {
    return null;
  }
  const from = item.type === "activity" ? item.createdTime : (item.updatedTime ?? item.createdTime);
  return from + ms;
}
