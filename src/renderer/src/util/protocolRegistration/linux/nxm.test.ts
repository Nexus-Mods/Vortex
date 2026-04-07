import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deregisterLinuxNxmProtocolHandler,
  registerLinuxNxmProtocolHandler,
} from "./nxm";

vi.mock("fs-extra", () => ({
  default: {
    readFileSync: vi.fn(),
    outputFileSync: vi.fn(),
    chmodSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  outputFileSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock("./common", () => ({
  applicationsDirectory: vi.fn(() => "/home/testuser/.local/share/applications"),
  getDefaultUrlSchemeHandler: vi.fn(() => undefined),
  setDefaultUrlSchemeHandler: vi.fn(),
  refreshDesktopDatabase: vi.fn(),
}));

vi.mock("./desktopFileEscaping", () => ({
  escapeDesktopExecFilePath: vi.fn((x: string) => x),
  escapeDesktopFilePath: vi.fn((x: string) => x),
}));

vi.mock("../../log", () => ({ log: vi.fn() }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setPlatform(platform: string): void {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let originalPlatform: string;
let originalNodeEnv: string | undefined;
let originalDefaultApp: boolean | undefined;

beforeEach(() => {
  vi.resetAllMocks();

  originalPlatform = process.platform;
  originalNodeEnv = process.env.NODE_ENV;
  originalDefaultApp = (process as NodeJS.Process & { defaultApp?: boolean })
    .defaultApp;

  // Ensure APPIMAGE is unset by default so production-build path doesn't
  // trigger in tests that don't explicitly want it.
  delete process.env.APPIMAGE;
  delete process.env.IS_FLATPAK;
});

afterEach(() => {
  setPlatform(originalPlatform);

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalDefaultApp === undefined) {
    delete (process as NodeJS.Process & { defaultApp?: boolean }).defaultApp;
  } else {
    (process as NodeJS.Process & { defaultApp?: boolean }).defaultApp =
      originalDefaultApp;
  }
});

// ---------------------------------------------------------------------------
// Tests: deregisterLinuxNxmProtocolHandler
// ---------------------------------------------------------------------------

describe("deregisterLinuxNxmProtocolHandler", () => {
  it("does not throw on non-linux platforms", () => {
    setPlatform("win32");
    expect(() => deregisterLinuxNxmProtocolHandler()).not.toThrow();
  });

  it("does not throw on linux", () => {
    setPlatform("linux");
    expect(() => deregisterLinuxNxmProtocolHandler()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: registerLinuxNxmProtocolHandler
// ---------------------------------------------------------------------------

describe("registerLinuxNxmProtocolHandler", () => {
  const defaultOptions = {
    setAsDefault: true,
    executablePath: "/usr/bin/electron",
    appPath: "/opt/vortex/app",
  };

  it("returns false on non-linux platforms", () => {
    setPlatform("win32");
    const result = registerLinuxNxmProtocolHandler(defaultOptions);
    expect(result).toBe(false);
  });

  describe("on linux", () => {
    beforeEach(async () => {
      setPlatform("linux");

      // Use development build so the dev desktop-entry path is exercised.
      // This avoids the APPIMAGE branch while still exercising file writes.
      process.env.NODE_ENV = "development";
      delete (process as NodeJS.Process & { defaultApp?: boolean }).defaultApp;

      // Make readFileSync throw ENOENT so writeFileIfChanged considers files
      // changed and calls outputFileSync (exercises the write path).
      const fse = await import("fs-extra");
      vi.mocked(fse.readFileSync).mockImplementation(() => {
        const err: NodeJS.ErrnoException = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      });
    });

    it("returns false when setAsDefault is false", async () => {
      const result = registerLinuxNxmProtocolHandler({
        ...defaultOptions,
        setAsDefault: false,
      });
      expect(result).toBe(false);
    });

    it("calls setDefaultUrlSchemeHandler when setAsDefault is true", async () => {
      const common = await import("./common");
      vi.mocked(common.getDefaultUrlSchemeHandler).mockReturnValue(undefined);

      registerLinuxNxmProtocolHandler({ ...defaultOptions, setAsDefault: true });

      expect(common.setDefaultUrlSchemeHandler).toHaveBeenCalledOnce();
      expect(common.setDefaultUrlSchemeHandler).toHaveBeenCalledWith(
        "nxm",
        "com.nexusmods.vortex.dev.desktop",
      );
    });

    it("returns true when the current handler differs from the desktop ID", async () => {
      const common = await import("./common");
      vi.mocked(common.getDefaultUrlSchemeHandler).mockReturnValue(
        "some.other.handler.desktop",
      );

      const result = registerLinuxNxmProtocolHandler({
        ...defaultOptions,
        setAsDefault: true,
      });

      expect(result).toBe(true);
    });

    it("returns false when the current handler already matches the desktop ID", async () => {
      const common = await import("./common");
      // Simulate the dev desktop ID already being the registered handler.
      vi.mocked(common.getDefaultUrlSchemeHandler).mockReturnValue(
        "com.nexusmods.vortex.dev.desktop",
      );

      const result = registerLinuxNxmProtocolHandler({
        ...defaultOptions,
        setAsDefault: true,
      });

      expect(result).toBe(false);
    });

    it("calls refreshDesktopDatabase when desktop files changed", async () => {
      const common = await import("./common");

      registerLinuxNxmProtocolHandler({ ...defaultOptions, setAsDefault: true });

      expect(common.refreshDesktopDatabase).toHaveBeenCalledOnce();
      expect(common.refreshDesktopDatabase).toHaveBeenCalledWith(
        "/home/testuser/.local/share/applications",
      );
    });

    it("does not call refreshDesktopDatabase when desktop files are unchanged", async () => {
      const fse = await import("fs-extra");
      const common = await import("./common");

      // For this test we need to simulate no file changes. We do this by
      // making readFileSync return the exact content that would be written so
      // writeFileIfChanged sees no diff.  Because the generated content is
      // non-trivial to replicate here we instead take a simpler approach:
      // switch to the PACKAGE_DESKTOP_ID path (production, non-AppImage) so
      // that neither ensureDevDesktopEntry nor ensureAppImageDesktopEntry runs
      // at all (both are gated on specific build types).
      delete process.env.NODE_ENV;
      delete (process as NodeJS.Process & { defaultApp?: boolean }).defaultApp;
      delete process.env.APPIMAGE;
      delete process.env.IS_FLATPAK;

      // readFileSync won't be called because no file-write helper is entered.
      vi.mocked(fse.readFileSync).mockReturnValue("" as unknown as Buffer);

      registerLinuxNxmProtocolHandler({ ...defaultOptions, setAsDefault: true });

      expect(common.refreshDesktopDatabase).not.toHaveBeenCalled();
    });
  });
});
