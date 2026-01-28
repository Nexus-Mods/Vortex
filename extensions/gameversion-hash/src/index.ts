import crypto from "crypto";
import path from "path";
import { fs, log, selectors, types, util } from "vortex-api";

import { HashMapper } from "./hashMapper";

import {
  GameVersionProviderFunc,
  GameVersionProviderTest,
  IHashEntry,
  IHashingDetails,
} from "./types/types";

import {
  DEBUG_MODE,
  HASHMAP_LOCAL_PATH,
  TEMP_PATH,
  WD_NAME,
} from "./constants";

import { fileMD5 } from "vortexmt";

type GameHashCache = { [gameId: string]: string };
const CACHE: GameHashCache = {};

async function insertCacheEntry(
  hashMapper: HashMapper,
  game: types.IGame,
  discovery: types.IDiscoveryResult,
): Promise<void> {
  if (!isGameValid(game, discovery)) {
    return;
  }
  const details: IHashingDetails = game.details;
  const hashPath = details?.hashDirPath
    ? path.isAbsolute(details.hashDirPath)
      ? details.hashDirPath
      : path.join(discovery.path, details.hashDirPath)
    : undefined;
  const files = details?.hashFiles
    ? details.hashFiles
    : hashPath
      ? (await fs.readdirAsync(hashPath))
          .map((file) => path.join(hashPath, file))
          .filter(async (filePath) => (await queryPath(filePath)).isFile)
      : [];
  if (files.length > 0) {
    const filePaths = files.map((file) =>
      path.isAbsolute(file) ? file : path.join(discovery.path, file),
    );
    const cacheKey = await hashMapper.generateCacheKey(filePaths);
    const cacheValue = hashMapper.getCacheValue(cacheKey);
    const hash = cacheValue ? cacheValue : await generateHash(filePaths);
    if (!cacheValue) {
      hashMapper.insertToCache(cacheKey, hash);
    }
    CACHE[game.id] = await hashMapper.getUserFacingVersion(hash, game.id);
  }
}

function nop() {
  // nop
}

const fileMD5Async = (fileName: string) =>
  new Promise<string>((resolve, reject) => {
    fileMD5(
      fileName,
      (err: Error, result: string) =>
        err !== null ? reject(err) : resolve(result),
      nop,
    );
  });

async function generateHash(filePaths: string[]): Promise<string> {
  const hashes: string[] = [];
  for (const filePath of filePaths) {
    const fileHash = await fileMD5Async(filePath);
    hashes.push(fileHash);
  }
  const hash = crypto.createHash("md5");
  const buf = hash.update(hashes.join("")).digest();
  return buf.toString("hex");
}

async function queryPath(
  filePath: string,
): Promise<{ exists: boolean; isFile: boolean }> {
  try {
    const stats = await fs.statAsync(filePath);
    const isFile = !stats.isDirectory();
    return Promise.resolve({ exists: true, isFile });
  } catch (err) {
    return Promise.resolve({ exists: false, isFile: false });
  }
}

function isGameValid(
  game: types.IGame,
  discovery: types.IDiscoveryResult,
): boolean {
  return !!discovery?.path && !!game?.executable;
}

async function testViability(
  game: types.IGame,
  discovery: types.IDiscoveryResult,
): Promise<boolean> {
  if (!isGameValid(game, discovery)) {
    return false;
  }

  const details: IHashingDetails = game.details;
  if (details?.hashDirPath) {
    if (!path.isAbsolute(details.hashDirPath)) {
      details.hashDirPath = path.join(discovery.path, details.hashDirPath);
    }

    const pathInfo = await queryPath(details.hashDirPath);
    if (pathInfo.exists && !pathInfo.isFile) {
      return true;
    }
  }

  if (details?.hashFiles) {
    for (let filePath of details.hashFiles) {
      if (!path.isAbsolute(filePath)) {
        filePath = path.join(discovery.path, filePath);
      }
      const filePathInfo = await queryPath(filePath);
      if (!filePathInfo.exists) {
        // this logged a warning in the past but the way it's being used, hashing may be used
        // only on specific variants of the game while others fall back to getting the version
        // from the exe so this is perfectly acceptable
        return false;
      }
      if (!filePathInfo.isFile) {
        log(
          "warn",
          "details.files should only contain filepaths, not directories",
          filePath,
        );
        return false;
      }
    }

    return true;
  }

  return false;
}

async function getHashVersion(
  hashMapper: HashMapper,
  game: types.IGame,
  discovery: types.IDiscoveryResult,
): Promise<string> {
  if (CACHE[game.id] === undefined) {
    await insertCacheEntry(hashMapper, game, discovery);
  }
  return CACHE[game.id];
}

async function getHashDetails(
  api: types.IExtensionApi,
  quick: boolean = false,
): Promise<IHashingDetails> {
  const state = api.getState();
  const gameId = selectors.activeGameId(state);
  const game = util.getGame(gameId);
  const discovery = selectors.discoveryByGame(state, gameId);
  const details = (game?.details as IHashingDetails) || {};
  if (quick) {
    return details;
  }
  let filePaths: string[] = [];
  if (details.hashFiles !== undefined) {
    filePaths = details.hashFiles.map((file) =>
      path.isAbsolute(file) ? file : path.join(discovery.path, file),
    );
  } else if (details.hashDirPath) {
    try {
      const hashPath = path.isAbsolute(details.hashDirPath)
        ? details.hashDirPath
        : path.join(discovery.path, details.hashDirPath);
      const dirContents = await fs.readdirAsync(hashPath);
      for (const entry of dirContents) {
        const filePath = path.join(hashPath, entry);
        const fileInfo = await queryPath(filePath);
        if (fileInfo.isFile) {
          filePaths.push(filePath);
        }
      }
    } catch (err) {
      // nop
    }
  }
  return { ...details, hashFiles: filePaths };
}

function raiseHashEntryDialog(api: types.IExtensionApi, gameId?: string) {
  const input: types.IInput[] = [
    { id: "gameId", label: "GameId", type: "text", value: gameId ?? "" },
    { id: "userFacingVersion", label: "User Facing Version", type: "text" },
    { id: "variant", label: "Variant (game store)", type: "text" },
  ];

  if (!gameId) {
    input.push({ id: "hashValue", label: "Hash Value", type: "text" });
  }
  return api.showDialog(
    "info",
    "Enter Hash Entry Values",
    {
      text: "Insert below information",
      input,
      checkboxes: [
        { id: "openFileLocation", value: false, text: "Open File Location" },
      ],
    },
    [{ label: "Cancel" }, { label: "Save" }],
  );
}

function main(context: types.IExtensionContext) {
  const hashMapper = new HashMapper(context.api);
  const testFunc: GameVersionProviderTest = testViability;
  const getGameVersionFunc: GameVersionProviderFunc = getHashVersion;
  context?.["registerGameVersionProvider"](
    "hash-version-check",
    75,
    testFunc,
    (game, discovery) => getGameVersionFunc(hashMapper, game, discovery),
  );

  context.registerAPI(
    "getHashVersion",
    (
      game: types.IGame,
      discovery: types.IDiscoveryResult,
      cb: (err: Error, version: string) => string,
    ) => {
      if (discovery?.path === undefined || game === undefined) {
        return;
      }
      getGameVersionFunc(hashMapper, game, discovery)
        .then((ver) => cb(null, ver))
        .catch((err) => cb(err, null));
    },
    { minArguments: 3 },
  );

  context.registerAction(
    "mod-icons",
    300,
    "settings",
    {},
    "Generate Hash Entry",
    () => {
      context.api.sendNotification({
        type: "activity",
        message: "Generating hash entry",
        noDismiss: true,
        allowSuppress: false,
        id: "generating-hash-notif",
      });
      getHashDetails(context.api).then(async (details) => {
        if (details?.hashFiles === undefined) {
          context.api.showErrorNotification(
            "Game extension is not configured correctly",
            "details.hashFiles is undefined",
            { allowReport: false },
          );
          context.api.dismissNotification("generating-hash-notif");
          return;
        }
        const filePaths = details.hashFiles;
        let hash;
        try {
          hash = await generateHash(filePaths);
        } catch (err) {
          context.api.showErrorNotification("Failed to generate hash", err, {
            allowReport: false,
          });
          return;
        }
        const state = context.api.getState();
        const gameId = selectors.activeGameId(state);
        const res = await raiseHashEntryDialog(context.api, gameId);
        if (res.action === "Save") {
          try {
            const discovery = selectors.discoveryByGame(
              state,
              res.input["gameId"],
            );
            if (!discovery?.path) {
              throw new util.ProcessCanceled(
                "Game is not discovered",
                res.input["gameId"],
              );
            }
            const entry: IHashEntry = {
              files: filePaths.map((file) =>
                path.relative(discovery.path, file),
              ),
              hashValue: hash,
              userFacingVersion: res.input["userFacingVersion"],
              variant: res.input["variant"],
            };
            const data = await hashMapper.hashMapFromFile();
            if (!data[res.input["gameId"]]) {
              data[res.input["gameId"]] = {};
            }
            data[res.input["gameId"]][entry.hashValue] = entry;
            await util.writeFileAtomic(
              HASHMAP_LOCAL_PATH,
              JSON.stringify(data, undefined, 2),
            );
            if (res.input["openFileLocation"]) {
              util.opn(path.dirname(HASHMAP_LOCAL_PATH)).catch((err) => null);
            }
          } catch (err) {
            context.api.showErrorNotification(
              "Failed to save hash entry",
              err,
              { allowReport: false },
            );
          }
        }
        context.api.dismissNotification("generating-hash-notif");
      });
    },
    () => DEBUG_MODE,
  );

  context.registerAction(
    "mod-icons",
    300,
    "settings",
    {},
    "Generate Hash Entry (Quick)",
    () => {
      getHashDetails(context.api, true).then(async (details) => {
        const res = await raiseHashEntryDialog(context.api);
        if (res.action === "Save") {
          try {
            const entry: IHashEntry = {
              files: details?.hashFiles || [],
              hashValue: res.input["hashValue"],
              userFacingVersion: res.input["userFacingVersion"],
              variant: res.input["variant"],
            };
            const data = await hashMapper.hashMapFromFile();
            data[res.input["gameId"]][entry.hashValue] = entry;
            await util.writeFileAtomic(
              HASHMAP_LOCAL_PATH,
              JSON.stringify(data, undefined, 2),
            );
            if (res.input["openFileLocation"]) {
              util.opn(path.dirname(HASHMAP_LOCAL_PATH)).catch((err) => null);
            }
          } catch (err) {
            context.api.showErrorNotification(
              "Failed to save hash entry",
              err,
              { allowReport: false },
            );
          }
        }
      });
    },
    () => DEBUG_MODE,
  );

  context.once(() => {
    const wdPath = path.join(TEMP_PATH, WD_NAME);
    if (DEBUG_MODE) {
      const git = require("simple-git/promise");
      const gitBootstrap = git();
      gitBootstrap
        .clone("https://github.com/Nexus-Mods/Vortex-Backend.git", wdPath)
        .catch((err) =>
          err.message.includes("already exists")
            ? git(wdPath).pull()
            : Promise.reject(err),
        );
    }
  });
  return true;
}

export default main;
