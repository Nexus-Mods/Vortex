import { type Browser, chromium, type Page } from "@playwright/test";

export interface NexusBrowserOptions {
  /**
   * Override headless mode. Defaults to true.
   * Set to false when navigating Cloudflare-protected pages on www.nexusmods.com
   * since Cloudflare's JS challenge blocks headless browsers.
   */
  headless?: boolean;
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
}

/**
 * Launch a Chromium browser suitable for navigating nexusmods.com.
 *
 * Matches the fingerprint used by scripts/capture-auth-state.mjs so that
 * Cloudflare's cf_clearance cookie (saved into storage state) remains valid.
 * Does not navigate anywhere — call page.goto(url) after receiving the result.
 *
 * The caller is responsible for closing the browser.
 */
export async function launchNexusBrowser(
  options: NexusBrowserOptions = {},
): Promise<NexusBrowserResult> {
  const headless = options.headless ?? true;
  const executablePath = process.env.E2E_PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const launchArgs = ["--disable-blink-features=AutomationControlled"];

  let browser: Browser;
  try {
    browser = await chromium.launch({
      headless,
      ...(executablePath !== undefined ? { executablePath } : { channel: "chrome" }),
      args: launchArgs,
    });
  } catch {
    browser = await chromium.launch({
      headless,
      ...(executablePath !== undefined ? { executablePath } : {}),
      args: launchArgs,
    });
  }

  const context = await browser.newContext(
    options.storageStatePath !== undefined ? { storageState: options.storageStatePath } : undefined,
  );
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();
  return { browser, page };
}
