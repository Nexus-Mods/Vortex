import { test, expect } from "../fixtures/vortex-app";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const TEST_NEXUS_USERNAME = "NXMMember";
const TEST_NEXUS_PASSWORD = "3BC1mwMZthxi";

test.describe("Collections", () => {
  test('"Download a collection', async ({ vortexApp, vortexWindow }) => {
    let loginPage: Page | null = null;
    let authBrowser: Browser | null = null;
    let authContext: BrowserContext | null = null;
    let authPage: Page | null = null;

    await test.step("Verify dashboard has loaded", async () => {
      const bodyText = await vortexWindow.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    });
    await test.step("Click the login button", async () => {
      const loginBtn = vortexWindow.getByRole("button", { name: "Log in" });
      const popupPromise = vortexWindow
        .waitForEvent("popup", { timeout: 5000 })
        .catch(() => null);
      const appWindowPromise = vortexApp
        .waitForEvent("window", { timeout: 5000 })
        .catch(() => null);

      await expect(loginBtn).toBeVisible();
      await loginBtn.click();

      loginPage = (await popupPromise) ?? (await appWindowPromise);
    });
    await test.step("Verify the browser has opened to the login page", async () => {
      const oauthUrlField = vortexWindow
        .locator("#login-dialog input[readonly]")
        .first();

      await expect(oauthUrlField).toBeVisible({ timeout: 10000 });

      const oauthUrl = await oauthUrlField.inputValue();
      expect(oauthUrl).toMatch(/^https?:\/\//i);

      if (loginPage !== null) {
        await loginPage.waitForLoadState("domcontentloaded");
        await expect(loginPage).toHaveURL(/nexusmods|users\./i);
      }

      // Fresh browser state each run: open a brand-new Chrome context.
      authBrowser = await chromium.launch({
        channel: "chrome",
        headless: false,
      });
      authContext = await authBrowser.newContext();
      authPage = await authContext.newPage();

      await authPage.goto(oauthUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await expect(authPage).toHaveURL(/nexusmods|users\./i);

      const loginHeading = authPage.getByRole("heading", {
        name: /Log in to\s+Nexus Mods/i,
      });
      await expect(loginHeading).toBeVisible({ timeout: 20000 });
    });

    await test.step("Keep auth browser open for login steps", async () => {
      expect(authBrowser).not.toBeNull();
      expect(authContext).not.toBeNull();
      expect(authPage).not.toBeNull();
    });

    await test.step("Login with test credentials", async () => {
      expect(authPage).not.toBeNull();
      if (authPage === null) {
        throw new Error("Auth page was not available for login.");
      }

      const loginForm = authPage.locator("form#new_user");
      const usernameInput = authPage
        .locator(
          '#user_login, input[name="user[login]"], input[autocomplete="email"]',
        )
        .first();
      const passwordInput = authPage
        .locator(
          '#password, input[name="user[password]"], input[type="password"]',
        )
        .first();

      await expect(loginForm).toBeVisible({ timeout: 20000 });
      await expect(usernameInput).toBeVisible({ timeout: 20000 });
      await expect(passwordInput).toBeVisible({ timeout: 20000 });

      await usernameInput.fill(TEST_NEXUS_USERNAME);
      await passwordInput.fill(TEST_NEXUS_PASSWORD);

      await authPage
        .getByRole("button", { name: /log in/i })
        .first()
        .click();

      const oauthPermissionTitle = authPage.locator("p.oauth__title");
      await expect(oauthPermissionTitle).toContainText(
        /Vortex\s+would like to:/i,
        {
          timeout: 30000,
        },
      );
      await expect(oauthPermissionTitle).toBeVisible({ timeout: 30000 });
    });

    await test.step("Click Authorise", async () => {
      expect(authPage).not.toBeNull();
      if (authPage === null) {
        throw new Error("Auth page was not available for authorisation.");
      }

      const authoriseButton = authPage
        .locator('input[type="submit"][value="Authorise"]')
        .first();
      await expect(authoriseButton).toBeVisible({ timeout: 30000 });
      await authoriseButton.click();

      const authorisationSuccessTitle = authPage.locator("p.oauth__title");
      await expect(authorisationSuccessTitle).toContainText(
        /Authorisation successful!/i,
        { timeout: 30000 },
      );
      await expect(authorisationSuccessTitle).toBeVisible({ timeout: 30000 });

      // Close the external auth browser so Vortex remains the only active app window.
      if (authBrowser !== null) {
        await authBrowser.close();
      }
      authBrowser = null;
      authContext = null;
      authPage = null;
    });
    await test.step("Verify dashboard has loaded", async () => {
      const bodyText = await vortexWindow.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    });

    await test.step("Return to Vortex and verify logged in state", async () => {
      await vortexWindow.bringToFront();

      const loginDialog = vortexWindow.locator("#login-dialog");
      if (await loginDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        await vortexWindow.keyboard.press("Escape").catch(() => undefined);
      }

      await expect(loginDialog).toBeHidden({ timeout: 60000 });

      const accountButton = vortexWindow
        .locator(
          "#btn-login, button[title='Profile'], button[title='Log in'], button:has(img[alt]), button.hover-overlay.rounded-full",
        )
        .first();
      await expect(accountButton).toBeVisible({ timeout: 60000 });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await accountButton.click({ timeout: 10000 });
          break;
        } catch (error) {
          if (attempt === 2) {
            throw error;
          }
        }
      }

      const loggedInMenuItem = vortexWindow
        .getByText(/view profile on web|logout/i)
        .first();
      await expect(loggedInMenuItem).toBeVisible({ timeout: 60000 });
    });
  });
});
