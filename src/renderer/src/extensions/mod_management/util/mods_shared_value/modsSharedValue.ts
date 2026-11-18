import type { IMod } from "../../types/IMod";

/** What the selected mods have for a field: their one value, or that they differ. */
export interface IModsSharedValue {
  /** The value they share; "" while they differ. */
  value: string;
  /** Whether they differ, which a field shows as "Various". */
  isVarious: boolean;
}

/** The value every one of the mods has for a field, or that they differ, as `read` reads it. */
export const modsSharedValue = <M extends IMod>(
  mods: M[],
  read: (mod: M) => string,
): IModsSharedValue => {
  const values = new Set(mods.map(read));
  return values.size === 1
    ? { value: [...values][0], isVarious: false }
    : { value: "", isVarious: true };
};
