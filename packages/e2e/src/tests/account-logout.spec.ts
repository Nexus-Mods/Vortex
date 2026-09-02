import { test, expect } from "../fixtures/vortex-app";
import { logoutFromVortex } from "../helpers/account";
import { seededAuthStatePath } from "../helpers/authState";
import { loginToNexus } from "../helpers/login";
import { Timeouts } from "../helpers/timeouts";
import { freeUser } from "../helpers/users";
import { ProfileMenu } from "../selectors/profileMenu";

test.describe("Account - Sign out", () => {
  test.use({ nexusUser: freeUser });

  test("[QA-97] logged-in user can sign out via the profile menu", async ({ vortexWindow }) => {
    await logoutFromVortex(vortexWindow);
  });

  test("[QA-98] user can log back in after signing out", async ({
    vortexApp,
    vortexWindow,
  }, testInfo) => {
    const profileMenu = new ProfileMenu(vortexWindow);

    await logoutFromVortex(vortexWindow);

    await test.step("Click Log in and complete the login flow on the website", async () => {
      await loginToNexus(vortexApp, vortexWindow, freeUser, {
        storageStatePath: seededAuthStatePath(freeUser),
        nexusDiagnostics: { testInfo, prefix: "relogin-nexus" },
      });
    });

    await test.step("Close the account menu", async () => {
      await vortexWindow.keyboard.press("Escape");
      await expect(profileMenu.logoutItem).toBeHidden();
    });

    await test.step("The header shows the signed-in avatar again", async () => {
      await expect(profileMenu.avatarButton).toBeVisible({ timeout: Timeouts.NETWORK });
    });

    await test.step("The header no longer offers a Log in button", async () => {
      await expect(profileMenu.loginButton).toBeHidden();
    });
  });
});
