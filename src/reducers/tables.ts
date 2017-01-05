import * as actions from '../actions/tables';
import { IReducerSpec } from '../types/IExtensionContext';

import { mutateSafe, setSafe } from '../util/storeHelper';

import {log} from '../util/log';
import * as util from 'util';

/**
 * reducer for changes to the window state
 */
export const tableReducer: IReducerSpec = {
  reducers: {
    [actions.selectRows]: (state, payload) => {
      log('info', 'select rows', util.inspect(payload));
      const { tableId, rowIds, selected } = payload;
      let copy = Object.assign({}, state);
      rowIds.forEach((id: string) => {
        mutateSafe(copy, [tableId, 'rows', id, 'selected'], selected);
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
