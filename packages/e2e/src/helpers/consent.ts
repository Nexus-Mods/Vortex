import type { Page } from "@playwright/test";

import { CookieConsent } from "../selectors/cookieConsent";

// The consent CMP loads asynchronously after navigation, so wait briefly for an
// accept control to appear rather than checking once (which races the dialog and
// usually misses it). Best-effort: pages without a CMP just wait out the timeout.
const CONSENT_WAIT_MS = 8_000;

// Accept rather than dismiss — some download-flow JS is gated on consent state.
export async function acceptConsent(page: Page): Promise<void> {
  const consent = new CookieConsent(page);
  const accept = consent.quantcastAccept
    .or(consent.cookiebotAllowAll)
    .or(consent.cookiebotAcceptId)
    .first();

  const appeared = await accept
    .waitFor({ state: "visible", timeout: CONSENT_WAIT_MS })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await accept.click().catch(() => undefined);
    return;
  }

  // Quantcast can render inside an iframe.
  for (const frame of page.frames()) {
    const acceptInFrame = frame.locator("button#accept-btn, button:has-text('Allow all')").first();
    if (await acceptInFrame.isVisible().catch(() => false)) {
      await acceptInFrame.click().catch(() => undefined);
      return;
    }
  }
}
