import type { Locator, Page } from "@playwright/test";

// Geo / A-B decides which CMP appears, so we model all observed ones.
export class CookieConsent {
  readonly page: Page;
  readonly quantcastAccept: Locator;
  readonly cookiebotAllowAll: Locator;
  readonly cookiebotAcceptId: Locator;

  constructor(page: Page) {
    this.page = page;
    this.quantcastAccept = page.locator("button#accept-btn");
    this.cookiebotAllowAll = page.getByRole("button", { name: /^allow all$/i });
    this.cookiebotAcceptId = page.locator("#CybotCookiebotDialogBodyButtonAccept");
  }
}
