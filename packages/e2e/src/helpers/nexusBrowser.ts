import { type Browser, chromium, type Page } from "@playwright/test";

export interface NexusBrowserOptions {
  /**
   * Path to a Playwright storage-state file (cookies + localStorage) to preload.
   * Use this to skip credential entry when Nexus session cookies are already valid.
   *
   * Generate with `pnpm -F @vortex/e2e auth:capture`.
   * The file location is gitignored (`packages/e2e/.auth/`); never commit it.
   */
  storageStatePath?: string;
}

export interface NexusBrowserResult {
  browser: Browser;
  page: Page;
  close: () => Promise<void>;
}

/**
 * Launch a Chromium browser for navigating nexusmods.com.
 * Does not navigate anywhere — call page.goto(url) after receiving the result.
 * Call close() when done instead of browser.close().
 */
export async function launchNexusBrowser(
  options: NexusBrowserOptions = {},
): Promise<NexusBrowserResult> {
  const browser = await chromium.launch({ headless: !process.env.VORTEX_E2E_HEADED });

  const context = await browser.newContext(
    options.storageStatePath !== undefined ? { storageState: options.storageStatePath } : undefined,
  );

  const page = await context.newPage();

  return { browser, page, close: () => browser.close() };
}
