// NOTE(erri120): yes, the library is called "jest-dom" but it works for vitest as well with this import:
// https://www.npmjs.com/package/@testing-library/jest-dom#with-vitest
import os from "node:os";
import path from "node:path";

import "@testing-library/jest-dom/vitest";
import type { VortexPaths } from "@vortex/shared/ipc";
import { beforeAll, vi } from "vitest";

import { ApplicationData } from "./src/applicationData";

// No test initialises i18next, so react-i18next warns once per file and falls back to
// returning the key. The source strings in this repo are the keys, so that fallback is
// already what the assertions read — this just makes it the stated behaviour instead of a
// side effect, and drops the warning. A test that needs real translations mocks over this.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // react-i18next hands back an array that also carries the same values as properties, so
  // both `const { t } = useTranslation()` and `const [t] = useTranslation()` work. The repo
  // uses both, so the stub keeps that shape.
  useTranslation: () => {
    const t = (key: string) => key;
    return Object.assign([t, undefined, true], { t, i18n: undefined, ready: true });
  },
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
