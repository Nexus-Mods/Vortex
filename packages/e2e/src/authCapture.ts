/**
 * One-time interactive capture of a Nexus website session, so local E2E runs can
 * skip the captcha-gated credential login.
 *
 *   pnpm -F @vortex/e2e auth:capture            # both free + premium
 *   pnpm -F @vortex/e2e auth:capture free       # just the free account
 *   pnpm -F @vortex/e2e auth:capture premium    # just the premium account
 *
 * A headed browser opens with the account's credentials pre-filled; you solve the
 * captcha and finish signing in, then press Enter here to save the session cookies
 * to packages/e2e/.auth/<username>.json (gitignored). The auth-snapshot fixture
 * then loads those cookies, so the OAuth flow lands straight on the consent screen
 * — no credentials, no captcha. Re-run when the cookies expire.
 */
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { chromium } from "@playwright/test";

import { AUTH_DIR, authStatePath } from "./helpers/authState";
import { freeUser, premiumUser, type NexusUser } from "./helpers/users";
import { LoginPage } from "./selectors/loginPage";

// Run outside Playwright's runner, so the .env it normally loads isn't present —
// load it here so the freeUser/premiumUser credential getters resolve.
const envFile = path.resolve(import.meta.dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const SIGN_IN_URL = "https://users.nexusmods.com/auth/sign_in";

async function captureFor(label: string, user: NexusUser): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const file = authStatePath(user);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(SIGN_IN_URL, { waitUntil: "domcontentloaded" }).catch(() => undefined);

  // Best-effort pre-fill so you only have to solve the captcha and submit; if the
  // page differs, just sign in by hand.
  const login = new LoginPage(page);
  await login.usernameInput.fill(user.username, { timeout: 5_000 }).catch(() => undefined);
  await login.passwordInput.fill(user.password, { timeout: 5_000 }).catch(() => undefined);

  console.log(
    `\n[auth:capture] A browser opened for the ${label} account (${user.username}).\n` +
      `  1. Solve the captcha and click "Log in" (credentials are pre-filled).\n` +
      `  2. Wait until you are back on a signed-in Nexus Mods page.\n` +
      `  3. Return here and press Enter to save the session.\n`,
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("[auth:capture] Press Enter once signed in… ");
  rl.close();

  await context.storageState({ path: file });
  await browser.close();
  console.log(`[auth:capture] Saved ${label} session → ${path.relative(process.cwd(), file)}\n`);
}

async function main(): Promise<void> {
  const arg = (process.argv[2] ?? "").toLowerCase();
  const all: Array<{ label: string; user: NexusUser }> = [
    { label: "free", user: freeUser },
    { label: "premium", user: premiumUser },
  ];
  const targets = arg === "" ? all : all.filter((t) => t.label === arg);

  if (targets.length === 0) {
    console.error(`Unknown account "${arg}". Usage: auth:capture [free|premium]`);
    process.exit(1);
  }

  // Sequentially — one browser window at a time so the prompts don't interleave.
  for (const { label, user } of targets) {
    await captureFor(label, user);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
