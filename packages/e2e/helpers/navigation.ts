import type { Page } from '@playwright/test';

import { NavBar } from '../selectors/navbar';

/**
 * Navigate to the Settings/Preferences page via the sidebar.
 */
export async function navigateToSettings(page: Page): Promise<void> {
  const navbar = new NavBar(page);
  await navbar.settingsLink.click();
  await page.waitForTimeout(1000);
}

/**
 * Navigate to the Games page via the home/games link.
 */
export async function navigateToGames(page: Page): Promise<void> {
  const navbar = new NavBar(page);
  if (await navbar.gamesLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await navbar.gamesLink.click();
  } else if (await navbar.homeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await navbar.homeLink.click();
  }
  await page.waitForTimeout(1000);
}
