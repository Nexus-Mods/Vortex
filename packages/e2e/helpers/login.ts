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

export async function loginToNexus(
  vortexApp: ElectronApplication,
  vortexWindow: Page,
  user: NexusUser = freeUser,
): Promise<void> {
  const { username, password } = user;
  let loginPage: Page | null = null;
  let authBrowser: Browser | null = null;
  let authPage: Page | null = null;

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

      authBrowser = await chromium.launch({
        headless: !process.env.PWDEBUG,
      });
      const authContext = await authBrowser.newContext();
      authPage = await authContext.newPage();

      await authPage.goto(oauthUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await expect(authPage).toHaveURL(/nexusmods|users\./i);

      const nexusLoginPage = new LoginPage(authPage);
      await expect(nexusLoginPage.authLoginHeading).toBeVisible();
    });

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
        await expect(nexusLoginPage.oauthPermissionTitle).toBeVisible();
      });
    });

    await test.step("Click Authorise", async () => {
      if (authPage === null) {
        throw new Error("Auth page was not available for authorisation.");
      }

      const nexusLoginPage = new LoginPage(authPage);

      await expect(nexusLoginPage.authoriseButton).toBeVisible();
      await nexusLoginPage.authoriseButton.click();

      await expect(nexusLoginPage.authorisationSuccessTitle).toBeVisible();
    });
  } finally {
    const browserToClose = authBrowser as Browser | null;
    authBrowser = null;
    authPage = null;

    if (browserToClose !== null) {
      await browserToClose.close();
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
}
