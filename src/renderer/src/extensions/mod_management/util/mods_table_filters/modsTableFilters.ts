import { MOD_TYPE as COLLECTION_TYPE } from "../../../collections/constants";
import type { IModWithState } from "../../types/IModProps";

/** A status the Mods table can be filtered to. */
export type ModsTableStatus = "enabled" | "disabled" | "uninstalled";

/** The statuses, in the Status submenu's order. */
export const MODS_TABLE_STATUSES: readonly ModsTableStatus[] = [
  "enabled",
  "disabled",
  "uninstalled",
];

/** What a view filters the mods by. */
export interface IModsTableFilters {
  /** The statuses to show; none ticked shows every mod. */
  status: ModsTableStatus[];
}

/** No filter narrowing the mods: every view's default. */
export const NO_MODS_TABLE_FILTERS: IModsTableFilters = { status: [] };

/** Which filters differ between two sets, a filter's values compared in any order. */
export const changedFilterKeys = (
  filters: IModsTableFilters,
  from: IModsTableFilters,
): Array<keyof IModsTableFilters> => {
  const same =
    filters.status.length === from.status.length &&
    filters.status.every((status) => from.status.includes(status));

  return same ? [] : ["status"];
};

/** A mod's status for the filter, or none for one installing, which no filter hides. */
const statusOf = (
  mod: IModWithState,
  isEnabled: (mod: IModWithState) => boolean,
): ModsTableStatus | undefined => {
  if (mod.state === "installing") {
    return undefined;
  }

  if (mod.state === "downloaded") {
    return "uninstalled";
  }

  return isEnabled(mod) ? "enabled" : "disabled";
};

/**
 * The mods with a ticked status, the same mods while nothing's ticked. Installing mods and
 * collections, whose groups head their members, always stay.
 */
export const filterModsByStatus = (
  mods: { [id: string]: IModWithState },
  status: readonly ModsTableStatus[],
  isEnabled: (mod: IModWithState) => boolean,
): { [id: string]: IModWithState } => {
  if (status.length === 0) {
    return mods;
  }

  return Object.fromEntries(
    Object.entries(mods).filter(([, mod]) => {
      const modStatus = statusOf(mod, isEnabled);
      return mod.type === COLLECTION_TYPE || !modStatus || status.includes(modStatus);
    }),
  );
};
