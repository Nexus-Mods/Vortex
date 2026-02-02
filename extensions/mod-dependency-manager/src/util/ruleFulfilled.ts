import { IModLookupInfo } from "../types/IModLookupInfo";

import { IReference, IRule } from "modmeta-db";
import { util } from "vortex-api";

function findReference(
  reference: IReference,
  mods: IModLookupInfo[],
  source: { gameId: string; modId: string },
): IModLookupInfo {
  if (reference["idHint"] !== undefined) {
    const refMod = mods.find((mod) => mod.id === reference["idHint"]);
    if (util.testModReference(refMod, reference)) {
      return refMod;
    }
  }
  if (reference["md5Hint"] !== undefined) {
    const refMod = mods.find((mod) => mod.fileMD5 === reference["md5Hint"]);
    if (refMod !== undefined) {
      return refMod;
    }
  }
  return mods.find((mod) =>
    (util as any).testModReference(mod, reference, source),
  );
}

function ruleFulfilled(
  enabledMods: IModLookupInfo[],
  rule: IRule,
  source: { gameId: string; modId: string },
) {
  if (rule["ignored"] === true) {
    return true;
  }

  if (rule.type === "conflicts") {
    enabledMods = enabledMods.filter((mod) => mod.id !== source.modId);
    if (findReference(rule.reference, enabledMods, source) !== undefined) {
      return false;
    } else {
      return true;
    }
  } else if (["requires", "recommends"].includes(rule.type)) {
    if (findReference(rule.reference, enabledMods, source) === undefined) {
      return rule.type === "requires" ? false : null;
    } else {
      return true;
    }
  } else {
    return null;
  }
}

export default ruleFulfilled;
