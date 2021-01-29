import { addReducer, IReducerSpec } from '../../types/IExtensionContext';
import { IOverlaysState } from '../../types/IState';
import { deleteOrNop, pushSafe, removeValue, setSafe } from '../../util/storeHelper';
import * as actions from './actions';

const sessionReducer: IReducerSpec<IOverlaysState> = {
  reducers: {
    ...addReducer(actions.showOverlay, (state, payload) =>
      setSafe(state, ['overlays', payload.id], { title: payload.title, text: payload.instructions })),
    ...addReducer(actions.dismissOverlay, (state, payload) =>
      deleteOrNop(state, ['overlays', payload])),
  },
  defaults: {
      overlays: {},
  },
};

export default sessionReducer;

