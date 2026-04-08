import * as winapi from "winapi-bindings";

import { log } from "../../logging";

import type { IStoreGameEntry, IStoreScanner } from "../IStoreScanner";

const REG_GOG_CLIENT = "SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths";
const REG_GOG_GAMES = "SOFTWARE\\WOW6432Node\\GOG.com\\Games";

export class GOGScanner implements IStoreScanner {
  public readonly storeType = "gog";

  public isAvailable(): Promise<boolean> {
    if (process.platform !== "win32") {
      return Promise.resolve(false);
    }

    try {
      winapi.RegGetValue("HKEY_LOCAL_MACHINE", REG_GOG_CLIENT, "client");
      return Promise.resolve(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err as string);
      log("info", "GOG client not found", { error: message });
      return Promise.resolve(false);
    }
  }

  public async scan(): Promise<IStoreGameEntry[]> {
    if (!(await this.isAvailable())) {
      return [];
    }

    try {
      let result: IStoreGameEntry[] = [];
      winapi.WithRegOpen(
        "HKEY_LOCAL_MACHINE",
        REG_GOG_GAMES,
        (hkey) => {
          const keys = winapi.RegEnumKeys(hkey);
          result = keys
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
              } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : String(err as string);
                log("error", "GOG: failed to read game entry", {
                  key: key.key,
                  error: errMsg,
                });
                return undefined;
              }
            })
            .filter((entry): entry is IStoreGameEntry => entry !== undefined);
        },
      );
      return result;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }
}
