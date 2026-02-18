import { truthy } from "../../../renderer/util/util";
import type { IMod, IReference } from "../types/IMod";
import { sanitizeExpression, coerceToSemver } from "./testModReference";

export function makeModReference(mod: IMod): IReference {
  if (
    !truthy(mod.attributes["fileMD5"]) &&
    !truthy(mod.attributes["logicalFileName"]) &&
    !truthy(mod.attributes["fileName"])
  ) {
    // if none of the usual markers are available, use just the mod name
    return {
      fileExpression: mod.attributes["name"],
    };
  }

  const fileName = mod.attributes["fileName"];

  return {
    fileExpression:
      fileName !== undefined ? sanitizeExpression(fileName) : undefined,
    fileMD5: mod.attributes["fileMD5"],
    versionMatch:
      coerceToSemver(mod.attributes["version"]) ?? mod.attributes["version"],
    logicalFileName: mod.attributes["logicalFileName"],
  };
}
