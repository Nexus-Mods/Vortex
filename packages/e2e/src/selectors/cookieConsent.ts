import type { Locator, Page } from "@playwright/test";

// Geo / A-B decides which CMP appears, so we model all observed ones.
export class CookieConsent {
  readonly page: Page;
  readonly quantcastAccept: Locator;
  readonly cookiebotAllowAll: Locator;
  readonly cookiebotAcceptId: Locator;
  readonly consentManagerDialog: Locator;
  readonly consentManagerAccept: Locator;
  readonly anyConsentDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.quantcastAccept = page.locator("button#accept-btn");
    this.cookiebotAllowAll = page.getByRole("button", { name: /^allow all$/i });
    this.cookiebotAcceptId = page.locator("#CybotCookiebotDialogBodyButtonAccept");
    this.consentManagerDialog = page.getByRole("dialog", {
      name: "Consent to Cookies & Data processing",
    });
    this.consentManagerAccept = this.consentManagerDialog.getByRole("button", {
      exact: true,
      name: "Accept all",
    });
    this.anyConsentDialog = page.getByRole("dialog", { name: /cookie|consent/i });
  }
}
