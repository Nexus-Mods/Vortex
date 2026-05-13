import type { Locator, Page } from "@playwright/test";

export class ModsPage {
  readonly page: Page;
  readonly installFromFileButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.installFromFileButton = page.locator("#install-from-archive");
  }

  modRow(name: string | RegExp): Locator {
    return this.page.getByText(name).first();
  }
}
