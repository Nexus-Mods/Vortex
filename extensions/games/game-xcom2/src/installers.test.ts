import { describe, expect, it } from "vitest";
import { util } from "vortex-api";

import {
  XCOM2_GAME_IDS,
  XCOM2_INSTALLER_SPECS,
  XCOM2_MOD_TYPES,
  installConfigDropIn,
  pickConfigDestination,
  testConfigDropIn,
} from "./installers";

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
  it("declares character-pool and save specs in ascending priority order", () => {
    const specs = XCOM2_INSTALLER_SPECS;
    expect(specs.map((s) => s.id)).toEqual(["character-pool", "save"]);
    expect(specs[0]!.priority).toBeLessThan(specs[1]!.priority);
  });

  it("character-pool spec targets the character-pool modType", () => {
    expect(specById("character-pool").modType).toBe(XCOM2_MOD_TYPES.characterPool);
  });

  it("character-pool spec uses filter + flatten install", () => {
    const inst = specById("character-pool").install;
    expect(inst.flatten).toBe(true);
    expect(inst.filter).toEqual({ kind: "extensions", list: [".bin"] });
  });

  it("save spec targets the save modType", () => {
    expect(specById("save").modType).toBe(XCOM2_MOD_TYPES.save);
  });

  it("save spec uses regex filter + flatten install", () => {
    const inst = specById("save").install;
    expect(inst.flatten).toBe(true);
    expect(inst.filter?.kind).toBe("regex");
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

describe("testConfigDropIn", () => {
  it("accepts archives with .ini and no .XComMod", async () => {
    const r = await testConfigDropIn(["mod/Config/X.ini", "mod/readme.txt"], XCOM2_GAME_IDS.base);
    expect(r.supported).toBe(true);
  });

  it("accepts archives with .int loc files", async () => {
    const r = await testConfigDropIn(
      ["XCom2-WarOfTheChosen/XComGame/Localization/X.int"],
      XCOM2_GAME_IDS.wotc,
    );
    expect(r.supported).toBe(true);
  });

  it("accepts language-tagged loc extensions (.rus, .deu, etc.)", async () => {
    const r = await testConfigDropIn(["XComGame/Localization/X.rus"], XCOM2_GAME_IDS.base);
    expect(r.supported).toBe(true);
  });

  it("rejects when a .XComMod descriptor is present (canonical installer claims it)", async () => {
    const r = await testConfigDropIn(["mod/mod.XComMod", "mod/Config/X.ini"], XCOM2_GAME_IDS.base);
    expect(r.supported).toBe(false);
  });

  it("rejects archives with no .ini or .int", async () => {
    const r = await testConfigDropIn(["Pool/X.bin"], XCOM2_GAME_IDS.base);
    expect(r.supported).toBe(false);
  });

  it("rejects when gameId is not an XCOM 2 id", async () => {
    const r = await testConfigDropIn(["XComGame/Config/X.ini"], "xrebirth");
    expect(r.supported).toBe(false);
  });
});

/** Normalise forward-slash paths to the platform separator (noop on Unix). */
function platformPath(p: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return p.replace(/\//g, (require("node:path") as typeof import("node:path")).sep);
}

describe("pickConfigDestination", () => {
  it("preserves WOTC tree suffix when archive has explicit WOTC prefix", () => {
    expect(
      pickConfigDestination(
        "Wrapper/XCom2-WarOfTheChosen/XComGame/Localization/X.int",
        XCOM2_GAME_IDS.wotc,
      ),
    ).toBe(platformPath("XCom2-WarOfTheChosen/XComGame/Localization/X.int"));
  });

  it("WOTC-prefixed path deploys to WOTC tree even when installing for base game", () => {
    // The author tagged the file as WOTC content. The base-game install
    // still deploys to <gamePath>/XCom2-WarOfTheChosen/...; if WOTC isn't
    // present the file is harmless dead weight.
    expect(
      pickConfigDestination(
        "Wrapper/XCom2-WarOfTheChosen/XComGame/Localization/X.int",
        XCOM2_GAME_IDS.base,
      ),
    ).toBe(platformPath("XCom2-WarOfTheChosen/XComGame/Localization/X.int"));
  });

  it("vanilla-tree path preserves XComGame/ prefix for base game install", () => {
    expect(pickConfigDestination("Mod/XComGame/Config/X.ini", XCOM2_GAME_IDS.base)).toBe(
      platformPath("XComGame/Config/X.ini"),
    );
  });

  it("vanilla-tree path gets WOTC prefix when installing for WOTC", () => {
    expect(pickConfigDestination("Mod/XComGame/Config/X.ini", XCOM2_GAME_IDS.wotc)).toBe(
      platformPath("XCom2-WarOfTheChosen/XComGame/Config/X.ini"),
    );
  });

  it("bare .ini at root routes to XComGame/Config (base game)", () => {
    expect(pickConfigDestination("DefaultGameCore.ini", XCOM2_GAME_IDS.base)).toBe(
      platformPath("XComGame/Config/DefaultGameCore.ini"),
    );
  });

  it("bare .int at root routes to XComGame/Localization (WOTC, prefixed)", () => {
    expect(pickConfigDestination("XComGame.int", XCOM2_GAME_IDS.wotc)).toBe(
      platformPath("XCom2-WarOfTheChosen/XComGame/Localization/XComGame.int"),
    );
  });

  it("handles backslash-separated source paths", () => {
    expect(pickConfigDestination("Wrap\\XComGame\\Config\\X.ini", XCOM2_GAME_IDS.base)).toBe(
      platformPath("XComGame/Config/X.ini"),
    );
  });
});

describe("installConfigDropIn", () => {
  it("emits one copy per .ini/.int and drops readmes/screenshots", async () => {
    const result = await installConfigDropIn(
      [
        "wrap/Config/MyConfig.ini",
        "wrap/Localization/MyLoc.int",
        "wrap/Readme.txt",
        "wrap/preview.jpg",
      ],
      "",
      XCOM2_GAME_IDS.base,
    );
    expect(result.instructions).toHaveLength(3); // 2 copy + 1 setmodtype
    const copies = result.instructions.filter((i) => i.type === "copy");
    expect(copies).toHaveLength(2);
    expect(result.instructions.at(-1)).toEqual({
      type: "setmodtype",
      value: XCOM2_MOD_TYPES.configDropIn,
    });
  });

  it("routes a Traducao-style WOTC archive into XCom2-WarOfTheChosen tree", async () => {
    const result = await installConfigDropIn(
      [
        "Traducao XCOM2/XCOM 2/XCom2-WarOfTheChosen/XComGame/DLC/DLC_1/Localization/DLC_1.int",
        "Traducao XCOM2/Creditos.txt",
      ],
      "",
      XCOM2_GAME_IDS.wotc,
    );
    const copy = result.instructions.find((i) => i.type === "copy")!;
    expect(copy).toEqual({
      type: "copy",
      source:
        "Traducao XCOM2/XCOM 2/XCom2-WarOfTheChosen/XComGame/DLC/DLC_1/Localization/DLC_1.int",
      destination: platformPath("XCom2-WarOfTheChosen/XComGame/DLC/DLC_1/Localization/DLC_1.int"),
    });
  });

  it("vanilla install of a bare .ini routes to XComGame/Config/", async () => {
    const result = await installConfigDropIn(["DefaultGameCore.ini"], "", XCOM2_GAME_IDS.base);
    const copy = result.instructions.find((i) => i.type === "copy")!;
    expect(copy).toEqual({
      type: "copy",
      source: "DefaultGameCore.ini",
      destination: platformPath("XComGame/Config/DefaultGameCore.ini"),
    });
  });

  it("WOTC install of a bare .int routes to XCom2-WarOfTheChosen/XComGame/Localization/", async () => {
    const result = await installConfigDropIn(["XComGame.int"], "", XCOM2_GAME_IDS.wotc);
    const copy = result.instructions.find((i) => i.type === "copy")!;
    expect((copy as { destination: string }).destination).toBe(
      platformPath("XCom2-WarOfTheChosen/XComGame/Localization/XComGame.int"),
    );
  });
});

describe("save match predicate (via custom match)", () => {
  const match = specById("save").match;
  if (match.kind !== "custom") throw new Error("expected custom match");
  const accepts = match.predicate;

  it("accepts a named save (save_<name>) at root", () => {
    expect(accepts(["save_LOST"])).toBe(true);
  });

  it("accepts a numbered save (save<digits>) at root", () => {
    expect(accepts(["save14"])).toBe(true);
  });

  it("accepts a save inside a wrapper directory", () => {
    expect(accepts(["Some Save Pack/save_MyName", "Some Save Pack/Readme.txt"])).toBe(true);
  });

  it("rejects archives with a .XComMod (canonical installer claims those)", () => {
    expect(accepts(["mod/save_X", "mod/mod.XComMod"])).toBe(false);
  });

  it("rejects savefile.txt (extension present)", () => {
    expect(accepts(["savefile.txt"])).toBe(false);
  });

  it("rejects 'save_archive.zip' (the underscore is followed by an extension)", () => {
    expect(accepts(["save_archive.zip"])).toBe(false);
  });

  it("rejects a name that just starts with 'save' (e.g. savescum.bin)", () => {
    expect(accepts(["savescum.bin"])).toBe(false);
  });
});

describe("save install (filter + flatten via declareInstallers)", () => {
  it("filters to save-named files and flattens to basenames", async () => {
    const ctx = makeContext();
    util.declareInstallers(ctx as never, XCOM2_GAME_IDS.base, XCOM2_INSTALLER_SPECS);
    const inst = findInstaller(ctx.installers, XCOM2_MOD_TYPES.save);

    const result = await inst.install([
      "MySaveCollection/save_LOST",
      "MySaveCollection/save14",
      "MySaveCollection/screenshot.jpg",
      "MySaveCollection/Readme.txt",
    ]);

    expect(result.instructions).toEqual([
      { type: "copy", source: "MySaveCollection/save_LOST", destination: "save_LOST" },
      { type: "copy", source: "MySaveCollection/save14", destination: "save14" },
      { type: "setmodtype", value: XCOM2_MOD_TYPES.save },
    ]);
  });

  it("accepts both xcom2 and xcom2-wotc when declared per game", async () => {
    const baseCtx = makeContext();
    const wotcCtx = makeContext();
    util.declareInstallers(baseCtx as never, XCOM2_GAME_IDS.base, XCOM2_INSTALLER_SPECS);
    util.declareInstallers(wotcCtx as never, XCOM2_GAME_IDS.wotc, XCOM2_INSTALLER_SPECS);

    const baseInst = findInstaller(baseCtx.installers, XCOM2_MOD_TYPES.save);
    const wotcInst = findInstaller(wotcCtx.installers, XCOM2_MOD_TYPES.save);

    const baseOk = await baseInst.testSupported(["save_X"], XCOM2_GAME_IDS.base);
    const wotcOk = await wotcInst.testSupported(["save14"], XCOM2_GAME_IDS.wotc);

    expect(baseOk.supported).toBe(true);
    expect(wotcOk.supported).toBe(true);
  });
});
