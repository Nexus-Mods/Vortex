import type { Locator, Page } from "@playwright/test";

export class NavBar {
  readonly page: Page;
  readonly homeLink: Locator;
  readonly gamesLink: Locator;
  readonly modsLink: Locator;
  readonly settingsLink: Locator;
  readonly preferencesLink: Locator;
  readonly profilesLink: Locator;
  readonly extensionsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.gamesLink = page.getByText("Games", { exact: true }).first();
    this.homeLink = page.getByText("Dashboard", { exact: true }).first();
    this.extensionsLink = page.getByText("Extensions", { exact: true }).first();
    // "Settings" is global; "Preferences" is the per-game page that also
    // appears in the menu — keep them as separate locators.
    this.settingsLink = page.getByRole("button", { name: "Settings", exact: true }).first();
    this.preferencesLink = page.getByRole("button", { name: "Preferences", exact: true }).first();
    this.profilesLink = page.getByRole("button", { name: "Profiles", exact: true }).first();
    this.modsLink = page.getByText("Mods", { exact: true }).first();
  }
}
