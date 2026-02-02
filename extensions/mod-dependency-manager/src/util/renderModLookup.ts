import { IModLookupInfo } from "../types/IModLookupInfo";

function renderModLookup(mod: IModLookupInfo) {
  if (mod === undefined) {
    return undefined;
  }
  const id = mod.customFileName || mod.logicalFileName || mod.name;

  const version = mod.version;
  return version !== undefined ? id + " v" + version : id;
}

export default renderModLookup;
