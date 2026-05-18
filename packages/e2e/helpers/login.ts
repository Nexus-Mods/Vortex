import {
  type Browser,
  chromium,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";

import { test } from "../fixtures/vortex-app";
import { LoginPage } from "../selectors/loginPage";
import { freeUser, type NexusUser } from "./users";

export interface LoginToNexusOptions {
  /**
   * When true, the auth browser is left open after login completes and is
   * returned to the caller. The caller is then responsible for closing it.
   * Defaults to false (browser is closed once login succeeds).
   */
  keepBrowser?: boolean;
  /**
   * Override headless mode for the auth browser. Defaults to !PWDEBUG.
   * Set to false when the caller needs to navigate Cloudflare-protected
   * pages on www.nexusmods.com after login — Cloudflare's JS challenge
   * generally blocks headless browsers.
   */
  headless?: boolean;
  /**
   * Path to a Playwright storage-state file (cookies + localStorage) to
   * preload into the auth browser context. Use this to skip credential
   * entry — if Nexus session cookies are already valid, the OAuth URL
   * will land directly on the consent screen.
   *
   * Generate with `pnpm -F @vortex/e2e auth:capture`.
   * The file location is gitignored (`packages/e2e/.auth/`); never commit it.
   */
  storageStatePath?: string;
}

export interface LoginToNexusResult {
  browser: Browser;
  page: Page;
}

export async function loginToNexus(
  vortexApp: ElectronApplication,
  vortexWindow: Page,
  user: NexusUser = freeUser,
  options: LoginToNexusOptions = {},
): Promise<LoginToNexusResult | null> {
  const { username, password } = user;
  let loginPage: Page | null = null;
  let authBrowser: Browser | null = null;
  let authPage: Page | null = null;
  let leakBrowser = false;

  const vortexLoginPage = new LoginPage(vortexWindow);

  await test.step("Verify dashboard has loaded", async () => {
    const bodyText = await vortexWindow.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  await test.step("Click the login button", async () => {
    const popupPromise = vortexWindow.waitForEvent("popup").catch(() => null);
    const appWindowPromise = vortexApp.waitForEvent("window").catch(() => null);

    await expect(vortexLoginPage.vortexLoginButton).toBeVisible();
    await vortexLoginPage.vortexLoginButton.click();

    loginPage = (await popupPromise) ?? (await appWindowPromise);
  });

  try {
    await test.step("Verify the browser has opened to the login page", async () => {
      await expect(vortexLoginPage.oauthUrlField).toBeVisible();

      const oauthUrl = await vortexLoginPage.oauthUrlField.inputValue();
      expect(oauthUrl).toMatch(/^https?:\/\//i);

      if (loginPage !== null) {
        await loginPage.waitForLoadState("domcontentloaded");
        await expect(loginPage).toHaveURL(/nexusmods|users\./i);
      }

      // Match the browser fingerprint used by scripts/capture-auth-state.mjs
      // so that Cloudflare's cf_clearance cookie (saved into storage state)
      // remains valid. Real Chrome + AutomationControlled disabled +
      // navigator.webdriver spoof matches what was cleared during warmup.
      const headless = options.headless ?? !process.env.PWDEBUG;
      const launchArgs = ["--disable-blink-features=AutomationControlled"];
      try {
        authBrowser = await chromium.launch({
          headless,
          channel: "chrome",
          args: launchArgs,
        });
      } catch {
        authBrowser = await chromium.launch({ headless, args: launchArgs });
      }
      const authContext = await authBrowser.newContext(
        options.storageStatePath !== undefined
          ? { storageState: options.storageStatePath }
          : undefined,
      );
      await authContext.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });
      authPage = await authContext.newPage();

      await authPage.goto(oauthUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await expect(authPage).toHaveURL(/nexusmods|users\./i);
    });

    // If we loaded a storage state with valid Nexus cookies, the OAuth URL
    // lands directly on the consent screen and the login form is skipped.
    const skipCredentials =
      options.storageStatePath !== undefined &&
      authPage !== null &&
      (await new LoginPage(authPage).oauthPermissionTitle
        .isVisible({ timeout: 10_000 })
        .catch(() => false));

    if (!skipCredentials) {
      await test.step("Login with Nexus Mods credentials", async () => {
        if (authPage === null) {
          throw new Error("Auth page was not available for login.");
        }

        const nexusLoginPage = new LoginPage(authPage);

        await test.step("Enter username", async () => {
          await nexusLoginPage.usernameInput.fill(username);
        });
        await test.step("Enter password", async () => {
          await nexusLoginPage.passwordInput.fill(password);
        });
        await test.step("Submit login form", async () => {
          await expect(nexusLoginPage.submitLoginButton).toBeEnabled();
          await nexusLoginPage.submitLoginButton.click();
        });
        await test.step("Verify OAuth permission screen", async () => {
          try {
            await expect(nexusLoginPage.oauthPermissionTitle).toBeVisible();
          } catch (err) {
            // On failure (rejected creds, captcha, 2FA, site change), drop a
            // screenshot into test-results/ so the cause is obvious. The
            // test-results directory is gitignored and cleaned each run.
            if (authPage !== null) {
              await authPage
                .screenshot({
                  path: `test-results/auth-page-failure-${Date.now()}.png`,
                  fullPage: true,
                })
                .catch(() => undefined);
              console.error(
                `[loginToNexus] OAuth permission screen never appeared. URL=${authPage.url()} Title=${await authPage
                  .title()
                  .catch(() => "(no title)")}. See test-results/auth-page-failure-*.png.`,
              );
            }
            throw err;
          }
        });
      });
    }

    await test.step("Click Authorise", async () => {
      if (authPage === null) {
        throw new Error("Auth page was not available for authorisation.");
      }

      const nexusLoginPage = new LoginPage(authPage);

      await expect(nexusLoginPage.authoriseButton).toBeVisible();
      await nexusLoginPage.authoriseButton.click();

      await expect(nexusLoginPage.authorisationSuccessTitle).toBeVisible();
    });

    leakBrowser = options.keepBrowser === true;
  } finally {
    if (!leakBrowser) {
      const browserToClose = authBrowser as Browser | null;
      authBrowser = null;
      authPage = null;
      if (browserToClose !== null) {
        await browserToClose.close();
      }
    }
  }

  await test.step("Verify logged in state in Vortex", async () => {
    const vortexLoginPage = new LoginPage(vortexWindow);

    const bodyText = await vortexWindow.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    await vortexWindow.bringToFront();

    if (await vortexLoginPage.vortexLoginDialog.isVisible().catch(() => false)) {
      await vortexWindow.keyboard.press("Escape").catch(() => undefined);
    }

    await expect(vortexLoginPage.vortexLoginDialog).toBeHidden();
    await expect(vortexLoginPage.profileButton).toBeVisible();
    await vortexLoginPage.profileButton.click();
    await expect(vortexLoginPage.loggedInMenuItem).toBeVisible();
  });

  if (leakBrowser && authBrowser !== null && authPage !== null) {
    return { browser: authBrowser, page: authPage };
  }
  return null;
}
