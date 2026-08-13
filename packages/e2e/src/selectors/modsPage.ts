import type { Locator, Page } from "@playwright/test";

export const MOD_STATUS = {
  enabled: "Enabled",
  disabled: "Disabled",
  uninstalled: "Uninstalled",
} as const;

export type ModStatus = (typeof MOD_STATUS)[keyof typeof MOD_STATUS];

export class ModsPage {
  readonly page: Page;
  readonly installFromFileButton: Locator;
  /** Toolbar "Deploy Mods" button (highlighted when a deployment is pending). */
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
    // the new toolbar renders actions rather than components, so these carry a
    // data-testid instead of the id the old button components had
    this.installFromFileButton = page.locator('[data-testid="install-from-archive"]');
    this.deployButton = page.locator('[data-testid="deploy-mods"]');
    this.playButton = page.locator("#btn-quicklaunch-play");
    this.statusButton = page.locator("#btn-mods-enabled").first();
    this.emptyState = page.getByText(/don't have any installed mods/i);
    this.deployedNotification = page.getByText(/mods deployed/i).first();
  }

  modRow(name: string | RegExp): Locator {
    return this.page.getByText(name).first();
  }

  row(name: string | RegExp): Locator {
    return this.page.getByRole("row").filter({ hasText: name }).first();
  }

  statusButtonInRow(name: string | RegExp): Locator {
    return this.row(name).locator("#btn-mods-enabled");
  }

  removeButtonInRow(name: string | RegExp): Locator {
    return this.row(name).getByRole("button", { name: "Remove", exact: true });
  }
}
