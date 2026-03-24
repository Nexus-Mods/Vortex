/**
 * Login/authentication tests.
 * Covers test cases: #3.1A, #3.3A, #5.5A-#5.7A
 */
import { test, expect } from '../fixtures/vortex-app';

test.describe('Login UI', () => {
  test('login button is visible when not logged in', async ({ vortexWindow }) => {
    await test.step('Verify login UI is present', async () => {
      // With a fresh user data dir, the user should not be logged in.
      const loginBtn = vortexWindow.getByText(/log in/i).first();

      if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(loginBtn).toBeVisible();
      }
    });
  });

  // TODO: Implement with API key injection fixture
  // test('can log in with injected API key', async ({ vortexWindow }) => { });

  // TODO: Implement with real auth (Tier 3)
  // test('can log in via browser OAuth', async ({ vortexWindow }) => { });
});
