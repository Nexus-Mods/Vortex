import { useDispatch, useSelector } from "react-redux";

import { setSplit } from "@/actions/splits";
import type { IState } from "@/types/IState";

/**
 * A `ResizableSplit`'s split, kept in settings under its id so it's where the user left it on
 * their next visit; `defaultSplit` until they move it.
 */
export const useSavedSplit = (splitId: string, defaultSplit = 0.5) => {
  const dispatch = useDispatch();
  const split = useSelector((state: IState) => state.settings.splits?.[splitId]) ?? defaultSplit;

  const saveSplit = (next: number) => {
    dispatch(setSplit({ splitId, split: next }));
  };

  return [split, saveSplit] as const;
};
