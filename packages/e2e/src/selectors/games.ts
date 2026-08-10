import type { Locator, Page } from "@playwright/test";

export class GamesPage {
  readonly page: Page;
  readonly managedSection: Locator;
  readonly unmanagedSection: Locator;
  readonly notDiscoveredDialog: Locator;
  readonly continueButton: Locator;
  /**
   * Filter box for the games picker (placeholder "Search games..."). The
   * unmanaged list is paginated/windowed, so narrowing it by name is the only
   * reliable way to bring a specific game's row into the DOM.
   */
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.managedSection = page.locator(".panel").filter({ hasText: /Managed \(/ });
    this.unmanagedSection = page.locator(".panel").filter({ hasText: /Unmanaged \(/ });
    this.notDiscoveredDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Game not discovered" })
      .last();
    this.continueButton = this.notDiscoveredDialog.getByRole("button", { name: "Continue" });
    this.searchInput = page.getByRole("textbox", { name: /search games/i }).first();
  }

  gameRow(gameName: string): Locator {
    return this.page
      .locator(".game-list-item, .game-thumbnail")
      .filter({ hasText: gameName })
      .first();
  }

  gameRowInSection(section: Locator, gameName: string): Locator {
    return section
      .locator(".game-list-item, .game-thumbnail")
      .filter({ hasText: gameName })
      .first();
  }

  manageButton(gameName: string): Locator {
    return this.gameRow(gameName).getByRole("button", { name: "Manage", exact: true }).first();
  }
}
