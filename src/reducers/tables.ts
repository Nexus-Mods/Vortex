import * as actions from '../actions/tables';
import { IReducerSpec } from '../types/IExtensionContext';

import { pushSafe, removeValue, setSafe } from '../util/storeHelper';

/**
 * reducer for changes to the window state
 */
export const tableReducer: IReducerSpec = {
  reducers: {
    [actions.setAttributeVisible as any]: (state, payload) => {
      const { tableId, attributeId, visible } = payload;
      return setSafe(state, [tableId, 'attributes', attributeId, 'enabled'], visible);
    },
    [actions.setAttributeSort as any]: (state, payload) => {
      const { tableId, attributeId, direction } = payload;
      // ensure sorting for other columns is reset because we don't support sorting by multiple
      // attributes atm
      Object.keys(state[tableId]?.attributes ?? {})
        .forEach(iter => {
          state = setSafe(state, [tableId, 'attributes', iter, 'sortDirection'], 'none');
        });
      return setSafe(state, [tableId, 'attributes', attributeId, 'sortDirection'], direction);
    },
    [actions.setAttributeFilter as any]: (state, payload) => {
      const { tableId, attributeId, filter } = payload;
      return (attributeId === undefined)
        ? setSafe(state, [tableId, 'filter'], undefined)
        : (filter === null)
          ? setSafe(state, [tableId, 'filter', attributeId], undefined)
          : setSafe(state, [tableId, 'filter', attributeId], filter);
    },
    [actions.setGroupingAttribute as any]: (state, payload) =>
      setSafe(state, [payload.tableId, 'groupBy'], payload.attributeId),
    [actions.collapseGroup as any]: (state, payload) => {
      const { tableId, groupId, collapse } = payload;
      return collapse
        ? pushSafe(state, [tableId, 'collapsedGroups'], groupId)
        : removeValue(state, [tableId, 'collapsedGroups'], groupId);
    },
    [actions.setCollapsedGroups as any]: (state, payload) =>
      setSafe(state, [payload.tableId, 'collapsedGroups'], payload.groups),
  },
  defaults: {
  },
};
