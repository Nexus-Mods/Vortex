import { type Browser, expect, type ElectronApplication, type Page } from "@playwright/test";

import { test } from "../fixtures/vortex-app";
import { LoginPage } from "../selectors/loginPage";
import { launchNexusBrowser } from "./nexusBrowser";
import { GlobalTimeouts, Timeouts } from "./timeouts";
import { freeUser, type NexusUser } from "./users";

export interface LoginToNexusOptions {
  /**
   * When true, the auth browser is left open after login completes and is
   * returned to the caller. The caller is then responsible for closing it.
   * Defaults to false (browser is closed once login succeeds).
   */
  keepBrowser?: boolean;
  /**
   * Path to a Playwright storage-state file (cookies + localStorage) to
   * preload into the auth browser context. When Nexus session cookies are
   * already valid, the OAuth URL lands directly on the consent screen,
   * skipping credential entry.
   *
   * Generate with `pnpm -F @vortex/e2e auth:capture`.
   * The file location is gitignored (`packages/e2e/.auth/`); never commit it.
   */
  storageStatePath?: string;
  /**
   * When true, skips test.step() wrappers. Pass true when calling from a
   * worker fixture, which runs outside any test context.
   */
  skipSteps?: boolean;
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
  let authBrowser: Browser | null = null;
  let authPage: Page | null = null;
  let leakBrowser = false;

  const step =
    options.skipSteps === true
      ? (_label: string, fn: () => Promise<void>) => fn()
      : (label: string, fn: () => Promise<void>) => test.step(label, fn);

  const vortexLoginPage = new LoginPage(vortexWindow);

  await step("Verify dashboard has loaded", async () => {
    const bodyText = await vortexWindow.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  await step("Click the login button", async () => {
    await expect(vortexLoginPage.vortexLoginButton).toBeVisible({ timeout: Timeouts.NETWORK });
    await vortexLoginPage.vortexLoginButton.click();
  });

  try {
    await step("Verify the browser has opened to the login page", async () => {
      await expect(vortexLoginPage.oauthUrlField).toBeVisible();

      const oauthUrl = await vortexLoginPage.oauthUrlField.inputValue();
      expect(oauthUrl).toMatch(/^https?:\/\//i);

      const nexusBrowser = await launchNexusBrowser({
        storageStatePath: options.storageStatePath,
      });
      authBrowser = nexusBrowser.browser;
      authPage = nexusBrowser.page;

      await authPage.goto(oauthUrl, {
        waitUntil: "domcontentloaded",
        timeout: Timeouts.NETWORK,
      });
      await expect(authPage).toHaveURL(/nexusmods|users\./i);
    });

    // If we loaded a storage state with valid Nexus cookies, the OAuth URL
    // lands directly on the consent screen and the login form is skipped.
    const skipCredentials =
      options.storageStatePath !== undefined &&
      authPage !== null &&
      (await expect(new LoginPage(authPage).oauthPermissionTitle)
        .toBeVisible()
        .then(() => true)
        .catch(() => false));

    if (!skipCredentials) {
      await step("Login with Nexus Mods credentials", async () => {
        if (authPage === null) {
          throw new Error("Auth page was not available for login.");
        }

        const nexusLoginPage = new LoginPage(authPage);

        await step("Enter username", async () => {
          await nexusLoginPage.usernameInput.fill(username);
        });
        await step("Enter password", async () => {
          await nexusLoginPage.passwordInput.fill(password);
        });
        await step("Submit login form", async () => {
          await expect(nexusLoginPage.submitLoginButton).toBeEnabled();
          await nexusLoginPage.submitLoginButton.click();
        });
        await step("Verify OAuth permission screen", async () => {
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

    await step("Click Authorise", async () => {
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

  await step("Verify logged in state in Vortex", async () => {
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
    await expect(vortexLoginPage.loggedInMenuItem).toBeVisible({ timeout: Timeouts.NETWORK });
  });

  if (leakBrowser && authBrowser !== null && authPage !== null) {
    return { browser: authBrowser, page: authPage };
  }
  return null;
}
