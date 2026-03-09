import { setPrefixOffset, setPreviousLO, setUDF } from './actions';
import { types, util } from 'vortex-api';
export const reducer: types.IReducerSpec = {
  reducers: {
    [setPrefixOffset as any]: (state, payload) => {
      const { profile, offset } = payload;
      return util.setSafe(state, ['prefixOffset', profile], offset);
    },
    [setUDF as any]: (state, payload) => {
      const { udf } = payload;
      return util.setSafe(state, ['udf'], udf);
    },
    [setPreviousLO as any]: (state, payload) => {
      const { profile, previousLO } = payload;
      return util.setSafe(state, ['previousLO', profile], previousLO);
    }
  },
  defaults: {},
};