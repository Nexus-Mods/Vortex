/* eslint-disable max-lines-per-function */
import { test, expect, Browser } from '@playwright/test';
import { launchVortex } from '../utils/vortex-helpers';
import path from 'path';
import { login } from '../selectors/user_accounts/login_page';
import { constants } from '../helpers/constants';

test('can log into nexusmods.com', async ({ browser }: { browser: Browser }) => {

  const { app, mainWindow, testRunDir } = await launchVortex('nexusmods-login');

  const userName = constants.USER_ACCOUNTS.FREE_USER.login;
  const userPassword = constants.USER_ACCOUNTS.FREE_USER.password;

  try {
    // Check if already logged in, logout if so
    const logoutLink = mainWindow.locator('div.logout-button').locator('a').filter({ hasText: 'Log out' });

    if (await logoutLink.isVisible({ timeout: 2000 })) {
      console.log('Already logged in, logging out first...');
      await logoutLink.click();
      await mainWindow.screenshot({ path: path.join(testRunDir, '01-logged-out.png') });
    }

    // open login dialog  

    console.log('Clicking login button in Vortex...');
    const loginButton = mainWindow.locator('button#btn-login');

    await loginButton.click();
    await mainWindow.screenshot({ path: path.join(testRunDir, '02-login-dialog.png') });

    // Wait for OAuth URL to be generated and stored in Redux
    await mainWindow.waitForTimeout(2000);

    // Extract OAuth URL from Vortex's Redux store (should now be staging URL)
    const oauthUrl = await mainWindow.evaluate(() => {
      try {
        const remote = (window as any).require('@electron/remote');
        const getReduxState = remote.getGlobal('getReduxState');
        const stateJson = getReduxState();
        const state = JSON.parse(stateJson);
        const oauthUrl = state?.session?.nexus?.oauthPending;

        console.log('Extracted OAuth URL from Redux store:', oauthUrl);
        
        if (oauthUrl) {
          // Parse URL to show OAuth parameters
          try {
            const url = new URL(oauthUrl);
            console.log('OAuth Parameters:');
            console.log('- host:', url.host);
            console.log('- client_id:', url.searchParams.get('client_id'));
            console.log('- redirect_uri:', url.searchParams.get('redirect_uri'));
            console.log('- state:', url.searchParams.get('state'));
            console.log('- code_challenge:', url.searchParams.get('code_challenge'));
            console.log('- code_challenge_method:', url.searchParams.get('code_challenge_method'));
          } catch (urlErr) {
            console.log('Error parsing OAuth URL:', urlErr);
          }
          
          return oauthUrl;
        }
        
        console.log('No OAuth URL found in Redux state');
        return null;
      } catch (err) {
        console.log('Error accessing Redux store:', err);
        return null;
      }
    });
    
    if (oauthUrl) {
      console.log('Successfully extracted OAuth URL from Vortex Redux store');
      
      // Now create browser context and login to staging
      const context = await browser.newContext();
      const page = await context.newPage();

      console.log('Navigating to staging login page...');
      await page.goto(oauthUrl);
      await page.screenshot({ path: path.join(testRunDir, '03-oauth-page.png') });

      await page.locator(login.nameInput).fill(userName);
      await page.locator(login.passwordInput).fill(userPassword);

      await page.screenshot({ path: path.join(testRunDir, '04-login-filled.png') });
      await page.locator(login.logInButton).click();
      await page.screenshot({ path: path.join(testRunDir, '05-login-clicked.png') });

      console.log('Login completed in browser, now handling OAuth flow...');

      // Handle OAuth flow in our controlled browser
      console.log('Navigating to OAuth URL...');
      await page.goto(oauthUrl);
      console.log('Current page URL:', page.url());
      console.log('Current page title:', await page.title());
      await page.screenshot({ path: path.join(testRunDir, '06-oauth-authorize.png') });

      // Check if we're on the expected OAuth page
      const pageContent = await page.textContent('body');
      if (pageContent?.includes('invalid') || pageContent?.includes('error')) {
        console.log('Error detected on OAuth page:', pageContent.substring(0, 500));
      }

      // Click the Authorize button
      console.log('Clicking Authorize button...');
      await page.locator('input[type="submit"][value="Authorise"]').click();
      console.log('After clicking Authorize - URL:', page.url());
      await page.screenshot({ path: path.join(testRunDir, '07-oauth-authorized.png') });

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
      await page.screenshot({ path: path.join(testRunDir, '08-oauth-callback.png') });

      // The loopback server in Vortex should now receive the auth code
      console.log('OAuth flow completed - Vortex should now be logged in');

      await mainWindow.waitForTimeout(2000);

      // Wait for Vortex to update its UI to reflect logged-in state
      await mainWindow.screenshot({ path: path.join(testRunDir, '09-vortex-logged-in.png') });

      // Gracefully close browser context
      await context.close();

    } else {
      console.error('Could not extract OAuth URL from Vortex store');
    }

  } finally {

    await app.close();
    console.log(`Test completed. Results in: ${testRunDir}`);
  }

});