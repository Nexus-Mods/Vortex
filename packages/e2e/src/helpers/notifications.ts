import { type Page } from "@playwright/test";

/**
 * Dismiss all on-screen notifications.
 *
 * The Spine renders notifications in a HeadlessUI Popover anchored to the bell
 * above the download button (see views/components/Spine/notifications). The tray
 * AUTO-OPENS whenever a new notification arrives, and its panel opens to the right
 * of the bell — so it hangs over the left of the content and intercepts pointer
 * events on anything beneath it. Startup notifications ("SMAPI is not installed",
 * "Vortex X is available", the privacy prompt, …) don't auto-expire, so the tray
 * lingers. Clear it before interacting with any such control.
 *
 * Open the tray if it's collapsed (so the per-item "Dismiss" buttons are in the
 * DOM), then dismiss every item; once the last one goes the tray unmounts. Bounded
 * in case a notification re-fires mid-loop, and closes the tray behind it if
 * anything un-dismissable is left holding it open.
 */
export async function dismissAllNotifications(page: Page): Promise<void> {
  const bell = page.getByRole("button", { name: "Notifications", exact: true }).first();

  if ((await bell.count()) === 0) {
    return;
  }

  const isOpen = async () => (await bell.getAttribute("aria-expanded")) === "true";

  if ((await bell.isEnabled()) && !(await isOpen())) {
    await bell.click().catch(() => undefined);
  }

  const dismiss = page.getByRole("button", { name: "Dismiss", exact: true });
  for (let attempt = 0; attempt < 12 && (await dismiss.count()) > 0; attempt++) {
    await dismiss
      .first()
      .click()
      .catch(() => undefined);
  }

  // Whatever is left carries noDismiss and can't be cleared from here. Close the tray
  // behind us rather than leave it over the content, swallowing the clicks this is meant
  // to protect. The last dismissable one going closes it on its own.
  if ((await bell.isEnabled()) && (await isOpen())) {
    await bell.click().catch(() => undefined);
  }
}
