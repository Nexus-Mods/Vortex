import * as actions from '../actions/tables';
import { IReducerSpec } from '../types/IExtensionContext';

import { setSafe } from '../util/storeHelper';

/**
 * reducer for changes to the window state
 */
export const tableReducer: IReducerSpec = {
  reducers: {
    [actions.selectRows]: (state, payload) => {
      const { tableId, rowIds, selected } = payload;
      let copy = state;
      rowIds.forEach((id: string) => {
        copy = setSafe(copy, [tableId, 'rows', id, 'selected'], selected);
      });

      return copy;
    },
    [actions.setAttributeVisible]: (state, payload) => {
      const { tableId, attributeId, visible } = payload;
      return setSafe(state, [tableId, 'attributes', attributeId, 'enabled'], visible);
    },
    [actions.setAttributeSort]: (state, payload) => {
      const { tableId, attributeId, direction } = payload;
      return setSafe(state, [tableId, 'attributes', attributeId, 'sortDirection'], direction);
    },
  },
  defaults: {
  },
};
