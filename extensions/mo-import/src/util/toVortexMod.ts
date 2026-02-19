import { IModEntry } from "../types/moEntries";

import { types } from "vortex-api";

function toVortexMod(
  input: IModEntry,
  md5Hash: string,
  archiveId: string,
): types.IMod {
  const attributes: { [id: string]: any } = {
    name: input.modName,
    installTime: new Date(),
    version: input.modVersion,
    fileId: input.downloadId,
    notes: "Imported from MO",
    category: input.categoryId,
  };

  if (md5Hash) {
    attributes.fileMD5 = md5Hash;
  }

  const mod: types.IMod = {
    id: input.vortexId,
    state: "installed",
    type: "",
    installationPath: input.vortexId,
    archiveId,
    attributes,
  };
  if (input.nexusId) {
    mod.attributes.source = "nexus";
    mod.attributes.modId = input.nexusId;
  }
  return mod;
}

export default toVortexMod;
