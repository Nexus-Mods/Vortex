import * as actions from '../actions/tables';
import { IReducerSpec } from '../types/IExtensionContext';

import { deleteOrNop, setSafe } from '../util/storeHelper';

/**
 * reducer for changes to the window state
 */
export const tableReducer: IReducerSpec = {
  reducers: {
    [actions.selectRows as any]: (state, payload) => {
      const { tableId, rowIds, selected } = payload;
      let copy = state;
      if (!selected) {
        rowIds.forEach((id: string) => {
          // TODO: this only works as long as selected is the only row-state we save
          copy = deleteOrNop(copy, [tableId, 'rows', id]);
        });
      } else {
        rowIds.forEach((id: string) => {
          copy = setSafe(copy, [tableId, 'rows', id, 'selected'], selected);
        });
      }

      return copy;
    },
    [actions.setAttributeVisible as any]: (state, payload) => {
      const { tableId, attributeId, visible } = payload;
      return setSafe(state, [tableId, 'attributes', attributeId, 'enabled'], visible);
    },
    [actions.setAttributeSort as any]: (state, payload) => {
      const { tableId, attributeId, direction } = payload;
      return setSafe(state, [tableId, 'attributes', attributeId, 'sortDirection'], direction);
    },
    [actions.setAttributeFilter as any]: (state, payload) => {
      const { tableId, attributeId, filter } = payload;
      if (attributeId === undefined) {
        return setSafe(state, [tableId, 'filter'], undefined);
      } else {
        return setSafe(state, [tableId, 'filter', attributeId], filter);
      }
    },
    [actions.setSplitPos as any]: (state, payload) =>
      setSafe(state, [payload.tableId, 'splitPos'], payload.pos),
  },
  defaults: {
  },
};
