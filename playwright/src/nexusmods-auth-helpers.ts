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
  browserContext?: any; // BrowserContext from Playwright
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

    // Short wait for Vortex to process the callback
    await mainWindow.waitForTimeout(1000);

    // Wait for Vortex to update its UI to reflect logged-in state
    if (testRunDir) {
      await mainWindow.screenshot({ path: path.join(testRunDir, '09-vortex-logged-in.png') });
    }

    // Return the browser context so it can be reused (e.g., for downloading mods)
    // Caller is responsible for closing the context when done
    return { success: true, browserContext: context };
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
    // Keep this short to prevent token expiration
    await mainWindow.waitForTimeout(1000);

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
 * Downloads a mod from Nexus Mods using an authenticated browser context
 *
 * @param browserContext - Authenticated browser context from loginToNexusMods
 * @param modUrl - URL to the mod page (e.g., https://nexusmods-staging.cluster.nexdev.uk/stardewvalley/mods/1?tab=files&file_id=1)
 * @param testRunDir - Optional directory for saving screenshots
 * @returns Promise<boolean> - true if download was initiated successfully
 */
export async function downloadModFromNexus(
  browserContext: any,
  modUrl: string,
  testRunDir?: string
): Promise<boolean> {
  try {
    console.log(`\nDownloading mod from: ${modUrl}`);

    // Create a new page in the authenticated context
    const page = await browserContext.newPage();

    // Navigate to the mod page
    await page.goto(modUrl);
    console.log('✓ Loaded mod page');

    if (testRunDir) {
      await page.screenshot({ path: path.join(testRunDir, 'mod-page.png') });
    }

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Look for the "Slow download" button on staging Nexus Mods
    // Button text varies: "Slow download" (free users) or "Mod Manager Download" (premium)
    const downloadButton = page.locator('button:has-text("Slow download"), button:has-text("Mod Manager Download"), button:has-text("Download")').first();

    const isVisible = await downloadButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      console.log('✓ Found download button, clicking...');
      await downloadButton.click();

      // Wait for download to initiate or for any modals/dialogs
      await page.waitForTimeout(2000);

      if (testRunDir) {
        await page.screenshot({ path: path.join(testRunDir, 'download-clicked.png') });
      }

      // Check if download actually started
      console.log('Current URL after click:', page.url());

      console.log('✓ Download button clicked - Vortex should receive the nxm:// link');
      await page.close();
      return true;
    } else {
      console.error('❌ Could not find download button on mod page');
      if (testRunDir) {
        await page.screenshot({ path: path.join(testRunDir, 'no-download-button.png') });
      }
      await page.close();
      return false;
    }
  } catch (err) {
    console.error('Error downloading mod:', err);
    return false;
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
