/**
 * Login/authentication tests.
 * Covers test cases: #3.1A, #3.3A, #5.5A-#5.7A
 */
import { test, expect } from "../fixtures/vortex-app-isolated";
import { loginToNexus } from "../helpers/login";
import { freeUser } from "../helpers/users";
import { LoginPage } from "../selectors/loginPage";

test.describe("Login UI", () => {
  test("Login", async ({ vortexApp, vortexWindow }) => {
    await loginToNexus(vortexApp, vortexWindow, freeUser);
  });

  test("Logout of Vortex", async ({ vortexApp, vortexWindow }) => {
    const loginPage = new LoginPage(vortexWindow);

    await test.step("Login as a free user", async () => {
      await loginToNexus(vortexApp, vortexWindow, freeUser);
      await expect(loginPage.profileButton).toBeVisible();
    });
    await test.step("Open the profile menu", async () => {
      await loginPage.profileButton.click();
      await expect(loginPage.logOutMenuItem).toBeVisible();
    });
    await test.step("Click logout", async () => {
      await loginPage.logOutMenuItem.click();
      await expect(loginPage.logOutMenuItem).not.toBeVisible();
    });
    await test.step("Verify logged out state", async () => {
      await expect(loginPage.vortexLoginButton).toBeVisible();
    });
  });

  // TODO: Implement with API key injection fixture
  // test('can log in with injected API key', async ({ vortexWindow }) => { });

  // TODO: Implement with real auth (Tier 3)
  // test('can log in via browser OAuth', async ({ vortexWindow }) => { });
});
