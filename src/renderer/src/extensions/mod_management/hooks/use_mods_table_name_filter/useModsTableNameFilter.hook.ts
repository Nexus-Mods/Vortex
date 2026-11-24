import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setAttributeFilter } from "@/actions/tables";
import type { IState } from "@/types/IState";

// set by other pages to show a mod
const legacyNameFilter = (state: IState): unknown => state.settings.tables?.mods?.filter?.name;

/**
 * While the new table is shown, the legacy table's name filter becomes its search once and is
 * cleared, so the same name can be asked for again.
 */
export const useModsTableNameFilter = (
  setSearch: (search: string) => void,
  newTableShown: boolean,
): void => {
  const dispatch = useDispatch();
  const filtered = useSelector(legacyNameFilter);
  const name =
    newTableShown && typeof filtered === "string" && filtered !== "" ? filtered : undefined;
  const [applied, setApplied] = useState<string>();

  if (name !== applied) {
    setApplied(name);
    if (name !== undefined) {
      setSearch(name);
    }
  }

  useEffect(() => {
    if (name !== undefined) {
      dispatch(setAttributeFilter("mods", "name", undefined));
    }
  }, [dispatch, name]);
};
