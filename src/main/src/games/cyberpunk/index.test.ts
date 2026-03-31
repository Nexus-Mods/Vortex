import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path/win32";

import { afterEach, describe, expect, it } from "vitest";

import { createCyberpunkService } from "./index";

const service = createCyberpunkService();
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      rm(dir, { recursive: true, force: true }),
    ),
  );
});

async function makeStagingDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cp2077-main-"));
  tempDirs.push(dir);
  return dir;
}

describe("Cyberpunk internal service", () => {
  it("autoconverts heritage archives into REDmods when the feature is enabled", async () => {
    const stagingPath = await makeStagingDir();
    const plan = await service.buildInstallPlan(
      {
        stagingPath,
        archivePath: "Legacy Archive.zip",
        files: [
          { path: "archive\\pc\\patch\\legacy.archive" },
        ],
      },
      {
        gameId: "cyberpunk2077",
        features: {
          v2077_feature_redmod_autoconvert_archives: true,
        },
      },
    );

    expect(plan.installerId).toBe("cyberpunk2077-archive");
    expect(plan.instructions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "copy",
          destination: "mods\\Legacy Archive\\archives\\legacy.archive",
        }),
        expect.objectContaining({
          type: "attribute",
          key: "V2077_mod_attr_mod_type",
        }),
      ]),
    );
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cyberpunk-install-autoconverted-redmod",
          level: "info",
        }),
      ]),
    );
  });

  it("detects and combines multitype archives", async () => {
    const stagingPath = await makeStagingDir();
    const plan = await service.buildInstallPlan(
      {
        stagingPath,
        archivePath: "Mixed Mod.zip",
        files: [
          { path: "archive\\pc\\mod\\base.archive" },
          { path: "r6\\scripts\\Mixed\\feature.reds" },
        ],
      },
      {
        gameId: "cyberpunk2077",
      },
    );

    expect(plan.installerId).toBe("cyberpunk2077-multitype");
    expect(plan.warnings?.[0]).toContain("archive");
    expect(plan.warnings?.[0]).toContain("redscript");
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cyberpunk-install-multitype",
        }),
      ]),
    );
    expect(plan.instructions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "copy",
          destination: "archive\\pc\\mod\\base.archive",
        }),
        expect.objectContaining({
          type: "copy",
          destination: "r6\\scripts\\Mixed\\feature.reds",
        }),
      ]),
    );
  });

  it("routes top-level preset files to CyberCAT when they look like CyberCAT JSON", async () => {
    const stagingPath = await makeStagingDir();
    await writeFile(
      path.join(stagingPath, "preset.preset"),
      JSON.stringify({
        DataExists: true,
        Unknown1: 0,
        UnknownFirstBytes: "",
        FirstSection: { AppearanceSections: [] },
        SecondSection: { AppearanceSections: [] },
        ThirdSection: { AppearanceSections: [] },
        StringTriples: [],
      }),
      "utf8",
    );

    const plan = await service.buildInstallPlan(
      {
        stagingPath,
        archivePath: "Preset.zip",
        files: [{ path: "preset.preset" }],
      },
      {
        gameId: "cyberpunk2077",
      },
    );

    expect(plan.installerId).toBe("cyberpunk2077-preset");
    expect(plan.instructions).toEqual([
      expect.objectContaining({
        type: "copy",
        destination: "V2077\\presets\\cybercat\\preset.preset",
      }),
    ]);
  });

  it("warns when an archive writes to protected config paths", async () => {
    const stagingPath = await makeStagingDir();
    const plan = await service.buildInstallPlan(
      {
        stagingPath,
        archivePath: "Config.zip",
        files: [{ path: "options.json" }],
      },
      {
        gameId: "cyberpunk2077",
      },
    );

    expect(plan.installerId).toBe("cyberpunk2077-config-json");
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cyberpunk-install-protected-paths",
          level: "warning",
        }),
      ]),
    );
  });

  it("warns when the fallback installer is used", async () => {
    const stagingPath = await makeStagingDir();
    const plan = await service.buildInstallPlan(
      {
        stagingPath,
        archivePath: "Unknown Package.zip",
        files: [{ path: "docs\\readme.txt" }],
      },
      {
        gameId: "cyberpunk2077",
      },
    );

    expect(plan.installerId).toBe("cyberpunk2077-fallback");
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cyberpunk-install-fallback",
          level: "warning",
        }),
      ]),
    );
  });

  it("compiles REDmod metadata into load-order entries", async () => {
    const snapshot = await service.compileLoadOrder({
      gameId: "cyberpunk2077",
      activeProfileId: "profile-1",
      mods: [
        {
          id: "mod-a",
          name: "Mod A",
          enabled: true,
          version: "1.2.3",
          attributes: {
            V2077_mod_attr_redmod_info_array: {
              data: [
                {
                  name: "Alpha",
                  version: "1.0.0",
                  relativePath: "mods\\Alpha",
                  vortexModId: "1",
                },
              ],
            },
          },
        },
      ],
    });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      id: "mod-a",
      enabled: true,
      data: expect.objectContaining({
        ownerVortexProfileId: "profile-1",
        redmodInfo: expect.objectContaining({
          relativePath: "mods\\Alpha",
        }),
      }),
    });
  });
});
