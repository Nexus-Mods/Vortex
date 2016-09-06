/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import { IState } from '../types/IState';
import { windowReducer } from './window';
import { combineReducers } from 'redux';

export default combineReducers<IState>({
  window: windowReducer,
});
