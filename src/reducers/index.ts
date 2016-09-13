/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import { IExtensionReducer } from '../types/Extension';
import { windowReducer } from './window';
import { combineReducers } from 'redux';


function reduceReducer(path, reducer, tree) {
  if (path.length === 1) {
    tree[path[0]] = reducer;
  } else {
    tree[path[0]] = {}
    reduceReducer(path.slice(1), reducer, tree[path[0]]);
  }
}

function buildReducerTree(reducers: IExtensionReducer[]) {
  let result = {};

  reducers.forEach((ele) => { reduceReducer(ele.path, ele.reducer, result); });

  return result;
}

function deriveReducer(ele) {
  if (typeof(ele) === 'function') {
    return ele;
  } else {
    for (let key of Object.keys(ele)) {
      ele[key] = deriveReducer(ele[key]);
    }
    return combineReducers(
      ele
    );
  }
}

export default function (extensionReducers: IExtensionReducer[]) {
  let tree = buildReducerTree(extensionReducers.concat([
    { path: ['window'], reducer: windowReducer },
  ]));

  return deriveReducer(tree);

}
