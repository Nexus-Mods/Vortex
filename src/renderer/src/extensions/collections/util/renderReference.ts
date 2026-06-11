import type * as types from "../../../types/api";
import * as util from "../../../util/api";

export function renderReference(
  ref: types.IModReference,
  mods: { [modId: string]: types.IMod },
): string {
  const mod = util.findModByRef(ref, mods);
  return util.renderModReference(ref, mod);
}
