import ARCWrapper from "./ARCWrapper";
import AttribDashlet from "./AttribDashlet";
import { arcGameId, arcVersion } from "./gameSupport";
import { ArcGame } from "./types";

import Promise from "bluebird";
import * as fs from "fs";
import * as path from "path";
import { log, selectors, types } from "vortex-api";

class ARCHandler implements types.IArchiveHandler {
  private mArc: ARCWrapper;
  private mArchivePath: string;
  private mGame: ArcGame;
  private mVersion: number;

  constructor(
    api: types.IExtensionApi,
    fileName: string,
    options: types.IArchiveOptions,
  ) {
    this.mArchivePath = fileName;
    this.mGame = arcGameId(options.gameId);
    this.mVersion = arcVersion(options.gameId);
    this.mArc = new ARCWrapper(api);
  }

  public readDir(dirPath: string): Promise<string[]> {
    return this.mArc
      .list(this.mArchivePath, { game: this.mGame, version: this.mVersion })
      .then((list) =>
        list
          .filter((entry) => entry.startsWith(dirPath))
          .map((entry) => entry.substr(dirPath.length)),
      );
  }

  public extractAll(outputPath: string): Promise<void> {
    return this.mArc.extract(this.mArchivePath, outputPath, {
      game: this.mGame,
      version: this.mVersion,
    });
  }

  public create(sourcePath: string): Promise<void> {
    return this.mArc.create(this.mArchivePath, sourcePath, {
      game: this.mGame,
      version: this.mVersion,
    });
  }
}

function createARCHandler(
  api: types.IExtensionApi,
  fileName: string,
  options: types.IArchiveOptions,
): Promise<types.IArchiveHandler> {
  log("info", "createARCHandler");
  return Promise.resolve(new ARCHandler(api, fileName, options));
}

function isSupported(state: types.IState) {
  const gameMode = selectors.activeGameId(state);

  return ["dragonsdogma"].indexOf(gameMode) !== -1;
}

function init(context: types.IExtensionContext) {
  try {
    fs.statSync(path.join(__dirname, "ARCtool.exe"));
  } catch (err) {
    log(
      "warn",
      "To use MT Framework games (Dragon's Dogma) you need to download ARCtool.rar " +
        `from http://www.fluffyquack.com/tools/ and unpack it to ${__dirname}`,
    );
    return false;
  }

  context.registerArchiveType("arc", (fileName, options) =>
    createARCHandler(context.api, fileName, options),
  );

  context.registerDashlet(
    "ARC Support",
    1,
    2,
    250,
    AttribDashlet,
    isSupported,
    () => ({}),
    undefined,
  );

  return true;
}

export default init;
