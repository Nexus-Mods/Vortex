import { setMaximized, setWindowPosition, setWindowSize, setLoggedInUser } from '../actions/actions';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

/**
 * reducer for changes to the window state
 */
export const windowReducer = createReducer({
  [setWindowSize]: (state, payload) => update(state, { size: { $set: payload } }),
  [setWindowPosition]: (state, payload) => update(state, { position: { $set: payload } }),
  [setMaximized]: (state, payload) => update(state, { maximized: { $set: payload } }),
  [setLoggedInUser]: (state, payload) => update(state, { account: { $set: payload } }),
}, {
        maximized: false,
        account: { username: 'undefined', cookie: '' },
        position: {x: 0, y: 0},
        size: {
            height: 768,
            width: 1024,
        },
});
