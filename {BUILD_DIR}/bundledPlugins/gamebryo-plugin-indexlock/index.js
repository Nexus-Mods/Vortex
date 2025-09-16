/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	const __webpack_modules__ = ({

/***/ "./src/LockIndex.tsx":
/*!***************************!*\
  !*** ./src/LockIndex.tsx ***!
  \***************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


      const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      }));
      const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      const __importStar = (this && this.__importStar) || function (mod) {
        if (mod && mod.__esModule) return mod;
        const result = {};
        if (mod != null) for (const k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const actions_1 = __webpack_require__(/*! ./actions */ "./src/actions.ts");
      const React = __importStar(__webpack_require__(/*! react */ "react"));
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      function toHex(input) {
        if (input === undefined) {
          return 'FF';
        }
        let res = input.toString(16).toUpperCase();
        if (res.length < 2) {
          res = '0' + res;
        }
        return res;
      }
      class LockIndex extends vortex_api_1.ComponentEx {
        constructor() {
          super(...arguments);
          this.onToggle = (newValue, dataId) => {
            const { gameMode, onLockPluginIndex, plugin } = this.props;
            onLockPluginIndex(gameMode, plugin.name.toLowerCase(), newValue ? plugin.modIndex : undefined);
            this.forceUpdate();
          };
          this.onToggleEvt = (evt) => {
            const value = evt.currentTarget.getAttribute('data-value');
            this.onToggle(value === 'locked');
          };
          this.setIndex = (evt) => {
            const { gameMode, onLockPluginIndex, plugin } = this.props;
            const newValue = Number.parseInt(evt.currentTarget.value, 16);
            if (!isNaN(newValue) && (newValue <= 0xFF)) {
              onLockPluginIndex(gameMode, plugin.name.toLowerCase(), newValue);
            }
          };
        }
        render() {
          const { t, lockedIndex } = this.props;
          const title = (lockedIndex !== undefined)
            ? t('Locked to index', { replace: { lockedIndex: toHex(lockedIndex) } })
            : t('Sorted automatically');
          return (React.createElement(vortex_api_1.FlexLayout, { type: 'column' },
                                      React.createElement(react_bootstrap_1.Radio, { name: 'lockedGroup', checked: lockedIndex === undefined, "data-value": 'automatic', onChange: this.onToggleEvt }, t('Sorted automatically')),
                                      React.createElement(react_bootstrap_1.Radio, { name: 'lockedGroup', checked: lockedIndex !== undefined, "data-value": 'locked', onChange: this.onToggleEvt }, t('Locked to index')),
                                      this.renderIndex()));
        }
        renderIndex() {
          const { t, lockedIndex, plugin } = this.props;
          const matched = (lockedIndex === undefined) || (plugin.modIndex === lockedIndex);
          return (React.createElement(react_bootstrap_1.FormGroup, { validationState: matched ? 'success' : 'error' },
                                      React.createElement(react_bootstrap_1.FormControl, { type: 'text', value: (lockedIndex !== undefined) ? toHex(lockedIndex) : '', placeholder: t('Automatic'), onChange: this.setIndex, disabled: lockedIndex === undefined }),
                                      matched ? null : (React.createElement(react_bootstrap_1.ControlLabel, { style: { maxWidth: 250 } }, t('Actual index differs. If this is the case after sorting it may be '
                + 'this index isn\'t possible.')))));
        }
      }
      function mapStateToProps(state, ownProps) {
        const statePath = ['persistent', 'plugins', 'lockedIndices',
          ownProps.gameMode, ownProps.plugin.name.toLowerCase()];
        return {
          lockedIndex: vortex_api_1.util.getSafe(state, statePath, undefined),
        };
      }
      function mapDispatchToProps(dispatch) {
        return {
          onLockPluginIndex: (gameId, pluginId, modIndex) => dispatch((0, actions_1.lockPluginIndex)(gameId, pluginId, modIndex)),
        };
      }
      exports["default"] = (0, react_i18next_1.withTranslation)(['common', 'gamebryo-lockindex'])((0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)(LockIndex));


/***/ }),

/***/ "./src/actions.ts":
/*!************************!*\
  !*** ./src/actions.ts ***!
  \************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.lockPluginIndex = void 0;
      const redux_act_1 = __webpack_require__(/*! redux-act */ "redux-act");
      exports.lockPluginIndex = (0, redux_act_1.createAction)('SET_PLUGIN_LOCKED_INDEX', (gameId, plugin, index) => ({ gameId, plugin, index }));


/***/ }),

/***/ "./src/index.tsx":
/*!***********************!*\
  !*** ./src/index.tsx ***!
  \***********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


      const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      }));
      const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      const __importStar = (this && this.__importStar) || function (mod) {
        if (mod && mod.__esModule) return mod;
        const result = {};
        if (mod != null) for (const k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
      };
      const __importDefault = (this && this.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const LockIndex_1 = __importDefault(__webpack_require__(/*! ./LockIndex */ "./src/LockIndex.tsx"));
      const reducers_1 = __webpack_require__(/*! ./reducers */ "./src/reducers.ts");
      const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
      const React = __importStar(__webpack_require__(/*! react */ "react"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      function genAttribute(api) {
        return {
          id: 'lockIndex',
          name: 'Lock Mod Index',
          icon: 'locked',
          help: api.translate('Use this to directly control the mod index of a plugin.\n'
            + 'This will completely override the order generated automatically and is '
            + 'only intended as a temporary measure or during mod development.\n\n'
            + 'Please note that if the index you choose is not possible because it\'s too low '
            + 'or too high, the plugin is prepended/appended to the list and will not have the expected '
            + 'mod index.\n\n'
            + 'Further note: This lets you place non-master esps before masters but the game '
            + 'will not load them in this order.'),
          customRenderer: (plugin) => (React.createElement(LockIndex_1.default, { plugin: plugin, gameMode: vortex_api_1.selectors.activeGameId(api.store.getState()) })),
          calc: (plugin) => {
            const state = api.store.getState();
            const gameMode = vortex_api_1.selectors.activeGameId(state);
            const statePath = ['persistent', 'plugins', 'lockedIndices', gameMode, plugin.name];
            return vortex_api_1.util.getSafe(state, statePath, undefined);
          },
          placement: 'detail',
          isVolatile: true,
          edit: {},
        };
      }
      function genApplyIndexlock(api) {
        let updating = false;
        return (newLoadOrder) => {
          if (updating) {
            return;
          }
          const state = api.store.getState();
          const gameMode = vortex_api_1.selectors.activeGameId(state);
          const fixed = vortex_api_1.util.getSafe(state, ['persistent', 'plugins', 'lockedIndices', gameMode], {});
          if (Object.keys(fixed).length === 0) {
            return;
          }
          const pluginInfo = vortex_api_1.util.getSafe(state, ['session', 'plugins', 'pluginInfo'], {});
          const sorted = Object.keys(newLoadOrder)
            .filter(key => fixed[key] === undefined)
            .sort((lhs, rhs) => newLoadOrder[lhs].loadOrder - newLoadOrder[rhs].loadOrder);
          const toInsert = Object.keys(fixed).reduce((prev, key) => {
            if (newLoadOrder[key] !== undefined) {
              prev[fixed[key]] = key;
            }
            return prev;
          }, {});
          let currentIndex = 0;
          const prependOffset = 0;
          while (true) {
            const lowIdx = Object.keys(toInsert)
              .map(idx => parseInt(idx, 10))
              .sort()
              .find(idx => (idx <= currentIndex));
            if (lowIdx === undefined) {
              break;
            }
            sorted.splice(prependOffset, 0, toInsert[lowIdx]);
            delete toInsert[lowIdx];
            ++currentIndex;
          }
          const isNative = (id) => vortex_api_1.util.getSafe(state.session, ['plugins', 'pluginList', id, 'isNative'], false);
          const isEnabled = (id, entry) => entry.enabled || isNative(id);
          for (let idx = 0; (idx < sorted.length) && (Object.keys(toInsert).length > 0); ++idx) {
            if ((newLoadOrder[sorted[idx]] === undefined)
                || !isEnabled(sorted[idx], newLoadOrder[sorted[idx]])
                || vortex_api_1.util.getSafe(pluginInfo, [sorted[idx], 'isLight'], false)) {
              continue;
            }
            ++currentIndex;
            if (toInsert[currentIndex] !== undefined) {
              sorted.splice(idx + 1, 0, toInsert[currentIndex]);
              delete toInsert[currentIndex];
            }
          }
          Object.keys(toInsert).forEach(idx => {
            sorted.push(toInsert[idx]);
          });
          try {
            updating = true;
            api.events.emit('set-plugin-list', sorted.map(id => (newLoadOrder[id] !== undefined)
              ? (newLoadOrder[id].name || id)
              : id), false);
          }
          finally {
            updating = false;
          }
        };
      }
      function init(context) {
        context.requireExtension('gamebryo-plugin-management');
        context.registerReducer(['persistent', 'plugins', 'lockedIndices'], reducers_1.indexReducer);
        context.registerTableAttribute('gamebryo-plugins', genAttribute(context.api));
        context.once(() => {
          const { store } = context.api;
          const liDebouncer = new vortex_api_1.util.Debouncer(() => {
            applyIndexlock(vortex_api_1.util.getSafe(store.getState(), ['loadOrder'], {}));
            return bluebird_1.default.resolve();
          }, 2000);
          const applyIndexlock = genApplyIndexlock(context.api);
          let deploying = false;
          context.api.onAsync('will-deploy', () => { deploying = true; return bluebird_1.default.resolve(); });
          context.api.onAsync('did-deploy', () => { deploying = false; return bluebird_1.default.resolve(); });
          context.api.onStateChange(['loadOrder'], (oldState, newState) => {
            if (!deploying) {
              return applyIndexlock(newState);
            }
          });
          context.api.onStateChange(['session', 'plugins', 'pluginInfo'], () => {
            const state = store.getState();
            applyIndexlock(state.loadOrder);
          });
          context.api.onStateChange(['persistent', 'plugins', 'lockedIndices'], () => {
            liDebouncer.schedule();
          });
        });
        return true;
      }
      exports["default"] = init;


/***/ }),

/***/ "./src/reducers.ts":
/*!*************************!*\
  !*** ./src/reducers.ts ***!
  \*************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


      const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      }));
      const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      const __importStar = (this && this.__importStar) || function (mod) {
        if (mod && mod.__esModule) return mod;
        const result = {};
        if (mod != null) for (const k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.indexReducer = void 0;
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const actions = __importStar(__webpack_require__(/*! ./actions */ "./src/actions.ts"));
      exports.indexReducer = {
        reducers: {
          [actions.lockPluginIndex]: (state, payload) => (payload.index !== undefined)
            ? vortex_api_1.util.setSafe(state, [payload.gameId, payload.plugin], payload.index)
            : vortex_api_1.util.deleteOrNop(state, [payload.gameId, payload.plugin]),
        },
        defaults: {},
      };


/***/ }),

/***/ "bluebird":
/*!***************************!*\
  !*** external "bluebird" ***!
  \***************************/
/***/ ((module) => {

      module.exports = require("bluebird");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

      module.exports = require("react");

/***/ }),

/***/ "react-bootstrap":
/*!**********************************!*\
  !*** external "react-bootstrap" ***!
  \**********************************/
/***/ ((module) => {

      module.exports = require("react-bootstrap");

/***/ }),

/***/ "react-i18next":
/*!********************************!*\
  !*** external "react-i18next" ***!
  \********************************/
/***/ ((module) => {

      module.exports = require("react-i18next");

/***/ }),

/***/ "react-redux":
/*!******************************!*\
  !*** external "react-redux" ***!
  \******************************/
/***/ ((module) => {

      module.exports = require("react-redux");

/***/ }),

/***/ "redux-act":
/*!****************************!*\
  !*** external "redux-act" ***!
  \****************************/
/***/ ((module) => {

      module.exports = require("redux-act");

/***/ }),

/***/ "vortex-api":
/*!*****************************!*\
  !*** external "vortex-api" ***!
  \*****************************/
/***/ ((module) => {

      module.exports = require("vortex-api");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	const __webpack_exports__ = __webpack_require__("./src/index.tsx");
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=bundledPlugins/gamebryo-plugin-indexlock/gamebryo-plugin-indexlock.js.map