import Promise from "bluebird";
import * as path from "path";
import { log, types, selectors, util } from "vortex-api";

import { migrate100 } from "./migrations";

import { DA_GAMES } from "./constants";

const DA_MODULE_ERF_SUFFIX = "_module.erf";

function testDazip(instructions: types.IInstruction[]) {
  // we can't (currently) know the files that are inside a dazip, the outer installer
  // has to tell us
  return Promise.resolve(false);
}

function testSupportedOuter(files: string[]) {
  const dazips = files.filter(
    (file) => !file.endsWith(path.sep) && path.extname(file) === ".dazip",
  );
  return Promise.resolve({
    supported: dazips.length > 0,
    requiredFiles: dazips,
  });
}

function shortestPath(lhs: string, rhs: string) {
  return lhs.split(path.sep).length - rhs.split(path.sep).length;
}

function testSupportedInner(files: string[], gameId: string) {
  const unsupported = () =>
    Promise.resolve({ supported: false, requiredFiles: [] });

  if (!isDragonAge(gameId)) {
    return unsupported();
  }

  if (
    files.find((file) =>
      file.toLowerCase().split(path.sep).includes("contents"),
    ) === undefined
  ) {
    return unsupported();
  }

  const manifests = files.filter(
    (iter) => path.basename(iter.toLowerCase()) === "manifest.xml",
  );
  if (manifests.length === 0) {
    return unsupported();
  }

  // if there are multiple manifests we only consider the one with the shortest directory tree
  const shortest = manifests.sort(shortestPath)[0];
  const basePath = path.dirname(shortest);

  if (basePath !== ".") {
    const extraFiles = files.filter((iter) => !iter.startsWith(basePath));
    if (extraFiles.length !== 0) {
      return unsupported();
    }
  }

  return Promise.resolve({
    supported: true,
    requiredFiles: [],
  });
}

function installOuter(
  files: string[],
  destinationPath: string,
  gameId: string,
  progressDelegate,
): Promise<types.IInstallResult> {
  const dazips = files.filter(
    (file) => !file.endsWith(path.sep) && path.extname(file) === ".dazip",
  );
  log("debug", "install nested", dazips);
  const instructions = dazips.map(
    (dazip: string): types.IInstruction => ({
      type: "submodule",
      key: dazip,
      path: path.join(destinationPath, dazip),
      submoduleType: "dazip",
    }),
  );
  return Promise.resolve({ instructions });
}

// Dragon Age 2 does not have an official creation kit and any dazip
//  archives targeted at DA2 are created using DA:O's creation kit.
//  Reason why it's safe to assume that both games have the same
//  folder structure.
function installInner(
  files: string[],
  destinationPath: string,
  gameId: string,
  progressDelegate,
): Promise<types.IInstallResult> {
  const result: types.IInstallResult = {
    instructions: [
      {
        type: "setmodtype",
        value: "dazip",
      },
    ],
  };

  const manifests = files.filter(
    (iter) => path.basename(iter.toLowerCase()) === "manifest.xml",
  );
  const shortest = manifests.sort(shortestPath)[0];
  const basePath = path.dirname(shortest);

  let modName: string;
  const sep = `${path.sep}${path.sep}`;
  const addinsPathRE = new RegExp(
    ["contents", "addins", `[^${sep}]+`].join(sep) + sep,
    "i",
  );
  const addinsPath = files.find((filePath) => addinsPathRE.test(filePath));
  if (addinsPath !== undefined) {
    const segments = addinsPath.split(path.sep);
    const addinsIdx = segments.findIndex(
      (seg) => seg.toLowerCase() === "addins",
    );
    modName = segments[addinsIdx + 1];
  } else {
    const moduleERF = files.find((file) =>
      path.basename(file).includes(DA_MODULE_ERF_SUFFIX),
    );
    if (moduleERF !== undefined) {
      modName = path.basename(moduleERF).replace(DA_MODULE_ERF_SUFFIX, "");
    }
  }

  // Go through each file and remove the contents folder.
  files.forEach((filePath) => {
    if (filePath.endsWith(path.sep)) {
      // ignore directories
      return;
    }

    if (filePath === shortest) {
      result.instructions.push({
        type: "copy",
        source: filePath,
        destination:
          modName !== undefined
            ? path.join("addins", modName, shortest)
            : filePath,
      });
      return;
    }

    // we already checked that all files are inside basePath in the test function so this
    // second check should be unnecessary
    if (
      basePath !== "." &&
      filePath.toLowerCase().startsWith(basePath.toLowerCase())
    ) {
      filePath = filePath.slice(basePath.length + 1);
    }
    let filePathSplit = filePath.split(path.sep);
    if (filePathSplit[0].toLowerCase() === "contents") {
      filePathSplit = filePathSplit.slice(1);
    }

    result.instructions.push({
      type: "copy",
      source: filePath,
      destination: path.join(...filePathSplit),
    });
  });

  return Promise.resolve(result);
}

function isDragonAge(gameId: string): boolean {
  return (
    [DA_GAMES.DragonAge1.id, DA_GAMES.DragonAge2.id].indexOf(gameId) !== -1
  );
}

function init(context: types.IExtensionContext) {
  const getPath = (game: types.IGame) => {
    if (game.id === DA_GAMES.DragonAge1.id) {
      return DA_GAMES.DragonAge1.getAddinsFolder
        ? DA_GAMES.DragonAge1.getAddinsFolder(context.api)
        : DA_GAMES.DragonAge1.modPath;
    } else if (game.id === DA_GAMES.DragonAge2.id) {
      return DA_GAMES.DragonAge2.getAddinsFolder
        ? DA_GAMES.DragonAge2.getAddinsFolder(context.api)
        : DA_GAMES.DragonAge2.modPath;
    }
  };

  // incorrectly named mod type. we use this mod type to denote addin-type mods
  // that have to be registered in the Addins.xml file
  context.registerModType("dazip", 25, isDragonAge, getPath, testDazip, {
    name: "Dragon Age AddIn",
  });
  context.registerInstaller("dazipOuter", 15, testSupportedOuter, installOuter);
  context.registerInstaller("dazipInner", 15, testSupportedInner, installInner);

  context.registerMigration((old: string) => migrate100(context, old) as any);

  return true;
}

export default init;
