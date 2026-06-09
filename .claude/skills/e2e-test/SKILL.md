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
- Source code under `src/renderer/` for UI component structure and text strings

## Step 3 — Inspect the live app (Chrome DevTools MCP)

The Chrome DevTools MCP connects to the Vortex isolated dev instance. It requires `pnpm nx run @vortex/e2e:dev` to be running.

**Check if the dev instance is running first:**
Use `mcp__chrome-devtools__list_pages` to see available pages. If no Vortex page is listed, tell the user:

> The isolated dev environment is not running. Start it with:
>
> ```bash
> pnpm nx run @vortex/e2e:dev
> ```
>
> Then re-invoke this skill. You might need to re-start the MCP server using `/mcp` to connect to the new instance.

If it is running, use the DevTools MCP to:

- Use `take_snapshot` for accessibility tree inspection to find roles
- Inspect element text, roles, and attributes to determine the best locator strategy (prefer `getByRole` > `getByText` > `getByTitle` > `getByTestId`)
- Navigate through the flow being tested to observe real selector targets

NEVER take a screenshot unless the user requests it, always prefer snapshots over screenshots.

## Step 4 — Write the test

Follow ALL rules from `E2E-BEST-PRACTICES.md`.

## Step 5 — Validate

After writing run the test that was created:

```bash
pnpm -F @vortex/e2e exec playwright test -g "<test name>"
```
