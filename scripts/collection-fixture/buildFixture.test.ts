import * as crypto from "node:crypto";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildFixture } from "./buildFixture";
import type { IFixtureSpec } from "./types";

const OUT = path.resolve("fixture-out");

function spec(overrides: Partial<IFixtureSpec> = {}): IFixtureSpec {
  return {
    game: "skyrimse",
    members: 24,
    phases: 3,
    optionalRatio: 0.25,
    library: 6,
    enabled: 30,
    overlapRatio: 0.5,
    seed: 7,
    outDir: OUT,
    collectionName: "Test Collection",
    autoDeploy: false,
    ...overrides,
  };
}

function build(overrides: Partial<IFixtureSpec> = {}) {
  const fixture = buildFixture(spec(overrides));
  const { state } = fixture;
  const gameId = fixture.summary.game;
  const mods = state.persistent.mods[gameId];
  const collection = mods[fixture.summary.collectionId];
  const allMods = Object.values(mods);
  const installed = allMods.filter((mod) => mod.type !== "collection");
  const members = allMods.filter((mod) => mod.attributes.installedAsDependency === true);
  const fileByPath = new Map(fixture.files.map((file) => [file.path, file.content]));
  const stagingDir = path.relative(OUT, fixture.paths.stagingDir);
  const filesUnder = (dir: string) =>
    fixture.files.filter((file) => file.path.startsWith(path.join(stagingDir, dir) + path.sep));
  return {
    fixture,
    state,
    gameId,
    mods,
    collection,
    installed,
    members,
    fileByPath,
    stagingDir,
    filesUnder,
  };
}

describe("buildFixture", () => {
  it("installs one collection whose rules each name exactly one member by tag", () => {
    const { fixture, collection, members, mods } = build();

    expect(collection.type).toBe("collection");
    expect(collection.rules).toHaveLength(24);
    expect(members).toHaveLength(24);
    expect(Object.keys(mods)).toHaveLength(24 + 6 + 1);

    const byTag = new Map(members.map((mod) => [mod.attributes.referenceTag, mod]));
    const unmatched = (collection.rules ?? []).filter(
      (rule) => byTag.get(rule.reference.tag)?.attributes.fileMD5 !== rule.reference.fileMD5,
    );
    expect(unmatched).toEqual([]);
    expect(new Set((collection.rules ?? []).map((rule) => rule.type))).toEqual(
      new Set(["requires", "recommends"]),
    );
    expect(fixture.summary.optional).toBeGreaterThan(0);
    expect(collection.rules?.filter((rule) => rule.type === "recommends")).toHaveLength(
      fixture.summary.optional,
    );
  });

  it("spreads members over every phase starting at phase 0", () => {
    const { collection } = build({ phases: 3 });
    expect(new Set((collection.rules ?? []).map((rule) => rule.phase))).toEqual(new Set([0, 1, 2]));
  });

  it("gives every mod a finished download whose archive bytes match the recorded md5", () => {
    const { state, gameId, installed, fileByPath, fixture } = build();
    const downloadsDir = path.relative(OUT, fixture.paths.downloadsDir);

    const broken = installed.filter((mod) => {
      const download = state.persistent.downloads.files[mod.archiveId ?? ""];
      const archive = fileByPath.get(path.join(downloadsDir, download?.localPath ?? ""));
      return (
        download?.state !== "finished" ||
        download.game[0] !== gameId ||
        download.installed?.modId !== mod.id ||
        archive === undefined ||
        crypto.createHash("md5").update(archive).digest("hex") !== download.fileMD5 ||
        mod.attributes.fileMD5 !== download.fileMD5
      );
    });
    expect(broken.map((mod) => mod.id)).toEqual([]);
    expect(Object.keys(state.persistent.downloads.files)).toHaveLength(installed.length);
  });

  it("writes the staging tag, every mod's staging folder and the collection manifest", () => {
    const { fixture, installed, fileByPath, state, collection, stagingDir, filesUnder } = build();
    const tag = fileByPath.get(path.join(stagingDir, "__vortex_staging_folder"));
    expect(JSON.parse(String(tag))).toEqual({ instance: state.app.instanceId, game: "skyrimse" });

    const withoutPlugin = installed.filter(
      (mod) => !filesUnder(mod.installationPath).some((file) => file.path.endsWith(".esp")),
    );
    expect(withoutPlugin.map((mod) => mod.id)).toEqual([]);

    const manifestPath = path.join(stagingDir, collection.installationPath, "collection.json");
    const manifest = JSON.parse(String(fileByPath.get(manifestPath)));
    expect(manifest.mods).toHaveLength(24);
    expect(manifest.info.domainName).toBe("skyrimspecialedition");
    expect(manifest.modRules).toHaveLength(fixture.summary.memberRules);
  });

  it("lays out Stardew members as SMAPI mod folders with a manifest naming the mod", () => {
    const { fixture, members, filesUnder } = build({
      game: "stardewvalley",
      members: 5,
      library: 0,
    });
    const manifests = members.map((mod) => {
      const file = filesUnder(mod.installationPath).find((f) => f.path.endsWith("manifest.json"));
      return JSON.parse(String(file?.content ?? "{}"));
    });
    expect(manifests.map((manifest) => manifest.Name)).toEqual(
      members.map((mod) => mod.attributes.name),
    );
    expect(manifests.every((manifest) => String(manifest.UniqueID).includes("."))).toBe(true);
    expect(fixture.state.settings.gameMode.discovered.stardewvalley.pathSetManually).toBe(true);
  });

  it("points load-order rules at installed members and puts every mod in the profile", () => {
    const { fixture, state, mods, members } = build();
    const memberIds = new Set(members.map((mod) => mod.id));
    const rules = members.flatMap((mod) => mod.rules ?? []);
    expect(rules).toHaveLength(fixture.summary.memberRules);
    const dangling = rules.filter(
      (rule) =>
        !memberIds.has(rule.reference.id ?? "") ||
        rule.reference.archiveId !== mods[rule.reference.id ?? ""]?.archiveId,
    );
    expect(dangling).toEqual([]);
    expect(new Set(rules.map((rule) => rule.type))).toEqual(new Set(["before", "after"]));

    const profile = state.persistent.profiles[state.settings.profiles.activeProfileId];
    expect(profile.gameId).toBe("skyrimse");
    expect(Object.keys(profile.modState)).toHaveLength(Object.keys(mods).length);
    const disabledMembers = members.filter((mod) => !(profile.modState[mod.id]?.enabled ?? false));
    expect(disabledMembers).toEqual([]);
    expect(profile.modState[fixture.summary.collectionId]?.enabled).toBe(true);
  });

  it("disables library mods first, then optional members, then required members", () => {
    const enabledState = (enabled: number) => {
      const { state, members, installed, collection } = build({ enabled });
      const profile = state.persistent.profiles[state.settings.profiles.activeProfileId];
      const isOff = (id: string) => !(profile.modState[id]?.enabled ?? false);
      const library = installed.filter((mod) => mod.attributes.installedAsDependency !== true);
      const optionalTags = new Set(
        (collection.rules ?? [])
          .filter((rule) => rule.type === "recommends")
          .map((rule) => rule.reference.tag),
      );
      const optionalIds = new Set(
        members
          .filter((mod) => optionalTags.has(String(mod.attributes.referenceTag)))
          .map((mod) => mod.id),
      );
      return {
        off: installed.filter((mod) => isOff(mod.id)).length,
        libraryOff: library.filter((mod) => isOff(mod.id)).length,
        optionalOff: members.filter((mod) => optionalIds.has(mod.id) && isOff(mod.id)).length,
        requiredOff: members.filter((mod) => !optionalIds.has(mod.id) && isOff(mod.id)).length,
      };
    };

    // 30 installed: 6 library, 24 members
    expect(enabledState(26)).toEqual({ off: 4, libraryOff: 4, optionalOff: 0, requiredOff: 0 });
    const deeper = enabledState(20);
    expect(deeper.off).toBe(10);
    expect(deeper.libraryOff).toBe(6);
    expect(deeper.requiredOff).toBe(Math.max(0, 4 - deeper.optionalOff));
    expect(enabledState(0).off).toBe(30);
  });

  it("reports the enabled and disabled counts it produced", () => {
    const { fixture } = build({ enabled: 21 });
    expect(fixture.summary.enabled).toBe(21);
    expect(fixture.summary.disabled).toBe(9);
    expect(build({ enabled: 999 }).fixture.summary.disabled).toBe(0);
  });

  it("points every path in the state under the output directory", () => {
    const { fixture, state, gameId } = build();
    expect(state.settings.gameMode.discovered[gameId].path).toBe(fixture.paths.gameDir);
    expect(state.settings.mods.installPath[gameId]).toBe(fixture.paths.stagingDir);
    expect(state.settings.downloads.path).toBe(fixture.paths.downloadsRoot);
    const outside = [
      fixture.paths.gameDir,
      fixture.paths.stagingDir,
      fixture.paths.downloadsRoot,
    ].filter((value) => !value.startsWith(OUT));
    expect(outside).toEqual([]);
  });

  it("turns auto-deploy off unless asked", () => {
    expect(build().state.settings.automation.deploy).toBe(false);
    expect(build({ autoDeploy: true }).state.settings.automation.deploy).toBe(true);
  });

  it("keeps the collection offline: no Nexus revision or collection ids", () => {
    const { collection } = build();
    const nexusIds = ["collectionId", "revisionId", "collectionSlug", "revisionNumber"].filter(
      (key) => collection.attributes[key] !== undefined,
    );
    expect(nexusIds).toEqual([]);
  });

  it("is reproducible from the spec and seed, and changes with the seed", () => {
    const first = JSON.stringify(buildFixture(spec()).state);
    const second = JSON.stringify(buildFixture(spec()).state);
    const other = JSON.stringify(buildFixture(spec({ seed: 8 })).state);
    expect(second).toBe(first);
    expect(other).not.toBe(first);
  });

  it("survives a JSON round trip unchanged, as the --merge import reads it", () => {
    const { fixture } = build();
    const parsed: unknown = JSON.parse(JSON.stringify(fixture.state));
    expect(parsed).toEqual(fixture.state);
  });

  it("rejects an empty collection", () => {
    expect(() => buildFixture(spec({ members: 0 }))).toThrow("at least one member");
    expect(() => buildFixture(spec({ phases: 0 }))).toThrow("at least one member");
  });
});
