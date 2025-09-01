/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function testSupported(files) {
    const supported = files.find(filePath => path.basename(filePath).toLowerCase() === 'enbseries.ini') !== undefined;
    return bluebird_1.default.resolve({
        supported,
        requiredFiles: [],
    });
}
function makeCopy(basePath, filePath) {
    const len = basePath !== '.' ? basePath.length + 1 : 0;
    return {
        type: 'copy',
        source: filePath,
        destination: filePath.substring(0),
    };
}
function install(files, destinationPath, gameId, progressDelegate) {
    const baseDirs = files
        .filter(filePath => path.basename(filePath).toLowerCase() === 'enbseries.ini')
        .map(path.dirname);
    const refFile = files.find(filePath => path.basename(filePath).toLowerCase() === 'enbseries.ini');
    const basePath = path.dirname(refFile);
    const instructions = files
        .filter(filePath => !filePath.endsWith(path.sep)
        && !path.relative(basePath, path.dirname(filePath)).startsWith('..'))
        .map(filePath => makeCopy(basePath, filePath));
    return bluebird_1.default.resolve({ instructions });
}
function gameSupported(gameId) {
    var _a, _b;
    const game = vortex_api_1.util.getGame(gameId);
    if (((_a = game.compatible) === null || _a === void 0 ? void 0 : _a.deployToGameDirectory) === false || ((_b = game.compatible) === null || _b === void 0 ? void 0 : _b.enb) === false) {
        return false;
    }
    return !['factorio', 'microsoftflightsimulator'].includes(gameId);
}
function init(context) {
    const getPath = (game) => {
        const state = context.api.store.getState();
        const discovery = state.settings.gameMode.discovered[game.id];
        return discovery.path;
    };
    const testEnb = (instructions) => {
        if (instructions.find(inst => inst.destination === 'enbseries.ini') !== undefined) {
            if (instructions.find(inst => inst.destination === 'd3d11.dll') !== undefined) {
                return context.api.showDialog('question', 'Confirm mod installation', {
                    text: 'The mod you\'re about to install contains dll files that will run with the ' +
                        'game, have the same access to your system and can thus cause considerable ' +
                        'damage or infect your system with a virus if it\'s malicious.\n' +
                        'Please install this mod only if you received it from a trustworthy source ' +
                        'and if you have a virus scanner active right now.',
                }, [
                    { label: 'Cancel' },
                    { label: 'Continue' },
                ])
                    .then(result => (result.action === 'Continue')
                    ? bluebird_1.default.resolve(true)
                    : bluebird_1.default.reject(new vortex_api_1.util.UserCanceled()));
            }
            else {
                return bluebird_1.default.resolve(true);
            }
        }
        else {
            return bluebird_1.default.resolve(false);
        }
    };
    context.registerModType('enb', 100, gameSupported, getPath, () => bluebird_1.default.resolve(false), {
        mergeMods: true,
        name: 'ENB',
    });
    return true;
}
exports["default"] = init;


/***/ }),

/***/ "bluebird":
/*!***************************!*\
  !*** external "bluebird" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("bluebird");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

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
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.ts");
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=bundledPlugins/modtype-enb/modtype-enb.js.map