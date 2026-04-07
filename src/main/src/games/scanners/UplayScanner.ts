import * as winapi from "winapi-bindings";

import { log } from "../../logging";

import type { IStoreGameEntry, IStoreScanner } from "../IStoreScanner";

const REG_UPLAY_LAUNCHER = "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher";
const REG_UPLAY_INSTALLS =
  "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs";
const REG_UPLAY_NAME_LOCATION =
  "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Uplay Install ";

export class UplayScanner implements IStoreScanner {
  public readonly storeType = "uplay";

  public isAvailable(): Promise<boolean> {
    if (process.platform !== "win32") {
      return Promise.resolve(false);
    }

    try {
      winapi.RegGetValue("HKEY_LOCAL_MACHINE", REG_UPLAY_LAUNCHER, "InstallDir");
      return Promise.resolve(true);
    } catch (err: unknown) {
      log("info", "Uplay launcher not found", { error: err instanceof Error ? err.message : String(err as string) });
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
        REG_UPLAY_INSTALLS,
        (hkey) => {
          let keys: ReturnType<typeof winapi.RegEnumKeys>;
          try {
            keys = winapi.RegEnumKeys(hkey);
          } catch (err: unknown) {
            log("error", "Uplay: registry enumeration failed", {
              error: err instanceof Error ? err.message : String(err as string),
            });
            return;
          }

          result = keys
            .map((key): IStoreGameEntry | undefined => {
              try {
                const installPath = winapi.RegGetValue(
                  hkey,
                  key.key,
                  "InstallDir",
                ).value as string;

                let name: string | undefined;
                try {
                  name = winapi.RegGetValue(
                    "HKEY_LOCAL_MACHINE",
                    REG_UPLAY_NAME_LOCATION + key.key,
                    "DisplayName",
                  ).value as string;
                } catch {
                  // Name is stored elsewhere and may not always be available.
                }

                return {
                  storeId: key.key,
                  installPath,
                  name,
                };
              } catch (err: unknown) {
                log("info", "Uplay: failed to read game entry", {
                  key: key.key,
                  error: err instanceof Error ? err.message : String(err as string),
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
