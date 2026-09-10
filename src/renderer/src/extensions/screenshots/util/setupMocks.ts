import { vi } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

const mockUseTranslation = vi.hoisted(() =>
  vi.fn(() => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: () => Promise.resolve(),
    },
  })),
);

/* This helper exists as some of the tests aren't set up with the correct global mocks and will fail during automated testing */
export default function setupRendererTestMocks(pathsOverride?: any) {
  (global as any).ResizeObserver = class {
    constructor(_cb: ResizeObserverCallback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  (global as any).window = globalThis;
  (window as any).api = {
    log: vi.fn(),
    app: {
      getName: () => Promise.resolve("vortex"),
      getVersion: () => Promise.resolve("0.0.0-test"),
      getVortexPaths: () => Promise.resolve(pathsOverride ?? {}),
    },
    translate: (k: string) => k,
    selectDir: vi.fn().mockResolvedValue(""),
    sendNotification: vi.fn(),
    shell: { openUrl: vi.fn(), showItemInFolder: vi.fn() },
  };

  vi.mock("react-i18next", () => ({
    useTranslation: mockUseTranslation,
  }));
}
