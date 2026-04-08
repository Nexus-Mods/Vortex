import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as querystring from "node:querystring";

import turbowalk, { type IEntry } from "turbowalk";
import * as winapi from "winapi-bindings";
import { parseStringPromise } from "xml2js";

import { log } from "../../logging";

import type { IStoreGameEntry, IStoreScanner } from "../IStoreScanner";

const ORIGIN_DATAPATH = "c:\\ProgramData\\Origin\\";
const INSTALLER_DATA = path.join("__Installer", "installerdata.xml");
const MANIFEST_EXT = ".mfst";

export class OriginScanner implements IStoreScanner {
  public readonly storeType = "origin";

  public isAvailable(): Promise<boolean> {
    if (process.platform !== "win32") {
      return Promise.resolve(false);
    }

    try {
      winapi.RegGetValue(
        "HKEY_LOCAL_MACHINE",
        "SOFTWARE\\WOW6432Node\\Origin",
        "ClientPath",
      );
      return Promise.resolve(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err as string);
      log("info", "Origin client not found", { error: message });
      return Promise.resolve(false);
    }
  }

  public async scan(): Promise<IStoreGameEntry[]> {
    if (!(await this.isAvailable())) {
      return [];
    }

    const localData = path.join(ORIGIN_DATAPATH, "LocalContent");

    let allEntries: IEntry[];
    try {
      allEntries = [];
      await turbowalk(localData, (entries) => {
        allEntries.push(...entries);
      });
    } catch (err: unknown) {
      if (["ENOTFOUND", "ENOENT"].includes((err as NodeJS.ErrnoException).code ?? "")) {
        return [];
      }
      const errMsg = err instanceof Error ? err.message : String(err as string);
      log("error", "failed to read origin directory", {
        error: errMsg,
        code: (err as NodeJS.ErrnoException).code,
      });
      return [];
    }

    const manifests = allEntries.filter(
      (entry) => path.extname(entry.filePath) === MANIFEST_EXT,
    );

    const results: IStoreGameEntry[] = [];

    for (const manifest of manifests) {
      try {
        const entry = await this.processManifest(manifest.filePath);
        if (entry !== undefined) {
          results.push(entry);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err as string);
        log("error", "failed to process origin manifest", {
          file: manifest.filePath,
          error: errMsg,
        });
      }
    }

    return results;
  }

  private async processManifest(
    manifestPath: string,
  ): Promise<IStoreGameEntry | undefined> {
    const data = await fs.readFile(manifestPath, { encoding: "utf-8" });

    let query: querystring.ParsedUrlQuery;
    try {
      // Strip the leading '?'
      query = querystring.parse(data.substr(1));
    } catch (err) {
      log("error", "failed to parse manifest file", { error: err instanceof Error ? err.message : String(err as string) });
      return undefined;
    }

    if (!query.dipinstallpath || !query.id) {
      return undefined;
    }

    const gamePath = query.dipinstallpath as string;
    const appid = query.id as string;
    const installerFilepath = path.join(gamePath, INSTALLER_DATA);

    // Uninstalling Origin games does NOT remove manifest files;
    // check that the installer data file still exists.
    try {
      await fs.stat(installerFilepath);
    } catch {
      log(
        "debug",
        "Origin game manifest found, but does not appear to be installed",
        appid,
      );
      return undefined;
    }

    const name = await this.getGameName(installerFilepath);

    return {
      storeId: appid,
      installPath: gamePath,
      name,
    };
  }

  private async getGameName(installerPath: string): Promise<string | undefined> {
    const installerData = await fs.readFile(installerPath, "utf-8");
    let xmlDoc: Record<string, unknown>;
    try {
      xmlDoc = await parseStringPromise(installerData) as Record<string, unknown>;
    } catch (err) {
      log("error", "failed to parse installer XML", { error: err instanceof Error ? err.message : String(err as string) });
      return undefined;
    }

    // Try DiPManifest format first (most common for third-party games)
    try {
      const dipManifest = xmlDoc.DiPManifest as Record<string, unknown> | undefined;
      const gameTitles = dipManifest?.gameTitles as Array<Record<string, unknown>> | undefined;
      const titles = gameTitles?.[0]?.gameTitle;
      if (Array.isArray(titles)) {
        const enTitle = titles.find(
          (element: Record<string, Record<string, string>>) => element.$.locale === "en_US",
        );
        if (enTitle?._) {
          return enTitle._ as string;
        }
      }
    } catch {
      // fall through to default format
    }

    // Try default format
    try {
      const game = xmlDoc.game as Record<string, unknown> | undefined;
      const metadata = game?.metadata as Record<string, unknown> | undefined;
      const localeInfos = metadata?.localeInfo;
      if (Array.isArray(localeInfos)) {
        const enInfo = localeInfos.find(
          (element: Record<string, Record<string, string>>) => element.$.locale === "en_US",
        );
        if (enInfo?.title) {
          return enInfo.title as string;
        }
      }
    } catch {
      // unable to determine name
    }

    log("warn", "could not determine Origin game name", { installerPath });
    return undefined;
  }
}
