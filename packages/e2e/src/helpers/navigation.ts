import { expect, type Page } from "@playwright/test";

import { NavBar } from "../selectors/navbar";
import { SettingsPage } from "../selectors/settings";

export async function navigateToSettings(page: Page): Promise<void> {
  const navbar = new NavBar(page);
  await navbar.settingsLink.click();
  await expect(new SettingsPage(page).interfaceTab).toBeVisible();
}

/**
 * Navigate to the per-game Health Check page via its sidebar entry. Requires a
 * managed, active game (the entry only renders inside the per-game workspace).
 * The sidebar label is "Health check" (lower-case "c"), distinct from the
 * "Health Check" page heading, so match exactly to avoid selecting the heading.
 */
export async function navigateToHealthCheck(page: Page): Promise<void> {
  await page.getByText("Health check", { exact: true }).first().click();
  await expect(page.locator("#health-check-page")).toBeVisible();
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
}
