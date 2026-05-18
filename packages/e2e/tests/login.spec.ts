/**
 * Login/authentication tests.
 * Covers test cases: #3.1A, #3.3A, #5.5A-#5.7A
 */
import { test, expect } from "../fixtures/vortex-app";
import { loginToNexus } from "../helpers/login";
import { freeUser } from "../helpers/users";

test.describe("Login UI", () => {
  test("Login", async ({ vortexApp, vortexWindow }) => {
    await loginToNexus(vortexApp, vortexWindow, freeUser);
  });

  // TODO: Implement with API key injection fixture
  // test('can log in with injected API key', async ({ vortexWindow }) => { });

  // TODO: Implement with real auth (Tier 3)
  // test('can log in via browser OAuth', async ({ vortexWindow }) => { });
});
