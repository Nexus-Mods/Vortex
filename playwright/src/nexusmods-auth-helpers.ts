/* eslint-disable max-lines-per-function */
import type { Page, BrowserContext } from "@playwright/test";
import { chromium } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";
import type { ChromeBrowserInstance } from "./chrome-browser-helpers";
import { launchRealChrome, closeRealChrome } from "./chrome-browser-helpers";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

/**
 * Builds a Nexus Mods download URL from game/mod/file IDs
 *
 * @param gameId - Game domain (e.g., 'stardewvalley', 'skyrimspecialedition')
 * @param modId - Mod ID number
 * @param fileId - File ID number
 * @returns Full URL to the mod download page
 */
export function buildModDownloadUrl(
  gameId: string,
  modId: number,
  fileId: number,
): string {
  return `https://www.nexusmods.com/${gameId}/mods/${modId}?tab=files&file_id=${fileId}`;
}

/**
 * Builds the Nexus Mods download popup URL
 * This is the actual URL that has the download button
 *
 * @param gameId - Game domain (e.g., 'stardewvalley', 'skyrimspecialedition')
 * @param fileId - File ID number
 * @returns Full URL to the download popup
 */
export function buildModDownloadPopupUrl(
  fileId: number,
  gameId: string,
): string {
  // Game ID mapping (this is the internal Nexus game ID, not the domain)
  const gameIdMap: Record<string, number> = {
    stardewvalley: 1303,
    skyrimspecialedition: 1704,
    skyrim: 110,
    fallout4: 1151,
  };

  const nexusGameId = gameIdMap[gameId] || 1303; // Default to Stardew Valley
  return `https://www.nexusmods.com/Core/Libs/Common/Widgets/DownloadPopUp?id=${fileId}&game_id=${nexusGameId}&nmm=1`;
}

interface OAuthData {
  url: string;
  host: string;
  client_id: string | null;
  redirect_uri: string | null;
  state: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
}

interface LoginResult {
  success: boolean;
  error?: string;
  browserContext?: any; // BrowserContext from Playwright
  browser?: any; // Browser object from connectOverCDP - needed to keep connection alive
}

/**
 * Blocks Vortex from opening external browser for OAuth flow
 * This prevents the system default browser from interfering with Playwright tests
 */
export async function blockExternalBrowserLaunch(
  mainWindow: Page,
): Promise<void> {
  await mainWindow.evaluate(() => {
    // Block all methods that Vortex uses to open external URLs
    const { shell, ipcRenderer } = (window as any).require("electron");

    // Override shell.openExternal
    shell.openExternal = (url: string) => {
      console.log("Blocked shell.openExternal:", url);
      return Promise.resolve();
    };

    // Block IPC calls to open external URLs
    const originalSend = ipcRenderer.send.bind(ipcRenderer);
    ipcRenderer.send = (channel: string, ...args: any[]) => {
      if (channel === "__opn_win32") {
        console.log("Blocked __opn_win32 IPC:", args[0]);
        return;
      }
      return originalSend(channel, ...args);
    };

    // Block winapi ShellExecuteEx if available
    try {
      const winapi = (window as any).require("winapi-bindings");
      if (winapi && winapi.ShellExecuteEx) {
        winapi.ShellExecuteEx = (options: any) => {
          console.log("Blocked winapi.ShellExecuteEx:", options);
        };
      }
    } catch (err) {
      // winapi-bindings not available, that's okay
    }
  });
}

/**
 * Extracts the OAuth URL from Vortex's Redux store
 */
export async function extractOAuthUrl(
  mainWindow: Page,
): Promise<OAuthData | { error: string }> {
  return await mainWindow.evaluate(() => {
    try {
      const remote = (window as any).require("@electron/remote");
      const getReduxState = remote.getGlobal("getReduxState");
      const stateJson = getReduxState();
      const state = JSON.parse(stateJson);
      const oauthUrl = state?.session?.nexus?.oauthPending;

      if (oauthUrl) {
        const url = new URL(oauthUrl);
        return {
          url: oauthUrl,
          host: url.host,
          client_id: url.searchParams.get("client_id"),
          redirect_uri: url.searchParams.get("redirect_uri"),
          state: url.searchParams.get("state"),
          code_challenge: url.searchParams.get("code_challenge"),
          code_challenge_method: url.searchParams.get("code_challenge_method"),
        };
      }

      return { error: "No OAuth URL found in Redux state" };
    } catch (err) {
      return {
        error: `Error accessing Redux store: ${(err as Error).message}`,
      };
    }
  });
}

/**
 * Downloads a mod from Nexus Mods using an authenticated browser context
 *
 * @param browserContext - Authenticated browser context from loginToNexusMods
 * @param modUrl - URL to the mod page (e.g., https://nexusmods-staging.cluster.nexdev.uk/stardewvalley/mods/1?tab=files&file_id=1)
 * @param testRunDir - Optional directory for saving screenshots
 * @returns Promise<boolean> - true if download was initiated successfully
 */
export async function downloadModFromNexus(
  browserContext: any,
  popupUrl: string,
  testRunDir?: string,
): Promise<boolean> {
  try {
    console.log(`\n=== Starting Mod Download ===`);
    console.log(`Download popup URL: ${popupUrl}`);

    // Create a new page in the authenticated context
    const page = await browserContext.newPage();
    console.log("✓ New page created");

    // Set up request/response logging to capture NXM protocol links
    page.on("request", (request: any) => {
      const url = request.url();
      if (url.startsWith("nxm://")) {
        console.log("🔗 NXM Protocol Link Detected:", url);
      }
    });

    // Navigate to the popup URL (it will redirect to files page with &nmm=1)
    console.log("Navigating to popup URL (will redirect)...");
    await page.goto(popupUrl, { waitUntil: "networkidle" });
    console.log("✓ Page loaded after redirect");
    console.log(`  Current URL: ${page.url()}`);

    if (testRunDir) {
      await page.screenshot({
        path: path.join(testRunDir, "after-redirect.png"),
      });
    }

    // Wait for page to fully load
    console.log("Waiting for page to fully load...");
    await page.waitForTimeout(3000);

    // Look for the "Start download" button
    console.log("Looking for Start Download button...");
    const startDownloadButton = page.locator("button#startDownloadButton");
    const isVisible = await startDownloadButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      const buttonText = await startDownloadButton.textContent();
      const dataDownloadUrl =
        await startDownloadButton.getAttribute("data-download-url");
      console.log(`✓ Found Start Download button`);
      console.log(`  Button text: "${buttonText?.trim()}"`);
      console.log(`  NXM URL: ${dataDownloadUrl}`);
      console.log("Clicking Start Download button...");

      await startDownloadButton.click();
      console.log("✓ Start Download button clicked");

      // Wait for NXM link to be triggered
      await page.waitForTimeout(3000);

      if (testRunDir) {
        await page.screenshot({
          path: path.join(testRunDir, "download-initiated.png"),
        });
      }

      // Log current page state
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`Page after click:`);
      console.log(`  URL: ${currentUrl}`);
      console.log(`  Title: ${pageTitle}`);

      console.log("✓ Download initiated - Vortex should receive NXM link");
      console.log("=== Mod Download Complete ===\n");

      await page.close();
      return true;
    } else {
      console.error(
        "❌ Could not find Start Download button (button#startDownloadButton)",
      );

      // Log what we can find
      const allButtons = await page.locator("button").allTextContents();
      console.log("Available buttons on page:", allButtons.slice(0, 20));

      const pageContent = await page.textContent("body");
      console.log("Page content preview:", pageContent?.substring(0, 300));

      if (testRunDir) {
        await page.screenshot({
          path: path.join(testRunDir, "no-download-button.png"),
        });
      }
      await page.close();
      return false;
    }
  } catch (err) {
    console.error("❌ Error downloading mod:", err);
    return false;
  }
}

/**
 * Logs out from Nexus Mods if currently logged in
 */
export async function logoutFromNexusMods(
  mainWindow: Page,
  testRunDir?: string,
): Promise<void> {
  const logoutLink = mainWindow
    .locator("div.logout-button")
    .locator("a")
    .filter({ hasText: "Log out" });

  if (await logoutLink.isVisible({ timeout: 2000 })) {
    console.log("Logging out from Nexus Mods...");
    await logoutLink.click();
    if (testRunDir) {
      await mainWindow.screenshot({
        path: path.join(testRunDir, "01-logged-out.png"),
      });
    }
  }
}

interface RealChromeLoginResult {
  success: boolean;
  error?: string;
  browserContext?: BrowserContext;
  browser?: any; // Browser object from connectOverCDP - needed to keep connection alive
  chromeInstance?: ChromeBrowserInstance;
}

/**
 * Performs OAuth login using real Chrome browser (with CDP)
 * This is a variant of performOAuthLogin that uses real Chrome instead of Playwright's bundled browser
 * Supports manual Cloudflare Turnstile captcha solving
 *
 * @param mainWindow - Vortex main window
 * @param oauthUrl - OAuth URL extracted from Vortex
 * @param chromeInstance - Real Chrome browser instance
 * @param username - Nexus Mods username
 * @param password - Nexus Mods password
 * @param testRunDir - Optional directory for screenshots
 * @returns Promise<LoginResult> with browser context
 */
async function performOAuthLoginWithRealChrome(
  mainWindow: Page,
  oauthUrl: string,
  chromeInstance: ChromeBrowserInstance,
  username: string,
  password: string,
  testRunDir?: string,
): Promise<LoginResult> {
  try {
    // Connect Playwright to the running Chrome instance via CDP
    const browser = await chromium.connectOverCDP(chromeInstance.cdpUrl);
    const context = browser.contexts()[0];
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    // Navigate to OAuth URL (it will redirect to login page if not logged in)
    console.log("Navigating to OAuth URL (will redirect to login)...");
    await page.goto(oauthUrl);

    if (testRunDir) {
      await page.screenshot({
        path: path.join(testRunDir, "chrome-oauth-redirected-to-login.png"),
      });
    }

    // Wait for login page
    await page.waitForSelector("#user_login", { state: "visible" });

    // Fill in login credentials
    console.log("Filling in login credentials...");
    await page.fill("#user_login", username);
    await page.fill("#password", password);

    if (testRunDir) {
      await page.screenshot({
        path: path.join(testRunDir, "chrome-login-filled.png"),
      });
    }

    // Wait for Cloudflare Turnstile captcha to be solved (manually by user)
    console.log(
      "Waiting for Cloudflare captcha to be solved (please solve it manually)...",
    );
    await page.waitForFunction(
      () => {
        const input = document.querySelector(
          'input[name="cf-turnstile-response"]',
        ) as HTMLInputElement;
        return input && input.value && input.value.length > 0;
      },
      { timeout: 60000 },
    );

    console.log("Captcha solved, submitting login form...");

    // Submit the login form
    await page.click('input[type="submit"][name="commit"]');
    await page.waitForTimeout(2000);

    if (testRunDir) {
      await page.screenshot({
        path: path.join(testRunDir, "chrome-login-submitted.png"),
      });
    }

    console.log("✓ Login completed, now handling OAuth flow...");

    // Navigate to OAuth URL again (now logged in, should show authorize page)
    console.log("Navigating to OAuth URL again...");
    await page.goto(oauthUrl);

    if (testRunDir) {
      await page.screenshot({
        path: path.join(testRunDir, "chrome-oauth-authorize-page.png"),
      });
    }

    // Check for errors
    const pageContent = await page.textContent("body");
    if (pageContent?.includes("invalid") || pageContent?.includes("error")) {
      console.log(
        "Error detected on OAuth page:",
        pageContent.substring(0, 500),
      );
      return { success: false, error: "OAuth page returned an error" };
    }

    // Click the Authorize button
    console.log("Clicking Authorize button...");
    await page.locator('input[type="submit"][value="Authorise"]').click();

    if (testRunDir) {
      await page.screenshot({
        path: path.join(testRunDir, "chrome-oauth-authorized.png"),
      });
    }

    // Wait for success page and get the redirect link
    await page.waitForURL("**/oauth/success**", { timeout: 10000 });
    console.log("OAuth authorization completed");

    const redirectLink = await page.locator("a#redirect").getAttribute("href");

    if (!redirectLink) {
      return { success: false, error: "OAuth redirect link not found" };
    }

    console.log("OAuth redirect URL received");

    // Navigate to the loopback URL to complete the OAuth flow
    console.log("Navigating to loopback URL...");
    await page.goto(redirectLink);

    if (testRunDir) {
      await page.screenshot({
        path: path.join(testRunDir, "chrome-oauth-callback.png"),
      });
    }

    // Wait for Vortex to process the OAuth callback
    await mainWindow.waitForTimeout(2000);

    if (testRunDir) {
      await mainWindow.screenshot({
        path: path.join(testRunDir, "vortex-logged-in.png"),
      });
    }

    console.log("✓ OAuth flow completed - Vortex is now logged in");

    // Leave the page open (don't close it, we'll reuse the browser for downloads)
    // Return the browser context AND browser object so they can be reused
    // IMPORTANT: We must return the browser object to keep the CDP connection alive
    return { success: true, browserContext: context, browser };
  } catch (err) {
    console.error("Error during OAuth login with real Chrome:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Logs into Nexus Mods using the user's real Chrome browser and completes OAuth flow
 * Uses "homemade incognito mode" with a temporary profile
 * Supports manual Cloudflare Turnstile captcha solving
 *
 * @param mainWindow - Vortex main window (needed to extract OAuth URL and block external browser)
 * @param testRunDir - Optional directory for saving screenshots
 * @returns Promise<RealChromeLoginResult> with browser context and Chrome instance
 *
 * @example
 * const loginResult = await loginToNexusModsWithRealChrome(mainWindow, testRunDir);
 * if (loginResult.success) {
 *   // Use loginResult.browserContext for authenticated requests
 *   await downloadModFromNexus(loginResult.browserContext, modUrl, testRunDir);
 * }
 * // Cleanup
 * if (loginResult.browserContext) await loginResult.browserContext.close();
 * if (loginResult.chromeInstance) await closeRealChrome(loginResult.chromeInstance);
 */
export async function loginToNexusModsWithRealChrome(
  mainWindow: Page,
  testRunDir?: string,
): Promise<RealChromeLoginResult> {
  let chromeInstance: ChromeBrowserInstance | undefined;

  try {
    // Get credentials from environment variables
    const username = process.env.PLAYWRIGHT_NEXUS_USERNAME;
    const password = process.env.PLAYWRIGHT_NEXUS_PASSWORD;

    if (!username || !password) {
      return {
        success: false,
        error:
          "PLAYWRIGHT_NEXUS_USERNAME and PLAYWRIGHT_NEXUS_PASSWORD must be set in .env file",
      };
    }

    // Block Vortex from opening external browser for OAuth
    await blockExternalBrowserLaunch(mainWindow);

    // Click login button in Vortex to trigger OAuth flow
    console.log("Clicking login button in Vortex...");
    const loginButton = mainWindow.locator("button#btn-login");
    await loginButton.click();
    if (testRunDir) {
      await mainWindow.screenshot({
        path: path.join(testRunDir, "vortex-login-clicked.png"),
      });
    }

    // Wait for OAuth URL to be generated
    await mainWindow.waitForTimeout(1000);

    // Extract OAuth URL from Vortex Redux store
    const oauthData = await extractOAuthUrl(mainWindow);

    if (!oauthData || !("url" in oauthData)) {
      return {
        success: false,
        error:
          "Could not extract OAuth URL from Vortex: " +
          (oauthData as { error: string }).error,
      };
    }

    const oauthUrl = oauthData.url;
    console.log("OAuth URL extracted from Vortex");

    // Launch real Chrome with remote debugging
    console.log("Launching Chrome browser...");
    chromeInstance = await launchRealChrome();

    // Perform OAuth login using real Chrome (handles login + captcha + OAuth flow)
    const loginResult = await performOAuthLoginWithRealChrome(
      mainWindow,
      oauthUrl,
      chromeInstance,
      username,
      password,
      testRunDir,
    );

    if (!loginResult.success) {
      // Clean up Chrome on failure
      if (chromeInstance) {
        await closeRealChrome(chromeInstance);
      }
      return {
        success: false,
        error: loginResult.error,
      };
    }

    // Return success with browser context, browser object, and Chrome instance
    return {
      success: true,
      browserContext: loginResult.browserContext,
      browser: loginResult.browser,
      chromeInstance,
    };
  } catch (err) {
    console.error("Error during Chrome login:", err);

    // Clean up on error
    if (chromeInstance) {
      try {
        await closeRealChrome(chromeInstance);
      } catch (e) {
        /* ignore */
      }
    }

    return {
      success: false,
      error: (err as Error).message,
    };
  }
}
