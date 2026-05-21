import { expect, type Page } from "@playwright/test";

import { NavBar } from "../selectors/navbar";
import { SettingsPage } from "../selectors/settings";

export async function navigateToSettings(page: Page): Promise<void> {
  const navbar = new NavBar(page);
  await navbar.settingsLink.click();
  await expect(new SettingsPage(page).interfaceTab).toBeVisible();
}

/**
 * Navigate to the Games page via the home/games link.
 */
export async function navigateToGames(page: Page): Promise<void> {
  const navbar = new NavBar(page);
  if (await navbar.gamesLink.isVisible().catch(() => false)) {
    await navbar.gamesLink.click();
  } else if (await navbar.homeLink.isVisible().catch(() => false)) {
    await navbar.homeLink.click();
  }
  await page.waitForTimeout(1000);
}
