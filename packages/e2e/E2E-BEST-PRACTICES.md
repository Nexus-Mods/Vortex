# E2E Test Best Practices (Vortex / Electron)

These tests drive Vortex (an Electron desktop app), not a web page. The fixture
launches Electron via Playwright's `_electron` API; there is no URL bar, no
multiple browser projects, and no remote staging environment.

## Running Tests

```bash
# All tests
pnpm nx run @vortex/e2e:e2e

# By tag (eg: smoke tests)
pnpm -F @vortex/e2e exec playwright test --grep "@smoke"

# By test name
pnpm -F @vortex/e2e exec playwright test -g "Settings"
```

### Debugging

```bash
# Launches playwright UI to run individual tests in headed mode
pnpm nx run @vortex/e2e:ui

# Run individual tests in headed mode
VORTEX_E2E_HEADED=1 pnpm -F @vortex/e2e exec playwright test -g "Settings"
```

### Reports and Traces

Local tests create reports in `./playwright-report`:

```bash
# Launches playwright UI to show reports
pnpm -F @vortex/e2e exec playwright show-report

# Launches playwright UI to show a trace
pnpm -F @vortex/e2e exec playwright show-trace <path to zip file>
```

Every test creates traces that include page snapshots and screenshots if `VORTEX_E2E_HEADED=1`. These traces are attached to tests as `page-trace.zip` files. Use the previous command to open the trace in the browser.

## Writing Tests

### Exploration

Start the isolated dev environment to get started:

```bash
# start the isolated dev environment
pnpm nx run @vortex/e2e:dev:isolated
```

### Skills

Skills and MCP servers are already configured for Claude Code to help write E2E tests. Use `/e2e-test <linear id | text>`.

### Fixtures

Tests import from `../fixtures/vortex-app`, **not** `@playwright/test`:

```typescript
import { test, expect } from "../fixtures/vortex-app";
import { DashboardPage } from "../selectors/dashboard";

test("customise button works", async ({ vortexWindow }) => {
    const dashboard = new DashboardPage(vortexWindow);
    await expect(dashboard.customiseButton).toBeVisible();
    await dashboard.customiseButton.click();
    await expect(dashboard.doneButton).toBeVisible();
});
```

- `vortexWindow` — the main `Page` for Vortex's renderer (use this for almost everything).
- `vortexApp` — the `ElectronApplication` handle (rarely needed; reach for it only when you need IPC, multiple windows, or `app.evaluate(...)`).
- The Electron app is **launched once per test** in its own isolated temp user-data directory. Tests cannot share Vortex state — isolation is guaranteed automatically.

### Test Steps

Use `test.step()` to decompose tests into granular, well-defined actions:

```typescript
await test.step("Navigate to the games page", async () => {
    const navbar = new NavBar(vortexWindow);
    await expect(navbar.gamesLink).toBeVisible();
    await navbar.gamesLink.click();
    await expect(navbar.gamesActive).toBeVisible();
});
```

### Assertions

**Every action must have a corresponding assertion** to validate successful execution and pinpoint failures.

```typescript
// BAD - no assertion after action
await test.step("Click the toggle", async () => {
    await expect(toggle).toBeVisible();
    await toggle.click();
});

// GOOD - includes assertion
await test.step("Click the toggle", async () => {
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toBeChecked();
});
```

Rules:

- **One assertion per test step** — keep steps atomic.
- **No assertions in hooks** — `beforeAll`/`afterAll` should only do setup/teardown.
- **Verify the page rendered** — assert visible elements after navigating between Vortex pages.

### Page Object Models (POMs)

POMs encapsulate selectors and page-specific helpers. Vortex's POMs live in `packages/e2e/src/selectors/` and are named after the area (e.g. `dashboard.ts`, `navbar.ts`, `settings.ts`). **No `_pom` suffix** — that's a different repo's convention.

```typescript
import type { Locator, Page } from "@playwright/test";

export class DashboardPage {
    readonly page: Page;
    readonly whatsNew: Locator;
    readonly customiseButton: Locator;
    readonly doneButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.whatsNew = page.getByText("What's New").first();
        this.customiseButton = page.getByText(/customi[sz]e/i).first();
        this.doneButton = page.getByText(/done/i).first();
    }
}
```

Initialise POMs **when needed**, not all at the start:

```typescript
test("dashboard customise", async ({ vortexWindow }) => {
    await test.step("Open customise mode", async () => {
        const dashboard = new DashboardPage(vortexWindow);
        await expect(dashboard.customiseButton).toBeVisible();
        await dashboard.customiseButton.click();
        await expect(dashboard.doneButton).toBeVisible();
    });
});
```

When a step navigates to a different page, instantiate a new POM for the new page rather than reusing a stale one.

### Locators (Priority Order)

Vortex is internationalised, but the existing tests use English strings as the source of truth. Prefer user-facing attributes over implementation details:

1. `page.getByRole()` — accessibility attributes (buttons, links, headings).
2. `page.getByText()` — visible text content (most common in Vortex POMs because the React UI doesn't have stable test ids).
3. `page.getByLabel()` — form control by label text.
4. `page.getByPlaceholder()` — input placeholder.
5. `page.getByTitle()` — title attribute (used heavily by Vortex sidebar items).
6. `page.getByTestId()` — only if the component actually exposes a `data-testid`.

Avoid: CSS class selectors, `nth-of-type`, internal React state, anything that changes on a refactor. If text matches multiple elements, narrow with `.first()`, `.filter()`, or a `hasText` constraint rather than reaching for CSS.

### Helpers

Shared utilities live in `packages/e2e/src/helpers/` (e.g. `navigation.ts`). Cross-test operations like "navigate to Settings", "open the games tab", or "wait for sidebar ready" go there — not duplicated in each spec.

```typescript
import { navigateToSettings } from "../helpers/navigation";

test("settings loads", async ({ vortexWindow }) => {
    await navigateToSettings(vortexWindow);
    // ...
});
```

When you catch yourself writing logic that another spec already contains (a
download flow, a login sequence, a multi-step navigation, forwarding an `nxm://`
URL to Vortex), **do not copy it**:

1. Extract the shared logic into a helper under `packages/e2e/src/helpers/`
   (parameterized as needed); keep selectors in POMs — helpers orchestrate POMs
   and fixtures, they don't hold their own selectors.
2. Call the helper from your test.
3. Update the other spec(s) that had the inline copy to use the same helper.

The behavior then lives in exactly one place, so an app change is fixed once.
Prefer a small, well-named helper (e.g. `downloadModViaModManager`) over
near-identical copies across specs.

### Auth Fixtures

Tests that require a logged-in user use the `nexusUser` fixture option. Set it
via `test.use()` at the describe level — never inside a `test()` body.

```typescript
import { test, expect } from "../fixtures/vortex-app";
import { freeUser, premiumUser } from "../helpers/users";

test.describe("premium features", () => {
    test.use({ nexusUser: premiumUser });

    test("premium badge is visible", async ({ vortexWindow }) => {
        // vortexWindow is already logged in as premiumUser
    });
});
```

Available users are `freeUser` and `premiumUser` from `helpers/users.ts`, sourced
from environment variables. The default is `null` (no login, fresh empty state).

#### How it works

The first test that needs a given user on a worker triggers a one-time snapshot
build: a temporary Electron instance authenticates via OAuth, then closes cleanly
so the DuckDB state file is fully flushed to disk. The resulting directory is
cached for the rest of the worker's lifetime. Each test that uses that role
receives a fresh copy of the snapshot as its `vortexUserDataDir`, so the app
starts authenticated without repeating the OAuth flow.

Snapshot builds run concurrently across workers. If two tests on the same worker
both need `freeUser`, they share a single build promise — no double login.

#### Composing role and game

The `nexusUser` option and the `managedGame` fixture are independent axes.
Request both to get a logged-in app with a managed game:

```typescript
test.use({ nexusUser: freeUser });

test("download a mod", async ({ vortexWindow, managedGame }) => {
    // logged in as freeUser, stardewvalley already managed
});
```

### Fake Game Installations

For tests that need a managed game, use the `managedGame` fixture instead of
calling `manageGame` manually. It handles setup and cleanup automatically.

```typescript
import { test, expect } from "../fixtures/vortex-app";

test("mod appears after install", async ({ vortexWindow, managedGame }) => {
    // stardewvalley is already managed; managedGame holds { basePath, gamePath }
    // cleanup runs automatically after the test
});
```

`managedGame` defaults to `"stardewvalley"`. Override it with
`test.use({ managedGameId: "gothic1remake" })` or any key from `GAME_CONFIGS`.

Games backed by dynamic/generated extensions must also prepare that extension. Use
`dynamicExtensionIds` for current tests, e.g.
`test.use({ dynamicExtensionIds: ["gothic1remake"], managedGameId: "gothic1remake" })`.

For [GDL] game fixtures, use `test.use({ dynamicGameExtensionId: "gothic1remake" })`.

#### Just the on-disk install — `setupFakeGame`

When the test only needs the game's files to exist (e.g. asserting that
discovery finds them) without involving Vortex's UI, use `setupFakeGame` directly:

```typescript
import { setupFakeGame, cleanupFakeGame } from "../fixtures/game-setup/fake-game";

test("fake game has expected files", async () => {
    const { basePath, gamePath } = setupFakeGame("stardewvalley");
    try {
        // assertions against `gamePath` contents
    } finally {
        cleanupFakeGame(basePath);
    }
});
```

Available configs: `stardewvalley`, `skyrimse`, `baldursgate3`, `gothic1remake`.
Game layouts live in `packages/e2e/src/fixtures/game-setup/trees/`; see that
folder's `README.md` for format and export command.

### Avoid Hardcoded Waits

Never use `waitForTimeout()`. Use assertions or locator auto-waiting instead.

```typescript
// BAD - arbitrary wait
await vortexWindow.waitForTimeout(2000);
await saveButton.click();

// GOOD - wait for specific condition
await expect(saveButton).toBeEnabled();
await saveButton.click();
```

| Instead of                            | Use                                                            |
| ------------------------------------- | -------------------------------------------------------------- |
| `waitForTimeout(X)` then click        | `await expect(element).toBeVisible()` then click               |
| `waitForTimeout(X)` for a modal       | `await expect(modal).toBeVisible()`                            |
| `waitForTimeout(X)` for spinner gone  | `await expect(loadingSpinner).not.toBeVisible()`               |
| `waitForTimeout(X)` for a toggle flip | `await expect(toggle).toHaveAttribute('aria-checked', 'true')` |

---

### CSP — Don't Pass Strings to `waitForFunction`

Vortex's renderer ships with a strict Content Security Policy: `script-src 'self' '<sha256...>'` with **no** `'unsafe-eval'`. Playwright evaluates string predicates via `eval`, which the CSP rejects.

```typescript
// BAD - string predicate, blocked by CSP at runtime
await vortexWindow.waitForFunction("document.body?.innerText?.length > 0");

// GOOD - function predicate, no eval
await vortexWindow.waitForFunction(() => (document.body?.innerText?.length ?? 0) > 0);

// BETTER - locator-based, no DOM types needed in test code
await expect(vortexWindow.locator("body")).not.toHaveText("");
```

Same rule for `page.evaluate(...)`, `locator.evaluate(...)`, and any `evaluateHandle` call: pass a function, not a string.

### Don't Assert on URLs

Vortex uses an internal router, not a browser URL bar. `expect(page).toHaveURL(...)` is meaningless here — assert on visible UI state instead (a heading, a sidebar item being active, a panel being mounted).

### Console Errors

The smoke spec watches the renderer console for unexpected errors at startup. When you add tests that exercise new flows, prefer relying on that smoke coverage over sprinkling per-test console listeners. If you do need a per-test listener, attach it before the action and detach in `afterEach` — leaked listeners cause flakes across the worker.

### Timeouts

All explicit timeouts live in `helpers/timeouts.ts`. Do not hardcode `X_000` literals in tests, helpers, or fixtures.

Rules:

- **Default UI waits use the config defaults** (5s `actionTimeout` / `expect.timeout` / `navigationTimeout`, sourced from `GlobalTimeouts` in `helpers/timeouts.ts` and applied via `playwright.config.ts`). Do not pass an explicit timeout for pure UI assertions/actions. If a UI wait "needs" longer, the test is racing something it should `await` explicitly.
- **Network-backed waits** (page navigation, API fetch, mod list populating, OAuth flow) use `Timeouts.NETWORK`.
- **Fixture / launch timeouts** use `Timeouts.LIFECYCLE`.
- **No per-test `test.setTimeout(...)` overrides.** The per-test timeout is set in `playwright.config.ts` (`timeout: Timeouts.LIFECYCLE`) and is sized to cover the slowest test. If a test exceeds it, the test is broken, not the timeout.
- **Probes** (best-effort "is this element here right now") use `await locator.isVisible().catch(() => false)` with no timeout. Never use 1s/3s "fast probe" timeouts.

```typescript
// GOOD - UI assertion, relies on the config default
await expect(saveButton).toBeVisible();

// GOOD - network-backed assertion
await expect(modRow).toBeVisible({ timeout: Timeouts.NETWORK });

// BAD - hardcoded literal, no semantic context
await expect(modRow).toBeVisible({ timeout: 30_000 });

// BAD - explicit timeout on a pure UI element; bump GlobalTimeouts.EXPECT if the default isn't enough
await expect(navbar.gamesLink).toBeVisible({ timeout: 10_000 });

// BAD - per-test override; bump GlobalTimeouts.TEST in helpers/timeouts.ts instead
test.setTimeout(120_000);
```

Current `Timeouts` / `GlobalTimeouts` values are starting points, not measured. Calibration follow-up is tracked in LAZ-443.

[GDL]: https://github.com/Nexus-Mods/gdl-games
