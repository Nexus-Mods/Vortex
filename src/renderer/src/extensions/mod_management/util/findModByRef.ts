import type { IMod, IModReference } from "../types/IMod";

import { log } from "../../../util/log";
import { isFuzzyVersion } from "./isFuzzyVersion";
import testModReference from "./testModReference";

export function findModByRef(
  reference: IModReference,
  mods: { [modId: string]: IMod },
  source?: { gameId: string; modId: string },
): IMod {
  if (!reference) {
    log("error", "findModByRef called with undefined reference", {
      source,
      stack: new Error().stack,
    });
    return undefined;
  }
  const fuzzy = isFuzzyVersion(reference.versionMatch);
  if (
    reference["idHint"] !== undefined &&
    testModReference(mods[reference["idHint"]], reference, source, fuzzy)
  ) {
    // fast-path if we have an id from a previous match
    return mods[reference["idHint"]];
  }

  if (
    reference.versionMatch !== undefined &&
    isFuzzyVersion(reference.versionMatch) &&
    reference.fileMD5 !== undefined &&
    (reference.logicalFileName !== undefined ||
      reference.fileExpression !== undefined)
  ) {
    reference = {
      md5Hint: reference.fileMD5,
      ...reference,
    };
    delete reference.fileMD5;
  }

  if (
    reference["md5Hint"] !== undefined &&
    reference.installerChoices === undefined &&
    reference.patches === undefined &&
    reference.fileList === undefined
  ) {
    const result = Object.keys(mods).find(
      (dlId) => mods[dlId].attributes?.fileMD5 === reference["md5Hint"],
    );
    if (result !== undefined) {
      return mods[result];
    }
  }

  return Object.values(mods).find((mod: IMod): boolean =>
    testModReference(mod, reference, source, fuzzy),
  );
}
