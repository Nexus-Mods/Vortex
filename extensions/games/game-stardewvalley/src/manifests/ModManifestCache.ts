/**
 * Caches parsed manifests for currently active Stardew Valley mods.
 */
import { ResolvedPath } from "@vortex/paths";
import type { ISDVModManifest } from "../types";
import { log, selectors, util } from "vortex-api";
import type { types } from "vortex-api";
import { GAME_ID, MOD_MANIFEST } from "../common";
import { selectSdvMods } from "../state/selectors";
import { getModManifests } from "./getModManifests";
import { parseManifest } from "./parseManifest";

/**
 * Caches parsed manifests for currently active/installed Stardew mods.
 *
 * Used by health checks to detect whether the installed SMAPI version satisfies
 * minimum API requirements declared by mods.
 */
export default class ModManifestCache {
  private mApi: types.IExtensionApi;
  private mManifests: ManifestMap | undefined;
  private mLoading: boolean = false;

  constructor(api: types.IExtensionApi) {
    this.mApi = api;
  }

  public async getManifests(): Promise<ManifestMap> {
    await this.scanManifests();
    return this.mManifests ?? {};
  }

  public async refresh(): Promise<void> {
    if (this.mLoading) {
      return;
    }
    this.mLoading = true;
    await this.scanManifests(true);
    this.mLoading = false;
  }

  public async scanManifests(force?: boolean): Promise<void> {
    if (!force && this.mManifests !== undefined) {
      return;
    }
    const state = this.mApi.getState();
    const staging = selectors.installPathForGame(state, GAME_ID);
    const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
    const profile = selectors.profileById(state, profileId);
    const isInstalled = (mod: types.IMod) => mod?.state === "installed";
    const isActive = (modId: string) =>
      util.getSafe(profile, ["modState", modId, "enabled"], false);
    const mods: { [modId: string]: types.IMod } = selectSdvMods(state);
    const manifests: ManifestMap = {};

    for (const iter of Object.values(mods)) {
      if (!isInstalled(iter) || !isActive(iter.id)) {
        continue;
      }

      const modPath = ResolvedPath.join(
        ResolvedPath.make(staging),
        iter.installationPath,
      );
      const manifestFiles = await getModManifests(modPath);

      for (const manifestFile of manifestFiles) {
        if (
          !ResolvedPath.basenameEqualsIgnoreCase(
            ResolvedPath.make(manifestFile),
            MOD_MANIFEST,
          )
        ) {
          continue;
        }

        let manifest: ISDVModManifest;
        try {
          manifest = await parseManifest(manifestFile);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log("error", "failed to parse manifest", {
            error: message,
            manifest: manifestFile,
          });
          continue;
        }

        const list = manifests[iter.id] ?? [];
        list.push(manifest);
        manifests[iter.id] = list;
      }
    }

    this.mManifests = manifests;
  }
}

type ManifestMap = { [modId: string]: ISDVModManifest[] };
