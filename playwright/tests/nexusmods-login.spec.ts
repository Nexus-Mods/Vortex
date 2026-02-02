/* eslint-disable max-lines-per-function */
import { test } from "@playwright/test";
import { launchVortex, closeVortex } from "../src/vortex-helpers";
import {
  loginToNexusModsWithRealChrome,
  logoutFromNexusMods,
} from "../src/nexusmods-auth-helpers";
import type { ChromeBrowserInstance } from "../src/chrome-browser-helpers";
import { closeRealChrome } from "../src/chrome-browser-helpers";
import type { BrowserContext } from "@playwright/test";

const TEST_NAME = "nexusmods-login";

test("can log into nexusmods.com", async () => {
  const { app, mainWindow, testRunDir, appProcess, pid, userDataDir } =
    await launchVortex(TEST_NAME);

  let loginResult:
    | {
        success: boolean;
        error?: string;
        browserContext?: BrowserContext;
        chromeInstance?: ChromeBrowserInstance;
      }
    | undefined;

  try {
    // Logout if already logged in
    await logoutFromNexusMods(mainWindow, testRunDir);

    // Perform login using real Chrome
    console.log("Logging in to Nexus Mods (production)...");
    loginResult = await loginToNexusModsWithRealChrome(mainWindow, testRunDir);

    if (!loginResult.success) {
      console.error("Login failed:", loginResult.error);
      throw new Error(loginResult.error);
    }

    console.log("✓ Login successful!");
  } finally {
    // Clean up Chrome instance (this also closes the browser context)
    // NOTE: Don't close browserContext separately - it's the default context from CDP
    // and closing it would disconnect from Chrome prematurely
    if (loginResult?.chromeInstance) {
      try {
        await closeRealChrome(loginResult.chromeInstance);
      } catch (e) {
        console.error("Failed to close Chrome:", e);
      }
    }

    await closeVortex(app, appProcess, pid, userDataDir);
    console.log(`Test completed. Results in: ${testRunDir}`);
  }
});
