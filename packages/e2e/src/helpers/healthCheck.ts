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
    await dismissAllNotifications(vortexWindow);
  });

  return { hc, warnings };
}

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
