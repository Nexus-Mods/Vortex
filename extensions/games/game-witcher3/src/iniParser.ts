/* eslint-disable */
import { rename } from "node:fs/promises";
import path from "path";

import { fs, selectors, types, util } from "@nexusmods/vortex-api";
import IniParser, { IniFile, WinapiFormat } from "vortex-parse-ini";

import { GAME_ID, ResourceInaccessibleError, getLoadOrderFilePath } from "./common";
import { assignPriorities, ModSettingsEntry } from "./modSettingsPriority";
import { forceRefresh, isLockedEntry, getAllMods, getManuallyAddedMods } from "./util";

export default class IniStructure {
  private static instance: IniStructure = null;
  public static getInstance(api?: types.IExtensionApi): IniStructure {
    if (!IniStructure.instance) {
      if (api === undefined) {
        throw new Error("IniStructure is not context aware");
      }
      IniStructure.instance = new IniStructure(api);
    }

    return IniStructure.instance;
  }
  private mIniStruct = {};
  private mApi: types.IExtensionApi;
  private mRevertedByPurge = false;
  constructor(api: types.IExtensionApi) {
    this.mIniStruct = {};
    this.mApi = api;
  }

  /** mods.settings holds only what a purge left behind, not the profile's load order. */
  public get revertedByPurge(): boolean {
    return this.mRevertedByPurge;
  }

  public async getIniStructure() {
    return this.mIniStruct;
  }

  public async setINIStruct(loadOrder: types.LoadOrder) {
    const modMap = await getAllMods(this.mApi);
    const mods: ModSettingsEntry[] = [...modMap.merged, ...modMap.managed, ...modMap.manual];
    const manualLocked = modMap.manual.filter(isLockedEntry);
    const managedLocked = modMap.managed
      .filter((entry) => isLockedEntry(entry.name))
      .map((entry) => entry.name);
    const totalLocked: string[] = [...modMap.merged, ...manualLocked, ...managedLocked];

    const order = loadOrder ?? [];
    const enabledByName = new Map(order.map((entry) => [entry.id, entry.enabled]));
    const assigned = assignPriorities({
      mods,
      locked: totalLocked,
      loadOrderIds: order.map((entry) => entry.id),
    });

    const struct: Record<string, { Enabled: number; Priority: number; VK: string }> = {};
    for (const entry of assigned) {
      struct[entry.name] = {
        // The INI file's enabled attribute expects 1 or 0
        Enabled: enabledByName.get(entry.name) === false ? 0 : 1,
        Priority: entry.priority,
        VK: entry.key,
      };
    }
    this.mIniStruct = struct;
    await this.writeToModSettings();
    this.mRevertedByPurge = false;
  }

  public async revertLOFile() {
    const state = this.mApi.getState();
    const profile = selectors.activeProfile(state);
    if (!!profile && profile.gameId === GAME_ID) {
      this.mRevertedByPurge = true;
      const manuallyAdded = await getManuallyAddedMods(this.mApi);
      if (manuallyAdded.length > 0) {
        const newStruct = {};
        manuallyAdded.forEach((mod, idx) => {
          newStruct[mod] = {
            Enabled: 1,
            Priority: idx + 1,
          };
        });

        this.mIniStruct = newStruct;
        await this.writeToModSettings()
          .then(() => {
            forceRefresh(this.mApi);
            return Promise.resolve();
          })
          .catch((err) => this.modSettingsErrorHandler(err, "Failed to cleanup load order file"));
      } else {
        const filePath = getLoadOrderFilePath();
        await fs
          .removeAsync(filePath)
          .catch((err) =>
            err.code !== "ENOENT"
              ? this.mApi.showErrorNotification("Failed to cleanup load order file", err)
              : null,
          );
        forceRefresh(this.mApi);
        return Promise.resolve();
      }
    }
  }

  public async ensureModSettings() {
    const filePath = getLoadOrderFilePath();
    const parser = new IniParser(new WinapiFormat());
    return fs
      .statAsync(filePath)
      .then(() => parser.read(filePath))
      .catch((err) =>
        err.code === "ENOENT"
          ? this.createModSettings().then(() => parser.read(filePath))
          : Promise.reject(err),
      );
  }

  private async createModSettings() {
    const filePath = getLoadOrderFilePath();
    // Theoretically the Witcher 3 documents path should be
    //  created at this point (either by us or the game) but
    //  just in case it got removed somehow, we re-instate it
    //  yet again... https://github.com/Nexus-Mods/Vortex/issues/7058
    return fs
      .ensureDirWritableAsync(path.dirname(filePath))
      .then(() => fs.writeFileAsync(filePath, "", { encoding: "utf8" }));
  }

  public modSettingsErrorHandler(err: any, errMessage: string) {
    let allowReport = true;
    const userCanceled = err instanceof util.UserCanceled;
    if (userCanceled) {
      allowReport = false;
    }
    const busyResource = err instanceof ResourceInaccessibleError;
    if (allowReport && busyResource) {
      allowReport = err.allowReport;
      err.message = err.errorMessage;
    }

    this.mApi.showErrorNotification(errMessage, err, { allowReport });
    return;
  }

  public async readStructure(): Promise<{ [key: string]: any }> {
    const state = this.mApi.getState();
    const activeProfile = selectors.activeProfile(state);
    if (activeProfile?.id === undefined) {
      return Promise.resolve(null);
    }

    const filePath = getLoadOrderFilePath();
    const parser = new IniParser(new WinapiFormat());
    const ini = await parser.read(filePath);
    const data = Object.entries(ini.data).reduce((accum, [key, value]) => {
      if (key.toLowerCase().startsWith("dlc")) {
        return accum;
      }
      accum[key] = value;
      return accum;
    }, {});
    return Promise.resolve(data);
  }

  public async writeToModSettings(): Promise<void> {
    const filePath = getLoadOrderFilePath();
    // Built beside the real file and moved over it, so a concurrent read never
    // sees it empty or half written.
    const tempPath = `${filePath}.vortex_tmp`;
    const parser = new IniParser(new WinapiFormat());
    try {
      await fs.ensureDirWritableAsync(path.dirname(filePath));
      await fs.writeFileAsync(tempPath, "", { encoding: "utf8" });
      const ini = await parser.read(tempPath);
      const struct = Object.keys(this.mIniStruct).sort(
        (a, b) => this.mIniStruct[a].Priority - this.mIniStruct[b].Priority,
      );
      for (const key of struct) {
        if (this.mIniStruct?.[key]?.Enabled === undefined) {
          // It's possible for the user to run multiple operations at once,
          //  causing the static ini structure to be modified
          //  elsewhere while we're attempting to write to file. The user must've been
          //  modifying the load order while deploying. This should
          //  make sure we don't attempt to write any invalid mod entries.
          //  https://github.com/Nexus-Mods/Vortex/issues/8437
          continue;
        }

        ini.data[key] = {
          Enabled: this.mIniStruct[key].Enabled,
          Priority: this.mIniStruct[key].Priority,
          VK: this.mIniStruct[key].VK,
        };
      }
      await parser.write(tempPath, ini);
      await rename(tempPath, filePath);
      return Promise.resolve();
    } catch (err) {
      return err.path !== undefined && ["EPERM", "EBUSY"].includes(err.code)
        ? Promise.reject(new ResourceInaccessibleError(err.path))
        : Promise.reject(err);
    }
  }
}
