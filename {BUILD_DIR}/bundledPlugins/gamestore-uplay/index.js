/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

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
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
const Promise = __webpack_require__(/*! bluebird */ "bluebird");
const path = __webpack_require__(/*! path */ "path");
const winapi = __webpack_require__(/*! winapi-bindings */ "winapi-bindings");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const STORE_ID = 'uplay';
const STORE_NAME = 'Uplay';
const STORE_PRIORITY = 55;
const UPLAY_EXEC = 'Uplay.exe';
const REG_UPLAY_INSTALLS = 'SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs';
const REG_UPLAY_NAME_LOCATION = 'SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Uplay Install ';
class UPlayLauncher {
    constructor() {
        this.id = STORE_ID;
        this.name = STORE_NAME;
        this.priority = STORE_PRIORITY;
        if (process.platform === 'win32') {
            try {
                const uplayPath = winapi.RegGetValue('HKEY_LOCAL_MACHINE', 'SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher', 'InstallDir');
                this.mClientPath = Promise.resolve(path.join(uplayPath.value, UPLAY_EXEC));
            }
            catch (err) {
                (0, vortex_api_1.log)('info', 'uplay launcher not found', { error: err.message });
                this.mClientPath = undefined;
            }
        }
        else {
            (0, vortex_api_1.log)('info', 'uplay launcher not found', { error: 'only available on Windows systems' });
            this.mClientPath = undefined;
        }
    }
    launchGame(appInfo, api) {
        return this.getPosixPath(appInfo)
            .then(posPath => vortex_api_1.util.opn(posPath).catch(err => Promise.resolve()));
    }
    getPosixPath(appId) {
        const posixPath = `uplay://launch/${appId}/0`;
        return Promise.resolve(posixPath);
    }
    allGames() {
        if (!this.mCache) {
            this.mCache = this.getGameEntries();
        }
        return this.mCache;
    }
    reloadGames() {
        return new Promise((resolve) => {
            this.mCache = this.getGameEntries();
            return resolve();
        });
    }
    findByName(appName) {
        const re = new RegExp('^' + appName + '$');
        return this.allGames()
            .then(entries => entries.find(entry => re.test(entry.name)))
            .then(entry => (entry === undefined)
            ? Promise.reject(new vortex_api_1.types.GameEntryNotFound(appName, STORE_ID))
            : Promise.resolve(entry));
    }
    findByAppId(appId) {
        const matcher = Array.isArray(appId)
            ? (entry) => (appId.includes(entry.appid))
            : (entry) => (appId === entry.appid);
        return this.allGames()
            .then(entries => {
            const gameEntry = entries.find(matcher);
            if (gameEntry === undefined) {
                return Promise.reject(new vortex_api_1.types.GameEntryNotFound(Array.isArray(appId) ? appId.join(', ') : appId, STORE_ID));
            }
            else {
                return Promise.resolve(gameEntry);
            }
        });
    }
    getGameStorePath() {
        return (!!this.mClientPath)
            ? this.mClientPath.then(basePath => path.join(basePath, 'Uplay.exe'))
            : Promise.resolve(undefined);
    }
    getGameEntries() {
        return (this.mClientPath === undefined)
            ? Promise.resolve([])
            : new Promise((resolve, reject) => {
                try {
                    winapi.WithRegOpen('HKEY_LOCAL_MACHINE', REG_UPLAY_INSTALLS, hkey => {
                        let keys = [];
                        try {
                            keys = winapi.RegEnumKeys(hkey);
                        }
                        catch (err) {
                            (0, vortex_api_1.log)('error', 'gamestore-uplay: registry query failed', hkey);
                            return resolve([]);
                        }
                        const gameEntries = keys.map(key => {
                            try {
                                const gameEntry = {
                                    appid: key.key,
                                    gamePath: winapi.RegGetValue(hkey, key.key, 'InstallDir').value,
                                    name: winapi.RegGetValue('HKEY_LOCAL_MACHINE', REG_UPLAY_NAME_LOCATION + key.key, 'DisplayName').value,
                                    gameStoreId: STORE_ID,
                                };
                                return gameEntry;
                            }
                            catch (err) {
                                (0, vortex_api_1.log)('info', 'gamestore-uplay: registry query failed', key.key);
                                return undefined;
                            }
                        });
                        return resolve(gameEntries.filter(entry => !!entry));
                    });
                }
                catch (err) {
                    return (err.code === 'ENOENT') ? resolve([]) : reject(err);
                }
            });
    }
}
function main(context) {
    const instance = process.platform === 'win32' ? new UPlayLauncher() : undefined;
    if (instance !== undefined) {
        context.registerGameStore(instance);
    }
    return true;
}
exports["default"] = main;

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=bundledPlugins/gamestore-uplay/gamestore-uplay.js.map