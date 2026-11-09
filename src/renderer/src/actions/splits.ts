import { createAction } from "redux-act";

/** Where the user left one resizable split. */
interface ISplitPosition {
  splitId: string;
  split: number;
}

/** Remembers where the user left a split: its first pane's share, from 0 to 1. */
export const setSplit = createAction("SET_SPLIT", (position: ISplitPosition) => position);
