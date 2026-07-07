import { log } from "../../../logging";
import type { IMod, IModInstallSpec, IModReference } from "../types/IMod";
import { isFuzzyVersion } from "./isFuzzyVersion";
import testModReference, { modMatchesInstallSpec } from "./testModReference";

export function findModByRef(
  reference: IModReference,
  mods: { [modId: string]: IMod },
  source?: { gameId: string; modId: string },
  installSpec?: IModInstallSpec,
): IMod {
  if (!reference) {
    log("error", "findModByRef called with undefined reference", {
      source,
      stack: new Error().stack,
    });
    return undefined;
  }
  const fuzzy = isFuzzyVersion(reference.versionMatch);

  // When an install spec is given, a candidate must also have been installed with that
  // spec (installer choices / file list / patches). Checked per candidate because
  // several variants of the same mod can be installed at once, and only one (if any) is
  // the requested one.
  const specMatches = (mod: IMod): boolean =>
    installSpec == null || modMatchesInstallSpec(mod, installSpec);

  // A candidate matches the reference by identity and by install spec.
  const matches = (mod: IMod): boolean =>
    mod != null && testModReference(mod, reference, source, fuzzy) && specMatches(mod);

  if (reference["idHint"] !== undefined && matches(mods[reference["idHint"]])) {
    // fast-path if we have an id from a previous match
    return mods[reference["idHint"]];
  }

  if (
    reference.versionMatch !== undefined &&
    isFuzzyVersion(reference.versionMatch) &&
    reference.fileMD5 !== undefined &&
    (reference.logicalFileName !== undefined || reference.fileExpression !== undefined)
  ) {
    reference = {
      md5Hint: reference.fileMD5,
      ...reference,
    };
    delete reference.fileMD5;
  }

  if (reference["md5Hint"] !== undefined) {
    const result = Object.keys(mods).find(
      (dlId) => mods[dlId].attributes?.fileMD5 === reference["md5Hint"] && specMatches(mods[dlId]),
    );
    if (result !== undefined) {
      return mods[result];
    }
  }

  return Object.values(mods).find((mod: IMod): boolean => matches(mod));
}
