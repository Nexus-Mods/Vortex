import { type Page } from "@playwright/test";

/**
 * Dismiss all on-screen notifications.
 *
 * Vortex's Header renders notifications in a HeadlessUI Popover anchored to the
 * nav bell (see views/components/Header/notifications). The tray AUTO-OPENS
 * whenever a new notification arrives, and its panel is `absolute right-0` — so
 * it hangs down over the top-right of the content and intercepts pointer events
 * on right-aligned controls (the Health Check tabs' action buttons and a warning
 * row's hide/feedback icons). Startup notifications ("SMAPI is not installed",
 * "Vortex X is available", the privacy prompt, …) don't auto-expire, so the tray
 * lingers. Clear it before interacting with any such control.
 *
 * The bell's accessible name is its unread-count badge, so target it by its
 * `title` instead. Open the tray if it's collapsed (so the per-item "Dismiss"
 * buttons are in the DOM), then dismiss every item; once the last one goes the
 * tray unmounts. Bounded in case a notification re-fires mid-loop.
 */
export async function dismissAllNotifications(page: Page): Promise<void> {
  const bell = page.getByTitle("Notifications", { exact: true }).first();
  if (
    (await bell.count()) > 0 &&
    (await bell.isEnabled()) &&
    (await bell.getAttribute("aria-expanded")) !== "true"
  ) {
    await bell.click().catch(() => undefined);
  }

  const dismiss = page.getByRole("button", { name: "Dismiss", exact: true });
  for (let attempt = 0; attempt < 12; attempt++) {
    if ((await dismiss.count()) === 0) return;
    await dismiss
      .first()
      .click()
      .catch(() => undefined);
  }
}
