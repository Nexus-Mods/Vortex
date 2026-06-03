import type { Locator, Page } from "@playwright/test";

export class Header {
  readonly page: Page;
  readonly premiumIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.premiumIndicator = page.getByTestId("premium-indicator");
  }
}
