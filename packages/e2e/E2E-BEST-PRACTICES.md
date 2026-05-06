# E2E Test Best Practices (Vortex / Electron)

These tests drive Vortex (an Electron desktop app), not a web page. The fixture
launches Electron via Playwright's `_electron` API; there is no URL bar, no
multiple browser projects, and no remote staging environment.

## Running Tests

From repo root:

```bash
# All e2e tests (headless)
pnpm e2e

# Visible Electron window (debugging)
pnpm e2e:headed

# Step-through with Playwright Inspector
pnpm e2e:debug

# A single spec file
pnpm -F @vortex/e2e exec playwright test smoke.spec.ts

# By tag
pnpm -F @vortex/e2e exec playwright test --grep @smoke

# By test name
pnpm -F @vortex/e2e exec playwright test -g "Settings"
```

Prerequisite: Vortex must be built before running tests:

```bash
pnpm run build
pnpm run build:assets
pnpm run build:extensions   # only needed for extension-dependent tests
```

---

## Fixtures (vortexWindow / vortexApp)

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
- The Electron app is **launched once per worker** (i.e. once per spec file) and shared across all tests in that file. Each worker has its own isolated temp user-data directory.

Implication: tests within the same spec **share Vortex state**. Isolation across files is automatic; isolation within a file is your responsibility (clean up after yourself, or use file-level `test.describe.configure({ mode: 'serial' })` and order-aware setup).

---

## Test Steps

Use `test.step()` to decompose tests into granular, well-defined actions:

```typescript
await test.step("Navigate to the games page", async () => {
    const navbar = new NavBar(vortexWindow);
    await expect(navbar.gamesLink).toBeVisible();
    await navbar.gamesLink.click();
    await expect(navbar.gamesActive).toBeVisible();
});
```

## Assertions

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

---

## Page Object Models (POMs)

POMs encapsulate selectors and page-specific helpers. Vortex's POMs live in `packages/e2e/selectors/` and are named after the area (e.g. `dashboard.ts`, `navbar.ts`, `settings.ts`). **No `_pom` suffix** — that's a different repo's convention.

### POM Structure

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

### Using POMs in Tests

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

---

## Locators (Priority Order)

Vortex is internationalised, but the existing tests use English strings as the source of truth. Prefer user-facing attributes over implementation details:

1. `page.getByRole()` — accessibility attributes (buttons, links, headings).
2. `page.getByText()` — visible text content (most common in Vortex POMs because the React UI doesn't have stable test ids).
3. `page.getByLabel()` — form control by label text.
4. `page.getByPlaceholder()` — input placeholder.
5. `page.getByTitle()` — title attribute (used heavily by Vortex sidebar items).
6. `page.getByTestId()` — only if the component actually exposes a `data-testid`.

Avoid: CSS class selectors, `nth-of-type`, internal React state, anything that changes on a refactor. If text matches multiple elements, narrow with `.first()`, `.filter()`, or a `hasText` constraint rather than reaching for CSS.

---

## Helpers

Shared utilities live in `packages/e2e/helpers/` (e.g. `navigation.ts`). Cross-test operations like "navigate to Settings", "open the games tab", or "wait for sidebar ready" go there — not duplicated in each spec.

```typescript
import { navigateToSettings } from "../helpers/navigation";

test("settings loads", async ({ vortexWindow }) => {
    await navigateToSettings(vortexWindow);
    // ...
});
```

---

## Fake Game Installations

For tests that need a managed game, use the fake-game fixture instead of installing a real game.

### Just the on-disk install — `setupFakeGame`

When the test only needs the game's files to exist (e.g. asserting that
discovery finds them), use `setupFakeGame` directly:

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

Available configs: `stardewvalley`, `skyrimse`. Add more in `packages/e2e/fixtures/game-setup/fake-game.ts`.

### Adding the game to Vortex's managed list — `manageGame`

For tests that need Vortex itself to be **actively managing** a game
(downloads, mod installs, profile state, etc.) call the `manageGame`
helper. It wraps `setupFakeGame`, drives the Games page UI, and uses
Vortex's built-in `__VORTEX_TEST_GAME_PATH__` test hook to bypass the
native folder picker:

```typescript
import { manageGame, type ManagedGame } from "../helpers/games";
import { cleanupFakeGame } from "../fixtures/game-setup/fake-game";

test("mod download lands in the library", async ({ vortexApp, vortexWindow }) => {
    let managed: ManagedGame | null = null;
    try {
        managed = await manageGame(vortexWindow, "stardewvalley");
    } finally {
        if (managed !== null) {
            cleanupFakeGame(managed.basePath);
        }
    }
});
```

Caller is responsible for calling `cleanupFakeGame(managed.basePath)` —
typically in a `try/finally` or `test.afterEach`. The helper returns
`{ basePath, gamePath }` so you can also reach the on-disk install if
the test needs to inspect or seed mod files there.

Currently only `"stardewvalley"` is supported — Skyrim SE goes through
Vortex's manual-discovery dialog flow which our fake-game install isn't
rich enough to satisfy yet (see TODO in `helpers/games.ts`).

---

## Avoid Hardcoded Waits

Never use `waitForTimeout()`. Use assertions or locator auto-waiting instead.

```typescript
// BAD - arbitrary wait
await vortexWindow.waitForTimeout(2000);
await saveButton.click();

// GOOD - wait for specific condition
await expect(saveButton).toBeEnabled();
await saveButton.click();
```

### Common Replacements

| Instead of                            | Use                                                            |
| ------------------------------------- | -------------------------------------------------------------- |
| `waitForTimeout(X)` then click        | `await expect(element).toBeVisible()` then click               |
| `waitForTimeout(X)` for a modal       | `await expect(modal).toBeVisible()`                            |
| `waitForTimeout(X)` for spinner gone  | `await expect(loadingSpinner).not.toBeVisible()`               |
| `waitForTimeout(X)` for a toggle flip | `await expect(toggle).toHaveAttribute('aria-checked', 'true')` |

---

## CSP — Don't Pass Strings to `waitForFunction`

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

---

## Don't Assert on URLs

Vortex uses an internal router, not a browser URL bar. `expect(page).toHaveURL(...)` is meaningless here — assert on visible UI state instead (a heading, a sidebar item being active, a panel being mounted).

---

## Console Errors

The smoke spec watches the renderer console for unexpected errors at startup. When you add tests that exercise new flows, prefer relying on that smoke coverage over sprinkling per-test console listeners. If you do need a per-test listener, attach it before the action and detach in `afterEach` — leaked listeners cause flakes across the worker.

---

## Timeouts

Use the `X_000` format for readability:

```typescript
// GOOD
test.setTimeout(120_000);
await expect(element).toBeVisible({ timeout: 30_000 });

// BAD
test.setTimeout(120000);
await expect(element).toBeVisible({ timeout: 30000 });
```

Defaults that match the fixture's expectations:

- Worker-scoped fixtures: 180s (Electron cold start can take ~2 min on slow CI).
- Renderer-render assertion (`mainWindow.locator('body')` non-empty): 60s.
- Per-test default: keep under 60s; if you need more, set `test.setTimeout(...)` explicitly.

---

## Diagnostics

Don't sprinkle `vortexWindow.screenshot(...)` calls in tests. Playwright config already captures:

- **Screenshots** on failure
- **Traces** on first retry
- **Video** on first retry

View results:

```bash
pnpm -F @vortex/e2e run test:report
```

---

## Pre-Commit Checklist

Do not add code comments unless ABSOLUTELY needed for explaining vague code. If you want to add a comment, try to rewrite the code to be understandable without one.

Run formatter, lint, and tests on the e2e package before committing:

```bash
# Format (oxfmt) — config at oxfmtrc.json. Run on the files you touched.
pnpm oxfmt packages/e2e/<paths-you-changed>

# Or format every staged file in one shot:
pnpm run format:staged

The repo formats with **oxfmt**, not prettier. There is no `.prettierrc`. oxfmt's default is double-quoted strings; some older files in this package still have single quotes from before the formatter switch — when you edit one of those files, oxfmt will convert it. Don't fight it.
```
