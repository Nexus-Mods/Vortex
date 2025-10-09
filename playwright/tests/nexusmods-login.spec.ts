/* eslint-disable max-lines-per-function */
import { test, Browser } from '@playwright/test';
import { launchVortex, closeVortex } from '../src/vortex-helpers';
import { loginToNexusMods, logoutFromNexusMods } from '../src/nexusmods-auth-helpers';
import { constants } from '../src/constants';

const TEST_NAME = 'nexusmods-login';

test('can log into nexusmods.com', async ({ browser }: { browser: Browser }) => {

  const { app, mainWindow, testRunDir, appProcess, pid, userDataDir } = await launchVortex(TEST_NAME);

  const userName = constants.USER_ACCOUNTS.FREE_USER.login;
  const userPassword = constants.USER_ACCOUNTS.FREE_USER.password;

  try {
    // Logout if already logged in
    await logoutFromNexusMods(mainWindow, testRunDir);

    // Perform login
    const result = await loginToNexusMods(browser, mainWindow, userName, userPassword, testRunDir);

    if (!result.success) {
      console.error('Login failed:', result.error);
      throw new Error(result.error);
    }

    console.log('Login successful!');

  } finally {
    await closeVortex(app, appProcess, pid, userDataDir);
    console.log(`Test completed. Results in: ${testRunDir}`);
  }

});
