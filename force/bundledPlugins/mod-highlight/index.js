/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	const __webpack_modules__ = ({

/***/ "./src/actions/session.ts":
/*!********************************!*\
  !*** ./src/actions/session.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.setSelectedMods = exports.setDisplayBatchHighlight = void 0;
      const redux_act_1 = __webpack_require__(/*! redux-act */ "redux-act");
      exports.setDisplayBatchHighlight = (0, redux_act_1.createAction)('SET_DISPLAY_BATCH_HIGHLIGHTER', (display) => display);
      exports.setSelectedMods = (0, redux_act_1.createAction)('SET_HIGHLIGHTER_SELECTED_MODS', (selectedMods) => selectedMods);


/***/ }),

/***/ "./src/reducers/session.ts":
/*!*********************************!*\
  !*** ./src/reducers/session.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.sessionReducer = void 0;
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const actions = __webpack_require__(/*! ../actions/session */ "./src/actions/session.ts");
      exports.sessionReducer = {
        reducers: {
          [actions.setDisplayBatchHighlight]: (state, display) => {
            return vortex_api_1.util.setSafe(state, ['displayBatchHighlighter'], display);
          },
          [actions.setSelectedMods]: (state, selectedMods) => {
            return vortex_api_1.util.setSafe(state, ['selectedMods'], selectedMods);
          },
        },
        defaults: {
          selectedMods: [],
          displayBatchHighlighter: false,
        },
      };


/***/ }),

/***/ "./src/types/types.tsx":
/*!*****************************!*\
  !*** ./src/types/types.tsx ***!
  \*****************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.cssHighlightList = exports.modIcons = exports.HighlightBase = void 0;
      const React = __webpack_require__(/*! react */ "react");
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      class HighlightBase extends vortex_api_1.ComponentEx {
        constructor() {
          super(...arguments);
          this.setRef = (ref) => {
            this.mRef = ref;
          };
        }
        renderHighlightColor(highlightColor, onClick) {
          return (React.createElement(react_bootstrap_1.Button, { type: 'button', key: highlightColor, className: 'highlight-base ' + highlightColor, id: highlightColor, value: highlightColor, onClick: onClick },
                                      React.createElement(vortex_api_1.Icon, { name: highlightColor === 'highlight-default' ? 'remove' : 'add' })));
        }
        renderPopover(popProps) {
          const { t } = this.props;
          const { toggleColors, toggleIcons } = popProps;
          return React.createElement(react_bootstrap_1.Popover, { id: 'popover-highlight-settings', title: t('Highlight Settings') },
                                     React.createElement(react_bootstrap_1.FormGroup, { key: 'some-form' },
                                                         React.createElement(react_bootstrap_1.ControlLabel, null, t('Select theme')),
                                                         React.createElement("div", { key: 'dialog-form-colors' }, exports.cssHighlightList.map((highlightColor) => {
                                                           return this.renderHighlightColor(highlightColor, toggleColors);
                                                         })),
                                                         React.createElement(react_bootstrap_1.ControlLabel, null, t('Select mod icon')),
                                                         React.createElement("div", { className: 'highlight-icons' }, exports.modIcons.map(icon => this.renderIcons(icon, toggleIcons)))));
        }
        renderIcons(icon, onClick) {
          return (React.createElement(react_bootstrap_1.Button, { type: 'button', key: icon, className: 'btn-embed', id: icon, value: icon, onClick: onClick },
                                      React.createElement(vortex_api_1.Icon, { name: icon })));
        }
        get bounds() {
          return {
            top: 0,
            left: 0,
            bottom: window.innerHeight,
            right: window.innerWidth,
            height: window.innerHeight,
            width: window.innerWidth,
          };
        }
      }
      exports.HighlightBase = HighlightBase;
      exports.modIcons = [
        'highlight-conflict',
        'highlight-patch',
        'highlight-shield',
        'highlight-map',
        'highlight-lab',
        'highlight-flag',
        'highlight-temple',
        'highlight-home',
        'highlight-person',
        'highlight-visuals',
        'highlight-tool',
        'highlight-ui',
        'highlight'
      ];
      exports.cssHighlightList = [
        'highlight-1',
        'highlight-2',
        'highlight-3',
        'highlight-4',
        'highlight-5',
        'highlight-6',
        'highlight-7',
        'highlight-8',
        'highlight-default',
      ];


/***/ }),

/***/ "./src/views/HighlightButton.tsx":
/*!***************************************!*\
  !*** ./src/views/HighlightButton.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const React = __webpack_require__(/*! react */ "react");
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      const ReactDOM = __webpack_require__(/*! react-dom */ "react-dom");
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const types_1 = __webpack_require__(/*! ../types/types */ "./src/types/types.tsx");
      class HighlightButton extends types_1.HighlightBase {
        constructor(props) {
          super(props);
          this.toggleIcon = (evt) => {
            const { gameMode, mod, onSetModAttribute } = this.props;
            onSetModAttribute(gameMode, mod.id, 'icon', evt.currentTarget.id);
          };
          this.toggleColors = (color) => {
            const { gameMode, mod, onSetModAttribute } = this.props;
            onSetModAttribute(gameMode, mod.id, 'color', color.currentTarget.value);
          };
          this.toggleOverlay = () => {
            this.nextState.showOverlay = !this.state.showOverlay;
            const node = ReactDOM.findDOMNode(this.mRef);
            const bounds = this.bounds;
            this.nextState.up =
                node.getBoundingClientRect().bottom > ((bounds.top + bounds.height) * 2 / 3);
          };
          this.initState({ showOverlay: false, up: false });
        }
        render() {
          const { mod, t } = this.props;
          if (mod.state !== 'installed') {
            return null;
          }
          const color = vortex_api_1.util.getSafe(mod.attributes, ['color'], '');
          const icon = vortex_api_1.util.getSafe(mod.attributes, ['icon'], '');
          const popoverBottom = this.state.showOverlay
            ? this.renderPopover({ toggleIcons: this.toggleIcon, toggleColors: this.toggleColors })
            : null;
          return (React.createElement("div", { style: { textAlign: 'center' } },
                                      this.state.showOverlay ? (React.createElement(react_bootstrap_1.Overlay, { rootClose: true, placement: this.state.up ? 'top' : 'bottom', onHide: this.toggleOverlay, show: this.state.showOverlay, target: this.mRef }, popoverBottom)) : null,
                                      React.createElement(vortex_api_1.tooltip.IconButton, { ref: this.setRef, className: 'highlight-base ' + (color !== '' ? color : 'highlight-default'), icon: icon !== '' ? icon : 'highlight', id: mod.id, tooltip: t('Change Icon'), onClick: this.toggleOverlay })));
        }
      }
      function mapStateToProps(state) {
        return {
          gameMode: vortex_api_1.selectors.activeGameId(state),
        };
      }
      function mapDispatchToProps(dispatch) {
        return {
          onSetModAttribute: (gameMode, modId, attributeId, value) => {
            dispatch(vortex_api_1.actions.setModAttribute(gameMode, modId, attributeId, value));
          },
        };
      }
      exports["default"] = (0, react_i18next_1.withTranslation)(['common'])((0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)(HighlightButton));


/***/ }),

/***/ "./src/views/HighlightIconBar.tsx":
/*!****************************************!*\
  !*** ./src/views/HighlightIconBar.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const session_1 = __webpack_require__(/*! ../actions/session */ "./src/actions/session.ts");
      const types_1 = __webpack_require__(/*! ../types/types */ "./src/types/types.tsx");
      const React = __webpack_require__(/*! react */ "react");
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      class HighlightIconBar extends types_1.HighlightBase {
        constructor(props) {
          super(props);
          this.toggleIcon = (evt) => {
            const { gameMode, selectedMods, onSetModAttributes } = this.props;
            onSetModAttributes(gameMode, selectedMods, 'icon', evt.currentTarget.id);
          };
          this.toggleColors = (color) => {
            const { gameMode, selectedMods, onSetModAttributes } = this.props;
            onSetModAttributes(gameMode, selectedMods, 'color', color.currentTarget.value);
          };
          this.toggleOverlay = () => {
            const { onToggleBatchHiglighter, showOverlay } = this.props;
            onToggleBatchHiglighter(!showOverlay);
          };
        }
        render() {
          const { t } = this.props;
          const popoverBottom = this.props.showOverlay
            ? this.renderPopover({ toggleIcons: this.toggleIcon, toggleColors: this.toggleColors })
            : null;
          return (React.createElement("div", { style: { height: '100%' } },
                                      this.props.showOverlay ? (React.createElement(react_bootstrap_1.Overlay, { rootClose: true, placement: 'top', onHide: this.toggleOverlay, show: this.props.showOverlay, target: this.mRef }, popoverBottom)) : null,
                                      React.createElement(vortex_api_1.ToolbarIcon, { className: 'highlight-default', text: 'Highlight Mods', ref: this.setRef, icon: 'highlight', tooltip: t('Highlight your mods'), onClick: this.toggleOverlay })));
        }
      }
      function mapStateToProps(state) {
        return {
          selectedMods: vortex_api_1.util.getSafe(state, ['session', 'modhighlight', 'selectedMods'], []),
          showOverlay: vortex_api_1.util.getSafe(state, ['session', 'modhighlight', 'displayBatchHighlighter'], false),
          gameMode: vortex_api_1.selectors.activeGameId(state),
        };
      }
      function mapDispatchToProps(dispatch) {
        return {
          onSetModAttribute: (gameMode, modId, attributeId, value) => {
            dispatch(vortex_api_1.actions.setModAttribute(gameMode, modId, attributeId, value));
          },
          onSetModAttributes: (gameMode, modIds, attributeId, value) => {
            vortex_api_1.util.batchDispatch(dispatch, modIds.map(modId => vortex_api_1.actions.setModAttribute(gameMode, modId, attributeId, value)));
          },
          onToggleBatchHiglighter: (enabled) => dispatch((0, session_1.setDisplayBatchHighlight)(enabled)),
        };
      }
      exports["default"] = (0, react_i18next_1.withTranslation)(['common'])((0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)(HighlightIconBar));


/***/ }),

/***/ "./src/views/TextareaNotes.tsx":
/*!*************************************!*\
  !*** ./src/views/TextareaNotes.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const React = __webpack_require__(/*! react */ "react");
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      class TextareaNotes extends vortex_api_1.ComponentEx {
        constructor(props) {
          super(props);
          this.handleChange = (event) => {
            const newValue = event.currentTarget.value;
            this.nextState.valueCache = newValue;
            this.mDebouncer.schedule(undefined, newValue);
          };
          this.initState({
            valueCache: this.getValue(props),
          });
          this.mDebouncer = new vortex_api_1.util.Debouncer((newNote) => {
            const { gameMode, mods, onSetModAttribute } = this.props;
            mods.forEach(mod => {
              onSetModAttribute(gameMode, mod.id, 'notes', newNote);
            });
            return null;
          }, 5000);
        }
        UNSAFE_componentWillReceiveProps(newProps) {
          const newValue = this.getValue(newProps);
          if (newValue !== this.state.valueCache) {
            this.nextState.valueCache = newValue;
          }
        }
        componentWillUnmount() {
          if (this.state.valueCache !== this.getValue(this.props)) {
            this.mDebouncer.runNow(undefined, this.state.valueCache);
          }
        }
        shouldComponentUpdate(nextProps, nextState) {
          return this.props.mods !== nextProps.mods
            || this.props.gameMode !== nextProps.gameMode
            || this.state !== nextState;
        }
        render() {
          const { t, mods } = this.props;
          const { valueCache } = this.state;
          if (mods.find(iter => iter.state !== 'installed') !== undefined) {
            return null;
          }
          return (React.createElement("textarea", { value: valueCache !== null ? valueCache : '', id: mods[0].id, className: 'textarea-notes', onChange: this.handleChange, placeholder: valueCache !== null
            ? t('Write your own notes on this mod')
            : t('Multiple values') }));
        }
        getValue(props) {
          const value = vortex_api_1.util.getSafe(props.mods[0].attributes, ['notes'], '');
          const different = props.mods.find(iter => vortex_api_1.util.getSafe(iter, ['attributes', 'notes'], '') !== value) !== undefined;
          return different ? null : value;
        }
      }
      function mapStateToProps(state) {
        return {};
      }
      function mapDispatchToProps(dispatch) {
        return {
          onSetModAttribute: (gameMode, modId, attributeId, value) => {
            dispatch(vortex_api_1.actions.setModAttribute(gameMode, modId, attributeId, value));
          },
        };
      }
      exports["default"] = (0, react_i18next_1.withTranslation)(['common'])((0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)(TextareaNotes));


/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

      module.exports = require("path");

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

/***/ "react-dom":
/*!****************************!*\
  !*** external "react-dom" ***!
  \****************************/
/***/ ((module) => {

      module.exports = require("react-dom");

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
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
  const __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
  (() => {
    const exports = __webpack_exports__;
/*!***********************!*\
  !*** ./src/index.tsx ***!
  \***********************/

    Object.defineProperty(exports, "__esModule", ({ value: true }));
    const HighlightButton_1 = __webpack_require__(/*! ./views/HighlightButton */ "./src/views/HighlightButton.tsx");
    const TextareaNotes_1 = __webpack_require__(/*! ./views/TextareaNotes */ "./src/views/TextareaNotes.tsx");
    const session_1 = __webpack_require__(/*! ./actions/session */ "./src/actions/session.ts");
    const session_2 = __webpack_require__(/*! ./reducers/session */ "./src/reducers/session.ts");
    const HighlightIconBar_1 = __webpack_require__(/*! ./views/HighlightIconBar */ "./src/views/HighlightIconBar.tsx");
    const path = __webpack_require__(/*! path */ "path");
    const React = __webpack_require__(/*! react */ "react");
    const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
    function init(context) {
      context.registerReducer(['session', 'modhighlight'], session_2.sessionReducer);
      context.registerTableAttribute('mods', {
        id: 'notes',
        description: 'Mod Notes',
        icon: 'sticky-note',
        placement: 'detail',
        supportsMultiple: true,
        customRenderer: (mods) => {
          const gameMode = vortex_api_1.selectors.activeGameId(context.api.store.getState());
          return (React.createElement(TextareaNotes_1.default, { gameMode: gameMode, mods: mods }));
        },
        calc: (mod) => vortex_api_1.util.getSafe(mod.attributes, ['notes'], ''),
        isToggleable: false,
        edit: {},
        isSortable: false,
      });
      context.registerTableAttribute('mods', {
        id: 'modHighlight',
        name: 'Highlight',
        description: 'Mod Highlight',
        icon: 'lightbulb-o',
        placement: 'table',
        customRenderer: (mod) => {
          const note = vortex_api_1.util.getSafe(mod.attributes, ['notes'], undefined);
          return (React.createElement("div", { className: 'highlight-container' },
                                      (!!note && (note.length > 0))
                                        ? React.createElement(vortex_api_1.tooltip.Icon, { tooltip: note, name: 'changelog' })
                                        : null,
                                      React.createElement(HighlightButton_1.default, { mod: mod })));
        },
        calc: (mod) => vortex_api_1.util.getSafe(mod.attributes, ['icon'], '')
            + ' - ' + vortex_api_1.util.getSafe(mod.attributes, ['color'], '')
            + ' - ' + vortex_api_1.util.getSafe(mod.attributes, ['notes'], ''),
        isToggleable: true,
        edit: {},
        isSortable: true,
        isDefaultVisible: false,
      });
      context.registerAction('mods-multirow-actions', 300, HighlightIconBar_1.default, {}, undefined, instanceIds => {
        const state = context.api.store.getState();
        const profile = vortex_api_1.selectors.activeProfile(state);
        if (profile !== undefined) {
          const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', profile.gameId], {});
          const selectedMods = Object.keys(mods)
            .filter(key => instanceIds.includes(key) && mods[key].state === 'installed');
          context.api.store.dispatch((0, session_1.setSelectedMods)(selectedMods));
        }
        return true;
      });
      context.once(() => {
        context.api.setStylesheet('mod-highlight', path.join(__dirname, 'mod-highlight.scss'));
      });
      return true;
    }
    exports["default"] = init;

  })();

  module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=bundledPlugins/mod-highlight/mod-highlight.js.map