import type { IPersistor } from "@vortex/shared/state";
import type leveldownT from "leveldown";

import { unknownToError } from "@vortex/shared";
import { DataInvalid } from "@vortex/shared/errors";
import PromiseBB from "bluebird";
import encode from "encoding-down";
import * as levelup from "levelup";

import { log } from "../logging";

const SEPARATOR: string = "###";

const READ_TIMEOUT: number = 10000;

export class DatabaseLocked extends Error {
  constructor() {
    super("Database is locked");
    this.name = this.constructor.name;
  }
}

function repairDB(dbPath: string): PromiseBB<void> {
  return new PromiseBB<void>((resolve, reject) => {
    log("warn", "repairing database", dbPath);
    const leveldown: typeof leveldownT = require("leveldown");
    leveldown.repair(dbPath, (err: Error) => {
      if (err !== null) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function openDB(dbPath: string): PromiseBB<levelup.LevelUp> {
  return new PromiseBB<levelup.LevelUp>((resolve, reject) => {
    const leveldown: typeof leveldownT = require("leveldown");
    const db = levelup.default(
      encode(leveldown(dbPath)),
      { keyEncoding: "utf8", valueEncoding: "utf8" },
      (err) => {
        if (err !== null) {
          return reject(err);
        }
        return resolve(db);
      },
    );
  });
}

class LevelPersist implements IPersistor {
  public static create(
    persistPath: string,
    tries: number = 10,
    repair: boolean = false,
  ): PromiseBB<LevelPersist> {
    return (repair ? repairDB(persistPath) : PromiseBB.resolve())
      .then(() => openDB(persistPath))
      .then((db) => new LevelPersist(db))
      .catch((err) => {
        if (err instanceof DataInvalid) {
          return PromiseBB.reject(err);
        }
        if (tries === 0) {
          log("info", "failed to open db", err);
          return PromiseBB.reject(new DatabaseLocked());
        } else {
          return PromiseBB.delay(500).then(() =>
            LevelPersist.create(persistPath, tries - 1, false),
          );
        }
      });
  }

  private mDB: levelup.LevelUp;

  constructor(db: levelup.LevelUp) {
    this.mDB = db;
  }

  public close = this.restackingFunc((): PromiseBB<void> => {
    return new PromiseBB<void>((resolve, reject) => {
      this.mDB.close((err) => (err ? reject(err) : resolve()));
    });
  });

  public setResetCallback(cb: () => PromiseBB<void>): void {
    return undefined;
  }

  public getItem = this.restackingFunc((key: string[]): PromiseBB<string> => {
    return new PromiseBB((resolve, reject) => {
      try {
        this.mDB.get(key.join(SEPARATOR), (error, value) => {
          if (error) {
            return reject(error);
          }
          return resolve(value);
        });
      } catch (err) {
        return reject(err);
      }
    });
  });

  public getAllKeys(options?: any): PromiseBB<string[][]> {
    return new PromiseBB((resolve, reject) => {
      const keys: string[][] = [];
      let resolved = false;
      this.mDB
        .createKeyStream(options)
        .on("data", (data) => {
          keys.push(data.split(SEPARATOR));
        })
        .on("error", (error) => {
          if (!resolved) {
            reject(error);
            resolved = true;
          }
        })
        .on("close", () => {
          if (!resolved) {
            resolve(keys);
            resolved = true;
          }
        });
    });
  }

  /**
   * Get all unique hive names that have persisted data.
   * Extracts the first segment of each key to find all hives.
   */
  public getPersistedHives(): PromiseBB<string[]> {
    return new PromiseBB((resolve, reject) => {
      const hives = new Set<string>();
      let resolved = false;
      this.mDB
        .createKeyStream()
        .on("data", (data: string) => {
          // Extract hive name (first segment before separator)
          const separatorIndex = data.indexOf(SEPARATOR);
          const hive =
            separatorIndex >= 0 ? data.slice(0, separatorIndex) : data;
          hives.add(hive);
        })
        .on("error", (error) => {
          if (!resolved) {
            reject(error);
            resolved = true;
          }
        })
        .on("close", () => {
          if (!resolved) {
            resolve([...hives]);
            resolved = true;
          }
        });
    });
  }

  public getAllKVs(
    prefix?: string,
  ): PromiseBB<Array<{ key: string[]; value: string }>> {
    return new PromiseBB((resolve, reject) => {
      const kvs: Array<{ key: string[]; value: string }> = [];

      const options =
        prefix === undefined
          ? undefined
          : {
              gt: `${prefix}${SEPARATOR}`,
              lt: `${prefix}${SEPARATOR}zzzzzzzzzzz`,
            };

      this.mDB
        .createReadStream(options)
        .on("data", (data) => {
          kvs.push({ key: data.key.split(SEPARATOR), value: data.value });
        })
        .on("error", (error) => {
          reject(error);
        })
        .on("close", () => {
          resolve(kvs);
        });
    });
  }

  public setItem = this.restackingFunc(
    (statePath: string[], newState: string): PromiseBB<void> => {
      return new PromiseBB<void>((resolve, reject) => {
        try {
          this.mDB.put(statePath.join(SEPARATOR), newState, (error) => {
            if (error) {
              return reject(error);
            }
            return resolve();
          });
        } catch (err) {
          // some errors are thrown directly, instead of through the callback. Great...
          return reject(err);
        }
      });
    },
  );

  public removeItem = this.restackingFunc(
    (statePath: string[]): PromiseBB<void> => {
      return new PromiseBB<void>((resolve, reject) => {
        try {
          this.mDB.del(statePath.join(SEPARATOR), (error) => {
            if (error) {
              return reject(error);
            }
            return resolve();
          });
        } catch (err) {
          return reject(err);
        }
      });
    },
  );

  private restackingFunc<T extends (...args: unknown[]) => any>(
    cb: T,
  ): (...args: Parameters<T>) => ReturnType<T> {
    return (...args: Parameters<T>): ReturnType<T> => {
      const stackErr = new Error();
      return cb(...args).catch((unknownErr) => {
        const err = unknownToError(unknownErr);
        err.stack = stackErr.stack;
        return PromiseBB.reject(err);
      });
    };
  }
}

export default LevelPersist;
