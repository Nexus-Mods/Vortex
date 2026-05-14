# @vortex/e2e — Playwright End-to-End Tests

Automated E2E tests for Vortex using [Playwright for Electron](https://playwright.dev/docs/api/class-electron).

## Prerequisites

**Install Playwright browsers** (one-time):

```bash
pnpm -F @vortex/e2e exec playwright install chromium
```

## Running Tests

```bash
# Run all e2e tests (headless)
pnpm e2e

# Run with visible browser window
pnpm e2e:headed

# Run with Playwright inspector (step-through debugging)
pnpm e2e:debug

# Run a specific test file
pnpm -F @vortex/e2e exec playwright test smoke.spec.ts

# Run tests matching a tag
pnpm -F @vortex/e2e exec playwright test --grep @smoke

# Run tests matching a name pattern
pnpm -F @vortex/e2e exec playwright test -g "Settings"
```

## Project Structure

```
packages/e2e/
  fixtures/
    vortex-app.ts              # Electron launch fixture (vortexApp + vortexWindow)
    game-setup/
      fake-game.ts             # Fake game installation helpers (Stardew Valley, Skyrim SE)
  selectors/
    navbar.ts                  # NavBar POM (sidebar navigation)
    dashboard.ts               # DashboardPage POM (dashboard tiles, videos)
    settings.ts                # SettingsPage POM (tabs, toggles, language)
  helpers/
    navigation.ts              # Navigation utilities (navigateToSettings, navigateToGames)
  tests/
    smoke.spec.ts              # App launch, console errors, basic navigation
    dashboard.spec.ts          # Dashboard tiles, getting started, what's new
    settings.spec.ts           # Settings page toggles and tab navigation
    game-management.spec.ts    # Games page, fake game fixture verification
    login.spec.ts              # Login UI (stub — auth flow needs fixtures)
  playwright.config.ts
```

## Architecture

### Page Object Model (POM)

Selectors are encapsulated in POM classes under `selectors/`. Tests import POMs instead of using raw locators:

```ts
import { DashboardPage } from "../selectors/dashboard";

test("customise button works", async ({ vortexWindow }) => {
    const dashboard = new DashboardPage(vortexWindow);
    await expect(dashboard.customiseButton).toBeVisible();
    await dashboard.customiseButton.click();
    await expect(dashboard.doneButton).toBeVisible();
});
```

### Helpers

Shared utilities live in `helpers/`. Navigation, session management, and common operations go here:

```ts
import { navigateToSettings } from "../helpers/navigation";

test("settings page loads", async ({ vortexWindow }) => {
    await navigateToSettings(vortexWindow);
    // ...
});
```

### Test Steps

Use `test.step()` to group actions within a test for better reporting:

```ts
test("my test", async ({ vortexWindow }) => {
    await test.step("Navigate to settings", async () => {
        await navigateToSettings(vortexWindow);
    });

    await test.step("Verify language is English", async () => {
        const settings = new SettingsPage(vortexWindow);
        await expect(settings.englishOption).toBeVisible();
    });
});
```

### Fixtures

The `vortex-app.ts` fixture launches one Electron instance per worker (worker-scoped). Each worker gets an isolated temp user data directory. Tests within the same file share the instance.

### Diagnostics

No inline `page.screenshot()` in tests. Diagnostics are handled by the Playwright config:

- **Screenshots**: captured automatically on test failure
- **Traces**: recorded on first retry
- **Video**: recorded on first retry

View reports after a run:

```bash
pnpm -F @vortex/e2e run test:report
```

### Fake Game Installations

For tests that need a managed game without installing real games:

```ts
import { setupFakeGame, cleanupFakeGame } from "../fixtures/game-setup/fake-game";

const { basePath, gamePath } = setupFakeGame("stardewvalley");
// ... run tests ...
cleanupFakeGame(basePath);
```

Available configs: `stardewvalley`, `skyrimse`. Add more in `fixtures/game-setup/fake-game.ts`.

## CI

E2E tests run as part of the `e2e.yml` GitHub Actions workflow:

- **Windows**: required (blocks PRs on failure)
- **Linux**: allowed to fail (`continue-on-error: true`)
- Linux uses `xvfb-run` for a virtual display

## Playwright Compatibility Patch

Electron 30+ removed `--remote-debugging-port` as a CLI flag. A `pnpm patch` for `playwright-core` is applied automatically on install (see `patches/` directory). This can be removed once Playwright ships the fix in a stable release.
