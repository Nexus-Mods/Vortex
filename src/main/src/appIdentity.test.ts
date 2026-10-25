import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertNotVortexDataPath,
  dataRootPath,
  multiUserRootPath,
  VortexDataPathError,
} from "./appIdentity";

const appData = path.join(path.sep, "Users", "me", "AppData", "Roaming");
const programData = path.join(path.sep, "ProgramData");
const env = { appData, programData, development: false };

describe("data folders", () => {
  it("uses a mkeiitmods folder instead of the Vortex one", () => {
    expect(dataRootPath(env)).toBe(path.join(appData, "mkeiitmods"));
    expect(dataRootPath({ ...env, development: true })).toBe(
      path.join(appData, "mkeiitmods_devel"),
    );
    expect(multiUserRootPath(programData)).toBe(path.join(programData, "mkeiitmods"));
  });

  it("never resolves to a Vortex data folder", () => {
    for (const p of [
      dataRootPath(env),
      dataRootPath({ ...env, development: true }),
      multiUserRootPath(programData),
    ]) {
      expect(() => assertNotVortexDataPath(p, env)).not.toThrow();
    }
  });
});

describe("assertNotVortexDataPath", () => {
  it.each([
    path.join(appData, "Vortex"),
    path.join(appData, "vortex"),
    path.join(appData, "VORTEX", "state.v2"),
    path.join(appData, "vortex_devel"),
    path.join(appData, "@vortex", "main"),
    path.join(programData, "vortex"),
    // Windows style separators with different casing
    "C:\\Users\\me\\AppData\\Roaming\\Vortex\\state.v2",
  ])("rejects %s", (p) => {
    const winEnv = { appData: "c:\\users\\me\\appdata\\roaming", development: false };
    const useEnv = p.startsWith("C:") ? winEnv : env;
    expect(() => assertNotVortexDataPath(p, useEnv)).toThrow(VortexDataPathError);
  });

  it("allows unrelated folders that happen to contain 'vortex'", () => {
    expect(() =>
      assertNotVortexDataPath(path.join(appData, "mkeiitmods", "vortex"), env),
    ).not.toThrow();
    expect(() => assertNotVortexDataPath(path.join(appData, "vortex-themes"), env)).not.toThrow();
    expect(() =>
      assertNotVortexDataPath(path.join(path.sep, "Games", "Vortex"), env),
    ).not.toThrow();
  });
});
