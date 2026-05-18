import type { Page } from "@playwright/test";

import { CookieConsent } from "../selectors/cookieConsent";

// Accept rather than dismiss — some download-flow JS is gated on consent state.
export async function acceptConsent(page: Page): Promise<void> {
  const consent = new CookieConsent(page);
  const candidates = [
    consent.quantcastAccept,
    consent.cookiebotAllowAll,
    consent.cookiebotAcceptId,
  ];
  for (const locator of candidates) {
    if (
      await locator
        .first()
        .isVisible({ timeout: 1_000 })
        .catch(() => false)
    ) {
      await locator
        .first()
        .click({ timeout: 5_000 })
        .catch(() => undefined);
      return;
    }
  }
  // Quantcast can render inside an iframe.
  for (const frame of page.frames()) {
    const acceptInFrame = frame.locator("button#accept-btn, button:has-text('Allow all')").first();
    if (await acceptInFrame.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await acceptInFrame.click({ timeout: 5_000 }).catch(() => undefined);
      return;
    }
  }
}
