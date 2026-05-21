import type { Locator, Page } from "@playwright/test";

export class GamesPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  gameRow(gameName: string): Locator {
    return this.page
      .locator(".game-list-item, .game-thumbnail")
      .filter({ hasText: gameName })
      .first();
  }

  manageButton(gameName: string): Locator {
    return this.gameRow(gameName).getByRole("button", { name: "Manage", exact: true }).first();
  }
}
