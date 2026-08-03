import type { Locator, Page } from "@playwright/test";

// Spine selection (home vs per-game) decides which page group the menu shows.
export class Spine {
  readonly page: Page;
  readonly homeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.homeButton = page.getByRole("button", { name: "Home", exact: true }).first();
  }

  gameButton(gameName: string): Locator {
    return this.page.getByRole("button", { name: gameName, exact: true }).first();
  }
}
