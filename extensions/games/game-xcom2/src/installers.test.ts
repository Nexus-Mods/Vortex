import { describe, expect, it } from "vitest";
import { util } from "vortex-api";

import { XCOM2_GAME_IDS, XCOM2_INSTALLER_SPECS, XCOM2_MOD_TYPES } from "./installers";

function specById(id: string) {
  const spec = XCOM2_INSTALLER_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`no spec with id=${id}`);
  return spec;
}

/**
 * Minimal mock context capturing registerInstaller calls so we can drive
 * declareInstallers and exercise the synthesised testSupported/install pair
 * against real fixture file lists.
 */
interface RegisteredInstaller {
  id: string;
  priority: number;
  testSupported: (
    files: string[],
    gameId: string,
  ) => Promise<{ supported: boolean; requiredFiles: string[] }>;
  install: (files: string[]) => Promise<{
    instructions: Array<{ type: string; source?: string; destination?: string; value?: string }>;
  }>;
}

function makeContext(): {
  installers: RegisteredInstaller[];
  registerInstaller: (
    id: string,
    priority: number,
    testSupported: RegisteredInstaller["testSupported"],
    install: RegisteredInstaller["install"],
  ) => void;
} {
  const installers: RegisteredInstaller[] = [];
  return {
    installers,
    registerInstaller: (id, priority, testSupported, install) => {
      installers.push({ id, priority, testSupported, install });
    },
  };
}

function findInstaller(installers: RegisteredInstaller[], modType: string): RegisteredInstaller {
  const inst = installers.find((i) => i.id === modType);
  if (!inst) throw new Error(`no registered installer for modType=${modType}`);
  return inst;
}

describe("XCOM2_INSTALLER_SPECS — shape", () => {
  it("declares the character-pool spec", () => {
    expect(XCOM2_INSTALLER_SPECS.map((s) => s.id)).toEqual(["character-pool"]);
  });

  it("character-pool spec targets the character-pool modType", () => {
    expect(specById("character-pool").modType).toBe(XCOM2_MOD_TYPES.characterPool);
  });

  it("character-pool spec uses filter + flatten install", () => {
    const inst = specById("character-pool").install;
    expect(inst.flatten).toBe(true);
    expect(inst.filter).toEqual({ kind: "extensions", list: [".bin"] });
  });
});

describe("character-pool match predicate (via custom match)", () => {
  // The match is a custom predicate; evaluate it directly so the test isn't
  // sensitive to declareInstallers's evaluation wrapping.
  const match = specById("character-pool").match;
  if (match.kind !== "custom") throw new Error("expected custom match");
  const accepts = match.predicate;

  it("accepts a single .bin at root", () => {
    expect(accepts(["Annette.bin"])).toBe(true);
  });

  it("accepts a multi-file .bin archive with readme/screenshot companions", () => {
    expect(accepts(["Archer.bin", "Archer.jpg", "Read Me.txt"])).toBe(true);
  });

  it("accepts a nested .bin (wrapper directory)", () => {
    expect(accepts(["Jagged Alliance v3/Jagged Alliance.bin"])).toBe(true);
  });

  it("rejects archives with .XComMod (those route to the canonical installer)", () => {
    expect(accepts(["MyMod/MyMod.XComMod", "MyMod/extra.bin"])).toBe(false);
  });

  it("rejects archives with no .bin", () => {
    expect(accepts(["Config/XComGame.ini", "Localization/XComGame.int"])).toBe(false);
  });

  it("accepts case-insensitively on .bin", () => {
    expect(accepts(["pool/X.BIN"])).toBe(true);
  });
});

describe("character-pool install (filter + flatten)", () => {
  it("drops readmes/screenshots and flattens .bin to basenames", async () => {
    const ctx = makeContext();
    util.declareInstallers(ctx as never, XCOM2_GAME_IDS.base, XCOM2_INSTALLER_SPECS);
    const inst = findInstaller(ctx.installers, XCOM2_MOD_TYPES.characterPool);

    const result = await inst.install([
      "Archer/Archer.bin",
      "Archer/Archer.jpg",
      "Archer/Read Me.txt",
    ]);

    expect(result.instructions).toEqual([
      { type: "copy", source: "Archer/Archer.bin", destination: "Archer.bin" },
      { type: "setmodtype", value: XCOM2_MOD_TYPES.characterPool },
    ]);
  });

  it("flattens multi-bin packs to one copy per .bin at root", async () => {
    const ctx = makeContext();
    util.declareInstallers(ctx as never, XCOM2_GAME_IDS.base, XCOM2_INSTALLER_SPECS);
    const inst = findInstaller(ctx.installers, XCOM2_MOD_TYPES.characterPool);

    const result = await inst.install([
      "Clone Troopers/Senate Guards.bin",
      "Clone Troopers/Clone Commandos.bin",
      "Clone Troopers/Clone Trooper Serial.bin",
    ]);

    expect(result.instructions).toEqual([
      {
        type: "copy",
        source: "Clone Troopers/Senate Guards.bin",
        destination: "Senate Guards.bin",
      },
      {
        type: "copy",
        source: "Clone Troopers/Clone Commandos.bin",
        destination: "Clone Commandos.bin",
      },
      {
        type: "copy",
        source: "Clone Troopers/Clone Trooper Serial.bin",
        destination: "Clone Trooper Serial.bin",
      },
      { type: "setmodtype", value: XCOM2_MOD_TYPES.characterPool },
    ]);
  });

  it("accepts both xcom2 and xcom2-wotc when declared per game", async () => {
    const baseCtx = makeContext();
    const wotcCtx = makeContext();
    util.declareInstallers(baseCtx as never, XCOM2_GAME_IDS.base, XCOM2_INSTALLER_SPECS);
    util.declareInstallers(wotcCtx as never, XCOM2_GAME_IDS.wotc, XCOM2_INSTALLER_SPECS);

    const baseInst = findInstaller(baseCtx.installers, XCOM2_MOD_TYPES.characterPool);
    const wotcInst = findInstaller(wotcCtx.installers, XCOM2_MOD_TYPES.characterPool);

    const baseOk = await baseInst.testSupported(["a.bin"], XCOM2_GAME_IDS.base);
    const wotcOk = await wotcInst.testSupported(["a.bin"], XCOM2_GAME_IDS.wotc);
    const baseReject = await baseInst.testSupported(["a.bin"], "other-game");

    expect(baseOk.supported).toBe(true);
    expect(wotcOk.supported).toBe(true);
    expect(baseReject.supported).toBe(false);
  });
});
