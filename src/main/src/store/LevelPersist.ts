import type { IPersistor } from "@vortex/shared/state";

import { DataInvalid } from "@vortex/shared/errors";
import encode from "encoding-down";
import leveldown from "leveldown";
import levelup from "levelup";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { log } from "../logging";

const SEPARATOR: string = "###";

export class DatabaseLocked extends Error {
  constructor() {
    super("Database is locked");
    this.name = this.constructor.name;
  }
}

function repairDB(dbPath: string): Promise<void> {
  log("warn", "repairing database", dbPath);

  return new Promise((resolve, reject) => {
    leveldown.repair(dbPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function openDB(dbPath: string): Promise<levelup.LevelUp> {
  return new Promise((resolve, reject) => {
    const db = levelup(
      encode(leveldown(dbPath)),
      { keyEncoding: "utf8", valueEncoding: "utf8" },
      (err) => {
        if (err) reject(err);
        else resolve(db);
      },
    );
  });
}

class LevelPersist implements IPersistor {
  public static async create(
    persistPath: string,
    tries: number = 10,
    repair: boolean = false,
  ): Promise<LevelPersist> {
    try {
      if (repair) await repairDB(persistPath);
      const db = await openDB(persistPath);
      const res = new LevelPersist(db);
      return res;
    } catch (err) {
      if (err instanceof DataInvalid) {
        throw err;
      }

      if (tries === 0) {
        log("info", "failed to open db", err);
        throw new DatabaseLocked();
      } else {
        return await new Promise((resolve) => {
          setTimeout(() => {
            const res = LevelPersist.create(persistPath, tries - 1, false);
            resolve(res);
          }, 500);
        });
      }
    }
  }

  private mDB: levelup.LevelUp;

  constructor(db: levelup.LevelUp) {
    this.mDB = db;
  }

  public close(): Promise<void> {
    return this.mDB.close();
  }

  public setResetCallback(_cb: () => PromiseLike<void>): void {
    return undefined;
  }

  public async getItem(key: string[]): Promise<string> {
    const value: string = await this.mDB.get(key.join(SEPARATOR));
    return value;
  }

  public async setItem(statePath: string[], newState: string): Promise<void> {
    await this.mDB.put(statePath.join(SEPARATOR), newState);
  }

  public async removeItem(statePath: string[]): Promise<void> {
    await this.mDB.del(statePath.join(SEPARATOR));
  }

  public async getAllKeys(): Promise<string[][]> {
    const keys: string[][] = [];

    const writable = new Writable({
      objectMode: true,
      write(chunk: string, _encoding, callback) {
        keys.push(chunk.split(SEPARATOR));
        callback();
      },
    });

    await pipeline(this.mDB.createKeyStream(), writable);
    return keys;
  }

  public async getPersistedHives(): Promise<string[]> {
    const hives = new Set<string>();

    const writable = new Writable({
      objectMode: true,
      write(data: string, _encoding, callback) {
        const separatorIndex = data.indexOf(SEPARATOR);
        hives.add(separatorIndex >= 0 ? data.slice(0, separatorIndex) : data);
        callback();
      },
    });

    await pipeline(this.mDB.createKeyStream(), writable);
    return [...hives];
  }

  public async getAllKVs(
    prefix?: string,
  ): Promise<Array<{ key: string[]; value: string }>> {
    const kvs: Array<{ key: string[]; value: string }> = [];

    const options =
      prefix === undefined
        ? undefined
        : {
            gt: `${prefix}${SEPARATOR}`,
            lt: `${prefix}${SEPARATOR}zzzzzzzzzzz`,
          };

    const writable = new Writable({
      objectMode: true,
      write(data: { key: string; value: string }, _encoding, callback) {
        kvs.push({ key: data.key.split(SEPARATOR), value: data.value });
        callback();
      },
    });

    await pipeline(this.mDB.createReadStream(options), writable);
    return kvs;
  }
}

export default LevelPersist;
