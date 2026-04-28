import { test, expect } from "../fixtures/vortex-app";
import { loginToNexus } from '../helpers/login';

test.describe("Collections", () => {
  test('"Download a collection', async ({ vortexApp, vortexWindow }) => {
    await test.step("Login", async () => {
      await loginToNexus(vortexApp, vortexWindow);
    });
  });
});
