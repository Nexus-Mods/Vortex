import crypto from "crypto";
import https from "https";
import url from "url";
import { IHashEntry, IHashMap } from "./types/types";

import { fs, selectors, types, util } from "vortex-api";
import { DEBUG_MODE, HASHMAP_LINK, HASHMAP_LOCAL_PATH } from "./constants";

export class HashMapper {
  private mApi: types.IExtensionApi;
  private mHashMap: IHashMap;
  private mStatsCache: { [statsHash: string]: string };
  constructor(api: types.IExtensionApi) {
    this.mApi = api;
    this.mStatsCache = {};
  }

  public async hashMapFromFile() {
    const data = await fs.readFileAsync(HASHMAP_LOCAL_PATH);
    try {
      const parsed: IHashMap = JSON.parse(data);
      return parsed;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  public async getUserFacingVersion(hash: string, gameId: string) {
    let gameHashMap = util.getSafe(this.mHashMap, [gameId], undefined);
    if (!gameHashMap) {
      gameHashMap = await this.updateHashMap(gameId);
    }
    const hashEntry: IHashEntry = gameHashMap?.[hash];
    return hashEntry ? hashEntry.userFacingVersion : hash;
  }

  public async generateCacheKey(filePaths: string[]) {
    const key: number[] = [];
    for (const filePath of filePaths) {
      const mtime = (await fs.statAsync(filePath)).mtimeMs;
      key.push(mtime);
    }
    key.sort((lhs, rhs) => lhs - rhs);
    const hash = crypto.createHash("md5");
    const buf = hash.update(key.map((k) => k.toString()).join("")).digest();
    return buf.toString("hex");
  }

  public insertToCache(key: string, value: string) {
    this.mStatsCache[key] = value;
  }

  public getCacheValue(key: string) {
    return this.mStatsCache[key];
  }

  private getHTTPData(link: string): Promise<IHashMap> {
    let sanitizedURL;
    try {
      sanitizedURL = new URL(link);
    } catch (err) {
      return Promise.reject(new Error(`Invalid URL: ${link}`));
    }
    return new Promise((resolve, reject) => {
      https
        .get(sanitizedURL.href, (res) => {
          res.setEncoding("utf-8");
          let output = "";
          res
            .on("data", (data) => (output += data))
            .on("end", () => {
              try {
                const parsed: IHashMap = JSON.parse(output);
                return resolve(parsed);
              } catch (err) {
                return reject(err);
              }
            });
        })
        .on("error", (e) => {
          return reject(e);
        })
        .end();
    });
  }

  private async updateHashMap(gameId: string) {
    try {
      this.mHashMap = DEBUG_MODE
        ? await this.hashMapFromFile()
        : await this.getHTTPData(HASHMAP_LINK);
      const data: { [hash: string]: IHashEntry } = this.mHashMap[gameId];
      return data;
    } catch (err) {
      return undefined;
    }
  }
}
