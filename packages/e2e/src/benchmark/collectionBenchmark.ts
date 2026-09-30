/**
 * Benchmark a Vortex collection fixture without anyone at the keyboard: launch the development
 * build against a fixture from scripts/collection-fixture, drive the Mods page (scroll, sort,
 * group, filter, toggle, page switch, purge and deploy), and write a report.
 *
 * Usage (from repo root, after `pnpm run build` and `pnpm run fixture:collection`):
 *   pnpm run fixture:collection:bench -- --out C:\fixtures\sse-typical [--deploys 3] [--label x]
 *
 * See docs/collection-fixture.md for what each metric means.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";

import { stubRemoteImages } from "../helpers/imageStub";
import { readDeployLog, type IDeployLog } from "./deployLog";
import { installProbe, startRecording, stopRecording, waitForQuiet } from "./probe";
import { renderReport } from "./report";
import { median, summarize, type IResponsiveness } from "./stats";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const LAUNCH_SCRIPT = path.join(REPO_ROOT, "scripts", "collection-fixture", "launch.ts");
const DEFAULT_OUT_DIR = path.join(os.tmpdir(), "vortex-collection-fixture");

const STARTUP_TIMEOUT_MS = 180_000;
const DEPLOY_TIMEOUT_MS = 600_000;
const QUIET_MS = 300;
const ACTION_TIMEOUT_MS = 20_000;
const IDLE_WINDOW_MS = 5_000;

const HELP = `Benchmark Vortex against a generated collection fixture, unattended.

Options:
  --out <dir>      the fixture directory (default: ${DEFAULT_OUT_DIR})
  --deploys <n>    full purge-and-deploy cycles to time (default: 3)
  --label <text>   tag for the report file name and heading, e.g. the branch under test
  --keep-state     reuse the fixture's user-data instead of re-importing state.json
  --headless       hide the window; frame and paint timings are then not meaningful
  --help           this text
`;

// ---------------------------------------------------------------------------------------------
// arguments and launch configuration

interface IOptions {
  outDir: string;
  deploys: number;
  label?: string;
  keepState: boolean;
  headless: boolean;
}

function parseOptions(argv: string[]): IOptions | undefined {
  const flags = new Map<string, string | true>();
  const tokens = argv.filter((token) => token !== "--");
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`unexpected argument: ${token}`);
    }
    const next = tokens[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(token.slice(2), next);
      i++;
    } else {
      flags.set(token.slice(2), true);
    }
  }
  if (flags.has("help")) {
    process.stdout.write(HELP);
    return undefined;
  }
  const out = flags.get("out");
  const deploys = Number(flags.get("deploys") ?? 3);
  if (!Number.isInteger(deploys) || deploys < 1) {
    throw new Error("--deploys needs a whole number of 1 or more");
  }
  const label = flags.get("label");
  // pnpm runs this from packages/e2e; resolve a relative --out against where the user typed it
  const base = process.env.INIT_CWD ?? process.cwd();
  return {
    outDir: path.resolve(base, typeof out === "string" ? out : DEFAULT_OUT_DIR),
    deploys,
    label: typeof label === "string" ? label : undefined,
    keepState: flags.get("keep-state") === true,
    headless: flags.get("headless") === true,
  };
}

interface ILaunchConfig {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  unsetEnv: string[];
  paths: { userDataDir: string; outDir: string };
  firstRun: boolean;
}

function isLaunchConfig(value: unknown): value is ILaunchConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const paths: unknown = Reflect.get(value, "paths");
  return (
    typeof Reflect.get(value, "command") === "string" &&
    Array.isArray(Reflect.get(value, "args")) &&
    typeof Reflect.get(value, "cwd") === "string" &&
    typeof paths === "object" &&
    paths !== null &&
    typeof Reflect.get(paths, "userDataDir") === "string"
  );
}

/** ask the fixture launcher for the command line, so launching stays defined in one place */
function launchConfig(opts: IOptions): ILaunchConfig {
  const tsxCli = createRequire(import.meta.filename).resolve("tsx/cli");
  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [
        tsxCli,
        LAUNCH_SCRIPT,
        "--out",
        opts.outDir,
        "--print-config",
        ...(opts.keepState ? [] : ["--reset"]),
      ],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    );
  } catch {
    // the launcher has already printed why (a missing fixture, a missing build)
    throw new Error("could not prepare the fixture; see the message above");
  }
  const parsed: unknown = JSON.parse(output);
  if (!isLaunchConfig(parsed)) {
    throw new Error("the fixture launcher printed an unexpected configuration");
  }
  return parsed;
}

function launchEnv(config: ILaunchConfig, opts: IOptions): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !config.unsetEnv.includes(key)) {
      env[key] = value;
    }
  }
  Object.assign(env, config.env);
  // skips the React/Redux DevTools extensions, which would add their own load, and the instance
  // lock, so the benchmark runs even with another development Vortex open
  env.VORTEX_E2E = "1";
  // Vortex opens the database in Electron's own profile folder before it switches to
  // --user-data. Skipping the instance lock means that folder must be private too, or a second
  // development Vortex holding it leaves this one retrying the lock forever. With VORTEX_E2E set,
  // src/main/src/main.ts moves the profile folder here.
  env.ELECTRON_USERDATA = path.join(config.paths.outDir, "electron-user-data");
  if (opts.headless) {
    env.VORTEX_E2E_HEADLESS = "1";
  }
  return env;
}

// ---------------------------------------------------------------------------------------------
// driving the app

async function mainWindow(app: ElectronApplication): Promise<Page> {
  // polled rather than waited on as an event: the window opens on a blank page and only then
  // navigates to index.html, so its URL at the moment it opens says nothing
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const main = app.windows().find((page) => page.url().includes("index.html"));
    if (main !== undefined) {
      return main;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("timed out waiting for the Vortex main window");
}

const navButton = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).first();

const modsPage = (page: Page) => page.locator("#page-Mods");

async function openModsPage(page: Page): Promise<void> {
  await navButton(page, "Mods").waitFor({ state: "visible", timeout: STARTUP_TIMEOUT_MS });
  await navButton(page, "Mods").click();
  await page.locator('[data-testid="deploy-mods"]').waitFor({ timeout: STARTUP_TIMEOUT_MS });
  await modsPage(page).locator("tbody tr").first().waitFor({ timeout: STARTUP_TIMEOUT_MS });
}

interface IScenario extends IResponsiveness {
  name: string;
}

async function measure(page: Page, name: string, action: () => Promise<void>): Promise<IScenario> {
  await startRecording(page);
  await action();
  const settled = await waitForQuiet(page, QUIET_MS, ACTION_TIMEOUT_MS);
  return { name, ...summarize(await stopRecording(page), settled) };
}

async function observe(page: Page, name: string, ms: number): Promise<IScenario> {
  await startRecording(page);
  await page.waitForTimeout(ms);
  return { name, ...summarize(await stopRecording(page), true), settleMs: ms };
}

/** the centre of the Mods table's scroll area and how far it scrolls */
async function scrollArea(page: Page) {
  const area: unknown = await page.evaluate(`(() => {
    const candidates = [...document.querySelectorAll("#page-Mods .overflow-auto")]
      .filter((el) => el.scrollHeight > el.clientHeight);
    const el = candidates.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (el === undefined) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, height: el.scrollHeight };
  })()`);
  if (typeof area !== "object" || area === null) {
    return undefined;
  }
  return {
    x: Number(Reflect.get(area, "x")),
    y: Number(Reflect.get(area, "y")),
    height: Number(Reflect.get(area, "height")),
  };
}

async function scrollScenarios(page: Page): Promise<IScenario[]> {
  const area = await scrollArea(page);
  if (area === undefined) {
    return [];
  }
  const step = 400;
  const steps = Math.min(300, Math.ceil(area.height / step) + 2);
  await page.mouse.move(area.x, area.y);
  const wheel = (delta: number) => async () => {
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(16);
    }
  };
  return [
    await measure(page, "Scroll the Mods list to the bottom", wheel(step)),
    await measure(page, "Scroll the Mods list to the top", wheel(-step)),
  ];
}

/** clicking a header cycles none, ascending, descending; three clicks restore the original */
async function sortScenarios(page: Page, column: string, label: string): Promise<IScenario[]> {
  const header = modsPage(page).locator(`th.header-${column} .flex-fill`).first();
  if ((await header.count()) === 0) {
    return [];
  }
  const results = [
    await measure(page, `Sort by ${label}`, () => header.click()),
    await measure(page, `Sort by ${label}, reversed`, () => header.click()),
  ];
  await header.click();
  await waitForQuiet(page, QUIET_MS, ACTION_TIMEOUT_MS);
  return results;
}

async function groupScenarios(page: Page): Promise<IScenario[]> {
  const button = modsPage(page)
    .locator("th.header-enabled")
    .getByRole("button", { name: "Group the table by this attribute" });
  if ((await button.count()) === 0) {
    return [];
  }
  return [
    await measure(page, "Group by status", () => button.click()),
    await measure(page, "Ungroup", () => button.click()),
  ];
}

async function filterScenarios(page: Page): Promise<IScenario[]> {
  const input = modsPage(page).locator("th.header-name input").first();
  if ((await input.count()) === 0) {
    return [];
  }
  await input.click();
  return [
    await measure(page, "Type a name filter", () => page.keyboard.type("Immersive", { delay: 60 })),
    await measure(page, "Clear the name filter", async () => {
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Backspace");
    }),
  ];
}

async function toggleScenarios(page: Page): Promise<IScenario[]> {
  const status = modsPage(page).locator("#btn-mods-enabled").first();
  if ((await status.count()) === 0) {
    return [];
  }
  return [
    await measure(page, "Toggle a mod's status", () => status.click()),
    await measure(page, "Toggle it back", () => status.click()),
  ];
}

interface IPageSwitch {
  scenarios: IScenario[];
  /** rows the hidden Mods page still had in the DOM while another page was showing */
  hiddenModsRows: number;
  otherPage: string;
}

async function pageSwitchScenarios(page: Page): Promise<IPageSwitch> {
  const otherPage = (await navButton(page, "Plugins").count()) > 0 ? "Plugins" : "Profiles";
  const scenarios = [
    await measure(page, `Open the ${otherPage} page`, () => navButton(page, otherPage).click()),
    await observe(page, `Idle on the ${otherPage} page (5 s)`, IDLE_WINDOW_MS),
  ];
  // rows with their contents drawn, found by the status button each drawn row has. Counting every
  // <tr> would mislead: the table keeps an empty placeholder row per mod and draws only the rows
  // near the screen (controls/VisibilityProxy.tsx), so the row count is the mod count either way.
  const hiddenModsRows = await modsPage(page).locator("tbody tr #btn-mods-enabled").count();
  scenarios.push(
    await measure(page, "Return to the Mods page", () => navButton(page, "Mods").click()),
  );
  return { scenarios, hiddenModsRows, otherPage };
}

// ---------------------------------------------------------------------------------------------
// deployment

export interface IDeployRun {
  kind: "purge" | "full" | "incremental";
  ms: number;
  log: IDeployLog;
  ui: IResponsiveness;
}

/**
 * The toast is the end signal: it shows when the deploy callback reports success. Its id is
 * fixed, so a new one only counts once the previous toast has gone.
 */
async function waitForToast(page: Page, text: string, timeoutMs: number): Promise<void> {
  await page.getByText(text, { exact: true }).first().waitFor({ timeout: timeoutMs });
}

async function waitForToastGone(page: Page, text: string): Promise<void> {
  await page
    .getByText(text, { exact: true })
    .first()
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);
}

async function timedRun(
  page: Page,
  logFile: string,
  kind: IDeployRun["kind"],
  click: () => Promise<void>,
  toast: string,
): Promise<IDeployRun> {
  await waitForToastGone(page, toast);
  await startRecording(page);
  const started = Date.now();
  await click();
  await waitForToast(page, toast, DEPLOY_TIMEOUT_MS);
  const ended = Date.now();
  const ui = summarize(await stopRecording(page), true);
  return { kind, ms: ended - started, log: readDeployLog(logFile, started, ended), ui };
}

async function purge(page: Page): Promise<void> {
  await page.locator('[data-testid="purge-mods"]').click();
  // the confirmation dialog shows unless the user switched it off
  const confirm = page.getByRole("button", { name: "Continue", exact: true });
  await confirm.waitFor({ timeout: 3_000 }).then(
    () => confirm.click(),
    () => undefined,
  );
}

async function deployRuns(page: Page, logFile: string, cycles: number): Promise<IDeployRun[]> {
  const deploy = () => page.locator('[data-testid="deploy-mods"]').click();
  const runs: IDeployRun[] = [];
  for (let i = 0; i < cycles; i++) {
    process.stdout.write(`  deploy cycle ${i + 1} of ${cycles}\n`);
    runs.push(await timedRun(page, logFile, "purge", () => purge(page), "Mods purged"));
    runs.push(await timedRun(page, logFile, "full", deploy, "Mods deployed"));
  }
  runs.push(await timedRun(page, logFile, "incremental", deploy, "Mods deployed"));
  return runs;
}

// ---------------------------------------------------------------------------------------------
// report context

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function fixtureSummary(outDir: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(path.join(outDir, "fixture.json"), "utf8"));
    const summary: unknown =
      typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "summary") : undefined;
    return typeof summary === "object" && summary !== null ? { ...summary } : {};
  } catch {
    return {};
  }
}

export interface IBenchmarkResult {
  label?: string;
  startedAt: string;
  commit: string;
  branch: string;
  dirty: boolean;
  machine: { os: string; cpu: string; cores: number; memoryGb: number };
  fixture: Record<string, unknown>;
  headless: boolean;
  startup: { windowMs: number; modsReadyMs: number };
  scenarios: IScenario[];
  hiddenModsRows: number;
  otherPage: string;
  deploys: IDeployRun[];
  deploySummary: { fullMedianMs: number; purgeMedianMs: number; incrementalMs: number };
}

function writeReport(opts: IOptions, result: IBenchmarkResult): string {
  const dir = path.join(opts.outDir, "reports");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = result.startedAt.replace(/[:.]/g, "-");
  const suffix = opts.label === undefined ? "" : `-${opts.label.replace(/[^\w.-]+/g, "_")}`;
  const base = path.join(dir, `bench-${stamp}${suffix}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(result, null, 2));
  fs.writeFileSync(`${base}.md`, renderReport(result));
  return base;
}

// ---------------------------------------------------------------------------------------------

async function runScenarios(page: Page) {
  const scenarios: IScenario[] = [];
  const step = async (name: string, run: () => Promise<IScenario[]>) => {
    process.stdout.write(`  ${name}\n`);
    scenarios.push(...(await run()));
  };
  await step("idle", async () => [
    await observe(page, "Idle on the Mods page (5 s)", IDLE_WINDOW_MS),
  ]);
  await step("scroll", () => scrollScenarios(page));
  await step("sort", async () => [
    ...(await sortScenarios(page, "enabled", "status")),
    ...(await sortScenarios(page, "name", "name")),
  ]);
  await step("group", () => groupScenarios(page));
  await step("filter", () => filterScenarios(page));
  await step("toggle", () => toggleScenarios(page));
  process.stdout.write("  page switch\n");
  const pageSwitch = await pageSwitchScenarios(page);
  scenarios.push(...pageSwitch.scenarios);
  return { scenarios, pageSwitch };
}

async function run(opts: IOptions): Promise<void> {
  const config = launchConfig(opts);
  const logFile = path.join(config.paths.userDataDir, "vortex.log");
  process.stdout.write(`Launching Vortex against ${opts.outDir}\n`);

  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const app = await electron.launch({
    executablePath: config.command,
    args: config.args,
    cwd: config.cwd,
    env: launchEnv(config, opts),
    timeout: STARTUP_TIMEOUT_MS,
  });
  // taken now: after close() the handle can no longer be asked for its process
  const child = app.process();
  try {
    const page = await mainWindow(app);
    const windowMs = Date.now() - t0;
    await stubRemoteImages(page);
    await openModsPage(page);
    const modsReadyMs = Date.now() - t0;
    await installProbe(page);
    // let startup work (health checks, the first sort) finish before measuring
    await waitForQuiet(page, 2_000, 60_000);

    process.stdout.write("Measuring the Mods page\n");
    const { scenarios, pageSwitch } = await runScenarios(page);
    process.stdout.write("Measuring deployment\n");
    const deploys = await deployRuns(page, logFile, opts.deploys);

    const byKind = (kind: IDeployRun["kind"]) =>
      deploys.filter((d) => d.kind === kind).map((d) => d.ms);
    const result: IBenchmarkResult = {
      label: opts.label,
      startedAt,
      commit: git(["rev-parse", "--short", "HEAD"]),
      branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
      dirty: git(["status", "--porcelain"]).length > 0,
      machine: {
        os: `${os.type()} ${os.release()}`,
        cpu: os.cpus()[0]?.model.trim() ?? "unknown",
        cores: os.cpus().length,
        memoryGb: Math.round(os.totalmem() / 1024 ** 3),
      },
      fixture: fixtureSummary(opts.outDir),
      headless: opts.headless,
      startup: { windowMs, modsReadyMs },
      scenarios,
      hiddenModsRows: pageSwitch.hiddenModsRows,
      otherPage: pageSwitch.otherPage,
      deploys,
      deploySummary: {
        fullMedianMs: median(byKind("full")),
        purgeMedianMs: median(byKind("purge")),
        incrementalMs: byKind("incremental")[0] ?? 0,
      },
    };
    const base = writeReport(opts, result);
    process.stdout.write(`\n${renderReport(result)}\nReport written to ${base}.md and .json\n`);
  } finally {
    await Promise.race([
      app.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 15_000)),
    ]).catch(() => undefined);
    if (child.exitCode === null) {
      child.kill();
    }
  }
}

const options = parseOptions(process.argv.slice(2));
if (options !== undefined) {
  run(options).catch((err: unknown) => {
    // the message alone reads better for someone just running it; the stack is for debugging
    const detail =
      err instanceof Error
        ? process.env.VORTEX_BENCH_DEBUG === "1"
          ? (err.stack ?? err.message)
          : err.message
        : String(err);
    process.stderr.write(`${detail}\n`);
    process.exit(1);
  });
}
