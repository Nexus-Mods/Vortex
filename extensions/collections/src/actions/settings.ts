import { createAction } from "redux-act";

export const setSortAdded = createAction(
  "SORT_COLLECTION_ADDED",
  (sorting: string) => ({ sorting }),
);

export const setSortWorkshop = createAction(
  "SORT_COLLECTION_WORKSHOP",
  (sorting: string) => ({ sorting }),
);
