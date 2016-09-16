import { setUpdateChannel } from './actions';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

/**
 * reducer for changes to interface settings
 */
const settingsReducer = createReducer({
  [setUpdateChannel]: (state, payload) => update(state, { channel: { $set: payload } }),
}, {
  channel: 'stable',
});

export default settingsReducer;
