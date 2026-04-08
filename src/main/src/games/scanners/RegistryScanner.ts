import * as path from "node:path";

import * as winapi from "winapi-bindings";

import { log } from "../../logging";

import type { IStoreGameEntry, IStoreScanner } from "../IStoreScanner";

export class RegistryScanner implements IStoreScanner {
  public readonly storeType = "registry";

  public isAvailable(): Promise<boolean> {
    return Promise.resolve(process.platform === "win32");
  }

  public scan(): Promise<IStoreGameEntry[]> {
    // Registry scanner doesn't enumerate a catalog
    return Promise.resolve([] as IStoreGameEntry[]);
  }

  /**
   * Look up a game installation path from a registry key.
   * Format: "HKEY_LOCAL_MACHINE:Software\\Path:KeyName"
   */
  public lookup(query: string): Promise<IStoreGameEntry | undefined> {
    if (process.platform !== "win32") {
      return Promise.resolve(undefined);
    }

    const parts = query.split(":", 3);
    if (parts.length !== 3) {
      return Promise.resolve(undefined);
    }

    const validHives = [
      "HKEY_CLASSES_ROOT",
      "HKEY_CURRENT_CONFIG",
      "HKEY_CURRENT_USER",
      "HKEY_LOCAL_MACHINE",
      "HKEY_USERS",
    ];
    if (!validHives.includes(parts[0])) {
      return Promise.resolve(undefined);
    }

    try {
      const result = winapi.RegGetValue(
        parts[0] as winapi.REGISTRY_HIVE,
        parts[1],
        parts[2],
      );
      if (!result || result.type !== "REG_SZ") {
        return Promise.resolve(undefined);
      }

      return Promise.resolve({
        storeId: query,
        installPath: result.value as string,
        name: path.basename(result.value as string),
      });
    } catch {
      return Promise.resolve(undefined);
    }
  }
}
