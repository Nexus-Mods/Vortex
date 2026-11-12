import { GameDomain, type VortexGameId } from "@vortex/shared";
import { VortexError, type VortexErrorKind } from "@vortex/shared/errors";
import type { TFunction } from "i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import {
  downloadAndInstallNexusFile,
  downloadNexusFile,
} from "@/extensions/nexus_integration/util/download_and_install/downloadAndInstall";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

/** Error kinds that mean the download was cancelled, which isn't reported. */
const CANCELED_KINDS: VortexErrorKind[] = ["user-canceled", "process-canceled"];

/** Whether the user has mods installed once they're downloaded, as their settings say. */
export const installsWhenDownloaded = (state: IState) => state.settings.automation.install;

/** Which file of which mod to download, and whether to install it. */
interface IInstallNexusFileArgs {
  /** The mod the file is of. */
  mod: ModSummary;
  /** The file's game-scoped id. */
  fileId: string;
  /** The game it's downloaded for. */
  gameId: VortexGameId;
  /** Whether to install it once downloaded, as the user's settings say. */
  shouldInstall: boolean;
}

/** Downloads a file of a mod, and installs it too when `shouldInstall`. */
export const installNexusFile = (
  api: IExtensionApi,
  { mod, fileId, gameId, shouldInstall }: IInstallNexusFileArgs,
) => {
  const nexusFile = {
    gameDomain: GameDomain(mod.game.domain_name),
    gameId,
    modId: mod.game_scoped_id,
    fileId,
    name: mod.name,
  };

  return shouldInstall
    ? downloadAndInstallNexusFile(api, nexusFile)
    : downloadNexusFile(api, nexusFile);
};

/** A failed download or install to tell the user about. */
interface IReportInstallFailureArgs {
  /** Translates the title. */
  t: TFunction;
  /** The mod it was of. */
  mod: ModSummary;
  /** Whether it was installing, rather than only downloading. */
  shouldInstall: boolean;
  /** What went wrong. */
  error: unknown;
}

/** Tells the user a download or install failed, unless they cancelled it. */
export const reportInstallFailure = (
  api: IExtensionApi,
  { t, mod, shouldInstall, error }: IReportInstallFailureArgs,
) => {
  if (error instanceof VortexError && CANCELED_KINDS.includes(error.data.kind)) {
    return;
  }

  const title = shouldInstall
    ? t("Failed to install {{name}}", { name: mod.name })
    : t("Failed to download {{name}}", { name: mod.name });

  api.showErrorNotification(title, error, { allowReport: false });
};
