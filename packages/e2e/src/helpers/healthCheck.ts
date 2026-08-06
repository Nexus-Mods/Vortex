import { type ElectronApplication, expect, type Page } from "@playwright/test";

import {
  SDV_FILE_REQUIREMENT_MOD_URL,
  SDV_MOD_REQUIREMENT_MOD_URL,
  SDV_OR_FILE_REQUIREMENT_MOD_URL,
} from "../constants";
import { test } from "../fixtures/vortex-app";
import {
  HealthCheckDetail,
  HealthCheckPage,
  HealthCheckSuggestions,
  HealthCheckWarnings,
} from "../selectors/healthCheck";
import { downloadModViaModManager } from "./modDownload";
import { navigateToHealthCheck } from "./navigation";
import { dismissAllNotifications } from "./notifications";
import { Timeouts } from "./timeouts";

/**
 * Install a file-requirement fixture mod (with its requirements unsatisfied), open
 * Health Check and refresh — leaving the single file-requirements warning visible
 * on the list. Returns the page + warnings POMs for the caller to drive.
 *
 * Shared by the missing- and OR-requirement openers so the download → open →
 * refresh → dismiss-notifications flow lives in one place; uses `test.step`
 * internally so each test's trace stays granular.
 */
async function installAndSurfaceFileWarning(
  nexusPage: Page,
  vortexApp: ElectronApplication,
  vortexWindow: Page,
  modUrl: string,
): Promise<{ hc: HealthCheckPage; warnings: HealthCheckWarnings }> {
  const hc = new HealthCheckPage(vortexWindow);
  const warnings = new HealthCheckWarnings(vortexWindow);

  await test.step("Install the requiring mod with its required files absent", async () => {
    await downloadModViaModManager(nexusPage, vortexApp, modUrl);
  });

  await test.step("Open Health Check and refresh", async () => {
    await navigateToHealthCheck(vortexWindow);
    await hc.refreshButton.click();
    await expect(warnings.row()).toBeVisible({ timeout: Timeouts.NETWORK });
    // Persistent notifications auto-open a tray that overlays the top-right and
    // intercepts clicks on the tabs' buttons and a row's hide/feedback icons;
    // clear it once the check has settled so it stays shut.
    await dismissAllNotifications(vortexWindow);
  });

  return { hc, warnings };
}

/**
 * The 49786 fixture: a mod whose main file declares two missing file requirements,
 * surfaced as one "download" warning.
 */
export function openFileRequirementWarning(
  nexusPage: Page,
  vortexApp: ElectronApplication,
  vortexWindow: Page,
): Promise<{ hc: HealthCheckPage; warnings: HealthCheckWarnings }> {
  return installAndSurfaceFileWarning(
    nexusPage,
    vortexApp,
    vortexWindow,
    SDV_FILE_REQUIREMENT_MOD_URL,
  );
}

/**
 * The 47938 fixture: a mod whose file requirement is satisfiable by more than one
 * alternative — an OR — surfaced as one "pick one of these" warning.
 */
export function openOrFileRequirementWarning(
  nexusPage: Page,
  vortexApp: ElectronApplication,
  vortexWindow: Page,
): Promise<{ hc: HealthCheckPage; warnings: HealthCheckWarnings }> {
  return installAndSurfaceFileWarning(
    nexusPage,
    vortexApp,
    vortexWindow,
    SDV_OR_FILE_REQUIREMENT_MOD_URL,
  );
}

/**
 * Open the sole warning's detail view from the list and confirm it rendered.
 * Returns the detail POM.
 */
export async function openWarningDetail(
  vortexWindow: Page,
  warnings: HealthCheckWarnings,
): Promise<HealthCheckDetail> {
  const detail = new HealthCheckDetail(vortexWindow);

  await test.step("Open the warning detail view", async () => {
    await warnings.title().click();
    await expect(detail.warningTitle).toBeVisible();
  });

  return detail;
}

/**
 * Install the mod-requirement fixture mod (46415) with its required mod absent,
 * open Health Check and refresh — leaving the single page-level requirement
 * "suggestion" visible on the list. Returns the page + suggestions POMs.
 *
 * The suggestion is populated by the mod-requirements check's Nexus round-trip
 * (slower than the file check), so the wait uses the network budget.
 */
export async function openModRequirementSuggestion(
  nexusPage: Page,
  vortexApp: ElectronApplication,
  vortexWindow: Page,
): Promise<{ hc: HealthCheckPage; suggestions: HealthCheckSuggestions }> {
  const hc = new HealthCheckPage(vortexWindow);
  const suggestions = new HealthCheckSuggestions(vortexWindow);

  await test.step("Install a mod that declares a page-level requirement", async () => {
    await downloadModViaModManager(nexusPage, vortexApp, SDV_MOD_REQUIREMENT_MOD_URL);
  });

  await test.step("Open Health Check and refresh", async () => {
    await navigateToHealthCheck(vortexWindow);
    await hc.refreshButton.click();
    await expect(suggestions.row()).toBeVisible({ timeout: Timeouts.NETWORK });
    await dismissAllNotifications(vortexWindow);
  });

  return { hc, suggestions };
}
