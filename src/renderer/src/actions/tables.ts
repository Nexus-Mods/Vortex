import { createAction } from "redux-act";

import type { SortDirection } from "../types/SortDirection";

export const setAttributeVisible = createAction(
  "SET_ATTRIBUTE_VISIBLE",
  (tableId: string, attributeId: string, visible: boolean) => ({
    tableId,
    attributeId,
    visible,
  }),
);

export const setAttributeSort = createAction(
  "SET_ATTRIBUTE_SORT",
  (tableId: string, attributeId: string, direction: SortDirection) => ({
    tableId,
    attributeId,
    direction,
  }),
);

export const setAttributeFilter = createAction(
  "SET_ATTRIBUTE_FILTER",
  (tableId: string, attributeId: string, filter: unknown) => ({
    tableId,
    attributeId,
    filter,
  }),
);

export const setGroupingAttribute = createAction(
  "SET_GROUPING_ATTRIBUTE",
  (tableId: string, attributeId: string) => ({ tableId, attributeId }),
);

export const collapseGroup = createAction(
  "COLLAPSE_GROUP",
  (tableId: string, groupId: string, collapse: boolean) => ({
    tableId,
    groupId,
    collapse,
  }),
);

export const setCollapsedGroups = createAction(
  "SET_COLLAPSED_GROUPS",
  (tableId: string, groups: string[]) => ({ tableId, groups }),
);
