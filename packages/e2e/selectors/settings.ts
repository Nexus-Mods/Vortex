import type { Locator, Page } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly languageLabel: Locator;
  readonly englishOption: Locator;
  readonly checkboxes: Locator;
  readonly darkThemeLabel: Locator;

  // Tab locators
  readonly interfaceTab: Locator;
  readonly vortexTab: Locator;
  readonly modsTab: Locator;
  readonly downloadTab: Locator;
  readonly workaroundsTab: Locator;
  readonly themeTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.languageLabel = page.getByText('Language').first();
    this.englishOption = page.getByText('English').first();
    this.checkboxes = page.getByRole('checkbox');
    this.darkThemeLabel = page.getByText('Dark theme').first();

    this.interfaceTab = page.getByText('Interface', { exact: true }).first();
    this.vortexTab = page.getByText('Vortex', { exact: true }).first();
    this.modsTab = page.getByText('Mods', { exact: true }).first();
    this.downloadTab = page.getByText('Download', { exact: true }).first();
    this.workaroundsTab = page.getByText('Workarounds', { exact: true }).first();
    this.themeTab = page.getByText('Theme', { exact: true }).first();
  }

  tabByName(name: string): Locator {
    return this.page.getByText(name, { exact: true }).first();
  }
}
