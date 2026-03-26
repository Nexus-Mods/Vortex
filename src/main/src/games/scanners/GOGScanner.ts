import * as winapi from "winapi-bindings";

import { log } from "../../logging";

import type { IStoreGameEntry, IStoreScanner } from "../IStoreScanner";

const REG_GOG_CLIENT = "SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths";
const REG_GOG_GAMES = "SOFTWARE\\WOW6432Node\\GOG.com\\Games";

export class GOGScanner implements IStoreScanner {
  public readonly storeType = "gog";

  public async isAvailable(): Promise<boolean> {
    if (process.platform !== "win32") {
      return false;
    }

    try {
      winapi.RegGetValue("HKEY_LOCAL_MACHINE", REG_GOG_CLIENT, "client");
      return true;
    } catch (err) {
      log("info", "GOG client not found", { error: String(err) });
      return false;
    }
  }

  public async scan(): Promise<IStoreGameEntry[]> {
    if (!(await this.isAvailable())) {
      return [];
    }

    try {
      return winapi.WithRegOpen(
        "HKEY_LOCAL_MACHINE",
        REG_GOG_GAMES,
        (hkey) => {
          const keys = winapi.RegEnumKeys(hkey);
          return keys
            .map((key): IStoreGameEntry | undefined => {
              try {
                return {
                  storeId: winapi.RegGetValue(hkey, key.key, "gameID")
                    .value as string,
                  installPath: winapi.RegGetValue(hkey, key.key, "path")
                    .value as string,
                  name: winapi.RegGetValue(hkey, key.key, "startMenu")
                    .value as string,
                };
              } catch (err) {
                log("error", "GOG: failed to read game entry", {
                  key: key.key,
                  error: String(err),
                });
                return undefined;
              }
            })
            .filter((entry): entry is IStoreGameEntry => entry !== undefined);
        },
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }
}
