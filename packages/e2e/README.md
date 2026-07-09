# @vortex/e2e — Playwright End-to-End Tests

Automated E2E tests for Vortex using [Playwright for Electron](https://playwright.dev/docs/api/class-electron).

## Prerequisites

**Install Playwright browsers** (one-time):

```bash
pnpm -F @vortex/e2e exec playwright install chromium
```

## Setup Environment

E2E tests load env from `packages/e2e/.env` automatically. File is gitignored.
Get Nexus creds from password manager, then add:

```env
E2E_NEXUS_FREE_USER_USERNAME=NXMMember
E2E_NEXUS_FREE_USER_PASSWORD=...
E2E_NEXUS_PREMIUM_USER_USERNAME=NXMPremium
E2E_NEXUS_PREMIUM_USER_PASSWORD=...
```

Currently, for login to work, a VPN connection to the office network is required.
Contact Platform Engineering if you need access credentials.

Free-user creds cover login, upgrade, and some smoke tests. Premium-user creds
are needed for specs that assert premium-only behaviour.

## Running Tests

```bash
# Run all e2e tests (headless)
pnpm e2e

# Run with visible browser window
pnpm e2e:headed

# Run with Playwright inspector (step-through debugging)
pnpm e2e:debug

# Debug specific test file
pnpm e2e:debug -- src/tests/smoke.spec.ts

# Debug single test by name
pnpm e2e:debug -- -g "Settings page loads"

# Run a specific test file
pnpm -F @vortex/e2e exec playwright test smoke.spec.ts

# Run tests matching a tag
pnpm -F @vortex/e2e exec playwright test --grep @smoke

# Run a YAML-backed data-driven case
VORTEX_E2E_GREP="@case:gothic1remake-ue4ss" pnpm e2e

# Debug one YAML-backed game/user variant
VORTEX_E2E_GREP="@game:stardewvalley.*@user:premium" pnpm e2e:debug

# Run tests matching a name pattern
pnpm -F @vortex/e2e exec playwright test -g "Settings"
```

Examples above assume `.env` has needed creds.

## Project Structure

```
packages/e2e/
  src/fixtures/
    vortex-app.ts              # Electron launch fixture (vortexApp + vortexWindow)
    game-setup/
      fake-game.ts             # Fake game installation helpers (Stardew Valley, Skyrim SE)
    test-cases/                # YAML-backed data-driven test cases
  src/selectors/
    navbar.ts                  # NavBar POM (sidebar navigation)
    dashboard.ts               # DashboardPage POM (dashboard tiles, videos)
    settings.ts                # SettingsPage POM (tabs, toggles, language)
  src/helpers/
    navigation.ts              # Navigation utilities (navigateToSettings, navigateToGames)
    data-driven/               # YAML discovery, validation, and flow registration
  src/tests/
    data-driven.spec.ts        # Registers YAML cases as individual Playwright tests
    smoke.spec.ts              # App launch, console errors, basic navigation
    dashboard.spec.ts          # Dashboard tiles, getting started, what's new
    settings.spec.ts           # Settings page toggles and tab navigation
    game-management.spec.ts    # Games page, fake game fixture verification
    login.spec.ts              # Login UI smoke test with configured Nexus user
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
pnpm -F @vortex/e2e exec playwright show-report
```

### Fake Game Installations

For tests that need a managed game without installing real games:

```ts
import { setupFakeGame, cleanupFakeGame } from "../fixtures/game-setup/fake-game";

const { basePath, gamePath } = setupFakeGame("stardewvalley");
// ... run tests ...
cleanupFakeGame(basePath);
```

Available configs: `stardewvalley`, `skyrimse`, `baldursgate3`, `gothic1remake`.

Game layouts live in `src/fixtures/game-setup/trees/`; see
`src/fixtures/game-setup/trees/README.md` for format and export command.

### Data-driven Test Cases

Per-game YAML cases live under `src/fixtures/test-cases/games/<gameId>/`.

They are registered by `src/tests/data-driven.spec.ts`, so `pnpm e2e` includes them
and Playwright lists each matrix variant as an individual test.

The first supported flow is `manage-download-and-deploy`. It:

- manages the fake game
- downloads a Nexus mod through Mod Manager Download
- optionally deploys and asserts files when the YAML includes a `deploy` block

See `src/fixtures/test-cases/README.md` for schema details and case-selection
examples.

### Dynamic Extensions

Tests can prepare real dynamic extensions in isolated Vortex instance before launch:

```ts
test.use({ dynamicExtensionIds: ["open-directory-e2e"] });
```

The fixture copies built extension output into `userData/plugins/<id>`. For game
fixtures that need a dynamic game extension, use `test.use({ dynamicGameExtensionId: "gothic1remake" })`.

## CI

E2E tests run as part of the `e2e.yml` GitHub Actions workflow:

- **Windows**: required (blocks PRs on failure)
- **Linux**: allowed to fail (`continue-on-error: true`)
- Linux uses `xvfb-run` for a virtual display
