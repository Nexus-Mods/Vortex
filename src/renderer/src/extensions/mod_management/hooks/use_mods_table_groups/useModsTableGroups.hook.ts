import type { TFunction } from "i18next";
import { useMemo, useState } from "react";

import { collectionsByMod } from "../../../collections/util/collectionsByMod";
import { makeCollectionModsResolver } from "../../../collections/util/resolveCollectionMods/resolveCollectionMods";
import type { IModWithState } from "../../types/IModProps";
import {
  groupMods,
  type IModsTableGroupingColumn,
  type ModsTableGrouping,
} from "../../util/mods_table_views/modsTableViews";

/**
 * The installed collections each mod belongs to, by mod id. The resolver is kept, so a
 * change to the mods only retests those that changed against each collection.
 */
export const useCollectionMemberships = (mods: { [id: string]: IModWithState }) => {
  const [resolveMembers] = useState(makeCollectionModsResolver);
  return useMemo(() => collectionsByMod(mods, resolveMembers), [mods, resolveMembers]);
};

/**
 * The table's groups for a grouping, or undefined for a flat list. Regroups when the
 * grouped-by column changes, not whenever any column does, as Status does on each switch.
 */
export const useModsTableGroups = (
  mods: { [id: string]: IModWithState },
  grouping: ModsTableGrouping,
  groupable: IModsTableGroupingColumn[],
  memberships: ReturnType<typeof useCollectionMemberships>,
  t: TFunction,
) => {
  const groupColumn = groupable.find((column) => column.id === grouping);

  return useMemo(
    () => groupMods(mods, grouping, t, memberships, groupColumn),
    [mods, grouping, t, memberships, groupColumn],
  );
};
