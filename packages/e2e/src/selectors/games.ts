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
    // Each games section is a CollapsibleSection: a container div whose first
    // child is a role="button" header named "Managed <count>" / "Unmanaged
    // <count>". Anchor on the header and take its parent as the section scope.
    this.managedSection = page.getByRole("button", { name: /^Managed/ }).locator("..");
    this.unmanagedSection = page.getByRole("button", { name: /^Unmanaged/ }).locator("..");
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
