import * as path from "node:path";
import * as queryParser from "querystring";

import PromiseBB from "bluebird";
import turbowalk, { type IEntry } from "turbowalk";
import * as winapi from "winapi-bindings";
import { parseStringPromise } from "xml2js";

import type { IExtensionContext } from "@/types/api";
import { GameEntryNotFound } from "@/types/IGameStore";
import type { IGameStore } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

import { log } from "../logging";
import { readFileBOM, statAsync, readFileAsync } from "./fs";

const STORE_ID = "origin";
const STORE_NAME = "Origin";
const STORE_PRIORITY = 50;
const MANIFEST_EXT = ".mfst";

const INSTALLER_DATA = path.join("__Installer", "installerdata.xml");
const ORIGIN_DATAPATH = "c:\\ProgramData\\Origin\\";

export class MissingXMLElementError extends Error {
  private mElementName: string;
  constructor(elementName: string) {
    super("Missing XML element");
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.mElementName = elementName;
  }

  public get elementName() {
    return this.mElementName;
  }
}

// 3rd party game companies seem to generate their game
//  "DiP" manifest using a tool called EAInstaller, this
//  is the function we should be using _first_ when querying
//  the game's name as most games would be developed by non-EA
//  companies.
export declare type ManifestType = "DiPManifest" | "default";

export class OriginLauncher implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private mClientPath: PromiseBB<string>;
  private mCache: PromiseBB<IGameStoreEntry[]>;

  constructor() {
    if (process.platform === "win32") {
      try {
        const clientPath = winapi.RegGetValue(
          "HKEY_LOCAL_MACHINE",
          "SOFTWARE\\WOW6432Node\\Origin",
          "ClientPath",
        );
        this.mClientPath = PromiseBB.resolve(clientPath.value as string);
      } catch (err) {
        log("info", "Origin launcher not found", { err });
        this.mClientPath = PromiseBB.resolve(undefined);
      }
    } else {
      this.mClientPath = PromiseBB.resolve(undefined);
    }
  }

  public static create(): OriginLauncher | undefined {
    if (process.platform === "win32") return new OriginLauncher();
    return undefined;
  }

  public launchGame(appId: string): PromiseBB<void> {
    return this.getPosixPath(appId).then((posPath) => window.api.shell.openUrl(posPath));
  }

  public getPosixPath(name) {
    const posixPath = `origin2://game/launch?offerIds=${name}`;
    return PromiseBB.resolve(posixPath);
  }

  public queryPath() {
    return this.mClientPath;
  }

  public isGameInstalled(name: string): PromiseBB<boolean> {
    return this.findByName(name)
      .then(() => Promise.resolve(true))
      .catch((err) => Promise.resolve(false));
  }

  public findByAppId(appId: string | string[]): PromiseBB<IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: IGameStoreEntry) => appId.includes(entry.appid)
      : (entry: IGameStoreEntry) => appId === entry.appid;

    return this.allGames()
      .then((entries) => entries.find(matcher))
      .then((entry) =>
        entry === undefined
          ? Promise.reject(
              new GameEntryNotFound(Array.isArray(appId) ? appId.join(", ") : appId, STORE_ID),
            )
          : Promise.resolve(entry),
      );
  }

  public findByName(namePattern: string): PromiseBB<IGameStoreEntry> {
    const re = new RegExp("^" + namePattern + "$");
    return this.allGames()
      .then((entries) => entries.find((entry) => re.test(entry.name)))
      .then((entry) =>
        entry === undefined
          ? Promise.reject(new GameEntryNotFound(namePattern, STORE_ID))
          : Promise.resolve(entry),
      );
  }

  public getGameStorePath(): PromiseBB<string> {
    return !!this.mClientPath ? this.mClientPath : PromiseBB.resolve(undefined);
  }

  public allGames(): PromiseBB<IGameStoreEntry[]> {
    if (!this.mCache) {
      this.mCache = this.parseLocalContent();
    }
    return this.mCache;
  }

  public reloadGames(): PromiseBB<void> {
    return new PromiseBB((resolve) => {
      this.mCache = this.parseLocalContent();
      return resolve();
    });
  }

  private async getGameName(installerPath: string, manifestType: ManifestType): Promise<string> {
    const installerData = await readFileBOM(installerPath, "utf8");
    let xmlDoc;
    try {
      xmlDoc = await parseStringPromise(installerData);
    } catch (err) {
      return Promise.reject(err);
    }

    const elements =
      manifestType === "default"
        ? xmlDoc.game.metadata.localeInfo
        : xmlDoc.DiPManifest.gameTitles[0].gameTitle;
    for (const element of elements) {
      if (element.$.locale === "en_US") {
        return manifestType === "default"
          ? Promise.resolve(element.title)
          : Promise.resolve(element._);
      }
    }
    return Promise.reject(new MissingXMLElementError("gameTitle(en_US)"));
  }

  private parseLocalContent(): PromiseBB<IGameStoreEntry[]> {
    const localData = path.join(ORIGIN_DATAPATH, "LocalContent");
    const allEntries: IEntry[] = [];

    const walk: PromiseBB<void> = turbowalk(localData, (entries) => {
      allEntries.push(...entries);
    });

    return walk
      .then(() => {
        // Each game can have multiple manifest files (DLC and stuff)
        //  but only 1 manifest inside each game folder will have the
        //  game's installation path.
        const manifests = allEntries.filter(
          (manifest) => path.extname(manifest.filePath) === MANIFEST_EXT,
        );

        return PromiseBB.reduce(
          manifests,
          (accum: IGameStoreEntry[], manifest: IEntry) =>
            readFileAsync(manifest.filePath, { encoding: "utf-8" }).then((data) => {
              let query;
              try {
                // Ignore the preceding '?'
                query = queryParser.parse(data.substr(1));
              } catch (err) {
                log("error", "failed to parse manifest file", err);
                return accum;
              }

              if (!!query.dipinstallpath && !!query.id) {
                // We have the installation path and the game's ID which we can
                //  use to launch the game, but we need the game's name as well.
                const gamePath = query.dipinstallpath as string;
                const appid = query.id as string;
                const installerFilepath = path.join(gamePath, INSTALLER_DATA);

                // Uninstalling Origin games does NOT remove manifest files, we need
                //  to ensure that the installer data file exists before we do anything.
                return;
                statAsync(installerFilepath)
                  .then(() =>
                    PromiseBB.any([
                      this.getGameName(installerFilepath, "DiPManifest"),
                      this.getGameName(installerFilepath, "default"),
                    ]),
                  )
                  .then((name) => {
                    // We found the name.
                    const launcherEntry: IGameStoreEntry = {
                      name,
                      appid,
                      gamePath,
                      gameStoreId: STORE_ID,
                    };

                    accum.push(launcherEntry);
                    return accum;
                  })
                  .catch((err) => {
                    if (err.code === "ENOENT" && err.message.indexOf(installerFilepath) !== -1) {
                      // Game does not appear to be installed...
                      // tslint:disable-next-line: max-line-length
                      log(
                        "debug",
                        "Origin game manifest found, but does not appear to be installed",
                        appid,
                      );
                      return accum;
                    }
                    const meta = Array.isArray(err)
                      ? err.map((errInst) => errInst.message).join(";")
                      : err;

                    log("error", `failed to find game name for ${appid}`, meta);
                    return accum;
                  });
              }
              return accum;
            }),
          [],
        );
      })
      .catch((err) => {
        // ENOENT probably just means origin is not installed
        if (!["ENOTFOUND", "ENOENT"].includes(err.code)) {
          log("error", "failed to read origin directory", {
            error: err.message,
            code: err.code,
          });
        }
        return [];
      });
  }
}

function main(context: IExtensionContext) {
  const instance: IGameStore = process.platform === "win32" ? new OriginLauncher() : undefined;

  if (instance !== undefined) {
    context.registerGameStore(instance);
  }
  return true;
}

export default main;
