/**
 * A throwaway Skyrim SE setup for live-testing deployment: a fake game folder, a staging folder of
 * small mods built around deployment edge cases, and a dev Vortex with its own user data that
 * manages them. Nothing touches a real game install or the usual dev state.
 *
 * Usage:
 *   node tools/mod-pipeline/fake-skyrimse.mjs [setup] [--root dir] [--port 9222] [--files N] [--reset] [--no-launch]
 *   node tools/mod-pipeline/fake-skyrimse.mjs tamper [--root dir]
 *   node tools/mod-pipeline/fake-skyrimse.mjs rollback [--root dir] [--port 9222] [--profile id] [--fail-at path] [--call name]
 *
 * setup builds <root>/game, <root>/staging and <root>/userData, starts dev Vortex (build it first:
 * `pnpm run build`) and, over the Chrome debug port, registers the game, the mods and three
 * profiles, then activates the "Edge cases" profile. Auto-deploy is off; deploy from the UI.
 *   --root       where everything goes (default: <temp>/vortex-fake-skyrimse); game and staging
 *                share it, so hardlink deployment works
 *   --files N    also stage a "bulk" mod of N files, for timing
 *   --reset      delete <root> first; setup stops when <root> exists without it
 *   --no-launch  only build the folders
 *
 * tamper changes the deployed game folder behind Vortex's back, after a deploy: it replaces one
 * deployed file, deletes another and adds a file of its own under Data/tamper.
 *
 * rollback proves an Apply rollback on the real disk, on a Vortex that setup started and that still
 * has "Edge cases" deployed. It runs a profile's plan through Apply with one disk call made to
 * fail, then checks that the game and staging folders are as they were (content, file id and link
 * count of every file), that no journal or set-aside file is left, and that the next plan is the
 * same and made without reseeding. The run's journal and set-aside files go under <root>/work.
 *   --profile    the profile to plan (default: fake-other, which unlinks "Edge cases" and links one file)
 *   --fail-at    the path the failing call names, relative to <root>/game (default: Data/other/only.txt)
 *   --call       the disk call that fails: createLink, delete or move (default: createLink)
 *
 * Skyrim's ini files and plugin lists live outside <root>: the game is registered as an Epic
 * install, so Vortex uses "Skyrim Special Edition EPIC" under Documents/My Games (ini files) and
 * local app data (plugins.txt, loadorder.txt). setup makes both folders with a marker file,
 * refuses to run where one exists without it, and --reset deletes them. Expect "Some files could
 * not be deployed" on every deploy of the "Taken backup" profile: that is over-leftover, whose
 * backup name is taken.
 *
 * What the mods cover (each mod's id is its staging folder's name):
 *   conflict-loser, conflict-winner   one path, different bytes, ordered by a rule
 *   override-first, override-second   one path, the later mod carries a file override for it
 *   twin-a, twin-b                    one path, identical bytes
 *   over-vanilla                      a file the game ships, so deploying backs it up
 *   tamper-target                     the files `tamper` changes
 *   deep-folders                      a five-level folder that empties when the mod goes
 *   case-upper, case-lower            paths differing only by case
 *   unicode-names                     a non-ASCII file name
 *   read-only                         a read-only staged file
 *   engine-injector                   mod type "dinput", deployed to the game root
 *   plugins                           an .esm, an .esp and an .esl
 *   other-only                        the only mod of the second profile, "Other"
 *   over-leftover                     the only mod of the third profile, "Taken backup": a path
 *                                     holding a file and an older .vortex_backup, which fails to deploy
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const GAME_ID = "skyrimse";
const MARKER = ".vortex-fake-skyrimse";
const BACKUP_TAG = ".vortex_backup";
const STAGING_TAG = "__vortex_staging_folder";
const PROFILE_EDGE_CASES = "fake-edge-cases";
const PROFILE_OTHER = "fake-other";
const PROFILE_TAKEN_BACKUP = "fake-taken-backup";
const WRITES_AT_ONCE = 64;

const argv = process.argv.slice(2);
const command = argv[0] !== undefined && !argv[0].startsWith("--") ? argv[0] : "setup";
const flag = (name) => argv.includes(`--${name}`);
function option(name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

const root = path.resolve(option("root", path.join(os.tmpdir(), "vortex-fake-skyrimse")));
const port = Number(option("port", "9222"));
const bulkFiles = Number(option("files", "0"));
const gamePath = path.join(root, "game");
const dataPath = path.join(gamePath, "Data");
const stagingPath = path.join(root, "staging");
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mainPath = path.join(repoRoot, "src", "main");

async function write(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

/** A plugin file holding only its TES4 header record. */
function pluginHeader(flags) {
  const header = Buffer.alloc(24 + 18);
  header.write("TES4", 0, "latin1");
  header.writeUInt32LE(18, 4);
  header.writeUInt32LE(flags, 8);
  header.writeUInt16LE(44, 20);
  header.write("HEDR", 24, "latin1");
  header.writeUInt16LE(12, 28);
  header.writeFloatLE(1.71, 30);
  header.writeUInt32LE(0x800, 38);
  return header;
}
const MASTER = 0x1;
const LIGHT = 0x200;

/**
 * A Skyrim SE archive of one folder holding one file. Its name hashes are zero: Vortex reads the
 * names stored next to them.
 */
function archiveOf(folderName, fileName, content) {
  const HEADER_SIZE = 36;
  const FOLDER_RECORD_SIZE = 24;
  const FILE_RECORD_SIZE = 16;
  const folder = Buffer.from(`${folderName}\0`, "latin1");
  const file = Buffer.from(`${fileName}\0`, "latin1");
  const data = Buffer.from(content, "latin1");
  const folderBlockOffset = HEADER_SIZE + FOLDER_RECORD_SIZE;
  const fileRecordOffset = folderBlockOffset + 1 + folder.length;
  const fileNamesOffset = fileRecordOffset + FILE_RECORD_SIZE;
  const dataOffset = fileNamesOffset + file.length;

  const archive = Buffer.alloc(dataOffset + data.length);
  archive.write("BSA\0", 0, "latin1");
  archive.writeUInt32LE(0x69, 4);
  archive.writeUInt32LE(HEADER_SIZE, 8);
  // the archive stores folder and file names
  archive.writeUInt32LE(0x1 | 0x2, 12);
  archive.writeUInt32LE(1, 16);
  archive.writeUInt32LE(1, 20);
  archive.writeUInt32LE(folder.length, 24);
  archive.writeUInt32LE(file.length, 28);

  archive.writeUInt32LE(1, HEADER_SIZE + 8);
  // a folder's offset counts the file names block as if it came first
  archive.writeBigUInt64LE(BigInt(folderBlockOffset + file.length), HEADER_SIZE + 16);

  archive.writeUInt8(folder.length, folderBlockOffset);
  folder.copy(archive, folderBlockOffset + 1);
  archive.writeUInt32LE(data.length, fileRecordOffset + 8);
  archive.writeUInt32LE(dataOffset, fileRecordOffset + 12);

  file.copy(archive, fileNamesOffset);
  data.copy(archive, dataOffset);
  return archive;
}

/** The staged mods: files are relative to the mod's folder, content defaults to the file's own path. */
function stagedMods() {
  const mods = [
    { id: "conflict-loser", files: { "textures/shared.dds": null } },
    { id: "conflict-winner", after: "conflict-loser", files: { "textures/shared.dds": null } },
    { id: "override-first", files: { "meshes/rock.nif": null } },
    {
      id: "override-second",
      after: "override-first",
      fileOverrides: [path.join(dataPath, "meshes", "rock.nif")],
      files: { "meshes/rock.nif": null },
    },
    { id: "twin-a", files: { "scripts/twin.pex": "the same bytes" } },
    { id: "twin-b", after: "twin-a", files: { "scripts/twin.pex": "the same bytes" } },
    { id: "over-vanilla", files: { "interface/vanilla.txt": null } },
    { id: "over-leftover", profile: PROFILE_TAKEN_BACKUP, files: { "leftover.txt": null } },
    { id: "tamper-target", files: { "tamper/edited.txt": null, "tamper/deleted.txt": null } },
    { id: "deep-folders", files: { "deep/a/b/c/d/deep.txt": null } },
    { id: "case-upper", files: { "textures/CASE.DDS": null } },
    { id: "case-lower", after: "case-upper", files: { "textures/case.dds": null } },
    { id: "unicode-names", files: { "interface/Café – 日本語.txt": null } },
    { id: "read-only", readOnly: true, files: { "readonly/locked.txt": null } },
    { id: "engine-injector", type: "dinput", files: { "d3d11.dll": null } },
    {
      id: "plugins",
      files: {
        "FakeMaster.esm": pluginHeader(MASTER),
        "FakePlugin.esp": pluginHeader(0),
        "FakeLight.esl": pluginHeader(LIGHT),
      },
    },
    { id: "other-only", profile: PROFILE_OTHER, files: { "other/only.txt": null } },
  ];
  if (bulkFiles > 0) {
    const files = {};
    for (let index = 0; index < bulkFiles; index++) {
      files[`bulk/${String(index % 100).padStart(2, "0")}/file-${index}.txt`] = null;
    }
    mods.push({ id: "bulk", files });
  }
  return mods;
}

async function buildFolders(mods) {
  if (existsSync(root)) {
    // a deployed file is its staged file, so writing the game folder again would change staging
    if (!flag("reset")) {
      throw new Error(`${root} already exists; pass --reset to delete it and build it again`);
    }
    if (!existsSync(path.join(root, MARKER))) {
      throw new Error(`${root} was not made by this script; delete it yourself`);
    }
    await rm(root, { recursive: true, force: true });
    // checkSettingsFolders has passed, so any that exist are this script's
    for (const folder of settingsFolders) {
      await rm(folder, { recursive: true, force: true });
    }
  }
  await write(path.join(root, MARKER), "");

  await write(path.join(gamePath, "SkyrimSE.exe"), "MZ");
  await write(path.join(dataPath, "Skyrim.esm"), pluginHeader(MASTER));
  await write(path.join(dataPath, "Update.esm"), pluginHeader(MASTER));
  // Vortex reads the game's fonts from this archive on every start
  await write(
    path.join(dataPath, "Skyrim - Interface.bsa"),
    archiveOf("interface", "placeholder.txt", "not a font"),
  );
  await write(path.join(dataPath, "interface", "vanilla.txt"), "the game's own file");
  await write(path.join(dataPath, "leftover.txt"), "a file nobody deployed");
  await write(path.join(dataPath, `leftover.txt${BACKUP_TAG}`), "an original backed up earlier");

  for (const mod of mods) {
    const files = Object.entries(mod.files).map(([relPath, content]) => ({
      filePath: path.join(stagingPath, mod.id, relPath),
      content: content ?? `${mod.id}/${relPath}`,
    }));
    for (const folder of new Set(files.map(({ filePath }) => path.dirname(filePath)))) {
      await mkdir(folder, { recursive: true });
    }
    for (let start = 0; start < files.length; start += WRITES_AT_ONCE) {
      await Promise.all(
        files.slice(start, start + WRITES_AT_ONCE).map(async ({ filePath, content }) => {
          await writeFile(filePath, content);
          if (mod.readOnly) {
            await chmod(filePath, 0o444);
          }
        }),
      );
    }
  }
  // the layout packages/e2e's prepareVortexInstance gives a Vortex with its own user data
  await mkdir(path.join(root, "userData"), { recursive: true });
  await mkdir(path.join(root, "appData", "@vortex", "main"), { recursive: true });
}

function launchVortex() {
  if (!existsSync(path.join(mainPath, "build", "index.html"))) {
    throw new Error("src/main/build is missing; run `pnpm run build` first");
  }
  const env = {
    ...process.env,
    NODE_ENV: "development",
    // no game discovery, and its own user data
    VORTEX_E2E: "1",
    ELECTRON_USERDATA: path.join(root, "userData"),
    ELECTRON_APPDATA: path.join(root, "appData"),
  };
  // set by editor-hosted shells
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn("pnpm", ["electron", ".", `--remote-debugging-port=${port}`], {
    cwd: mainPath,
    env,
    shell: true,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `attempt` until it returns something other than undefined. */
async function waitFor(what, attempt, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await attempt().catch(() => undefined);
    if (result !== undefined) {
      return result;
    }
    await sleep(1000);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** A session on Vortex's main window that evaluates functions in the renderer. */
async function connect(timeoutMs) {
  const page = await waitFor(
    "Vortex's debug port",
    async () => {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      return pages.find(({ type, url }) => type === "page" && url.endsWith("index.html"));
    },
    timeoutMs,
  );
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let lastId = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    pending.get(message.id)?.resolve(message);
    pending.delete(message.id);
  });
  // Vortex closing fails every evaluation still waiting, and every later one
  let closed = false;
  socket.addEventListener("close", () => {
    closed = true;
    for (const { reject } of pending.values()) {
      reject(new Error("Vortex closed"));
    }
    pending.clear();
  });
  const evaluate = async (func, arg) => {
    if (closed) {
      throw new Error("Vortex closed");
    }
    const id = ++lastId;
    const reply = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    socket.send(
      JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: {
          expression: `(${func.toString()})(${JSON.stringify(arg ?? null)})`,
          awaitPromise: true,
          returnByValue: true,
        },
      }),
    );
    const { result, error } = await reply;
    if (error !== undefined || result.exceptionDetails !== undefined) {
      throw new Error(JSON.stringify(error ?? result.exceptionDetails.exception?.description));
    }
    return result.result.value;
  };
  return { evaluate, close: () => socket.close() };
}

// The functions below run in Vortex's renderer.

/** Finds the redux store through React's tree, keeps it on window and returns the instance id. */
function findStore() {
  if (window.__fakeStore === undefined) {
    const pendingFibers = [...document.querySelectorAll("body *")].flatMap((element) => {
      const key = Object.keys(element).find((name) => name.startsWith("__reactContainer"));
      return key === undefined ? [] : [element[key]];
    });
    const seen = new Set();
    while (pendingFibers.length > 0 && window.__fakeStore === undefined) {
      const fiber = pendingFibers.pop();
      if (fiber === null || fiber === undefined || seen.has(fiber)) {
        continue;
      }
      seen.add(fiber);
      const store = fiber.memoizedProps?.store;
      if (typeof store?.getState === "function" && typeof store?.dispatch === "function") {
        window.__fakeStore = store;
      }
      pendingFibers.push(fiber.child, fiber.sibling);
    }
  }
  return window.__fakeStore?.getState().app?.instanceId;
}

function registerSetup({ gameId, gamePath, stagingPath, mods, profiles }) {
  const store = window.__fakeStore;
  const dispatch = (type, payload) => store.dispatch({ type, payload });
  dispatch("ADD_DISCOVERED_GAME", {
    id: gameId,
    result: {
      path: gamePath,
      tools: {},
      hidden: false,
      environment: {},
      pathSetManually: true,
      // an Epic install records no ids, so no store library is looked up
      store: "epic",
    },
  });
  const discoveredPath = store.getState().settings.gameMode.discovered[gameId]?.path;
  if (discoveredPath !== gamePath) {
    throw new Error(`${gameId} is discovered at ${discoveredPath}, not the fake game`);
  }
  dispatch("SET_MOD_INSTALL_PATH", { gameId, path: stagingPath });
  dispatch("SET_ACTIVATOR", { gameId, activatorId: "hardlink_activator" });
  dispatch("SET_AUTO_DEPLOYMENT", false);
  for (const mod of mods) {
    dispatch("ADD_MOD", { gameId, mod });
  }
  for (const profile of profiles) {
    dispatch("SET_PROFILE", profile);
  }
  // an action type Vortex no longer has is ignored, so check what landed
  const state = store.getState();
  const registered = {
    stagingPath: state.settings.mods.installPath?.[gameId],
    activator: state.settings.mods.activator?.[gameId],
    autoDeploy: state.settings.automation.deploy,
    mods: Object.keys(state.persistent.mods[gameId] ?? {}).length,
    profiles: profiles.filter(({ id }) => state.persistent.profiles[id] !== undefined).length,
  };
  const expected = {
    stagingPath,
    activator: "hardlink_activator",
    autoDeploy: false,
    mods: mods.length,
    profiles: profiles.length,
  };
  if (JSON.stringify(registered) !== JSON.stringify(expected)) {
    throw new Error(`Vortex has ${JSON.stringify(registered)}, not ${JSON.stringify(expected)}`);
  }
  dispatch("SET_NEXT_PROFILE", { profileId: profiles[0].id });
}

function hasApplyDevHandle() {
  return window.__vortexApplyDevHandle !== undefined;
}

function applyThroughDevHandle(request) {
  return window.__vortexApplyDevHandle.apply(request);
}

function planThroughDevHandle(profileId) {
  return window.__vortexApplyDevHandle.plan(profileId);
}

function activeProfile(profileId) {
  const state = window.__fakeStore.getState();
  if (state.settings.profiles.activeProfileId === profileId) {
    return { active: true };
  }
  const dialogs = state.session.notifications?.dialogs ?? [];
  return dialogs.length > 0 ? { dialog: dialogs[0].title } : undefined;
}

const EPIC_FOLDER_NAME = "Skyrim Special Edition EPIC";
/** Where Vortex keeps an Epic Skyrim SE's ini files. */
const iniFolder = path.join(os.homedir(), "Documents", "My Games", EPIC_FOLDER_NAME);
/** Where Vortex keeps an Epic Skyrim SE's plugin lists. */
const pluginListFolder = path.join(
  process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
  EPIC_FOLDER_NAME,
);
const settingsFolders = [iniFolder, pluginListFolder];

/** Throws when a settings folder exists that this script did not make. */
function checkSettingsFolders() {
  const realFolder = settingsFolders.find(
    (folder) => existsSync(folder) && !existsSync(path.join(folder, MARKER)),
  );
  if (realFolder !== undefined) {
    throw new Error(`${realFolder} exists; Vortex would write a real Epic Skyrim SE's settings`);
  }
}

/** Makes the settings folders, marked as this script's, with the ini files Vortex expects. */
async function buildSettingsFolders() {
  for (const folder of settingsFolders) {
    await write(path.join(folder, MARKER), "");
  }
  for (const iniName of ["Skyrim.ini", "SkyrimPrefs.ini"]) {
    if (!existsSync(path.join(iniFolder, iniName))) {
      await write(path.join(iniFolder, iniName), "");
    }
  }
}

async function setup() {
  checkSettingsFolders();
  const mods = stagedMods();
  await buildFolders(mods);
  console.log(`fake Skyrim SE in ${root}`);
  if (flag("no-launch")) {
    return;
  }

  await buildSettingsFolders();
  launchVortex();
  const session = await connect();
  try {
    await registerWith(session, mods);
  } catch (err) {
    console.error(`setup failed; Vortex may still be running on debug port ${port}`);
    throw err;
  } finally {
    session.close();
  }
  console.log(
    `Vortex manages it with ${mods.length} mods; debug port ${port}. Deploy from the UI.`,
  );
}

/** Registers the game, mods and profiles with the Vortex behind `session` and activates the first. */
async function registerWith(session, mods) {
  const instanceId = await waitFor("Vortex to finish starting", () => session.evaluate(findStore));
  await write(
    path.join(stagingPath, STAGING_TAG),
    JSON.stringify({ instance: instanceId, game: GAME_ID }),
  );

  const installTime = new Date().toISOString();
  const profileOf = (id, name) => ({
    id,
    gameId: GAME_ID,
    name,
    lastActivated: undefined,
    modState: Object.fromEntries(
      mods.map((mod) => [
        mod.id,
        { enabled: (mod.profile ?? PROFILE_EDGE_CASES) === id, enabledTime: 0 },
      ]),
    ),
  });
  await session.evaluate(registerSetup, {
    gameId: GAME_ID,
    gamePath,
    stagingPath,
    mods: mods.map((mod) => ({
      id: mod.id,
      state: "installed",
      type: mod.type ?? "",
      installationPath: mod.id,
      attributes: { name: mod.id, installTime },
      rules: mod.after === undefined ? [] : [{ type: "after", reference: { id: mod.after } }],
      fileOverrides: mod.fileOverrides ?? [],
    })),
    profiles: [
      profileOf(PROFILE_EDGE_CASES, "Edge cases"),
      profileOf(PROFILE_OTHER, "Other"),
      profileOf(PROFILE_TAKEN_BACKUP, "Taken backup"),
    ],
  });

  const result = await waitFor("the Edge cases profile to activate", () =>
    session.evaluate(activeProfile, PROFILE_EDGE_CASES),
  );
  if (result.dialog !== undefined) {
    throw new Error(`Vortex is showing a dialog: "${result.dialog}"; answer it in the window`);
  }
}

async function tamper() {
  const edited = path.join(dataPath, "tamper", "edited.txt");
  if (!existsSync(edited)) {
    throw new Error(`${edited} is not deployed; run setup and deploy first`);
  }
  // removed first: writing through the hardlink would change the staged file too
  await rm(edited);
  await writeFile(edited, "edited outside Vortex");
  await rm(path.join(dataPath, "tamper", "deleted.txt"), { force: true });
  await writeFile(path.join(dataPath, "tamper", "added-by-hand.txt"), "added outside Vortex");
  console.log(
    "replaced tamper/edited.txt, deleted tamper/deleted.txt, added tamper/added-by-hand.txt",
  );
}

/** Every file under `folder` as its content hash, file id and link count; every folder as "folder". */
async function snapshotOf(folder) {
  const entries = new Map();
  for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
    const entryPath = path.join(entry.parentPath, entry.name);
    const relPath = path.relative(folder, entryPath);
    if (entry.isDirectory()) {
      entries.set(relPath, "folder");
    } else {
      const status = await stat(entryPath, { bigint: true });
      const hash = createHash("sha1")
        .update(await readFile(entryPath))
        .digest("hex");
      entries.set(relPath, `${hash}, file id ${status.ino}, ${status.nlink} links`);
    }
  }
  return entries;
}

/** The folders a rollback leaves as they were, each with the name a report gives it. */
const snapshotFolders = [
  ["game folder", gamePath],
  ["staging", stagingPath],
];
const snapshotAll = () => Promise.all(snapshotFolders.map(([, folder]) => snapshotOf(folder)));

/** How `after` differs from `before`, one line per difference; a path is matched whatever its case. */
function differencesBetween(before, after) {
  const differences = [];
  const afterByKey = new Map([...after.keys()].map((relPath) => [relPath.toLowerCase(), relPath]));
  for (const [relPath, entry] of before) {
    const nowAt = afterByKey.get(relPath.toLowerCase());
    if (nowAt === undefined) {
      differences.push(`gone: ${relPath}`);
      continue;
    }
    if (nowAt !== relPath) {
      differences.push(`renamed by letter case: ${relPath} is now ${nowAt}`);
    }
    if (after.get(nowAt) !== entry) {
      differences.push(`changed: ${relPath} (was ${entry}, is ${after.get(nowAt)})`);
    }
  }
  const beforeKeys = new Set([...before.keys()].map((relPath) => relPath.toLowerCase()));
  for (const relPath of after.keys()) {
    if (!beforeKeys.has(relPath.toLowerCase())) {
      differences.push(`new: ${relPath}`);
    }
  }
  return differences;
}

const SEEDED_MESSAGE = "seeded previous lockfile from manifest";

/** How many times this Vortex's log says a plan seeded its previous lockfile. */
async function seedCount() {
  // the renderer's log lines reach the file through the main process
  await sleep(2000);
  const userData = path.join(root, "userData");
  const logNames = (await readdir(userData)).filter((name) => /^vortex.*\.log$/.test(name));
  const logs = await Promise.all(
    logNames.map((name) => readFile(path.join(userData, name), "utf8")),
  );
  return logs.reduce((count, log) => count + log.split(SEEDED_MESSAGE).length - 1, 0);
}

const FAULT_CALLS = ["createLink", "delete", "move"];

/**
 * Proves a rollback on the real disk: runs a profile's plan through Apply with one disk call made
 * to fail, then checks the game and staging folders are as they were, nothing is left behind and
 * the next plan is the same plan, made without reseeding.
 */
async function rollback() {
  const profileId = option("profile", PROFILE_OTHER);
  const fault = {
    call: option("call", "createLink"),
    path: path.join(gamePath, option("fail-at", path.join("Data", "other", "only.txt"))),
  };
  // a fault that matches no call lets the plan apply for real
  if (!FAULT_CALLS.includes(fault.call)) {
    throw new Error(`--call is one of ${FAULT_CALLS.join(", ")}`);
  }
  const workPath = path.join(root, "work");
  const journalFile = path.join(workPath, "apply-journal.ndjson");
  const keptFolder = path.join(workPath, "kept");

  const session = await connect(5000);
  const failures = [];
  try {
    if (!(await session.evaluate(hasApplyDevHandle))) {
      throw new Error("this Vortex has no Apply dev handle; build the renderer and run setup");
    }
    const before = await snapshotAll();
    const outcome = await session.evaluate(applyThroughDevHandle, {
      profileId,
      journalFile,
      keptFolder,
      fault,
    });
    if (outcome === undefined) {
      throw new Error(`Vortex couldn't plan profile "${profileId}"; see its log`);
    }
    const { operations, status, failedAt } = outcome;
    if (status !== "rolled-back") {
      throw new Error(
        `planned ${operations.length} operations for "${profileId}" and expected a rollback, ` +
          `but Apply ended ${status}; the fault (${fault.call} on ${fault.path}) may match no ` +
          `step: ${JSON.stringify({ ...outcome, operations: undefined })}`,
      );
    }
    console.log(
      `planned ${operations.length} operations for "${profileId}"; Apply rolled back at step ` +
        `${failedAt?.index} (${failedAt?.operation?.kind} ` +
        `${failedAt?.operation?.destinationPath}): ${failedAt?.error}`,
    );
    if ((failedAt?.index ?? 0) === 0) {
      failures.push("the run failed at its first step, so the rollback had nothing to undo");
    }

    const after = await snapshotAll();
    snapshotFolders.forEach(([name], index) =>
      failures.push(
        ...differencesBetween(before[index], after[index]).map((line) => `${name} ${line}`),
      ),
    );
    if (existsSync(journalFile)) {
      failures.push(`the journal is still there: ${journalFile}`);
    }
    if (existsSync(keptFolder) && (await readdir(keptFolder)).length > 0) {
      failures.push(`files were set aside in ${keptFolder}`);
    }

    const seedsBeforeReplan = await seedCount();
    if (seedsBeforeReplan === 0) {
      failures.push("Vortex's log has no seed line, so a reseed couldn't be told from none");
    }
    const replanned = await session.evaluate(planThroughDevHandle, profileId);
    if (JSON.stringify(replanned) !== JSON.stringify(operations)) {
      failures.push("the plan made after the rollback differs from the one rolled back");
    }
    if ((await seedCount()) !== seedsBeforeReplan) {
      failures.push("the plan made after the rollback seeded its previous lockfile again");
    }
    console.log(
      `checked ${snapshotFolders.map(([name], index) => `${after[index].size} ${name} entries`).join(" and ")}`,
    );
  } finally {
    session.close();
  }

  if (failures.length > 0) {
    throw new Error(`the rollback left differences:\n  ${failures.join("\n  ")}`);
  }
  console.log(
    "rollback proven: the disk is as it was, nothing is left behind, the plan is the same",
  );
}

const commands = { setup, tamper, rollback };
if (commands[command] === undefined) {
  console.error(`unknown command "${command}"; use setup, tamper or rollback`);
  process.exit(1);
}
commands[command]().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
