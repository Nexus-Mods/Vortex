/**
 * Download helpers for retrieving the SMAPI archive from Nexus.
 */
import type { IFileInfo } from "@nexusmods/nexus-api";
import type { types } from "vortex-api";

import { util } from "vortex-api";

import { GAME_ID, SMAPI_MOD_ID } from "../common";

/**
 * Downloads the latest SMAPI main archive into Vortex downloads.
 *
 * @param api Vortex extension API (`types.IExtensionApi`) used for Nexus auth
 * and download events.
 * @returns Download id (`string`) emitted by Vortex.
 * @throws util.ProcessCanceled if Nexus APIs are unavailable or no main file
 * can be resolved.
 */
export async function downloadSMAPI(api: types.IExtensionApi): Promise<string> {
  if (api.ext?.ensureLoggedIn !== undefined) {
    await api.ext.ensureLoggedIn();
  }

  const file = await findSMAPIMainFile(api);
  const dlInfo = {
    game: GAME_ID,
    name: "SMAPI",
  };

  const nxmUrl = `nxm://${GAME_ID}/mods/${SMAPI_MOD_ID}/files/${file.file_id}`;
  return util.toPromise<string>((cb) =>
    api.events.emit(
      "start-download",
      [nxmUrl],
      dlInfo,
      undefined,
      cb,
      undefined,
      { allowInstall: false },
    ),
  );
}

async function findSMAPIMainFile(api: types.IExtensionApi): Promise<IFileInfo> {
  if (api.ext?.nexusGetModFiles === undefined) {
    throw new util.ProcessCanceled("Nexus API unavailable");
  }
  const modFiles = await api.ext.nexusGetModFiles(GAME_ID, SMAPI_MOD_ID);

  const fileTime = (input: IFileInfo) =>
    Number.parseInt(String(input.uploaded_time ?? 0), 10);

  const file = modFiles
    .filter((modFile) => modFile.category_id === 1)
    .sort((lhs, rhs) => fileTime(lhs) - fileTime(rhs))[0];

  if (file === undefined) {
    throw new util.ProcessCanceled("No SMAPI main file found");
  }

  return file;
}
