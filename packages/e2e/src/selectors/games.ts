import type { Locator, Page } from "@playwright/test";

export class GamesPage {
  readonly page: Page;
  /**
   * "Games detected", or "New games detected" when it has games the user hasn't
   * seen: installed games Vortex found but the user hasn't added.
   */
  readonly detectedSection: Locator;
  /** "Added games": the games the user is managing. */
  readonly addedSection: Locator;
  /** "All supported games": every game with an extension, detected or not. */
  readonly supportedSection: Locator;
  readonly notDiscoveredDialog: Locator;
  readonly continueButton: Locator;
  /**
   * Filter box for the games picker (placeholder "Search games..."). The
   * supported list is windowed, so narrowing it by name is the only reliable
   * way to bring a specific game's tile into the DOM.
   */
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.detectedSection = this.section(/^(New games|Games) detected$/);
    this.addedSection = this.section("Added games");
    this.supportedSection = this.section("All supported games");
    this.notDiscoveredDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Game not discovered" })
      .last();
    this.continueButton = this.notDiscoveredDialog.getByRole("button", { name: "Continue" });
    this.searchInput = page.getByRole("textbox", { name: /search games/i }).first();
  }

  gameTile(gameName: string): Locator {
    return this.gameTileIn(this.page, gameName);
  }

  gameTileInSection(section: Locator, gameName: string): Locator {
    return this.gameTileIn(section, gameName);
  }

  /**
   * The primary action on a tile in "All supported games". It's revealed on
   * hover, so hover the tile before clicking. Scoped to that section because a
   * detected game also has a tile under "Games detected", whose action is
   * "Add game" instead.
   */
  manualAddButton(gameName: string): Locator {
    return this.gameTileInSection(this.supportedSection, gameName).getByRole("button", {
      name: "Manual add",
      exact: true,
    });
  }

  /**
   * The primary action on a tile in "Added games". Adding a game activates it
   * but leaves the user on the Games page; Open is what takes them into the
   * game's workspace.
   */
  openButton(gameName: string): Locator {
    return this.gameTileInSection(this.addedSection, gameName).getByRole("button", {
      name: "Open",
      exact: true,
    });
  }

  // A section is a <section> whose header carries its title; the sections have
  // no accessible name, so anchor on the header text. The title may also be
  // given as a pattern for a section whose title varies.
  private section(title: string | RegExp): Locator {
    return this.page
      .locator("section")
      .filter({ has: this.page.getByText(title, { exact: true }) });
  }

  // The tile's data-testid ends up on its art <img> (alt = game name), and the
  // name and actions are the image's siblings, so the tile is the img's parent.
  private gameTileIn(scope: Page | Locator, gameName: string): Locator {
    return scope
      .getByTestId("game-tile")
      .and(this.page.getByAltText(gameName, { exact: true }))
      .first()
      .locator("..");
  }
}
