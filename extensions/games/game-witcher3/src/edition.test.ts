import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CONFIG_MATRIX_FILES,
  DX11_EXECUTABLE,
  DX12_EXECUTABLE,
  EDITION_CAPABILITIES,
  MAX_MOD_NAME_LENGTH,
  W3Edition,
  detectEditionFrom,
  determineExecutableFrom,
} from "./edition";

const DX11 = path.join("bin", "x64", "witcher3.exe");
const DX12 = path.join("bin", "x64_dx12", "witcher3.exe");
const FREECAM = path.join("bin", "config", "base", "freecamera.ini");

/** Build the `exists` predicate from a list of paths the install contains. */
const install = (...present: string[]) => {
  const set = new Set(present);
  return (relPath: string) => set.has(relPath);
};

describe("detectEditionFrom", () => {
  it("reports Classic installs as legacy", () => {
    expect(detectEditionFrom(install(DX11))).toBe(W3Edition.Legacy);
  });

  it("reports Next-Gen installs as legacy", () => {
    // 4.x ships both renderers.
    expect(detectEditionFrom(install(DX11, DX12))).toBe(W3Edition.Legacy);
  });

  it("reports a DirectX 12 only install as remastered", () => {
    expect(detectEditionFrom(install(DX12))).toBe(W3Edition.Remastered);
  });

  it("recognises a remaster from its packaging markers alone", () => {
    expect(detectEditionFrom(install("dlc-tombstones"))).toBe(W3Edition.Remastered);
    expect(detectEditionFrom(install(FREECAM))).toBe(W3Edition.Remastered);
  });

  it("treats the DirectX 11 binary as decisive when markers contradict it", () => {
    // A storefront could ship remaster-shaped extras alongside a 4.x tree; the
    // renderer is the engine-level signal, so it wins.
    expect(detectEditionFrom(install(DX11, DX12, "dlc-tombstones"))).toBe(W3Edition.Legacy);
  });

  it("falls back to legacy when the install shape is unrecognised", () => {
    // Every edition-specific code path is gated on Remastered, so an install we
    // can't read has to behave exactly as the extension always has.
    expect(detectEditionFrom(install())).toBe(W3Edition.Legacy);
  });
});

describe("EDITION_CAPABILITIES", () => {
  it("covers every edition", () => {
    for (const edition of Object.values(W3Edition)) {
      expect(EDITION_CAPABILITIES[edition]).toBeDefined();
    }
  });

  it("leaves the legacy config matrix list untouched", () => {
    // Narrowing this for 4.x would silently stop menu mods merging.
    expect(EDITION_CAPABILITIES[W3Edition.Legacy].configMatrixFiles).toEqual(CONFIG_MATRIX_FILES);
  });

  it("drops only graphicsdx11 from the remastered config matrix list", () => {
    const remastered = EDITION_CAPABILITIES[W3Edition.Remastered].configMatrixFiles;
    expect(remastered).not.toContain("graphicsdx11");
    expect(remastered).toEqual(CONFIG_MATRIX_FILES.filter((file) => file !== "graphicsdx11"));
  });

  it("enforces the mod folder name limit only on the remaster", () => {
    expect(EDITION_CAPABILITIES[W3Edition.Legacy].enforcesModNameLength).toBe(false);
    expect(EDITION_CAPABILITIES[W3Edition.Remastered].enforcesModNameLength).toBe(true);
  });
});

describe("determineExecutableFrom", () => {
  it("prefers the DirectX 12 binary when the install has one", () => {
    expect(determineExecutableFrom(install(DX11_EXECUTABLE, DX12_EXECUTABLE))).toBe(
      DX12_EXECUTABLE,
    );
    expect(determineExecutableFrom(install(DX12_EXECUTABLE))).toBe(DX12_EXECUTABLE);
  });

  it("falls back to the DirectX 11 binary when nothing is found", () => {
    // Vortex calls the game's executable() with no arguments to establish a
    // default, and that default is what every pre-remaster install launches
    // through - changing it would break the Play button for existing users.
    expect(determineExecutableFrom(install())).toBe(DX11_EXECUTABLE);
  });
});

describe("MAX_MOD_NAME_LENGTH", () => {
  it("leaves room for a terminator under the game's declared limit of 64", () => {
    expect(MAX_MOD_NAME_LENGTH).toBe(63);
  });
});
