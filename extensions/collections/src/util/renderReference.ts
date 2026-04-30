import { types, util } from "vortex-api";

export function renderReference(
  ref: types.IModReference,
  mods: { [modId: string]: types.IMod },
): string {
  const mod = util.findModByRef(ref, mods);
  return util.renderModReference(ref, mod);
}
