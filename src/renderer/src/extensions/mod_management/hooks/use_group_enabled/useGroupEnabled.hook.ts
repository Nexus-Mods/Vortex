import { useCallback, useState } from "react";

import type { IMod } from "../../types/IMod";
import {
  type IModGroup,
  type IModRow,
  type ISharedMods,
  sharedMods,
} from "../../util/mods_table_views/modsTableViews";

/** A group being disabled, while the user decides about the mods it shares. */
interface IPendingDisable {
  /** The group being turned off. */
  group: IModGroup;
  /** Its mods other collections have too, and those collections' names. */
  shared: ISharedMods;
}

const modIds = (rows: IModRow[]) => rows.map(({ mod }) => mod.id);

/** A group's mods, and its collection's own, which no row switches. */
const groupModIds = ({ collection, rows }: IModGroup) =>
  collection ? [collection.id, ...modIds(rows)] : modIds(rows);

/**
 * Enables or disables a group's mods from its switch. Turning one off waits, as `pending`,
 * while other collections share some of its mods, for the user to disable them all or keep
 * the shared ones.
 */
export const useGroupEnabled = (
  memberships: { [modId: string]: IMod[] },
  setEnabled: (modIds: string[], enabled: boolean) => void,
) => {
  const [pending, setPending] = useState<IPendingDisable>();

  const setGroupEnabled = useCallback(
    (group: IModGroup, enabled: boolean) => {
      const shared = sharedMods(group, memberships);

      if (enabled || shared.rows.length === 0) {
        setEnabled(groupModIds(group), enabled);
        return;
      }

      setPending({ group, shared });
    },
    [memberships, setEnabled],
  );

  const disablePending = (keepShared: boolean) => {
    if (!pending) {
      return;
    }

    const keep = new Set(keepShared ? modIds(pending.shared.rows) : []);
    setEnabled(
      groupModIds(pending.group).filter((id) => !keep.has(id)),
      false,
    );
    setPending(undefined);
  };

  const cancelPending = () => setPending(undefined);

  return { setGroupEnabled, pending, disablePending, cancelPending };
};
