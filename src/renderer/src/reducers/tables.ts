import * as actions from "../actions/tables";
import type { SortDirection } from "../types/SortDirection";
import { actionsToReducerSpec } from "./builder";

interface TableAttributeState {
  enabled: boolean;
  sortDirection?: SortDirection;
}

interface TableState {
  attributes: Record<string, TableAttributeState>;
  filter?: Record<string, unknown>;
  groupBy?: string;
  collapsedGroups?: string[];
}

const defaultTableState: TableState = { attributes: {} };

const defaultState: Record<string, TableState> = {};

export const tableReducer = actionsToReducerSpec(defaultState, actions, {
  setAttributeVisible: (state, payload) => {
    const { tableId, attributeId, visible } = payload;
    const table = state[tableId] ?? defaultTableState;
    return {
      ...state,
      [tableId]: {
        ...table,
        attributes: {
          ...table.attributes,
          [attributeId]: { ...table.attributes[attributeId], enabled: visible },
        },
      },
    };
  },
  setAttributeFilter: (state, payload) => {
    const { tableId, attributeId, filter } = payload;
    const table = state[tableId] ?? defaultTableState;
    if (attributeId === undefined) {
      return { ...state, [tableId]: { ...table, filter: undefined } };
    }
    return {
      ...state,
      [tableId]: {
        ...table,
        filter: { ...table.filter, [attributeId]: filter === null ? undefined : filter },
      },
    };
  },
  setAttributeSort: (state, payload) => {
    const { tableId, attributeId, direction } = payload;
    const table = state[tableId] ?? defaultTableState;
    // ensure sorting for other columns is reset because we don't support sorting by multiple
    // attributes atm
    const attributes: Record<string, TableAttributeState> = Object.fromEntries(
      Object.entries(table.attributes).map(([iter, attribute]): [string, TableAttributeState] => [
        iter,
        { ...attribute, sortDirection: "none" },
      ]),
    );
    return {
      ...state,
      [tableId]: {
        ...table,
        attributes: {
          ...attributes,
          [attributeId]: { ...attributes[attributeId], sortDirection: direction },
        },
      },
    };
  },
  setGroupingAttribute: (state, payload) => {
    const { tableId, attributeId } = payload;
    const table = state[tableId] ?? defaultTableState;
    return { ...state, [tableId]: { ...table, groupBy: attributeId } };
  },
  setCollapsedGroups: (state, payload) => {
    const { tableId, groups } = payload;
    const table = state[tableId] ?? defaultTableState;
    return { ...state, [tableId]: { ...table, collapsedGroups: groups } };
  },
  collapseGroup: (state, payload) => {
    const { tableId, groupId, collapse } = payload;
    const table = state[tableId] ?? defaultTableState;
    const collapsedGroups = table.collapsedGroups ?? [];
    return {
      ...state,
      [tableId]: {
        ...table,
        collapsedGroups: collapse
          ? collapsedGroups.includes(groupId)
            ? collapsedGroups
            : [...collapsedGroups, groupId]
          : collapsedGroups.filter((id) => id !== groupId),
      },
    };
  },
});
