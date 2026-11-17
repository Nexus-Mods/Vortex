import { MOD_TYPE as COLLECTION_TYPE } from "@/extensions/collections/constants";
import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import modName from "@/extensions/mod_management/util/modName";

import {
  downloadKey,
  type IModInstallSources,
  nexusModKey,
} from "../mod_install_state/modInstallState";

/** A file the user has of a mod: an installed mod, or a download nothing is installed from. */
export type UserModFile =
  | {
      kind: "installed";
      /** The installed mod. */
      mod: IMod;
    }
  | {
      kind: "downloaded";
      /** The download's id. */
      downloadId: string;
      /** The download. */
      download: IDownload;
    };

/** What `userModFilesOf` looks through: the game's mods and downloads, or a mod's own of them. */
export type IUserModFileSources = Omit<IModInstallSources, "modState">;

/**
 * Every file the user has of the mod `key` names, Main or not, as the install button counts them:
 * its installed mods, matched by their own Nexus ids, then its finished downloads in this game
 * that no mod at all is installed from, nor installing from: one installed as a renamed or local
 * mod is still in use, so isn't offered as only downloaded. A collection isn't one.
 */
export const userModFilesOf = (
  { mods, downloads, gameId, domainOf }: IUserModFileSources,
  key: string,
): UserModFile[] => {
  const all = Object.values(mods).filter((mod) => mod.type !== COLLECTION_TYPE);
  const installed = all.filter(
    (mod) => mod.state === "installed" && nexusModKey(mod, gameId, domainOf) === key,
  );
  const installedFrom = new Set(Object.values(mods).map((mod) => mod.archiveId));

  const downloaded = Object.entries(downloads).filter(
    ([id, download]) =>
      download.state === "finished" &&
      !!download.game?.includes(gameId) &&
      downloadKey(download, domainOf) === key &&
      !installedFrom.has(id),
  );

  return [
    ...installed.map((mod): UserModFile => ({ kind: "installed", mod })),
    ...downloaded.map(
      ([downloadId, download]): UserModFile => ({ kind: "downloaded", downloadId, download }),
    ),
  ];
};

/**
 * A file's name as Vortex stored it when the user got it, never empty: an installed one's name as
 * the Mods page shows it, a download's file name, falling back to its id.
 */
export const storedNameOf = (file: UserModFile): string => {
  if (file.kind === "installed") {
    return modName(file.mod) || file.mod.id;
  }

  const { modInfo, localPath } = file.download;

  return modInfo?.nexus?.fileInfo?.name || modInfo?.name || localPath || file.downloadId;
};
