import { setLanguage } from './actions';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

/**
 * reducer for changes to interface settings
 */
const settingsReducer = createReducer({
  [setLanguage]: (state, payload) => update(state, { language: { $set: payload } }),
}, {
  language: 'en-GB',
});

export default settingsReducer;
