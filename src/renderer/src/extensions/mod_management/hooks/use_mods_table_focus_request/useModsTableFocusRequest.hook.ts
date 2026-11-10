import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "@/types/IState";

import { focusModsTableGroup, focusModsTableMod } from "../../actions/session";
import type { IModGroup, IModRow } from "../../util/mods_table_views/modsTableViews";

const focusedGroupId = (state: IState) => state.session.mods?.focusedGroupId;

const focusedModId = (state: IState) => state.session.mods?.focusedModId;

/**
 * The new table is asked to show a group, which it opens and scrolls to, or a mod, which it
 * scrolls to and selects, then drops the request. A search could hide either, so a new request
 * clears it once. A request nothing answers, as when the view isn't grouped by collection or the
 * mod isn't in the table, is dropped.
 *
 * `groups` and `rows` are all the table's, not only those a search leaves.
 */
export const useModsTableFocusRequest = ({
  groups,
  rows,
  search,
  setSearch,
}: {
  groups: IModGroup[] | undefined;
  rows: IModRow[];
  search: string;
  setSearch: (search: string) => void;
}) => {
  const dispatch = useDispatch();
  const focusGroupId = useSelector(focusedGroupId);
  const focusModId = useSelector(focusedModId);
  const onGroupFocused = useCallback(() => dispatch(focusModsTableGroup(undefined)), [dispatch]);
  const onModFocused = useCallback(() => dispatch(focusModsTableMod(undefined)), [dispatch]);
  const request = focusGroupId ?? focusModId;
  const [searchClearedFor, setSearchClearedFor] = useState<string>();

  if (request !== searchClearedFor) {
    setSearchClearedFor(request);
    if (request && search !== "") {
      setSearch("");
    }
  }

  useEffect(() => {
    if (focusGroupId && !groups?.some((group) => group.id === focusGroupId)) {
      onGroupFocused();
    }
  }, [focusGroupId, groups, onGroupFocused]);

  useEffect(() => {
    if (focusModId && !rows.some((row) => row.mod.id === focusModId)) {
      onModFocused();
    }
  }, [focusModId, rows, onModFocused]);

  return { focusGroupId, onGroupFocused, focusModId, onModFocused };
};
