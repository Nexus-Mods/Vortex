import type { MouseEvent } from "react";

/**
 * Adds zero-width spaces after non-word characters to enable word wrapping
 * at punctuation and special characters in notification messages.
 */
export const addWordBreakOpportunities = (text: string): string[] => {
  return text.replace(/\W/g, (_) => `${_}\u200b`).split("\n");
};

/**
 * Creates an event handler that stops propagation and calls the callback with the ID.
 * Used for notification action buttons (dismiss, suppress, etc).
 */
export const createNotificationHandler =
  (id: string | undefined, callback: (id: string) => void) =>
  (e: MouseEvent) => {
    e.stopPropagation();
    if (id) {
      callback(id);
    }
  };
