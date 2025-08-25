"use strict";

// Very small compatibility layer to keep the renderer/main wiring happy
// without depending on the exact forked electron-redux version during dev.

function identityMiddleware() {
  return next => action => next(action);
}

const forwardToMain = identityMiddleware;
const forwardToRenderer = identityMiddleware;

function replayActionRenderer() {
  // no-op in shim; real impl replays buffered actions on renderer load
  return;
}

function getInitialStateRenderer() {
  // return undefined to let normal preload/bootstrap state flow apply
  return undefined;
}

// Basic alias enhancer passthrough; in shim it does nothing.
function alias() {
  return (createStore) => (...args) => createStore(...args);
}

module.exports = {
  forwardToMain,
  replayActionRenderer,
  forwardToRenderer,
  getInitialStateRenderer,
  alias
};