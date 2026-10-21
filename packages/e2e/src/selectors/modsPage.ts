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
  /** The page's toolbar, told from the table's by its Install From File button. */
  readonly toolbar: Locator;
  /** The toolbar's "…", which opens a menu of the actions not pinned to the bar. */
  readonly toolbarOverflow: Locator;

  constructor(page: Page) {
    this.page = page;
    // the new toolbar renders actions rather than components, so these carry a
    // data-testid instead of the id the old button components had
    this.installFromFileButton = page.locator('[data-testid="install-from-archive"]');
    this.playButton = page.locator("#btn-quicklaunch-play");
    this.statusButton = page.locator("#btn-mods-enabled").first();
    this.emptyState = page.getByText(/don't have any installed mods/i);
    this.deployedNotification = page.getByText(/mods deployed/i).first();
    this.toolbar = page.getByRole("toolbar").filter({ has: this.installFromFileButton });
    this.toolbarOverflow = this.toolbar.getByTestId("toolbar-overflow");
  }

  /**
   * An action in the toolbar's "…" menu, by its label; open the menu first. Matched from the
   * start of its name, which ends with its pin button's.
   */
  toolbarMenuItem(label: string): Locator {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.page.getByRole("menuitem", { name: new RegExp(`^${escaped}`) });
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
