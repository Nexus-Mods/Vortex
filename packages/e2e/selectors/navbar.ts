import type { Locator, Page } from "@playwright/test";

export class NavBar {
  readonly page: Page;
  readonly homeLink: Locator;
  readonly gamesLink: Locator;
  readonly modsLink: Locator;
  readonly settingsLink: Locator;
  readonly extensionsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.gamesLink = page.getByText("Games", { exact: true }).first();
    this.homeLink = page.getByText("Dashboard", { exact: true }).first();
    this.extensionsLink = page.getByText("Extensions", { exact: true }).first();
    this.settingsLink = page.getByText(/^(Settings|Preferences)$/).first();
    this.modsLink = page.getByText("Mods", { exact: true }).first();
  }
}
