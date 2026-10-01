import { setdefault } from "../../../util/util";
import type { IMod } from "../../mod_management/types/IMod";
import { findModByRef } from "../../mod_management/util/findModByRef";
import { MOD_TYPE } from "../constants";

/** The installed collections each mod belongs to, by mod id, from the collections' rules. */
export function collectionsByMod(mods: { [modId: string]: IMod }): {
  [modId: string]: IMod[];
} {
  const collections = Object.values(mods).filter((mod) => mod.type === MOD_TYPE);

  const result: { [modId: string]: IMod[] } = {};

  collections.forEach((coll) =>
    (coll.rules ?? []).forEach((rule) => {
      if (rule.reference.id !== undefined) {
        setdefault(result, rule.reference.id, []).push(coll);
      } else {
        const installed = findModByRef(rule.reference, mods);
        if (installed !== undefined) {
          setdefault(result, installed.id, []).push(coll);
        }
      }
    }),
  );

  return result;
}
