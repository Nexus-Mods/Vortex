import type { Locator, Page } from '@playwright/test';

export class NavBar {
  readonly page: Page;
  readonly homeLink: Locator;
  readonly gamesLink: Locator;
  readonly settingsLink: Locator;
  readonly extensionsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    // "Settings" on fresh install, "Preferences" when a game is managed
    this.settingsLink = page.getByText(/^(Settings|Preferences)$/).first();
    this.gamesLink = page.locator('a[href="#/games"]').first();
    this.homeLink = page.locator('.main-nav-sidebar a').first();
    this.extensionsLink = page.getByText('Extensions', { exact: true }).first();
  }
}
