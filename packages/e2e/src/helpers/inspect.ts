import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Page } from "@playwright/test";

type E2EBreakpointState = { label: string; resume: boolean };

/**
 * Sentinel file written when a breakpoint is reached and removed when it
 * resumes. A watcher waits for this file to appear (pause reached), then for it
 * to disappear (resumed).
 */
export const E2E_PAUSE_FILE = join(tmpdir(), "vortex-e2e-pause");

/**
 * Block a test mid-flow so an LLM (or human) can inspect and drive the live app
 * via Chrome DevTools MCP, then step forward on demand.
 *
 * No-op unless VORTEX_E2E_INSPECT is set, so calls can stay in committed specs.
 *
 * When active, the fixture launches the app with --remote-debugging-port=9222.
 * On pause, E2E_PAUSE_FILE is created (containing the label) so a watcher can
 * detect the stop with a portable file-existence poll. Attach the MCP, then
 * resume one step with:
 *   evaluate_script: () => { window.__e2e.resume = true; }
 * On resume the file is removed, re-arming the watcher for the next breakpoint.
 *
 * The pause has no timeout: the test waits indefinitely until resumed.
 */
export async function llmBreakpoint(page: Page, label: string): Promise<void> {
  if (!process.env.VORTEX_E2E_INSPECT) return;

  await page.evaluate((l) => {
    const state: E2EBreakpointState = { label: l, resume: false };
    (globalThis as { __e2e?: E2EBreakpointState }).__e2e = state;
    console.log(`[E2E-PAUSE] ${l} — MCP: evaluate window.__e2e.resume = true to step`);
  }, label);

  writeFileSync(E2E_PAUSE_FILE, label);

  await page.waitForFunction(
    () => (globalThis as { __e2e?: E2EBreakpointState }).__e2e?.resume === true,
    null,
    { timeout: 0 },
  );

  if (existsSync(E2E_PAUSE_FILE)) rmSync(E2E_PAUSE_FILE);
}
