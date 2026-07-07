// NOTE(erri120): yes, the library is called "jest-dom" but it works for vitest as well with this import:
// https://www.npmjs.com/package/@testing-library/jest-dom#with-vitest
import "@testing-library/jest-dom/vitest";
import type { VortexPaths } from "@vortex/shared/ipc";
import { beforeAll, vi } from "vitest";

import { ApplicationData } from "./src/applicationData";

// Every path keyed off a single absolute test root so getVortexPath-backed selectors
// (downloadPathForGame, etc.) resolve real strings instead of throwing in tests.
const TEST_ROOT = "C:\\vortex-test";
const testPaths: VortexPaths = {
  base: TEST_ROOT,
  base_unpacked: TEST_ROOT,
  assets: `${TEST_ROOT}\\assets`,
  assets_unpacked: `${TEST_ROOT}\\assets`,
  modules: `${TEST_ROOT}\\modules`,
  modules_unpacked: `${TEST_ROOT}\\modules`,
  bundledPlugins: `${TEST_ROOT}\\plugins`,
  locales: `${TEST_ROOT}\\locales`,
  package: `${TEST_ROOT}\\package`,
  package_unpacked: `${TEST_ROOT}\\package`,
  application: TEST_ROOT,
  userData: `${TEST_ROOT}\\userData`,
  appData: `${TEST_ROOT}\\appData`,
  localAppData: `${TEST_ROOT}\\localAppData`,
  temp: `${TEST_ROOT}\\temp`,
  home: `${TEST_ROOT}\\home`,
  documents: `${TEST_ROOT}\\documents`,
  exe: `${TEST_ROOT}\\vortex.exe`,
  desktop: `${TEST_ROOT}\\desktop`,
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

// Initialize once per (isolated) test file so getVortexPath returns the stub paths above.
// The instance getter throws until initialized; use that to init exactly once.
beforeAll(async () => {
  try {
    void ApplicationData.instance;
  } catch {
    await ApplicationData.init();
  }
});
