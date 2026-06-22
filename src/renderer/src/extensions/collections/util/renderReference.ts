import type { IMod, IModReference } from "../../../extensions/mod_management/types/IMod";
import { findModByRef } from "../../../extensions/mod_management/util/findModByRef";
import { renderModReference } from "../../../extensions/mod_management/util/modName";

export function renderReference(ref: IModReference, mods: { [modId: string]: IMod }): string {
  const mod = findModByRef(ref, mods);
  return renderModReference(ref, mod);
}
