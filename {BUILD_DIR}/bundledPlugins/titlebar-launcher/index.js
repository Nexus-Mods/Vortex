/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/memoize-one/dist/memoize-one.esm.js":
/*!**********************************************************!*\
  !*** ./node_modules/memoize-one/dist/memoize-one.esm.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
var safeIsNaN = Number.isNaN ||
    function ponyfill(value) {
        return typeof value === 'number' && value !== value;
    };
function isEqual(first, second) {
    if (first === second) {
        return true;
    }
    if (safeIsNaN(first) && safeIsNaN(second)) {
        return true;
    }
    return false;
}
function areInputsEqual(newInputs, lastInputs) {
    if (newInputs.length !== lastInputs.length) {
        return false;
    }
    for (var i = 0; i < newInputs.length; i++) {
        if (!isEqual(newInputs[i], lastInputs[i])) {
            return false;
        }
    }
    return true;
}

function memoizeOne(resultFn, isEqual) {
    if (isEqual === void 0) { isEqual = areInputsEqual; }
    var lastThis;
    var lastArgs = [];
    var lastResult;
    var calledOnce = false;
    function memoized() {
        var newArgs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            newArgs[_i] = arguments[_i];
        }
        if (calledOnce && lastThis === this && isEqual(newArgs, lastArgs)) {
            return lastResult;
        }
        lastResult = resultFn.apply(this, newArgs);
        calledOnce = true;
        lastThis = this;
        lastArgs = newArgs;
        return lastResult;
    }
    return memoized;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (memoizeOne);


/***/ }),

/***/ "./src/TitlebarToggle.tsx":
/*!********************************!*\
  !*** ./src/TitlebarToggle.tsx ***!
  \********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const React = __webpack_require__(/*! react */ "react");
const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const actions_1 = __webpack_require__(/*! ./actions */ "./src/actions.ts");
function TitlebarToggle(props) {
    const [t] = (0, react_i18next_1.useTranslation)();
    const { onGetValidStarters } = props;
    const context = React.useContext(vortex_api_1.MainContext);
    const { game, addToTitleBar, discoveredTools, mods, toolsOrder, discovery, primaryTool } = (0, react_redux_1.useSelector)(mapStateToProps);
    const onToggle = React.useCallback(() => {
        context.api.store.dispatch((0, actions_1.setAddToTitleBar)(!addToTitleBar));
        if (!addToTitleBar === true) {
            context.api.events.emit('analytics-track-click-event', 'Tools', 'Added to Titlebar');
        }
    }, [addToTitleBar]);
    const [valid, setValid] = React.useState(false);
    React.useEffect(() => {
        const isValid = () => __awaiter(this, void 0, void 0, function* () {
            const hasValidTools = (yield (yield onGetValidStarters(game, discovery, Object.values(discoveredTools) || [])).length) > 0;
            setValid(hasValidTools);
        });
        isValid();
    }, [primaryTool, discoveredTools, toolsOrder, discovery, mods]);
    if (!game) {
        return null;
    }
    return (React.createElement("div", { id: 'titlebar-tools-toggle-container' },
        React.createElement("p", { className: 'titlebar-tools-toggle-text' }, t('Enable toolbar')),
        React.createElement(vortex_api_1.Toggle, { disabled: !valid, className: 'titlebar-tools-toggle', checked: addToTitleBar, onToggle: onToggle })));
}
exports["default"] = TitlebarToggle;
const emptyObj = {};
function mapStateToProps(state) {
    const game = vortex_api_1.selectors.currentGame(state);
    const discovery = vortex_api_1.selectors.currentGameDiscovery(state);
    if ((game === null || game === void 0 ? void 0 : game.id) === undefined || (discovery === null || discovery === void 0 ? void 0 : discovery.path) === undefined) {
        return {
            game: undefined,
            addToTitleBar: false,
            discoveredTools: emptyObj,
            discovery: emptyObj,
            primaryTool: undefined,
            toolsOrder: [],
            mods: emptyObj,
        };
    }
    return {
        toolsOrder: vortex_api_1.util.getSafe(state, ['settings', 'interface', 'tools', 'order', game.id], []),
        addToTitleBar: vortex_api_1.util.getSafe(state, ['settings', 'interface', 'tools', 'addToolsToTitleBar'], false),
        game,
        primaryTool: vortex_api_1.util.getSafe(state, ['settings', 'interface', 'primaryTool', game.id], undefined),
        discovery,
        discoveredTools: vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', game.id, 'tools'], emptyObj),
        mods: vortex_api_1.util.getSafe(state, ['persistent', 'mods', game.id], emptyObj),
    };
}


/***/ }),

/***/ "./src/ToolStarter.tsx":
/*!*****************************!*\
  !*** ./src/ToolStarter.tsx ***!
  \*****************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const path = __webpack_require__(/*! path */ "path");
const React = __webpack_require__(/*! react */ "react");
const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const { MainContext } = __webpack_require__(/*! vortex-api */ "vortex-api");
function toolIconRW(gameId, toolId) {
    return path.join(vortex_api_1.util.getVortexPath('userData'), gameId, 'icons', toolId + '.png');
}
function toolIcon(gameId, extensionPath, toolId, toolLogo) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const iconPath = toolIconRW(gameId, toolId);
            yield vortex_api_1.fs.statAsync(iconPath);
            return iconPath;
        }
        catch (err) {
            if (toolLogo === undefined) {
                return undefined;
            }
            try {
                const iconPath = path.join(extensionPath, toolLogo);
                yield vortex_api_1.fs.statAsync(iconPath);
                return iconPath;
            }
            catch (err) {
                return undefined;
            }
        }
    });
}
function ToolStarterIcon(props) {
    const { valid } = props;
    const { api } = React.useContext(MainContext);
    const { primaryTool } = (0, react_redux_1.useSelector)(mapStateToProps);
    const onShowError = React.useCallback((message, details, allowReport) => {
        api.showErrorNotification(message, details, { allowReport });
    }, [api]);
    const startCB = React.useCallback(() => {
        api.events.emit('analytics-track-click-event', 'Tools', 'Manually ran tool');
        vortex_api_1.util.StarterInfo.run(props.tool, api, onShowError);
    }, [props]);
    return valid ? (React.createElement(vortex_api_1.ToolIcon, { classes: ['fade-in'], t: api.translate, valid: true, item: props.tool, isPrimary: props.tool.id === primaryTool, imageUrl: props.iconLocation, onRun: startCB }, props.running ? React.createElement(vortex_api_1.Spinner, { className: 'running-overlay' }) : null)) : null;
}
function makeExeId(exePath) {
    return path.basename(exePath).toLowerCase();
}
function ToolStarter(props) {
    const { onGetStarters, onGetValidStarters } = props;
    const { addToTitleBar, discovery, game, discoveredTools, mods, toolsRunning, toolsOrder, primaryTool } = (0, react_redux_1.useSelector)(mapStateToProps);
    const [toolImages, setToolImages] = React.useState({});
    const [validStarters, setValidStarters] = React.useState([]);
    const starters = onGetStarters(game, discovery, Object.values(discoveredTools) || []);
    const idxOfTool = (tool) => {
        const idx = toolsOrder.findIndex(id => tool.id === id);
        return idx !== -1 ? idx : starters.length;
    };
    starters.sort((lhs, rhs) => idxOfTool(lhs) - idxOfTool(rhs));
    React.useEffect(() => {
        const hasValidTools = () => __awaiter(this, void 0, void 0, function* () {
            const starters = yield onGetValidStarters(game, discovery, Object.values(discoveredTools));
            setValidStarters(starters);
        });
        const getImagePath = () => __awaiter(this, void 0, void 0, function* () {
            const imageMap = {};
            for (const starter of starters) {
                imageMap[starter.id] = yield toolIcon(game.id, game.extensionPath, starter.id, starter.logoName);
            }
            setToolImages(imageMap);
            hasValidTools();
        });
        getImagePath();
    }, [primaryTool, discoveredTools, toolsOrder, discovery, mods]);
    if (!game || !discovery || !addToTitleBar || validStarters.length === 0) {
        return null;
    }
    return (React.createElement("div", { id: 'titlebar-starter' }, starters.map((starter, idx) => {
        const running = (starter.exePath !== undefined)
            && (toolsRunning[makeExeId(starter.exePath)] !== undefined);
        return (React.createElement(ToolStarterIcon, { valid: validStarters.includes(starter.id), running: running, key: idx, tool: starter, iconLocation: toolImages[starter.id] }));
    })));
}
const emptyObj = {};
function mapStateToProps(state) {
    const game = vortex_api_1.selectors.currentGame(state);
    const discovery = vortex_api_1.selectors.currentGameDiscovery(state);
    if (!(game === null || game === void 0 ? void 0 : game.id) || !(discovery === null || discovery === void 0 ? void 0 : discovery.path)) {
        return {
            addToTitleBar: false,
            toolsOrder: [],
            game: undefined,
            discovery: undefined,
            discoveredTools: emptyObj,
            primaryTool: undefined,
            toolsRunning: emptyObj,
            mods: emptyObj,
        };
    }
    return {
        addToTitleBar: vortex_api_1.util.getSafe(state, ['settings', 'interface', 'tools', 'addToolsToTitleBar'], false),
        toolsOrder: vortex_api_1.util.getSafe(state, ['settings', 'interface', 'tools', 'order', game.id], []),
        game,
        discovery,
        discoveredTools: game !== undefined
            ? vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', game.id, 'tools'], emptyObj)
            : undefined,
        primaryTool: game !== undefined
            ? vortex_api_1.util.getSafe(state, ['settings', 'interface', 'primaryTool', game.id], undefined)
            : undefined,
        toolsRunning: state.session.base.toolsRunning,
        mods: game !== undefined
            ? vortex_api_1.util.getSafe(state, ['persistent', 'mods', game.id], emptyObj)
            : emptyObj,
    };
}
exports["default"] = ToolStarter;


/***/ }),

/***/ "./src/actions.ts":
/*!************************!*\
  !*** ./src/actions.ts ***!
  \************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.setAddToTitleBar = void 0;
const redux_act_1 = __webpack_require__(/*! redux-act */ "redux-act");
exports.setAddToTitleBar = (0, redux_act_1.createAction)('SET_ADD_TO_TITLEBAR', (addToTitleBar) => ({ addToTitleBar }));


/***/ }),

/***/ "./src/index.tsx":
/*!***********************!*\
  !*** ./src/index.tsx ***!
  \***********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const memoize_one_1 = __webpack_require__(/*! memoize-one */ "./node_modules/memoize-one/dist/memoize-one.esm.js");
const path = __webpack_require__(/*! path */ "path");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const reducers_1 = __webpack_require__(/*! ./reducers */ "./src/reducers.ts");
const ToolStarter_1 = __webpack_require__(/*! ./ToolStarter */ "./src/ToolStarter.tsx");
const TitlebarToggle_1 = __webpack_require__(/*! ./TitlebarToggle */ "./src/TitlebarToggle.tsx");
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const toStarters = (0, memoize_one_1.default)(util_1.starterMemoizer);
const getValidStarters = (0, memoize_one_1.default)(ValidStarters);
function ValidStarters(game, discovery, tools) {
    return __awaiter(this, void 0, void 0, function* () {
        const starters = toStarters(game, discovery, tools);
        const validStarters = [];
        for (const starter of starters) {
            if ((starter === null || starter === void 0 ? void 0 : starter.exePath) === undefined) {
                continue;
            }
            try {
                const exePath = path.isAbsolute(starter.exePath)
                    ? starter.exePath : path.join(discovery.path, starter.exePath);
                yield vortex_api_1.fs.statAsync(exePath);
                validStarters.push(starter.id);
            }
            catch (err) {
            }
        }
        return validStarters;
    });
}
function init(context) {
    context.registerReducer(['settings', 'interface'], reducers_1.default);
    context.registerDynDiv('main-toolbar', ToolStarter_1.default, {
        condition: (props) => {
            return vortex_api_1.selectors.activeGameId(context.api.store.getState()) !== undefined;
        },
        props: {
            onGetStarters: (game, discovery, tools) => toStarters(game, discovery, tools),
            onGetValidStarters: (game, discovery, tools) => getValidStarters(game, discovery, tools)
        }
    });
    context.registerDynDiv('starter-dashlet-tools-controls', TitlebarToggle_1.default, {
        condition: (props) => {
            return vortex_api_1.selectors.activeGameId(context.api.store.getState()) !== undefined;
        },
        props: {
            onGetValidStarters: (game, discovery, tools) => getValidStarters(game, discovery, tools)
        }
    });
    context.once(() => {
        context.api.setStylesheet('titlebar-launcher', path.join(__dirname, 'titlebar-launcher.scss'));
    });
    return true;
}
exports["default"] = init;


/***/ }),

/***/ "./src/reducers.ts":
/*!*************************!*\
  !*** ./src/reducers.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const actions = __webpack_require__(/*! ./actions */ "./src/actions.ts");
const reducer = {
    reducers: {
        [actions.setAddToTitleBar]: (state, payload) => {
            const { addToTitleBar } = payload;
            return vortex_api_1.util.setSafe(state, ['tools', 'addToolsToTitleBar'], addToTitleBar);
        },
    },
    defaults: {},
};
exports["default"] = reducer;


/***/ }),

/***/ "./src/util.ts":
/*!*********************!*\
  !*** ./src/util.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.starterMemoizer = exports.toStarterInfo = void 0;
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function toStarterInfo(game, gameDiscovery, tool, toolDiscovery) {
    return new vortex_api_1.util.StarterInfo(game, gameDiscovery, tool, toolDiscovery);
}
exports.toStarterInfo = toStarterInfo;
function starterMemoizer(game, discovery, tools) {
    const result = tools.filter(tool => tool.id !== undefined)
        .map(toolDiscovery => {
        if (toolDiscovery.hidden) {
            return undefined;
        }
        const tool = game.supportedTools.find(iter => iter.id === toolDiscovery.id);
        try {
            return toStarterInfo(game, discovery, tool, toolDiscovery);
        }
        catch (err) {
            return undefined;
        }
    })
        .filter(iter => iter !== undefined);
    return result;
}
exports.starterMemoizer = starterMemoizer;


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
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
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
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.tsx");
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=bundledPlugins/titlebar-launcher/titlebar-launcher.js.map