/* eslint-disable perfectionist/sort-imports */
/**
 * Shared helpers for Nexus Mods Mod Manager downloads and deployment in E2E tests.
 */
import fs from "node:fs";

import { expect, type ElectronApplication, type Locator, type Page } from "@playwright/test";

import { fixturePathToNative } from "../fixtures/game-setup/mock-tree";
import { ModsPage } from "../selectors/modsPage";
import { NavBar } from "../selectors/navbar";
import { acceptConsent } from "./consent";
import { installNxmCapture, waitForNxmUrl } from "./nxmCapture";
import { Timeouts } from "./timeouts";

/** Options for opening a Nexus mod page and capturing its `nxm://` URL. */
export interface NexusModManagerDownloadOptions {
  /** Optional Nexus URL assertion after the page loads. */
  expectedUrl?: RegExp;
  /** Optional Nexus file row name used to select a specific Mod Manager download link. */
  fileName?: string | RegExp;
  /** Error text used when no `nxm://` URL appears before timeout. */
  missingNxmMessage?: string;
  /** Nexus Mods page URL opened before clicking Mod Manager Download. */
  modUrl: string;
  /** Timeout override for network-dependent page actions and URL capture. */
  timeoutMs?: number;
}

/** Options for importing a Nexus Mod Manager download into Vortex. */
export interface InstallModManagerDownloadOptions extends NexusModManagerDownloadOptions {
  /** Expected Vortex Mods page row after the download imports. */
  expectedModRow: string | RegExp;
  /** Logged-in Nexus browser page used to capture the `nxm://` URL. */
  nexusPage: Page;
  /** Running Vortex Electron app that receives the captured URL. */
  vortexApp: ElectronApplication;
  /** Vortex renderer page used to verify the imported mod row. */
  vortexWindow: Page;
}

/** Options for deploying mods and checking deployed files. */
export interface DeployAndExpectFilesOptions {
  /** Error text used when expected files do not appear before timeout. */
  message?: string;
  /** Timeout override for deployment and file polling. */
  timeoutMs?: number;
}

/**
 * Download a mod from Nexus, forward it to Vortex, and verify it appears on the Mods page.
 *
 * @param options Nexus/Vortex handles plus expected download and row metadata.
 * @returns The captured `nxm://` URL that was forwarded to Vortex.
 * @throws Error when the Nexus download step cannot load `options.modUrl`, or `options.expectedUrl` is set and the loaded URL does not match it.
 * @throws Error when `options.fileName` is set and no matching Nexus file row becomes visible before timeout.
 * @throws Error when the matching Nexus file row has no `data-id` attribute.
 * @throws Error when the Nexus download step cannot find or click the resolved Mod Manager download trigger.
 * @throws Error when the optional requirements modal shows a Download action and that action cannot be clicked.
 * @throws Error when the Nexus download flow never yields an `nxm://` URL.
 * @throws Error when Vortex has no main window to receive the URL.
 * @throws Error when the Vortex Mods link cannot be clicked.
 * @throws Error when the expected mod row never appears in Vortex.
 */
export async function installModManagerDownload(
  options: InstallModManagerDownloadOptions,
): Promise<string> {
  const nxmUrl = await downloadNxmFromNexus(options.nexusPage, options);
  await forwardNxmUrlToVortex(options.vortexApp, nxmUrl);

  const navbar = new NavBar(options.vortexWindow);
  await navbar.modsLink.click();

  const modsPage = new ModsPage(options.vortexWindow);
  await expect(modsPage.modRow(options.expectedModRow)).toBeVisible({
    timeout: options.timeoutMs ?? Timeouts.NETWORK,
  });

  return nxmUrl;
}

/**
 * Open a Nexus mod page and capture its `nxm://` Mod Manager download URL.
 *
 * @param nexusPage Logged-in Nexus browser page used to load the mod page.
 * @param options Download URL, optional assertions, and timeout controls.
 * @returns The captured `nxm://` URL.
 * @throws Error when the Nexus page cannot load `options.modUrl` or `options.expectedUrl` is set and the loaded URL does not match it.
 * @throws Error when `options.fileName` is set and no matching Nexus file row becomes visible before timeout.
 * @throws Error when the matching Nexus file row has no `data-id` attribute.
 * @throws Error when the resolved Mod Manager download trigger is missing or cannot be clicked.
 * @throws Error when the optional requirements modal shows a Download action and that action cannot be clicked.
 * @throws Error when the download flow never yields an `nxm://` URL before timeout.
 */
export async function downloadNxmFromNexus(
  nexusPage: Page,
  options: NexusModManagerDownloadOptions,
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? Timeouts.NETWORK;

  await nexusPage.goto(options.modUrl, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  if (options.expectedUrl !== undefined) {
    await expect(nexusPage).toHaveURL(options.expectedUrl);
  }
  await acceptConsent(nexusPage);
  await installNxmCapture(nexusPage);

  const modManagerLink = await resolveModManagerDownloadLink(nexusPage, {
    fileName: options.fileName,
    timeoutMs,
  });
  await expect(modManagerLink).toBeVisible({ timeout: timeoutMs });
  await modManagerLink.click({ timeout: timeoutMs });

  await clickOptionalRequirementsDownload(nexusPage, timeoutMs);
  await nexusPage.waitForLoadState("load", { timeout: timeoutMs }).catch(() => undefined);
  await acceptConsent(nexusPage);
  // Reinstall the capture hook after optional Nexus navigation resets page scripts.
  await installNxmCapture(nexusPage);
  await clickOptionalSlowDownload(nexusPage, timeoutMs);

  const nxmUrl = await waitForNxmUrl(nexusPage, timeoutMs);
  if (nxmUrl === null) {
    throw new Error(
      options.missingNxmMessage ?? "No nxm:// URL appeared after the Mod Manager download click",
    );
  }
  return nxmUrl;
}

/**
 * Resolve the Nexus Mods Mod Manager download trigger, optionally scoped to a named file row.
 *
 * @param nexusPage Loaded Nexus Mods file page.
 * @param options Optional file-row matcher and timeout.
 * @returns Locator for the resolved download trigger, scoped to the matched file row when `options.fileName` is set.
 * @throws Error when `options.fileName` is set and no matching Nexus file row becomes visible before timeout.
 * @throws Error when the matching Nexus file row has no `data-id` attribute.
 */
export async function resolveModManagerDownloadLink(
  nexusPage: Page,
  options: Pick<NexusModManagerDownloadOptions, "fileName" | "timeoutMs"> = {},
): Promise<Locator> {
  const timeoutMs = options.timeoutMs ?? Timeouts.NETWORK;
  if (options.fileName === undefined) return modManagerDownloadTriggers(nexusPage).first();

  const header = nexusPage
    .locator(".file-expander-header")
    .filter({ hasText: options.fileName })
    .first();
  await expect(header).toBeVisible({ timeout: timeoutMs });

  const fileId = await header.getAttribute("data-id");
  if (fileId === null || fileId.length === 0) {
    throw new Error(`Nexus file row has no data-id: ${String(options.fileName)}`);
  }

  const fileDetails = nexusPage.locator(`dd[data-id="${escapeAttributeValue(fileId)}"]`).first();
  return modManagerDownloadTriggers(fileDetails).first();
}

/**
 * Send an `nxm://` URL to the running Vortex main window.
 *
 * @param vortexApp Running Vortex Electron app.
 * @param nxmUrl Captured Nexus download URL to forward.
 * @returns Nothing; the URL is sent to the active Vortex main window.
 * @throws Error when Vortex has no main window to receive the URL.
 */
export async function forwardNxmUrlToVortex(
  vortexApp: ElectronApplication,
  nxmUrl: string,
): Promise<void> {
  await vortexApp.evaluate(({ BrowserWindow }, url) => {
    const target = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes("index.html"),
    );
    if (target === undefined) {
      throw new Error("Vortex main window not found");
    }
    target.webContents.send("external-url", url, undefined, false);
  }, nxmUrl);
}

/**
 * Click deploy and wait for expected files to exist below the managed game root.
 *
 * @param vortexWindow Vortex renderer page currently able to reach the Mods page controls.
 * @param gamePath Absolute root path for the managed game fixture.
 * @param relativePaths File paths relative to `gamePath` that deployment should create.
 * @param options Timeout and failure-message overrides.
 * @returns Nothing; deployment is triggered and the expected files are confirmed on disk.
 * @throws Error when a path in `relativePaths` is empty, absolute, or escapes `gamePath`.
 * @throws Error when the deploy button is missing or cannot be clicked.
 * @throws Error when expected files do not exist after deployment.
 */
export async function deployAndExpectFiles(
  vortexWindow: Page,
  gamePath: string,
  relativePaths: readonly string[],
  options: DeployAndExpectFilesOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? Timeouts.NETWORK;
  const modsPage = new ModsPage(vortexWindow);

  await expect(modsPage.deployButton).toBeVisible({ timeout: timeoutMs });
  await modsPage.deployButton.click({ timeout: timeoutMs });

  const expectedPaths = relativePaths.map((relativePath) =>
    fixturePathToNative(gamePath, relativePath),
  );
  await expect
    .poll(() => expectedPaths.filter((filePath) => !fs.existsSync(filePath)), {
      timeout: timeoutMs,
      message: options.message ?? "Expected deployed mod files to exist",
    })
    .toEqual([]);
}

/** Returns Nexus Mod Manager download triggers rendered as either buttons or links. */
function modManagerDownloadTriggers(root: Page | Locator): Locator {
  return root
    .getByRole("button", { name: /^vortex$/i })
    .or(root.getByRole("link", { name: /mod manager download|vortex/i }));
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Clicks the optional requirements modal download action when Nexus shows a dependency popup.
 *
 * @param page Nexus browser page that may render the requirements modal.
 * @param timeoutMs Timeout used to wait for the modal and click its download action.
 */
async function clickOptionalRequirementsDownload(page: Page, timeoutMs: number): Promise<void> {
  const modal = page.locator('.popup, .modal, [role="dialog"], #popup-content').first();
  const modalAppeared = await modal
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);

  if (!modalAppeared) return;

  const modalDownloadButton = modal.getByRole("link", { name: /^download$/i }).first();
  if (await modalDownloadButton.isVisible().catch(() => false)) {
    await modalDownloadButton.click({ timeout: timeoutMs });
  }
}

/**
 * Clicks the optional Slow download button when Nexus routes through the manual download page.
 *
 * @param page Nexus browser page that may render the Slow download button.
 * @param timeoutMs Timeout used for the visibility check and click.
 */
async function clickOptionalSlowDownload(page: Page, timeoutMs: number): Promise<void> {
  const slowDownloadButton = page.getByRole("button", { name: "Slow download" }).first();
  if (await slowDownloadButton.isVisible().catch(() => false)) {
    await slowDownloadButton.click({ timeout: timeoutMs }).catch(() => undefined);
  }
}
