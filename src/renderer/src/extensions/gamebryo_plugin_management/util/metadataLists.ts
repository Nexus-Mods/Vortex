import { stat } from "node:fs/promises";
import * as path from "node:path";

import type { ILootProm } from "../types/ILoot";

/** Where libloot reads one game's metadata from. */
export interface IListPaths {
  masterlist: string;
  userlist: string;
  prelude: string;
}

export function listPaths(userDataPath: string, gameMode: string): IListPaths {
  return {
    masterlist: path.join(userDataPath, gameMode, "masterlist", "masterlist.yaml"),
    userlist: path.join(userDataPath, gameMode, "userlist.yaml"),
    prelude: path.join(userDataPath, "loot_prelude", "prelude.yaml"),
  };
}

/** What the loaded lists came from; a file that is not there has no time. */
interface IListTimes {
  masterlist: number | undefined;
  userlist: number | undefined;
  prelude: number | undefined;
}

const timeOf = (filePath: string): Promise<number | undefined> =>
  stat(filePath).then(
    (stats) => stats.mtimeMs,
    () => undefined,
  );

async function listTimes(paths: IListPaths): Promise<IListTimes> {
  const [masterlist, userlist, prelude] = await Promise.all([
    timeOf(paths.masterlist),
    timeOf(paths.userlist),
    timeOf(paths.prelude),
  ]);
  return { masterlist, userlist, prelude };
}

/**
 * libloot holds the lists in memory and watches neither file, so a change on disk only reaches it
 * through another load.
 */
export class MetadataLists {
  private mLoaded: IListTimes | undefined;

  /**
   * Loads the lists into the instance unless it already holds what is on disk, and answers whether
   * it loaded.
   */
  public async ensureLoaded(paths: IListPaths, loot: ILootProm): Promise<boolean> {
    const times = await listTimes(paths);
    // a missing masterlist is the download path's failure to report
    if (times.masterlist === undefined || this.holds(times)) {
      return false;
    }
    await loot.loadListsAsync(
      paths.masterlist,
      times.userlist !== undefined ? paths.userlist : "",
      times.prelude !== undefined ? paths.prelude : "",
    );
    this.mLoaded = times;
    return true;
  }

  /** Forgets what is loaded, for a rewrite the file times are too coarse to catch. */
  public invalidate(): void {
    this.mLoaded = undefined;
  }

  private holds(times: IListTimes): boolean {
    return (
      this.mLoaded !== undefined &&
      this.mLoaded.masterlist === times.masterlist &&
      this.mLoaded.userlist === times.userlist &&
      this.mLoaded.prelude === times.prelude
    );
  }
}
