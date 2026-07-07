import type { Locator, Page } from "@playwright/test";

export class ModsPage {
  readonly page: Page;
  readonly installFromFileButton: Locator;
  /** Toolbar "Deploy Mods" button (flashes when a deployment is pending). */
  readonly deployButton: Locator;
  /** Toolbar Quick Launcher "Play" button that starts the managed game. */
  readonly playButton: Locator;
  /**
   * Inline-editable Status cell button in the Mods table. Shows the mod's
   * status text ("Disabled" / "Enabled" / ...) and, for an installed mod,
   * clicking it toggles enabled⇄disabled (TableRow `cycle` → cycleModState).
   * The id has no row suffix, so this targets the single-mod case used here.
   */
  readonly statusButton: Locator;
  /** Placeholder shown when the game has no installed mods. */
  readonly emptyState: Locator;
  /** Transient "Mods deployed" notification shown after a successful deploy. */
  readonly deployedNotification: Locator;

  constructor(page: Page) {
    this.page = page;
    this.installFromFileButton = page.locator("#install-from-archive");
    this.deployButton = page.locator("#deploy-mods");
    this.playButton = page.locator("#btn-quicklaunch-play");
    this.statusButton = page.locator("#btn-mods-enabled").first();
    this.emptyState = page.getByText(/don't have any installed mods/i);
    this.deployedNotification = page.getByText(/mods deployed/i).first();
  }

  modRow(name: string | RegExp): Locator {
    return this.page.getByText(name).first();
  }
}
