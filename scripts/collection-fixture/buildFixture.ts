/**
 * Builds the fixture in memory: the state backup Vortex merges at startup, plus every file that
 * state points at (fake game install, staging folders, download archives). Pure: nothing here
 * touches the disk, so a test can assert on the output and `generate.ts` owns the writing.
 *
 * The records mirror what a real collection install leaves behind, as modelled by the renderer's
 * test builders (`src/renderer/src/test-utils/builders.ts`) and stamped by `InstallManager`,
 * `InstallDriver` and `postprocessCollection`:
 *
 * - the collection is a mod of type "collection" whose `rules` name each member by reference tag
 * - each member is an installed mod carrying `referenceTag` and `installedAsDependency`, with a
 *   finished download whose `modInfo.referenceTag` and md5 match the rule
 * - load-order rules between members use `{ id, idHint, archiveId }` references, the form
 *   `postprocessCollection` writes once both mods are installed
 *
 * The collection deliberately carries no Nexus ids (`collectionId`, `revisionId`,
 * `collectionSlug`, `revisionNumber`). Every collection view guards its revision fetch on those,
 * so leaving them out keeps the fixture offline; the collection behaves like one authored
 * locally.
 */
import * as crypto from "node:crypto";
import * as path from "node:path";

import { fakeExecutable, GAMES, type IGameConfig } from "./games";
import { makePlugin } from "./plugin";
import { SeededRandom } from "./random";
import type {
  GameId,
  IDownloadRecord,
  IFixture,
  IFixtureFile,
  IFixturePaths,
  IFixtureSpec,
  IFixtureState,
  IModRecord,
  IModRuleRecord,
  IProfileRecord,
} from "./types";
import { type IZipEntry, makeZip } from "./zip";

// the tag files Vortex writes into a staging / downloads folder to bind it to an instance
// (src/renderer/src/extensions/mod_management/stagingDirectory.ts,
//  src/renderer/src/extensions/download_management/util/downloadDirectory.ts)
const STAGING_TAG = "__vortex_staging_folder";
const DOWNLOADS_TAG = "__vortex_downloads_folder";

const COLLECTION_TYPE = "collection";

// every timestamp derives from this so a spec produces byte-identical output
const BASE_TIME = Date.UTC(2026, 0, 1, 12, 0, 0);

// share of members that get a load-order rule against an earlier member
const RULE_CHANCE = 0.15;
// members with overlapping files are spread over this many shared files
const OVERLAP_GROUPS = 8;

const MASTER_PLUGIN: Partial<Record<GameId, string>> = {
  skyrimse: "Skyrim.esm",
  fallout4: "Fallout4.esm",
};

const ADJECTIVES = [
  "Immersive",
  "Enhanced",
  "Realistic",
  "Dynamic",
  "Ultimate",
  "Legendary",
  "Simple",
  "Vivid",
  "Ancient",
  "Modern",
  "Cinematic",
  "Improved",
  "Better",
  "Complete",
  "True",
  "Wild",
  "Quiet",
  "Bright",
  "Dark",
  "Northern",
  "Frozen",
  "Verdant",
  "Rustic",
  "Grand",
];

const NOUNS = [
  "Armory",
  "Weathers",
  "Textures",
  "Landscapes",
  "Creatures",
  "Followers",
  "Cities",
  "Interiors",
  "Lighting",
  "Animations",
  "Sounds",
  "Crafting",
  "Combat",
  "Magic",
  "Quests",
  "Trees",
  "Roads",
  "Water",
  "Skies",
  "Faces",
  "Outfits",
  "Furniture",
  "Overhaul",
  "Patch",
];

const AUTHORS = [
  "modmaker42",
  "Elsweyr",
  "ravenfeather",
  "Nordwind",
  "pixelsmith",
  "Cartographer",
  "BlueVerdigris",
  "Saltmarsh",
  "quietfox",
  "Tallgrass",
];

const CATEGORIES: Array<{ id: number; name: string }> = [
  { id: 2, name: "Armour" },
  { id: 3, name: "Audio" },
  { id: 4, name: "Cities, Towns and Villages" },
  { id: 5, name: "Environment" },
  { id: 6, name: "Gameplay" },
  { id: 7, name: "Models and Textures" },
  { id: 8, name: "Patches" },
  { id: 9, name: "Visuals and Graphics" },
];

interface IModEntry {
  mod: IModRecord;
  download: IDownloadRecord;
  name: string;
  tag: string;
  version: string;
  modId: number;
  fileId: number;
  author: string;
  category: string;
  phase: number;
  optional: boolean;
  overlapping: boolean;
  zip: Buffer;
  archiveName: string;
  files: IZipEntry[];
}

interface IBuildContext {
  spec: IFixtureSpec;
  game: IGameConfig;
  rng: SeededRandom;
  paths: IFixturePaths;
  instanceId: string;
  usedNames: Set<string>;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function fixturePaths(outDir: string, game: IGameConfig): IFixturePaths {
  return {
    outDir,
    gameDir: path.join(outDir, "game", game.name),
    stagingDir: path.join(outDir, "staging", game.id),
    // Vortex appends the game id to the downloads root itself (getDownloadPath)
    downloadsRoot: path.join(outDir, "downloads"),
    downloadsDir: path.join(outDir, "downloads", game.id),
    userDataDir: path.join(outDir, "user-data"),
    stateFile: path.join(outDir, "state.json"),
    // game settings Bethesda games write on deploy, redirected here by the launcher
    localAppDataDir: path.join(outDir, "local-app-data"),
    documentsDir: path.join(outDir, "documents"),
  };
}

function uniqueName(ctx: IBuildContext): string {
  const base = `${ctx.rng.pick(ADJECTIVES)} ${ctx.rng.pick(NOUNS)}`;
  let name = base;
  let suffix = 2;
  while (ctx.usedNames.has(name)) {
    name = `${base} ${suffix++}`;
  }
  ctx.usedNames.add(name);
  return name;
}

function version(rng: SeededRandom): string {
  return `${rng.int(1, 4)}.${rng.int(0, 12)}.${rng.int(0, 9)}`;
}

/** a shared file's bytes depend only on its group, so every mod in the group ships the same file */
function sharedFile(group: number, size: number): Buffer {
  return new SeededRandom(0x5eed + group).bytes(size);
}

function modFiles(
  ctx: IBuildContext,
  name: string,
  author: string,
  opts: { modId: number; overlapGroup?: number },
): IZipEntry[] {
  const slug = slugify(name);
  const files: IZipEntry[] = [];
  if (ctx.game.layout === "gamebryo") {
    files.push({
      name: `${name}.esp`,
      data: makePlugin({
        author,
        description: `${name} (fixture)`,
        masters: [MASTER_PLUGIN[ctx.game.id] ?? "Skyrim.esm"],
      }),
    });
    files.push({ name: `textures/${slug}/${slug}_d.dds`, data: ctx.rng.bytes(2048) });
    files.push({ name: `meshes/${slug}/${slug}.nif`, data: ctx.rng.bytes(1024) });
    if (opts.overlapGroup !== undefined) {
      files.push({
        name: `textures/shared/tile_${opts.overlapGroup}.dds`,
        data: sharedFile(opts.overlapGroup, 1024),
      });
    }
  } else {
    const manifest = {
      Name: name,
      Author: author,
      Version: "1.0.0",
      Description: `${name} (fixture)`,
      UniqueID: `${author}.${slug}`,
      EntryDll: `${slug}.dll`,
      MinimumApiVersion: "4.0.0",
      UpdateKeys: [`Nexus:${opts.modId}`],
      Dependencies: [],
    };
    files.push({ name: `${name}/manifest.json`, data: JSON.stringify(manifest, null, 2) });
    files.push({ name: `${name}/${slug}.dll`, data: ctx.rng.bytes(1024) });
    files.push({ name: `${name}/i18n/default.json`, data: JSON.stringify({ greeting: name }) });
    if (opts.overlapGroup !== undefined) {
      files.push({
        name: `Shared Assets/assets/tile_${opts.overlapGroup}.png`,
        data: sharedFile(opts.overlapGroup, 1024),
      });
    }
  }
  return files;
}

function makeModEntry(
  ctx: IBuildContext,
  index: number,
  kind: "member" | "library",
  phase: number,
  optional: boolean,
): IModEntry {
  const { rng, game } = ctx;
  const name = uniqueName(ctx);
  const slug = slugify(name);
  const author = rng.pick(AUTHORS);
  const cat = rng.pick(CATEGORIES);
  const ver = version(rng);
  const modId = 1000 + index * 7 + rng.int(0, 5);
  const fileId = modId * 10 + rng.int(1, 9);
  const tag = rng.token(9);
  const overlapping = kind === "member" && rng.chance(ctx.spec.overlapRatio);
  const overlapGroup = overlapping ? rng.int(0, OVERLAP_GROUPS - 1) : undefined;

  const files = modFiles(ctx, name, author, { modId, overlapGroup });
  const zip = makeZip(files);
  const md5 = crypto.createHash("md5").update(zip).digest("hex");
  const modKey = `${slug}-${modId}-${ver.replace(/\./g, "-")}`;
  const archiveName = `${modKey}.zip`;
  const downloadId = rng.token(9);
  const installTime = new Date(BASE_TIME + index * 60_000).toISOString();
  const modSize = files.reduce((sum, file) => sum + Buffer.byteLength(file.data), 0);

  const mod: IModRecord = {
    id: modKey,
    state: "installed",
    type: "",
    archiveId: downloadId,
    installationPath: modKey,
    attributes: {
      name,
      logicalFileName: name,
      fileName: archiveName,
      version: ver,
      newestVersion: ver,
      author,
      uploader: author,
      description: `${name} by ${author}. Generated fixture content for performance testing.`,
      shortDescription: `${name} (fixture)`,
      category: cat.id,
      source: "nexus",
      modId,
      fileId,
      downloadGame: game.id,
      fileMD5: md5,
      fileSize: zip.length,
      modSize,
      installTime,
      homepage: `https://www.nexusmods.com/${game.domainName}/mods/${modId}`,
      ...(kind === "member"
        ? { referenceTag: tag, referenceTags: [tag], installedAsDependency: true }
        : {}),
    },
  };

  const download: IDownloadRecord = {
    id: downloadId,
    state: "finished",
    urls: [],
    localPath: archiveName,
    game: [game.id],
    modInfo: {
      game: game.id,
      name,
      source: "nexus",
      nexus: { ids: { gameId: game.id, modId, fileId } },
      ...(kind === "member" ? { referenceTag: tag, referenceTags: [tag] } : {}),
    },
    installed: { gameId: game.id, modId: modKey },
    fileMD5: md5,
    startTime: BASE_TIME + index * 60_000 - 30_000,
    fileTime: BASE_TIME + index * 60_000 - 10_000,
    size: zip.length,
    received: zip.length,
    verified: 0,
  };

  return {
    mod,
    download,
    name,
    tag,
    version: ver,
    modId,
    fileId,
    author,
    category: cat.name,
    phase,
    optional,
    overlapping,
    zip,
    archiveName,
    files,
  };
}

function memberRule(ctx: IBuildContext, entry: IModEntry): IModRuleRecord {
  return {
    type: entry.optional ? "recommends" : "requires",
    phase: entry.phase,
    reference: {
      tag: entry.tag,
      logicalFileName: entry.name,
      versionMatch: entry.version,
      fileMD5: entry.download.fileMD5,
      fileSize: entry.download.size,
      gameId: ctx.game.id,
      repo: {
        repository: "nexus",
        gameId: ctx.game.domainName,
        modId: String(entry.modId),
        fileId: String(entry.fileId),
      },
    },
    extra: {
      name: entry.name,
      author: entry.author,
      version: entry.version,
      category: entry.category,
      type: "",
    },
    ...(entry.optional ? { ignored: false } : {}),
  };
}

/** load-order rules between members, both as installed-mod rules and as manifest modRules */
function memberLoadOrderRules(ctx: IBuildContext, members: IModEntry[]) {
  const manifestRules: Array<Record<string, unknown>> = [];
  for (let i = 1; i < members.length; i++) {
    if (!ctx.rng.chance(RULE_CHANCE)) {
      continue;
    }
    const source = members[i];
    const target = members[ctx.rng.int(0, i - 1)];
    const type = ctx.rng.chance(0.5) ? "after" : "before";
    source.mod.rules ??= [];
    source.mod.rules.push({
      type,
      reference: { id: target.mod.id, idHint: target.mod.id, archiveId: target.mod.archiveId },
    });
    manifestRules.push({
      type,
      source: { tag: source.tag, logicalFileName: source.name },
      reference: { tag: target.tag, logicalFileName: target.name },
    });
  }
  return manifestRules;
}

function collectionManifest(ctx: IBuildContext, members: IModEntry[], modRules: unknown[]) {
  return {
    info: {
      author: "Fixture",
      authorUrl: "",
      name: ctx.spec.collectionName,
      description: `Generated collection of ${members.length} members for performance testing.`,
      installInstructions: "",
      domainName: ctx.game.domainName,
    },
    mods: members.map((entry) => ({
      name: entry.name,
      version: entry.version,
      optional: entry.optional,
      domainName: ctx.game.domainName,
      phase: entry.phase,
      author: entry.author,
      source: {
        type: "nexus",
        modId: entry.modId,
        fileId: entry.fileId,
        md5: entry.download.fileMD5,
        fileSize: entry.download.size,
        logicalFilename: entry.name,
        updatePolicy: "exact",
      },
    })),
    modRules,
  };
}

function gameFiles(ctx: IBuildContext): { directories: string[]; files: IFixtureFile[] } {
  const { game, paths } = ctx;
  const rel = (p: string) => path.join(path.relative(paths.outDir, paths.gameDir), p);
  const directories = game.directories.map(rel);
  const files: IFixtureFile[] = game.requiredFiles.map((file) => ({
    path: rel(file),
    content: file.endsWith(".exe") ? fakeExecutable() : "",
  }));
  for (const optional of game.optionalFiles) {
    files.push({ path: rel(optional.path), content: optional.content });
  }
  return { directories, files };
}

function shuffled<T>(rng: SeededRandom, items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The mods left disabled so that `enabled` mods stay enabled. Library mods go first, since a user
 * is likelier to switch off something they added than a collection member; then optional
 * members, then required ones. Within each group the choice is random, so disabled rows are
 * spread through the Mods page rather than bunched together.
 */
function pickDisabled(
  rng: SeededRandom,
  members: IModEntry[],
  library: IModEntry[],
  enabled: number,
): Set<string> {
  const total = members.length + library.length;
  const disabledCount = Math.min(total, Math.max(0, total - enabled));
  const order = [
    ...shuffled(rng, library),
    ...shuffled(
      rng,
      members.filter((entry) => entry.optional),
    ),
    ...shuffled(
      rng,
      members.filter((entry) => !entry.optional),
    ),
  ];
  return new Set(order.slice(0, disabledCount).map((entry) => entry.mod.id));
}

export function buildFixture(spec: IFixtureSpec): IFixture {
  if (spec.members < 1 || spec.phases < 1) {
    throw new Error("a fixture needs at least one member and one phase");
  }
  const game = GAMES[spec.game];
  const rng = new SeededRandom(spec.seed);
  const paths = fixturePaths(spec.outDir, game);
  const ctx: IBuildContext = {
    spec,
    game,
    rng,
    paths,
    instanceId: rng.uuid(),
    usedNames: new Set(),
  };
  const profileId = `fx${rng.token(7)}`;
  const collectionId = `collection-${slugify(spec.collectionName)}`;

  // members fill phases in contiguous blocks: phase 0 is the "framework" block, later phases
  // the content that depends on it
  const members: IModEntry[] = [];
  for (let i = 0; i < spec.members; i++) {
    const phase = Math.floor((i * spec.phases) / spec.members);
    members.push(makeModEntry(ctx, i, "member", phase, rng.chance(spec.optionalRatio)));
  }
  const library: IModEntry[] = [];
  for (let i = 0; i < spec.library; i++) {
    library.push(makeModEntry(ctx, spec.members + i, "library", 0, false));
  }
  const manifestRules = memberLoadOrderRules(ctx, members);

  const collection: IModRecord = {
    id: collectionId,
    state: "installed",
    type: COLLECTION_TYPE,
    installationPath: collectionId,
    attributes: {
      name: spec.collectionName,
      logicalFileName: spec.collectionName,
      author: "Fixture",
      uploader: "Fixture",
      version: "1",
      description: `Generated collection of ${members.length} members for performance testing.`,
      shortDescription: `${spec.collectionName} (fixture)`,
      downloadGame: game.id,
      installTime: new Date(BASE_TIME).toISOString(),
      modSize: 0,
    },
    rules: members.map((entry) => memberRule(ctx, entry)),
  };

  const disabledIds = pickDisabled(rng, members, library, spec.enabled);
  const modState: IProfileRecord["modState"] = {
    [collectionId]: { enabled: true, enabledTime: BASE_TIME },
  };
  for (const entry of [...members, ...library]) {
    modState[entry.mod.id] = { enabled: !disabledIds.has(entry.mod.id), enabledTime: BASE_TIME };
  }
  const profile: IProfileRecord = {
    id: profileId,
    gameId: game.id,
    name: "Collection fixture",
    modState,
    lastActivated: BASE_TIME,
  };

  const mods: Record<string, IModRecord> = { [collectionId]: collection };
  const downloads: Record<string, IDownloadRecord> = {};
  for (const entry of [...members, ...library]) {
    mods[entry.mod.id] = entry.mod;
    downloads[entry.download.id] = entry.download;
  }
  const categories: Record<string, { name: string; order: number }> = {};
  CATEGORIES.forEach((cat, order) => {
    categories[String(cat.id)] = { name: cat.name, order };
  });

  const state: IFixtureState = {
    app: { instanceId: ctx.instanceId },
    settings: {
      gameMode: {
        discovered: {
          [game.id]: { path: paths.gameDir, pathSetManually: true, timestamp: BASE_TIME },
        },
      },
      mods: {
        installPath: { [game.id]: paths.stagingDir },
        activator: { [game.id]: "hardlink_activator" },
      },
      downloads: { path: paths.downloadsRoot },
      profiles: {
        activeProfileId: profileId,
        nextProfileId: profileId,
        lastActiveProfile: { [game.id]: profileId },
      },
      automation: { deploy: spec.autoDeploy },
    },
    persistent: {
      profiles: { [profileId]: profile },
      mods: { [game.id]: mods },
      downloads: { files: downloads },
      categories: { [game.id]: categories },
    },
  };

  const { directories, files } = gameFiles(ctx);
  const stagingRel = path.relative(paths.outDir, paths.stagingDir);
  const downloadsRel = path.relative(paths.outDir, paths.downloadsDir);
  const downloadsRootRel = path.relative(paths.outDir, paths.downloadsRoot);
  files.push({
    path: path.join(stagingRel, STAGING_TAG),
    content: JSON.stringify({ instance: ctx.instanceId, game: game.id }),
  });
  const downloadsTag = JSON.stringify({ instance: ctx.instanceId });
  files.push({ path: path.join(downloadsRootRel, DOWNLOADS_TAG), content: downloadsTag });
  files.push({ path: path.join(downloadsRel, DOWNLOADS_TAG), content: downloadsTag });
  files.push({
    path: path.join(stagingRel, collectionId, "collection.json"),
    content: JSON.stringify(collectionManifest(ctx, members, manifestRules), null, 2),
  });
  for (const entry of [...members, ...library]) {
    for (const file of entry.files) {
      files.push({
        path: path.join(stagingRel, entry.mod.installationPath, ...file.name.split("/")),
        content: file.data,
      });
    }
    files.push({ path: path.join(downloadsRel, entry.archiveName), content: entry.zip });
  }

  const bytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0);
  return {
    spec,
    paths,
    state,
    directories,
    files,
    summary: {
      game: game.id,
      collectionId,
      profileId,
      instanceId: ctx.instanceId,
      members: members.length,
      optional: members.filter((entry) => entry.optional).length,
      phases: spec.phases,
      library: library.length,
      enabled: members.length + library.length - disabledIds.size,
      disabled: disabledIds.size,
      ...(spec.tier !== undefined ? { tier: spec.tier } : {}),
      overlapping: members.filter((entry) => entry.overlapping).length,
      memberRules: manifestRules.length,
      files: files.length,
      bytes,
    },
  };
}
