import type { IExtensionApi } from "../../../types/IExtensionContext";
import { ModsDeployedEvent } from "./MixpanelEvents";
import { numericNexusGameId } from "./numericGameId";

export interface ModsDeployedInfo {
  /** Internal game id (resolved to the numeric Nexus id on the event). */
  gameId: string;
  /** Deployment activator name (hardlink, symlink, ...). */
  deploymentMethod: string;
  /** Total files written across all mod types. */
  fileCount: number;
  /** Enabled mods on the deployed profile. */
  enabledModCount: number;
  /** A user-triggered deploy rather than an automatic one. */
  manual: boolean;
  /** The deploy Vortex runs while finishing a collection install. */
  isCollectionPostprocess: boolean;
}

/** Emits mods_deployed for a successful deployment to the game directory. */
export function emitModsDeployed(api: IExtensionApi, info: ModsDeployedInfo): void {
  api.events.emit(
    "analytics-track-mixpanel-event",
    new ModsDeployedEvent({
      game_id: numericNexusGameId(info.gameId),
      deployment_method: info.deploymentMethod,
      file_count: info.fileCount,
      enabled_mod_count: info.enabledModCount,
      manual: info.manual,
      is_collection_postprocess: info.isCollectionPostprocess,
    }),
  );
}
