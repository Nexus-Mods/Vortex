// NOTE(erri120): yes, the library is called "jest-dom" but it works for vitest as well with this import:
// https://www.npmjs.com/package/@testing-library/jest-dom#with-vitest
import os from "node:os";
import path from "node:path";

// TODO: remove polyfill with Node.js 26 upgrade. This file is .mts because
// the renderer is a CommonJS package (module: node16) and the polyfill is
// ESM-only; .mts keeps it an ES module for both tsc and vitest.
import { install } from "temporal-polyfill/shim";
install();

import "@testing-library/jest-dom/vitest";
import type { VortexPaths } from "@vortex/shared/ipc";
import type * as ReactDOMModule from "react-dom";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { ApplicationData } from "./src/applicationData.js";

// A React update outside act() fails the test it happened in; "React warnings" in docs/testing.md
// says how to fix one. console.error is assigned rather than spied on so vi.restoreAllMocks()
// leaves it be, and the check runs after testing-library's cleanup (vitest.config.mts runs hooks
// last-registered first), so an update that lands while a test is torn down still counts.
const componentsUpdatedOutsideAct = new Set<string>();
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) {
    // React passes the component's name after the message
    componentsUpdatedOutsideAct.add(typeof args[1] === "string" ? args[1] : "a component");
  }
  originalConsoleError.apply(console, args);
};

// A call to findDOMNode from our own code fails the test it ran in; React 19 removes it, and
// "React warnings" in docs/testing.md says what to use instead. React's own warning can't drive
// this: it's logged once per test file, and react-bootstrap 0.33 and react-overlays still call
// findDOMNode themselves, so theirs would hide ours. vi.mock only reaches the modules vitest
// transforms, our source, and not the copy of react-dom those libraries require() for themselves.
// The callers named in `allowedFindDOMNodeCallers` are let through.
const { allowedFindDOMNodeCallers, findDOMNodeCallers } = vi.hoisted(() => ({
  /**
   * Functions that call findDOMNode on purpose until React 19, for extension components that
   * don't pass a ref on. Each is named for that, so a new call elsewhere still fails.
   */
  allowedFindDOMNodeCallers: ["findDOMNodeUntilReact19"],
  findDOMNodeCallers: new Set<string>(),
}));
vi.mock("react-dom", async (importOriginal) => {
  const original = await importOriginal<typeof ReactDOMModule>();
  const findDOMNode: typeof original.findDOMNode = (instance) => {
    // the frame below this one is whoever called findDOMNode
    const caller = new Error().stack?.split("\n")[2]?.trim().replace(/^at /, "");
    if (!allowedFindDOMNodeCallers.some((allowed) => caller?.startsWith(`${allowed} `))) {
      findDOMNodeCallers.add(caller ?? "unknown code");
    }
    return original.findDOMNode(instance);
  };
  return { ...original, findDOMNode, default: { ...original, findDOMNode } };
});

// React warnings about our own code fail the test they're logged in, as act() warnings and findDOMNode calls do above;
// "React warnings" in docs/testing.md says how to fix each. A warning is ours when the first
// component in React's stack that has a file isn't in node_modules: react-bootstrap 0.33 logs
// the same warnings about its own components, and those go when it does.
// `about`, when set, is the first value React fills into the message.
const ourWarnings: { logged: string; about?: string; failure: string }[] = [
  { logged: "uses the legacy contextTypes API", failure: "reads legacy context" },
  { logged: "uses the legacy childContextTypes API", failure: "provides legacy context" },
  {
    logged: "declares both contextTypes and contextType",
    failure: "declares both contextType and legacy contextTypes",
  },
  { logged: "Failed %s type", about: "context", failure: "fails a context type check" },
  {
    logged: "Failed %s type",
    about: "child context",
    failure: "fails a child context type check",
  },
  { logged: "validateDOMNesting", failure: "nests elements HTML doesn't allow" },
  {
    logged: "Function components cannot be given refs",
    failure: "gives a ref to a function component",
  },
];
// Legacy context on purpose: ComponentExProvider hands MainContext on to extensions that still
// read legacy context, LegacyContextExtension is the tests' stand-in for one of those, and
// FormFeedback reads react-bootstrap's FormGroup, which only has legacy context.
const legacyContextOnPurpose = ["ComponentExProvider", "LegacyContextExtension", "FormFeedback"];
const ourWarningsLogged = new Set<string>();
const consoleErrorBeforeOurWarnings = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0];
  const warning =
    typeof message === "string"
      ? ourWarnings.find(
          ({ logged, about }) =>
            message.includes(logged) && (about === undefined || args[1] === about),
        )
      : undefined;
  if (warning !== undefined && !legacyContextOnPurpose.includes(String(args[1]))) {
    // React passes the component stack last
    const stack = [...args]
      .reverse()
      .find((arg) => typeof arg === "string" && arg.includes(" at "));
    const frame = /\bat (\S+) \(([^)]+)\)/.exec(String(stack ?? ""));
    if (frame === null || !/[\\/]node_modules[\\/]/.test(frame[2])) {
      ourWarningsLogged.add(`${frame?.[1] ?? "a component"} ${warning.failure}`);
    }
  }
  consoleErrorBeforeOurWarnings.apply(console, args);
};

/**
 * Fails the test for every check above at once. Vitest skips the after-hooks left to run once
 * one throws, so with a hook each, a test failing one check would leave the others' findings
 * to be blamed on the next test.
 */
const failOnReactWarnings = () => {
  const problems: string[] = [];
  if (componentsUpdatedOutsideAct.size > 0) {
    problems.push(`React updated ${[...componentsUpdatedOutsideAct].join(", ")} outside act()`);
  }
  if (findDOMNodeCallers.size > 0) {
    problems.push(`findDOMNode was called from ${[...findDOMNodeCallers].join(", ")}`);
  }
  problems.push(...ourWarningsLogged);
  componentsUpdatedOutsideAct.clear();
  findDOMNodeCallers.clear();
  ourWarningsLogged.clear();
  if (problems.length > 0) {
    throw new Error(`${problems.join("; ")}; see "React warnings" in docs/testing.md`);
  }
};
afterEach(failOnReactWarnings);
afterAll(failOnReactWarnings);

// No test initialises i18next, so react-i18next warns once per file and falls back to
// returning the key. The source strings in this repo are the keys, so that fallback is
// already what the assertions read — this just makes it the stated behaviour instead of a
// side effect, and drops the warning. A test that needs real translations mocks over this.
const { t, i18n } = vi.hoisted(() => ({
  t: (key: string) => key,
  i18n: { language: "en" },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // react-i18next hands back an array that also carries the same values as properties, so
  // both `const { t } = useTranslation()` and `const [t] = useTranslation()` work. The repo
  // uses both, so the stub keeps that shape. The same `t` and `i18n` each time, as the app's
  // are until the language changes, so a memo keyed on them holds across renders.
  useTranslation: () => Object.assign([t, undefined, true], { t, i18n, ready: true }),
}));

// Every path keyed off a single absolute test root so getVortexPath-backed selectors
// (downloadPathForGame, etc.) resolve real strings instead of throwing in tests.
const TEST_ROOT = path.join(os.tmpdir(), "vortex-test");
const p = (...segments: string[]): string => path.join(TEST_ROOT, ...segments);
const testPaths: VortexPaths = {
  base: TEST_ROOT,
  base_unpacked: TEST_ROOT,
  assets: p("assets"),
  assets_unpacked: p("assets"),
  modules: p("modules"),
  modules_unpacked: p("modules"),
  bundledPlugins: p("plugins"),
  locales: p("locales"),
  package: p("package"),
  package_unpacked: p("package"),
  application: TEST_ROOT,
  userData: p("userData"),
  appData: p("appData"),
  localAppData: p("localAppData"),
  temp: p("temp"),
  home: p("home"),
  documents: p("documents"),
  exe: p(process.platform === "win32" ? "vortex.exe" : "vortex"),
  desktop: p("desktop"),
};

// Many modules access window.api.* during import, so provide a default stub.
if (typeof window !== "undefined" && !(window as any).api) {
  (window as any).api = {
    log: vi.fn(),
    app: {
      getName: () => Promise.resolve("vortex"),
      getVersion: () => Promise.resolve("0.0.0-test"),
      getVortexPaths: () => Promise.resolve(testPaths),
    },
    window: { getId: () => Promise.resolve(0) },
  };
}

// happy-dom has no Web Animations API, and headless-ui's Transition asks an element for its
// running animations to know when a transition has finished. Left to itself headless-ui
// installs its own polyfill and warns about it once per test file. Nothing animates for real
// here, so an empty list is the honest answer: a transition is finished as soon as it starts.
if (typeof window !== "undefined" && typeof Element.prototype.getAnimations !== "function") {
  Element.prototype.getAnimations = () => [];
}

// happy-dom has no matchMedia, and anything reading a media preference (reduced motion)
// calls it during render. Reports "no preference" and accepts listeners without firing
// them; a test that cares drives it by replacing window.matchMedia itself.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    // Deprecated half of the MediaQueryList API, still what some libraries reach for.
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

// Initialize once per (isolated) test file so getVortexPath returns the stub paths above.
// The instance getter throws until initialized; use that to init exactly once.
beforeAll(async () => {
  try {
    void ApplicationData.instance;
  } catch {
    await ApplicationData.init();
  }
});
