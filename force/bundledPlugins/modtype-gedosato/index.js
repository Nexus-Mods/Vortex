/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/gameSupport.ts":
/*!****************************!*\
  !*** ./src/gameSupport.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getPath = exports.gameSupported = void 0;
const gameSupport = {
    darksouls2: {
        id: 'DarkSoulsII',
    },
};
function gameSupported(gameId) {
    return gameSupport[gameId] !== undefined;
}
exports.gameSupported = gameSupported;
function getPath(gameId) {
    return gameSupport[gameId].id;
}
exports.getPath = getPath;


/***/ }),

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
const gameSupport_1 = __webpack_require__(/*! ./gameSupport */ "./src/gameSupport.ts");
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const platform_1 = __webpack_require__(/*! ./platform */ "./src/platform.ts");
const winapi = (0, platform_1.isWindows)() ? ((0, platform_1.isWindows)() ? __webpack_require__(/*! winapi-bindings */ "winapi-bindings") : undefined) : undefined;
let gedosatoPath;
function getLocation() {
    try {
        const instPath = winapi.RegGetValue('HKEY_LOCAL_MACHINE', 'Software\\Wow6432Node\\Durante\\GeDoSaTo', 'InstallPath');
        if (!instPath) {
            throw new Error('empty registry key');
        }
        return vortex_api_1.fs.statAsync(instPath.value)
            .then(() => instPath.value);
    }
    catch (err) {
        return bluebird_1.default.reject(err);
    }
}
function isTexture(file) {
    return file.endsWith(path.sep)
        || ['.dds', '.png'].includes(path.extname(file).toLowerCase());
}
function allTextures(files) {
    return files.find(file => !isTexture(file)) === undefined;
}
let askGeDoSaTo;
function testSupported(files, gameId) {
    const isGeDoSaTo = (0, gameSupport_1.gameSupported)(gameId) && allTextures(files);
    const prom = !isGeDoSaTo || (gedosatoPath !== undefined)
        ? bluebird_1.default.resolve(isGeDoSaTo)
        : askGeDoSaTo();
    return prom.then(choice => bluebird_1.default.resolve({
        supported: isGeDoSaTo && choice,
        requiredFiles: [],
    }));
}
function makeCopy(basePath, filePath) {
    return {
        type: 'copy',
        source: filePath,
        destination: basePath !== '.' ? filePath.substring(basePath.length + 1) : filePath,
    };
}
function install(files, destinationPath, gameId, progressDelegate) {
    const basePath = path.dirname(files.find(isTexture));
    const instructions = files
        .filter(filePath => !filePath.endsWith(path.sep)
        && ((basePath === '.') || filePath.startsWith(basePath + path.sep)))
        .map(filePath => makeCopy(basePath, filePath));
    return bluebird_1.default.resolve({ instructions });
}
function isSupported(gameId) {
    return (0, gameSupport_1.gameSupported)(gameId);
}
function init(context) {
    const getOutputPath = (game) => {
        if (gedosatoPath !== undefined) {
            return path.join(gedosatoPath, 'textures', (0, gameSupport_1.getPath)(game.id));
        }
        else {
            return undefined;
        }
    };
    const testGeDoSaTo = (instructions) => bluebird_1.default.resolve(allTextures(instructions.filter(instruction => instruction.type === 'copy')
        .map(instruction => instruction.destination)));
    context.registerModType('gedosato', 50, isSupported, getOutputPath, testGeDoSaTo);
    context.registerInstaller('gedosato', 50, testSupported, install);
    askGeDoSaTo = () => {
        return context.api.store.dispatch(vortex_api_1.actions.showDialog('question', 'GeDoSaTo not installed', {
            bbcode: 'This looks like a mod that requires the tool GeDoSaTo<br />'
                + 'To use it, you should cancel this installation now, get GeDoSaTo and then retry. '
                + 'If you continue now, the mod may not be installed correctly and will not work '
                + 'even after you install GeDoSaTo.<br />'
                + 'Download from here: [url]https://community.pcgamingwiki.com/files/file/897-gedosato/[/url]<br />',
        }, [
            { label: 'Cancel', default: true },
            { label: 'Ignore' },
        ]))
            .then(result => result.action === 'Ignore'
            ? bluebird_1.default.resolve(true)
            : bluebird_1.default.reject(new vortex_api_1.util.UserCanceled()));
    };
    context.once(() => {
        return getLocation()
            .then(location => {
            if (location === undefined) {
                (0, vortex_api_1.log)('info', 'gedosato not installed or not found');
                return;
            }
            gedosatoPath = location;
        })
            .catch({ systemCode: 2 }, err => {
            (0, vortex_api_1.log)('info', 'GeDoSaTo not installed');
        })
            .catch(err => {
            (0, vortex_api_1.log)('warn', 'failed to look for GeDoSaTo', { err: err.message });
        });
    });
    return true;
}
exports["default"] = init;


/***/ }),

/***/ "./src/platform.ts":
/*!*************************!*\
  !*** ./src/platform.ts ***!
  \*************************/
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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.normalizePath = exports.platformSwitch = exports.getWineDriveCPath = exports.getLineEnding = exports.getPathSeparator = exports.getExecutableExtension = exports.isUnixLike = exports.isLinux = exports.isMacOS = exports.isWindows = exports.getPlatform = void 0;
const os = __importStar(__webpack_require__(/*! os */ "os"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
function getPlatform() {
    return process.platform;
}
exports.getPlatform = getPlatform;
function isWindows() {
    return process.platform === 'win32';
}
exports.isWindows = isWindows;
function isMacOS() {
    return process.platform === 'darwin';
}
exports.isMacOS = isMacOS;
function isLinux() {
    return process.platform === 'linux';
}
exports.isLinux = isLinux;
function isUnixLike() {
    return process.platform !== 'win32';
}
exports.isUnixLike = isUnixLike;
function getExecutableExtension() {
    return isWindows() ? '.exe' : '';
}
exports.getExecutableExtension = getExecutableExtension;
function getPathSeparator() {
    return isWindows() ? '\\' : '/';
}
exports.getPathSeparator = getPathSeparator;
function getLineEnding() {
    return isWindows() ? '\r\n' : '\n';
}
exports.getLineEnding = getLineEnding;
function getWineDriveCPath() {
    return path.join(os.homedir(), '.wine', 'drive_c');
}
exports.getWineDriveCPath = getWineDriveCPath;
function platformSwitch(cases) {
    if (isWindows() && cases.windows !== undefined)
        return cases.windows;
    if (isMacOS() && cases.macos !== undefined)
        return cases.macos;
    if (isLinux() && cases.linux !== undefined)
        return cases.linux;
    if (cases.default !== undefined)
        return cases.default;
    throw new Error('No matching platform case and no default provided');
}
exports.platformSwitch = platformSwitch;
function normalizePath(inputPath) {
    return path.normalize(inputPath).replace(/\\/g, '/');
}
exports.normalizePath = normalizePath;


/***/ }),

/***/ "bluebird":
/*!***************************!*\
  !*** external "bluebird" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("bluebird");

/***/ }),

/***/ "os":
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("os");

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

/***/ }),

/***/ "winapi-bindings":
/*!**********************************!*\
  !*** external "winapi-bindings" ***!
  \**********************************/
/***/ ((module) => {

module.exports = require("winapi-bindings");

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
//# sourceMappingURL=bundledPlugins/modtype-gedosato/modtype-gedosato.js.map