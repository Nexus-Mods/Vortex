import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "@/types/IState";

import { focusModsTableGroup } from "../../actions/session";
import type { IModGroup } from "../../util/mods_table_views/modsTableViews";

const focusedGroupId = (state: IState) => state.session.mods?.focusedGroupId;

/**
 * The new table is asked to show a group, which it opens and scrolls to, then drops. A search
 * could hide the group, so a new request clears it once. A request no group answers, as when the
 * view isn't grouped by collection, is dropped.
 *
 * `groups` are all the table's groups, not only those a search leaves.
 */
export const useModsTableFocusRequest = ({
  groups,
  search,
  setSearch,
}: {
  groups: IModGroup[] | undefined;
  search: string;
  setSearch: (search: string) => void;
}) => {
  const dispatch = useDispatch();
  const focusGroupId = useSelector(focusedGroupId);
  const onGroupFocused = useCallback(() => dispatch(focusModsTableGroup(undefined)), [dispatch]);
  const [searchClearedFor, setSearchClearedFor] = useState<string>();

  if (focusGroupId !== searchClearedFor) {
    setSearchClearedFor(focusGroupId);
    if (focusGroupId && search !== "") {
      setSearch("");
    }
  }

  useEffect(() => {
    if (focusGroupId && !groups?.some((group) => group.id === focusGroupId)) {
      onGroupFocused();
    }
  }, [focusGroupId, groups, onGroupFocused]);

  return { focusGroupId, onGroupFocused };
};
