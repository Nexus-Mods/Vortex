/**
 * A throwaway Skyrim SE setup for live-testing deployment: a fake game folder, a staging folder of
 * small mods built around deployment edge cases, and a dev Vortex with its own user data that
 * manages them. Nothing touches a real game install or the usual dev state.
 *
 * Usage:
 *   node tools/mod-pipeline/fake-skyrimse.mjs [setup] [--root dir] [--port 9222] [--files N] [--mod id] [--reset] [--no-launch]
 *   node tools/mod-pipeline/fake-skyrimse.mjs tamper [--root dir]
 *   node tools/mod-pipeline/fake-skyrimse.mjs rollback [--root dir] [--port 9222] [--profile id] [--fail-at path] [--call name]
 *   node tools/mod-pipeline/fake-skyrimse.mjs manifests [--root dir] [--port 9222]
 *   node tools/mod-pipeline/fake-skyrimse.mjs journal [--root dir]
 *
 * setup deletes what an earlier run made, so every run starts fresh. It then builds <root>/game,
 * <root>/staging and <root>/userData, starts dev Vortex (build it first:
 * `pnpm run build`) and, over the Chrome debug port, registers the game, the mods and four
 * profiles, then activates the "Edge cases" profile. Auto-deploy is off; deploy from the UI.
 *   --root       where everything goes (default: <temp>/vortex-fake-skyrimse); game and staging
 *                share it, so hardlink deployment works
 *   --files N    also stage a "bulk" mod of N files, for timing
 *   --mod id     stage only this mod, by the id listed below
 *   --reset      only delete what an earlier run made; nothing is built or started
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
 * manifests proves an Apply deployment leaves the files and saves the manifests today's deployment
 * does, on a Vortex that setup started and whose "Edge cases" profile today's deployment deployed
 * last. It keeps both, runs Apply to "Other" and back, and compares every file in the game and
 * staging folders (content, file id, link count) and every manifest entry.
 *
 * journal prints the latest Apply run's journal: how the run ended and how far each operation got.
 * Finished runs' journals are kept under <root>/work/journals; a run that didn't end leaves its
 * journal at <root>/work/apply-journal.ndjson, listed last.
 *
 * Skyrim's ini files and plugin lists live outside <root>: the game is registered as an Epic
 * install, so Vortex uses "Skyrim Special Edition EPIC" under Documents/My Games (ini files) and
 * local app data (plugins.txt, loadorder.txt). setup makes both folders with a marker file,
 * refuses to run where one exists without it, and deletes them with <root>. Expect "Some files could
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
 *   shared-from-root, shared-from-data  the mods of the fourth profile, "Shared by types": a
 *                                     "dinput" mod and a default-type mod deploying one path, the
 *                                     default-type mod sorted last
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { chmod, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
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
const PROFILE_SHARED_BY_TYPES = "fake-shared-by-types";
const WRITES_AT_ONCE = 64;
const VORTEX_WINDOW_TITLE = "Vortex (fake Skyrim SE)";

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
const userDataPath = path.join(root, "userData");
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
    {
      id: "shared-from-root",
      profile: PROFILE_SHARED_BY_TYPES,
      type: "dinput",
      files: { "Data/shared-by-types.txt": null },
    },
    {
      id: "shared-from-data",
      profile: PROFILE_SHARED_BY_TYPES,
      after: "shared-from-root",
      files: { "shared-by-types.txt": null },
    },
  ];
  if (bulkFiles > 0) {
    const files = {};
    for (let index = 0; index < bulkFiles; index++) {
      files[`bulk/${String(index % 100).padStart(2, "0")}/file-${index}.txt`] = null;
    }
    mods.push({ id: "bulk", files });
  }
  const onlyId = option("mod");
  if (onlyId === undefined) {
    return mods;
  }
  const only = mods.find(({ id }) => id === onlyId);
  if (only === undefined) {
    throw new Error(`--mod is one of ${mods.map(({ id }) => id).join(", ")}`);
  }
  // the mod its rule names is not staged
  return [{ ...only, after: undefined }];
}

/** Whether a Vortex answers on the debug port. */
const vortexAnswers = () =>
  fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) }).then(
    () => true,
    () => false,
  );

/** Deletes what an earlier run made: <root> and the settings folders. */
async function deleteLastSetup() {
  if (existsSync(root) && !existsSync(path.join(root, MARKER))) {
    throw new Error(`${root} was not made by this script; delete it yourself`);
  }
  if (await vortexAnswers()) {
    throw new Error(`a Vortex is running on debug port ${port}; close it first`);
  }
  try {
    // on Windows a running Vortex holds its user data open, so this fails with the setup whole
    if (existsSync(userDataPath)) {
      const doomed = `${userDataPath}.deleting`;
      await rm(doomed, { recursive: true, force: true });
      await rename(userDataPath, doomed);
    }
    // checkSettingsFolders has passed, so any settings folder that exists is this script's
    for (const folder of [root, ...settingsFolders].filter((owned) => existsSync(owned))) {
      // the marker goes last, so a folder that couldn't be deleted whole is still this script's
      for (const name of (await readdir(folder)).filter((child) => child !== MARKER)) {
        await rm(path.join(folder, name), { recursive: true, force: true });
      }
      await rm(folder, { recursive: true, force: true });
    }
  } catch (cause) {
    throw new Error(`couldn't delete the last setup; close its Vortex first (${cause.message})`, {
      cause,
    });
  }
}

async function buildFolders(mods) {
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
  await mkdir(userDataPath, { recursive: true });
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
    ELECTRON_USERDATA: userDataPath,
    ELECTRON_APPDATA: path.join(root, "appData"),
  };
  // set by editor-hosted shells
  delete env.ELECTRON_RUN_AS_NODE;
  const electron = `pnpm electron . --remote-debugging-port=${port}`;
  // on Windows Vortex gets a console window of its own, which shows its output; cmd /k keeps
  // that window open once Vortex ends, so what it printed last can still be read
  const child = spawn(
    process.platform === "win32" ? `start "${VORTEX_WINDOW_TITLE}" cmd /k ${electron}` : electron,
    { cwd: mainPath, env, shell: true, detached: process.platform !== "win32", stdio: "ignore" },
  );
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
  if (flag("reset")) {
    await deleteLastSetup();
    console.log(`deleted ${root} and the fake Skyrim SE's settings folders`);
    return;
  }
  const mods = stagedMods();
  // a deployed file is its staged file, so every setup starts from nothing
  await deleteLastSetup();
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
      profileOf(PROFILE_SHARED_BY_TYPES, "Shared by types"),
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
      try {
        const status = await stat(entryPath, { bigint: true });
        const hash = createHash("sha1")
          .update(await readFile(entryPath))
          .digest("hex");
        entries.set(relPath, `${hash}, file id ${status.ino}, ${status.nlink} links`);
      } catch (err) {
        // a file Vortex made and removed while the folder was listed, such as its write probe
        if (err?.code !== "ENOENT") {
          throw err;
        }
      }
    }
  }
  return entries;
}

/** The folders a proof compares, each with the name a report gives it. */
const snapshotFolders = [
  ["game folder", gamePath],
  ["staging", stagingPath],
];
const snapshotAll = () => Promise.all(snapshotFolders.map(([, folder]) => snapshotOf(folder)));

/** How each folder of `after` differs from `before`, both from snapshotAll; a line per difference. */
const folderDifferences = (before, after) =>
  snapshotFolders.flatMap(([name], index) =>
    differencesBetween(before[index], after[index]).map((line) => `${name} ${line}`),
  );

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
  const logNames = (await readdir(userDataPath)).filter((name) => /^vortex.*\.log$/.test(name));
  const logs = await Promise.all(
    logNames.map((name) => readFile(path.join(userDataPath, name), "utf8")),
  );
  return logs.reduce((count, log) => count + log.split(SEEDED_MESSAGE).length - 1, 0);
}

const journalFile = path.join(root, "work", "apply-journal.ndjson");
const keptFolder = path.join(root, "work", "kept");
const journalsFolder = path.join(root, "work", "journals");

/** This tool's Apply runs' journals, oldest first, then any a run left in place. */
export async function keptJournals() {
  const names = await readdir(journalsFolder).catch(() => []);
  return [
    ...names.toSorted().map((name) => path.join(journalsFolder, name)),
    ...(existsSync(journalFile) ? [journalFile] : []),
  ];
}

/** A step's state from its journal lines, the last of which counts. */
const STEP_STATES = { changing: "started", done: "done", undone: "undone" };

/** A path below the game folder, or as it is when it is outside it. */
const belowGame = (filePath) => {
  const relative = path.relative(gamePath, filePath);
  return relative.startsWith("..") ? filePath : relative;
};

/** A journal as a tool shows it: how its run ended, and each operation's progress and notes. */
export async function describeJournal(file) {
  const parse = (line) => {
    try {
      return JSON.parse(line);
    } catch {
      return undefined;
    }
  };
  // as Apply reads it: a header, its count of entries, then progress, whose last line may be torn
  const lines = (await readFile(file, "utf8")).split("\n").slice(0, -1);
  const header = parse(lines[0] ?? "");
  const entries = header?.type === "header" ? lines.slice(1, 1 + header.count).map(parse) : [];
  if (entries.length !== header?.count || entries.some((entry) => entry?.operation === undefined)) {
    throw new Error(`${file} is not a readable Apply journal`);
  }
  const operations = entries.map(({ operation }, index) => ({
    index,
    kind: operation.kind,
    destination: belowGame(operation.file?.destinationPath ?? operation.destinationPath),
    state: "not run",
    notes: [],
  }));
  let rolledBack = false;
  for (const line of lines
    .slice(1 + operations.length)
    .map(parse)
    .filter(Boolean)) {
    const step = operations[line.index];
    if (line.type === "phase") {
      rolledBack = line.phase === "rolling-back";
    } else if (step === undefined) {
      continue;
    } else if (line.type === "folder") {
      step.notes.push(`made ${belowGame(line.path)}`);
    } else if (line.type === "removed-folder") {
      step.notes.push("removed an empty folder there");
    } else {
      step.state = STEP_STATES[line.type] ?? step.state;
      if (line.kept === true) {
        step.notes.push("set its file aside");
      }
    }
  }
  // a kept copy is of a run that ended; the journal left in place is of one that didn't
  const ended = file !== journalFile;
  return {
    file,
    runId: header.runId,
    outcome: ended
      ? rolledBack
        ? "rolled back"
        : "applied"
      : rolledBack
        ? "rollback stopped"
        : "unfinished",
    operations,
  };
}

/** Prints the latest journal, one line per operation. */
async function journal() {
  const journalFiles = await keptJournals();
  const latest = journalFiles.at(-1);
  if (latest === undefined) {
    throw new Error("no Apply run of this setup has a journal yet; run rollback or manifests");
  }
  const { runId, outcome, operations } = await describeJournal(latest);
  console.log(`journal ${journalFiles.length} of ${journalFiles.length}: ${latest}`);
  console.log(`run ${runId}, ${operations.length} operations, ${outcome}`);
  for (const { index, kind, destination, state, notes } of operations) {
    console.log(
      `${String(index).padStart(3)}  ${kind.padEnd(7)} ${state.padEnd(8)} ${destination}` +
        (notes.length > 0 ? `  (${notes.join("; ")})` : ""),
    );
  }
}

/** A session on a running Vortex that has the Apply dev handle. */
async function connectToApplyHandle() {
  const session = await connect(5000);
  if (!(await session.evaluate(hasApplyDevHandle))) {
    session.close();
    throw new Error("this Vortex has no Apply dev handle; build the renderer and run setup");
  }
  return session;
}

/** Runs a profile's plan through Apply on the Vortex behind `session`, and gives the outcome. */
async function applyProfile(session, { profileId, fault }) {
  const outcome = await session.evaluate(applyThroughDevHandle, {
    profileId,
    journalFile,
    keptFolder,
    // named so the copies sort by when their run started
    journalCopyFile: path.join(
      journalsFolder,
      `${new Date().toISOString().replaceAll(":", "-")}_${profileId}.ndjson`,
    ),
    fault,
  });
  if (outcome === undefined) {
    throw new Error(`Vortex couldn't plan profile "${profileId}"; see its log`);
  }
  return outcome;
}

/** An Apply outcome for an error message, without its operations. */
const reportOf = (outcome) => JSON.stringify({ ...outcome, operations: undefined });

/** The game's manifests as one entry per manifest and per file it lists, without their save time. */
async function manifestSnapshot() {
  const entries = new Map();
  for (const folder of [gamePath, dataPath]) {
    const names = (await readdir(folder)).filter((name) =>
      /^vortex\.deployment.*\.json$/.test(name),
    );
    for (const name of names) {
      const { files, ...header } = JSON.parse(await readFile(path.join(folder, name), "utf8"));
      delete header.deploymentTime;
      entries.set(name, JSON.stringify(header));
      for (const file of files) {
        entries.set(path.join(name, file.relPath), JSON.stringify(file, Object.keys(file).sort()));
      }
    }
  }
  return entries;
}

const CheckState = { Running: "running", Passed: "passed", Failed: "failed" };

/** Sends a check's state to a front end that started this script with a process channel. */
const tellFrontEnd = (name, state, problems = []) =>
  new Promise((resolve) => {
    if (process.send === undefined) {
      resolve();
    } else {
      process.send({ type: "check", name, state, problems }, () => resolve());
    }
  });

let failedChecks = 0;

/** Runs one check of a proof; problems `run` returns fail it, an error it throws ends the proof. */
async function check(name, run) {
  await tellFrontEnd(name, CheckState.Running);
  let problems;
  try {
    problems = (await run()) ?? [];
  } catch (err) {
    console.log(`✗ ${name}`);
    await tellFrontEnd(name, CheckState.Failed, [err instanceof Error ? err.message : String(err)]);
    throw err;
  }
  if (problems.length > 0) {
    failedChecks += 1;
  }
  console.log(`${problems.length === 0 ? "✓" : "✗"} ${name}`);
  for (const problem of problems) {
    console.log(`    ${problem}`);
  }
  await tellFrontEnd(name, problems.length === 0 ? CheckState.Passed : CheckState.Failed, problems);
}

/** Ends a proof: prints what it proved, or fails when a check did. */
function endProof(proven) {
  if (failedChecks > 0) {
    throw new Error(`${failedChecks} ${failedChecks === 1 ? "check" : "checks"} failed`);
  }
  console.log(proven);
}

/** A disk snapshot's files without the manifests and their staging copies, which carry a save time. */
// TODO(MOD-147): compare folders too once Apply removes the ones it empties
const deployedFilesIn = (snapshot) =>
  new Map(
    [...snapshot].filter(
      ([relPath, entry]) =>
        entry !== "folder" && !path.basename(relPath).startsWith("vortex.deployment."),
    ),
  );

/**
 * Proves an Apply deployment leaves the files and saves the manifests today's deployment does:
 * keeps both from the deployed "Edge cases" profile, runs Apply to "Other" and back, and compares.
 */
async function manifests() {
  const session = await connectToApplyHandle();
  try {
    const fromTodaysDeploy = await manifestSnapshot();
    const filesFromTodaysDeploy = (await snapshotAll()).map(deployedFilesIn);
    const applyTo = async (profileId) => {
      const outcome = await applyProfile(session, { profileId });
      if (outcome.status !== "applied") {
        throw new Error(`Apply ended ${outcome.status} for "${profileId}": ${reportOf(outcome)}`);
      }
    };
    await check(`Apply deploys "${PROFILE_OTHER}"`, () => applyTo(PROFILE_OTHER));
    // a run that saves nothing leaves today's manifests in place, so the later checks prove nothing
    await check("that run saved its manifests", async () => {
      if (differencesBetween(fromTodaysDeploy, await manifestSnapshot()).length === 0) {
        throw new Error("the manifests are as today's deployment left them");
      }
    });
    await check(`Apply deploys "${PROFILE_EDGE_CASES}" again`, () => applyTo(PROFILE_EDGE_CASES));
    const fromApply = await manifestSnapshot();
    const filesFromApply = (await snapshotAll()).map(deployedFilesIn);
    await check("its manifests are the ones today's deployment saved", () =>
      differencesBetween(fromTodaysDeploy, fromApply),
    );
    await check("its files are the ones today's deployment left", () =>
      folderDifferences(filesFromTodaysDeploy, filesFromApply),
    );
    const [gameFiles] = filesFromApply;
    endProof(
      `manifests proven: Apply left the ${gameFiles.size} game folder files and saved the ` +
        `${fromApply.size} manifest entries today's deployment did`,
    );
  } finally {
    session.close();
  }
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

  const session = await connectToApplyHandle();
  try {
    const before = await snapshotAll();
    let operations;
    await check(`Apply rolls back a run of "${profileId}" whose ${fault.call} fails`, async () => {
      const outcome = await applyProfile(session, { profileId, fault });
      const { status, failedAt } = outcome;
      ({ operations } = outcome);
      if (status !== "rolled-back") {
        throw new Error(
          `planned ${operations.length} operations for "${profileId}" and expected a rollback, ` +
            `but Apply ended ${status}; the fault (${fault.call} on ${fault.path}) may match no ` +
            `step: ${reportOf(outcome)}`,
        );
      }
      console.log(
        `planned ${operations.length} operations for "${profileId}"; Apply rolled back at step ` +
          `${failedAt?.index} (${failedAt?.operation?.kind} ` +
          `${failedAt?.operation?.destinationPath}): ${failedAt?.error}`,
      );
      return (failedAt?.index ?? 0) === 0
        ? ["the run failed at its first step, so the rollback had nothing to undo"]
        : [];
    });

    const after = await snapshotAll();
    await check(
      `the ${snapshotFolders.map(([name], index) => `${after[index].size} ${name} entries`).join(" and ")} are as they were`,
      () => folderDifferences(before, after),
    );
    await check("no journal or set-aside file is left", async () => [
      ...(existsSync(journalFile) ? [`the journal is still there: ${journalFile}`] : []),
      ...(existsSync(keptFolder) && (await readdir(keptFolder)).length > 0
        ? [`files were set aside in ${keptFolder}`]
        : []),
    ]);
    await check("the next plan is the same plan, made without reseeding", async () => {
      const seedsBeforeReplan = await seedCount();
      const replanned = await session.evaluate(planThroughDevHandle, profileId);
      return [
        ...(seedsBeforeReplan === 0
          ? ["Vortex's log has no seed line, so a reseed couldn't be told from none"]
          : []),
        ...(JSON.stringify(replanned) !== JSON.stringify(operations)
          ? ["the plan made after the rollback differs from the one rolled back"]
          : []),
        ...((await seedCount()) !== seedsBeforeReplan
          ? ["the plan made after the rollback seeded its previous lockfile again"]
          : []),
      ];
    });
  } finally {
    session.close();
  }
  endProof("rollback proven: the disk is as it was, nothing is left behind, the plan is the same");
}

/** Where the setup goes, whether it and its Vortex are there, and how many journals are kept. */
export const status = async () => ({
  root,
  port,
  isSetUp: existsSync(path.join(root, MARKER)),
  vortexAnswers: await vortexAnswers(),
  journalCount: (await keptJournals()).length,
});

const commands = { setup, tamper, rollback, manifests, journal };
// only when run as a script; real paths, since the module's URL resolves links
const scriptPath = process.argv[1] === undefined ? "" : realpathSync(process.argv[1]);
if (scriptPath === fileURLToPath(import.meta.url)) {
  if (commands[command] === undefined) {
    console.error(`unknown command "${command}"; use ${Object.keys(commands).join(", ")}`);
    process.exit(1);
  }
  commands[command]().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    // lets what was printed and sent reach a front end before the process ends
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 2000).unref();
  });
}
