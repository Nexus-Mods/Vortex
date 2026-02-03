import { ILoadOrder } from "./types";

import Promise from "bluebird";
import * as path from "path";
import { fs, log, types, util } from "vortex-api";

const poe2Path = path.resolve(
  util.getVortexPath("appData"),
  "..",
  "LocalLow",
  "Obsidian Entertainment",
  "Pillars of Eternity II",
);

let watcher: fs.FSWatcher;
let loadOrder: ILoadOrder = util.makeReactive({});

function modConfig(): string {
  return path.join(poe2Path, "modconfig.json");
}

function updateLoadOrder(tries: number = 3): Promise<void> {
  return fs
    .readFileAsync(modConfig(), { encoding: "utf-8" })
    .catch(() => "{}")
    .then((jsonData) => {
      try {
        const data = JSON.parse((util as any).deBOM(jsonData));
        loadOrder = (data.Entries || []).reduce((prev, entry, idx) => {
          prev[entry.FolderName] = {
            pos: idx,
            enabled: entry.Enabled,
          };
          return prev;
        }, {});
      } catch (err) {
        // this probably happens when poe2 is currently writing to that file,
        log("debug", "update load order", { tries });
        if (tries > 0) {
          return Promise.delay(100).then(() => updateLoadOrder(tries - 1));
        } else {
          return err.message.indexOf("Unexpected token") !== -1
            ? Promise.reject(new util.DataInvalid("Invalid config file"))
            : Promise.reject(err);
        }
      }
    });
}

export function getLoadOrder(): ILoadOrder {
  return loadOrder;
}

export function setLoadOrder(order: ILoadOrder) {
  loadOrder = order;
  fs.readFileAsync(modConfig(), { encoding: "utf-8" })
    .catch(() => "{}")
    .then((jsonData) => {
      const data = JSON.parse((util as any).deBOM(jsonData));
      data.Entries = Object.keys(loadOrder)
        .sort((lhs, rhs) => loadOrder[lhs].pos - loadOrder[rhs].pos)
        .reduce((prev, key) => {
          prev.push({ FolderName: key, Enabled: loadOrder[key].enabled });
          return prev;
        }, []);
      return fs.writeFileAsync(
        modConfig(),
        JSON.stringify(data, undefined, 2),
        { encoding: "utf-8" },
      );
    });
}

export function startWatch(state: types.IState): Promise<void> {
  const discovery = state.settings.gameMode.discovered["pillarsofeternity2"];
  if (discovery === undefined) {
    // this shouldn't happen because startWatch is only called if the
    // game is activated and it has to be discovered for that
    return Promise.reject(new Error("Pillars of Eternity 2 wasn't discovered"));
  }
  const loDebouncer = new util.Debouncer(() => {
    return updateLoadOrder();
  }, 200);
  watcher = fs.watch(modConfig(), {}, () => {
    loDebouncer.schedule();
  });
  watcher.on("error", (err) => {
    log("error", "failed to watch poe2 mod directory for changes", {
      message: err.message,
    });
  });

  return updateLoadOrder();
}

export function stopWatch() {
  if (watcher !== undefined) {
    watcher.close();
    watcher = undefined;
  }
}
