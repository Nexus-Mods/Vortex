---
name: e2e-test
description: Write a new Playwright E2E test for Vortex. Accepts a plain-text description of what to test, or a Linear issue ID to fetch the description automatically. Uses Chrome DevTools MCP to inspect the live app and source code to produce a well-structured spec.
when_to_use: When the user wants to add, scaffold, or write a new E2E test for Vortex.
user-invocable: true
allowed-tools: mcp__linear-server__list_issues mcp__chrome-devtools__click mcp__chrome-devtools__take_snapshot
---

# E2E Test Writing Skill

You help developers write Playwright E2E tests for Vortex, an Electron desktop app. Tests live in `packages/e2e/src/tests/` and MUST follow `packages/e2e/E2E-BEST-PRACTICES.md`.

## Step 1 — Gather scope

If `$ARGUMENTS` contains a Linear issue ID (pattern: `LAZ-\d+` or similar `[A-Z]+-\d+`):

- Fetch the issue using the `mcp__linear-server__get_issue` tool
- Extract the title and description to understand what needs to be tested

If `$ARGUMENTS` is a plain-text description, use it directly.

If no arguments were provided, ask the user: "What should the test cover? Provide a description or a Linear issue ID."

Before proceeding, **confirm the scope** with the user in one or two sentences: what flows will be tested, which Vortex pages are involved, and whether auth (freeUser/premiumUser) is needed.

## Step 2 — Understand the existing code

Read the relevant existing files to understand patterns and available building blocks:

- `packages/e2e/E2E-BEST-PRACTICES.md` — rules you must follow
- `packages/e2e/src/selectors/` — existing POMs (check if a relevant one already exists)
- `packages/e2e/src/helpers/` — shared utilities (navigation, timeouts, users, etc.)
- `packages/e2e/src/fixtures/vortex-app.ts` — available fixtures
- `packages/e2e/src/tests/` — existing specs; skim them for flows you'll need
  (download a mod, log in, manage a game, navigate to a page). If another test
  already does what you're about to write, that's a signal to reuse or extract
  it — see "Reuse over duplication" in Step 3.
- Source code under `src/renderer/` for UI component structure and text strings

## Step 3 — Write a first draft

Follow ALL rules from `E2E-BEST-PRACTICES.md`. It is fine for selectors and
intermediate steps to be uncertain at this point: the inspector loop in Step 4
exists to discover and correct them against the live app.

At each step whose selector or behavior you are unsure about, insert a
breakpoint so the loop can pause there:

```ts
import { llmBreakpoint } from "../helpers/inspect";
// ...
await llmBreakpoint(vortexWindow, "after manage game");
```

`llmBreakpoint` is a no-op unless `VORTEX_E2E_INSPECT` is set, so the calls are
safe to leave in the spec while iterating. Strip them once the test is green.

### Reuse over duplication (DRY)

Before writing a block of logic, check whether an existing spec already does the
same thing (a download flow, a login sequence, a multi-step navigation). If so,
don't copy it — follow the **Helpers** guidance in `E2E-BEST-PRACTICES.md`:
extract it into a `packages/e2e/src/helpers/` function, call it from your test,
and update the other spec(s) to use the same helper.

## Step 4 — Inspector loop (run, walk, fix, repeat)

The dev inspector runs **the real test** (fixtures: login snapshot, managed
game, image stubs) headed and single-worker, and launches the app with a fixed
CDP endpoint on `127.0.0.1:9222` that Chrome DevTools MCP attaches to.

Resolve the shared tmp paths the same way `llmBreakpoint` does (running `node`
guarantees the shell and the test agree on `os.tmpdir()` on every platform),
clear any stale files from a prior run, then start the single test you are
authoring. Redirect its output to a log file, and write a **done sentinel** the
moment the runner exits (in a subshell, so it fires on pass, fail, or crash) so
the poll below can tell a pause apart from an early exit. Run this with
`run_in_background` so the terminal stays free:

```bash
TMP="$(node -e 'console.log(require("os").tmpdir())')"
PAUSE_FILE="$TMP/vortex-e2e-pause"
LOG_FILE="$TMP/vortex-e2e-dev.log"
DONE_FILE="$TMP/vortex-e2e-dev.done"
rm -f "$PAUSE_FILE" "$LOG_FILE" "$DONE_FILE"
( VORTEX_E2E_GREP="<test name>" pnpm nx run @vortex/e2e:dev > "$LOG_FILE" 2>&1; echo $? > "$DONE_FILE" )
```

`VORTEX_E2E_GREP` is read by `playwright.config.ts` as the test grep, so it must
match exactly one test. Passing it as an env var (rather than a trailing CLI
arg) survives forwarding through pnpm and nx cleanly.

When the run reaches an `llmBreakpoint` it creates `$PAUSE_FILE` (containing the
label) and blocks indefinitely. But the test can also **fail before reaching the
breakpoint** (wrong selector, assertion error, launch failure), in which case
`$PAUSE_FILE` is never created and the runner exits, writing `$DONE_FILE`. So
the wait must poll for **either** outcome: pause-file appears, **or** done-file
appears. Never poll for the pause file alone, it would hang forever on a
pre-breakpoint failure.

```bash
TMP="$(node -e 'console.log(require("os").tmpdir())')"
PAUSE_FILE="$TMP/vortex-e2e-pause"
LOG_FILE="$TMP/vortex-e2e-dev.log"
DONE_FILE="$TMP/vortex-e2e-dev.done"
while [ ! -f "$PAUSE_FILE" ] && [ ! -f "$DONE_FILE" ]; do sleep 0.5; done
if [ -f "$PAUSE_FILE" ]; then
  echo "[PAUSED] $(cat "$PAUSE_FILE")"
else
  echo "[RUNNER EXITED before breakpoint, code $(cat "$DONE_FILE")] read the log to see why it failed:"
  tail -n 80 "$LOG_FILE"
fi
```

Uses only `[ -f ]`, `cat`, and `sleep` (no PIDs or signals), so it works on
Linux, macOS, and Git Bash on Windows. If it prints `[RUNNER EXITED ...]`, the
test failed: read the log tail, fix the spec, and re-run from the launch step.
Only drive the MCP when it prints `[PAUSED]`. (A `[E2E-PAUSE] <label>` console
line is also emitted but is not guaranteed to reach stdout, so do not grep for
it.)

While paused, drive the live app via the MCP:

- `list_pages` → `select_page` for the `index.html` window
- `take_snapshot` for the accessibility tree to find roles
- Inspect element text, roles, and attributes to pick the best locator
  (prefer `getByRole` > `getByText` > `getByTitle` > `getByTestId`)
- `click` / `fill` to confirm an action does what the test expects before
  committing it to the spec

Step forward one breakpoint by resuming via the MCP:

```
evaluate_script: () => { window.__e2e.resume = true; }
```

On resume the test removes `$PAUSE_FILE`, re-arming the watcher. Wait for the
next pause by re-running the **same dual-condition poll** before driving the app
again (the test may also fail or finish between breakpoints, so still check the
PID, not just the pause file):

```bash
TMP="$(node -e 'console.log(require("os").tmpdir())')"
PAUSE_FILE="$TMP/vortex-e2e-pause"
LOG_FILE="$TMP/vortex-e2e-dev.log"
DONE_FILE="$TMP/vortex-e2e-dev.done"
while [ ! -f "$PAUSE_FILE" ] && [ ! -f "$DONE_FILE" ]; do sleep 0.5; done
if [ -f "$PAUSE_FILE" ]; then
  echo "[PAUSED] $(cat "$PAUSE_FILE")"
else
  echo "[RUNNER EXITED, code $(cat "$DONE_FILE")] no more breakpoints (test passed) or it failed, check the log:"
  tail -n 80 "$LOG_FILE"
fi
```

Walk the whole flow this way. On a wrong selector or failed assertion: stop the
run, edit the spec with what you learned, and re-run. Repeat until the test
passes end to end. MCP `click`/`fill` during a pause mutate app state — that is
expected; use it to _discover_ the correct Playwright steps, then bake them in.

NEVER take a screenshot unless the user requests it, always prefer snapshots.

## Step 5 — Validate

Remove the `llmBreakpoint` calls, then run the test normally (headless, as CI
does) to confirm it passes without the inspector:

```bash
pnpm -F @vortex/e2e exec playwright test -g "<test name>"
```
