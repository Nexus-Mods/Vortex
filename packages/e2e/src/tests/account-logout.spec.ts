/**
 * QA-97: a logged-in user can sign out via the profile menu's Logout item.
 * After logout the app returns to a logged-out state (the avatar is gone and a
 * "Log in" control is shown).
 *
 * QA-98: after signing out, the header "Log in" button reopens the login flow
 * on the website and the user can authenticate back in.
 *
 * Signing in is setup rather than a test step: the nexusUser fixture starts
 * each test from a copy of the worker's authenticated snapshot, in its own app
 * instance and user-data directory, so the tests are order-independent.
 */
import { test, expect } from "../fixtures/vortex-app";
import { logoutFromVortex } from "../helpers/account";
import { seededAuthStatePath } from "../helpers/authState";
import { readExternalOpens } from "../helpers/externalOpen";
import { loginToNexus } from "../helpers/login";
import { freeUser } from "../helpers/users";

test.describe("Account - Sign out", () => {
  test.use({ nexusUser: freeUser });

  test("[QA-97] logged-in user can sign out via the profile menu", async ({ vortexWindow }) => {
    await logoutFromVortex(vortexWindow);
  });

  test("[QA-98] user can log back in after signing out", async ({
    vortexApp,
    vortexWindow,
  }, testInfo) => {
    await logoutFromVortex(vortexWindow);

    // Clicks the header "Log in" button, drives the OAuth flow the app opens on
    // the website, and asserts Vortex ends up logged in again.
    await loginToNexus(vortexApp, vortexWindow, freeUser, {
      storageStatePath: seededAuthStatePath(freeUser),
      nexusDiagnostics: { testInfo, prefix: "relogin-nexus" },
    });

    await test.step("The Log in button opened the login flow on the website", async () => {
      const opened = await readExternalOpens(vortexApp);
      expect(opened.length).toBeGreaterThan(0);

      const url = new URL(opened[0]!);
      expect(url.hostname).toContain("nexusmods.com");
      expect(url.pathname).toMatch(/oauth/i);
    });
  });
});
