import type { GameDomain, VortexGameId } from "@vortex/shared";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { buildNXMModUrl } from "../../NXMUrl";

/** A file of a mod on Nexus Mods to download and install. */
export interface INexusFile {
  /** The game's Nexus Mods domain, which the `nxm` link names. */
  gameDomain: GameDomain;
  /** The game's id in Vortex, which the download is kept and installed under. */
  gameId: VortexGameId;
  /** The mod's game-scoped id. */
  modId: string;
  /** The file's game-scoped id. */
  fileId: string;
  /** What the download is called until its own name is known. */
  name?: string;
}

/**
 * Downloads a Nexus Mods file through its `nxm` link, without installing it, resolving to the
 * download's id. Rejects with the download's error, `UserCanceled` and `ProcessCanceled` included,
 * for the caller to report as it sees fit.
 */
export const downloadNexusFile = (
  api: IExtensionApi,
  { gameDomain, gameId, modId, fileId, name }: INexusFile,
): Promise<string> =>
  new Promise<string>((resolve, reject) =>
    api.events.emit<"start-download">(
      "start-download",
      [buildNXMModUrl(gameDomain, modId, fileId)],
      { game: gameId, name, fileId: Number(fileId), modId: Number(modId) },
      undefined,
      (err, id) => {
        if (err !== null || !id) {
          reject(err ?? new Error("download did not report an id"));
          return;
        }

        resolve(id);
      },
      undefined,
      { allowInstall: false },
    ),
  );

/**
 * Downloads a Nexus Mods file and installs it, enabled if the user has mods enabled once
 * installed, resolving to the installed mod's id. Rejects with the download's or the install's
 * error, `UserCanceled` and `ProcessCanceled` included, for the caller to report as it sees fit.
 */
export const downloadAndInstallNexusFile = async (
  api: IExtensionApi,
  file: INexusFile,
): Promise<string> => {
  const downloadId = await downloadNexusFile(api, file);

  return new Promise<string>((resolve, reject) =>
    api.events.emit<"start-install-download">(
      "start-install-download",
      downloadId,
      { allowAutoEnable: true },
      (err, installedId) => {
        if (err !== null || !installedId) {
          reject(err ?? new Error("install did not report a mod id"));
          return;
        }

        resolve(installedId);
      },
    ),
  );
};
