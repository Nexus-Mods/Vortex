# @vortex/e2e — Playwright End-to-End Tests

Automated E2E tests for Vortex using [Playwright for Electron](https://playwright.dev/docs/api/class-electron).

## Prerequisites

1. **Build Vortex for development** — the tests launch the app from `src/main/out/`:
   ```bash
   pnpm run build
   pnpm run build:assets
   pnpm run build:extensions  # optional, needed for extension-dependent tests
   ```

2. **Install Playwright browsers** (one-time):
   ```bash
   pnpm -F @vortex/e2e exec playwright install chromium
   ```

## Running Tests

From the repo root:

```bash
# Run all e2e tests (headless — no windows shown)
pnpm e2e

# Run with visible browser window (for debugging)
pnpm e2e:headed

# Run with Playwright inspector (step-through debugging)
pnpm e2e:debug

# Run a specific test file
pnpm -F @vortex/e2e exec playwright test smoke.spec.ts

# Run tests matching a name pattern
pnpm -F @vortex/e2e exec playwright test -g "Settings"
```

## Test Structure

```
packages/e2e/
  fixtures/
    vortex-app.ts              # Electron launch fixture (vortexApp + vortexWindow)
    game-setup/
      fake-game.ts             # Fake game installation helpers (Stardew Valley, Skyrim SE)
  tests/
    smoke.spec.ts              # App launch, console errors, navigation
    dashboard.spec.ts          # Dashboard tiles, getting started, what's new
    settings.spec.ts           # Preferences page toggles and tab navigation
    game-management.spec.ts    # Games page, fake game fixture verification
    login.spec.ts              # Login UI (stub — auth flow needs fixtures)
  scripts/
    patch-playwright-electron.mjs  # Patches Playwright for Electron 30+ compat
  playwright.config.ts
```

## How It Works

### App Lifecycle

- The Electron app launches **once per test file** (worker-scoped fixture)
- All tests in the same file share the app instance for speed
- Each worker gets an **isolated temp user data directory** — no conflicts with your real Vortex installation or between parallel runs
- Windows are hidden by default (`VORTEX_E2E_HEADLESS=1`). Use `pnpm e2e:debug` to see them.

### Headless Mode

Electron doesn't have a true headless mode like Chrome. Instead, the app skips `window.show()` calls when `VORTEX_E2E_HEADLESS=1` is set. The renderer process still runs fully — screenshots, DOM queries, and interactions all work.

For CI on Linux, wrap with `xvfb-run`:
```bash
xvfb-run pnpm e2e
```

Windows CI runners already have a display — no extra setup needed.

## Writing Tests

Import the custom fixture instead of the default Playwright `test`:

```ts
import { test, expect } from '../fixtures/vortex-app';

test('my test', async ({ vortexWindow }) => {
  // vortexWindow is a Playwright Page connected to the Vortex main window
  await vortexWindow.getByText('Preferences').click();
  await expect(vortexWindow.getByText('Language')).toBeVisible();
});
```

### Selector Strategy

Since the codebase currently lacks `data-testid` attributes, tests use:
- **Text selectors**: `getByText('Preferences')` — works for nav items, buttons, labels
- **Role selectors**: `getByRole('button', { name: 'Deploy' })` — works for standard controls
- **Regex text**: `getByText(/customi[sz]e/i)` — for case/spelling variants

When a selector is genuinely fragile, add a `data-testid` to the React component rather than writing a brittle CSS selector.

### Fake Game Installations

For tests that need a managed game without installing real games:

```ts
import { setupFakeGame, cleanupFakeGame } from '../fixtures/game-setup/fake-game';

// Creates a temp directory with correct file structure for Stardew Valley
const { basePath, gamePath } = setupFakeGame('stardewvalley');

// ... run tests ...

// Clean up
cleanupFakeGame(basePath);
```

Available game configs: `stardewvalley`, `skyrimse`. Add more in `fixtures/game-setup/fake-game.ts`.

### Authentication Tests (Future)

Full login flow tests require a real Nexus Mods account and browser-based OAuth. These need:

- **Google Chrome** installed at the default path (uses CDP for real browser auth)
- A `.env` file with `NEXUS_EMAIL` and `NEXUS_PASSWORD` (or API key injection)
- Manual captcha solving (not fully automatable)

Current login tests only verify the UI state (login button visibility). Auth flow automation is tracked as Tier 2 work.

## Reports

View the HTML report after a test run:
```bash
pnpm -F @vortex/e2e run test:report
```

Screenshots are captured automatically on test failure (configured in `playwright.config.ts`).

## Playwright Compatibility Patch

Electron 30+ removed `--remote-debugging-port` as a CLI flag. Playwright hasn't shipped a fix in a stable release yet (tracked in [microsoft/playwright#39012](https://github.com/microsoft/playwright/issues/39008)). The `postinstall` script in this package patches Playwright's electron launcher automatically. This patch can be removed once Playwright ships the fix.
