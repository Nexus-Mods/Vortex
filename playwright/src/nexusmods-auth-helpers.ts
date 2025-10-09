/* eslint-disable max-lines-per-function */
import { Browser, Page } from '@playwright/test';
import path from 'path';
import { login } from './login_page';
import { constants } from './constants';

interface OAuthData {
  url: string;
  host: string;
  client_id: string | null;
  redirect_uri: string | null;
  state: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
}

interface LoginResult {
  success: boolean;
  error?: string;
}

/**
 * Blocks Vortex from opening external browser for OAuth flow
 * This prevents the system default browser from interfering with Playwright tests
 */
export async function blockExternalBrowserLaunch(mainWindow: Page): Promise<void> {
  await mainWindow.evaluate(() => {
    // Block all methods that Vortex uses to open external URLs
    const { shell, ipcRenderer } = (window as any).require('electron');

    // Override shell.openExternal
    shell.openExternal = (url: string) => {
      console.log('Blocked shell.openExternal:', url);
      return Promise.resolve();
    };

    // Block IPC calls to open external URLs
    const originalSend = ipcRenderer.send.bind(ipcRenderer);
    ipcRenderer.send = (channel: string, ...args: any[]) => {
      if (channel === '__opn_win32') {
        console.log('Blocked __opn_win32 IPC:', args[0]);
        return;
      }
      return originalSend(channel, ...args);
    };

    // Block winapi ShellExecuteEx if available
    try {
      const winapi = (window as any).require('winapi-bindings');
      if (winapi && winapi.ShellExecuteEx) {
        winapi.ShellExecuteEx = (options: any) => {
          console.log('Blocked winapi.ShellExecuteEx:', options);
        };
      }
    } catch (err) {
      // winapi-bindings not available, that's okay
    }
  });
}

/**
 * Extracts the OAuth URL from Vortex's Redux store
 */
export async function extractOAuthUrl(mainWindow: Page): Promise<OAuthData | { error: string }> {
  return await mainWindow.evaluate(() => {
    try {
      const remote = (window as any).require('@electron/remote');
      const getReduxState = remote.getGlobal('getReduxState');
      const stateJson = getReduxState();
      const state = JSON.parse(stateJson);
      const oauthUrl = state?.session?.nexus?.oauthPending;

      if (oauthUrl) {
        const url = new URL(oauthUrl);
        return {
          url: oauthUrl,
          host: url.host,
          client_id: url.searchParams.get('client_id'),
          redirect_uri: url.searchParams.get('redirect_uri'),
          state: url.searchParams.get('state'),
          code_challenge: url.searchParams.get('code_challenge'),
          code_challenge_method: url.searchParams.get('code_challenge_method')
        };
      }

      return { error: 'No OAuth URL found in Redux state' };
    } catch (err) {
      return { error: `Error accessing Redux store: ${(err as Error).message}` };
    }
  });
}

/**
 * Performs the complete Nexus Mods OAuth login flow
 *
 * @param browser - Playwright browser instance
 * @param mainWindow - Vortex main window
 * @param oauthUrl - OAuth URL extracted from Vortex
 * @param userName - Nexus Mods username
 * @param userPassword - Nexus Mods password
 * @param testRunDir - Optional directory for saving screenshots
 * @returns Promise<LoginResult>
 */
export async function performOAuthLogin(
  browser: Browser,
  mainWindow: Page,
  oauthUrl: string,
  userName: string,
  userPassword: string,
  testRunDir?: string
): Promise<LoginResult> {
  try {
    // Create a new incognito browser context (separate from Electron)
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Navigating to staging login page...');
    await page.goto(oauthUrl);
    if (testRunDir) {
      await page.screenshot({ path: path.join(testRunDir, '03-oauth-page.png') });
    }

    // Fill in login credentials
    await page.locator(login.nameInput).fill(userName);
    await page.locator(login.passwordInput).fill(userPassword);

    if (testRunDir) {
      await page.screenshot({ path: path.join(testRunDir, '04-login-filled.png') });
    }
    await page.locator(login.logInButton).click();
    if (testRunDir) {
      await page.screenshot({ path: path.join(testRunDir, '05-login-clicked.png') });
    }

    console.log('Login completed in browser, now handling OAuth flow...');

    // Handle OAuth flow
    console.log('Navigating to OAuth URL...');
    await page.goto(oauthUrl);
    console.log('Current page URL:', page.url());
    console.log('Current page title:', await page.title());
    if (testRunDir) {
      await page.screenshot({ path: path.join(testRunDir, '06-oauth-authorize.png') });
    }

    // Check if we're on the expected OAuth page
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('invalid') || pageContent?.includes('error')) {
      console.log('Error detected on OAuth page:', pageContent.substring(0, 500));
      await context.close();
      return { success: false, error: 'OAuth page returned an error' };
    }

    // Click the Authorize button
    console.log('Clicking Authorize button...');
    await page.locator('input[type="submit"][value="Authorise"]').click();
    console.log('After clicking Authorize - URL:', page.url());
    if (testRunDir) {
      await page.screenshot({ path: path.join(testRunDir, '07-oauth-authorized.png') });
    }

    // Wait for success page and get the redirect link
    await page.waitForURL('**/oauth/success**');
    console.log('Reached success page - URL:', page.url());

    const redirectLink = await page.locator('a#redirect').getAttribute('href');
    console.log('OAuth redirect URL:', redirectLink);

    if (redirectLink) {
      // Parse the callback URL to show the authorization code
      try {
        const callbackUrl = new URL(redirectLink);
        console.log('Callback Parameters:');
        console.log('- code:', callbackUrl.searchParams.get('code'));
        console.log('- state:', callbackUrl.searchParams.get('state'));
      } catch (err) {
        console.log('Error parsing callback URL:', err);
      }
    }

    // Navigate to the loopback URL to complete the OAuth flow
    console.log('Navigating to loopback URL...');
    await page.goto(redirectLink!);
    console.log('Final callback page URL:', page.url());
    if (testRunDir) {
      await page.screenshot({ path: path.join(testRunDir, '08-oauth-callback.png') });
    }

    // The loopback server in Vortex should now receive the auth code
    console.log('OAuth flow completed - Vortex should now be logged in');

    await mainWindow.waitForTimeout(2000);

    // Wait for Vortex to update its UI to reflect logged-in state
    if (testRunDir) {
      await mainWindow.screenshot({ path: path.join(testRunDir, '09-vortex-logged-in.png') });
    }

    // Gracefully close browser context
    await context.close();

    return { success: true };
  } catch (err) {
    console.error('Error during OAuth login:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Complete login flow: blocks external browser, clicks login button,
 * extracts OAuth URL, and performs OAuth login
 *
 * @param browser - Playwright browser instance
 * @param mainWindow - Vortex main window
 * @param userName - Nexus Mods username (defaults to FREE_USER from constants)
 * @param userPassword - Nexus Mods password (defaults to FREE_USER from constants)
 * @param testRunDir - Optional directory for saving screenshots
 * @returns Promise<LoginResult>
 */
export async function loginToNexusMods(
  browser: Browser,
  mainWindow: Page,
  userName: string = constants.USER_ACCOUNTS.FREE_USER.login,
  userPassword: string = constants.USER_ACCOUNTS.FREE_USER.password,
  testRunDir?: string
): Promise<LoginResult> {
  try {
    // Check if already logged in
    const logoutLink = mainWindow.locator('div.logout-button').locator('a').filter({ hasText: 'Log out' });

    if (await logoutLink.isVisible({ timeout: 2000 })) {
      console.log('Already logged in, skipping login flow');
      return { success: true };
    }

    // Block Vortex from opening external browser
    await blockExternalBrowserLaunch(mainWindow);

    // Click login button
    console.log('Clicking login button in Vortex...');
    const loginButton = mainWindow.locator('button#btn-login');
    await loginButton.click();
    if (testRunDir) {
      await mainWindow.screenshot({ path: path.join(testRunDir, '02-login-dialog.png') });
    }

    // Wait for OAuth URL to be generated and stored in Redux
    await mainWindow.waitForTimeout(2000);

    // Extract OAuth URL
    const oauthData = await extractOAuthUrl(mainWindow);

    // Don't log the full URL - it might trigger Windows to open it
    if (oauthData && 'url' in oauthData) {
      console.log('OAuth Data received:', {
        host: oauthData.host,
        hasUrl: !!oauthData.url,
        urlLength: oauthData.url?.length
      });
    } else {
      console.log('OAuth Data:', JSON.stringify(oauthData, null, 2));
      return { success: false, error: (oauthData as { error: string }).error };
    }

    if (oauthData && 'url' in oauthData) {
      const oauthUrl = oauthData.url;
      console.log('Successfully extracted OAuth URL from Vortex Redux store');

      return await performOAuthLogin(browser, mainWindow, oauthUrl, userName, userPassword, testRunDir);
    } else {
      return { success: false, error: 'Could not extract OAuth URL from Vortex store' };
    }
  } catch (err) {
    console.error('Error during login flow:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Logs out from Nexus Mods if currently logged in
 */
export async function logoutFromNexusMods(mainWindow: Page, testRunDir?: string): Promise<void> {
  const logoutLink = mainWindow.locator('div.logout-button').locator('a').filter({ hasText: 'Log out' });

  if (await logoutLink.isVisible({ timeout: 2000 })) {
    console.log('Logging out from Nexus Mods...');
    await logoutLink.click();
    if (testRunDir) {
      await mainWindow.screenshot({ path: path.join(testRunDir, '01-logged-out.png') });
    }
  }
}
