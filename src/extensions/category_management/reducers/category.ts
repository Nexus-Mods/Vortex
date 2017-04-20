import { IReducerSpec } from '../../../types/IExtensionContext';
import {deleteOrNop, setOrNop, setSafe} from '../../../util/storeHelper';

import * as actions from '../actions/category';

/**
 * reducer for changes to ephemeral session state
 */
export const categoryReducer: IReducerSpec = {
  reducers: {
    [actions.loadCategories as any]: (state, payload) =>
      setOrNop(state, [payload.gameId], payload.gameCategories),
    [actions.setCategory as any]: (state, payload) =>
      setSafe(state, [payload.gameId, payload.id], payload.category),
    [actions.removeCategory as any]: (state, payload) =>
      deleteOrNop(state, [payload.gameId, payload.id]),
    [actions.updateCategories as any]: (state, payload) =>
      setSafe(state, [payload.gameId], payload.gameCategories),
    [actions.renameCategory as any]: (state, payload) =>
      setOrNop(state, [payload.gameId, payload.categoryId, 'name'], payload.name),
  }, defaults: {
  },
};
