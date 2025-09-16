/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	const __webpack_modules__ = ({

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
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/

    Object.defineProperty(exports, "__esModule", ({ value: true }));
    const Promise = __webpack_require__(/*! bluebird */ "bluebird");
    const path = __webpack_require__(/*! path */ "path");
    const winapi = __webpack_require__(/*! winapi-bindings */ "winapi-bindings");
    const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
    const STORE_ID = 'gog';
    const STORE_NAME = 'GOG';
    const STORE_PRIORITY = 15;
    const GOG_EXEC = 'GalaxyClient.exe';
    const REG_GOG_GAMES = 'SOFTWARE\\WOW6432Node\\GOG.com\\Games';
    class GoGLauncher {
      constructor() {
        this.id = STORE_ID;
        this.name = STORE_NAME;
        this.priority = STORE_PRIORITY;
        if (process.platform === 'win32') {
          try {
            const gogPath = winapi.RegGetValue('HKEY_LOCAL_MACHINE', 'SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths', 'client');
            this.mClientPath = Promise.resolve(gogPath.value);
          }
          catch (err) {
            (0, vortex_api_1.log)('info', 'gog not found', { error: err.message });
            this.mClientPath = undefined;
          }
        }
        else {
          (0, vortex_api_1.log)('info', 'gog not found', { error: 'only available on Windows systems' });
          this.mClientPath = undefined;
        }
      }
      findByName(namePattern) {
        const re = new RegExp('^' + namePattern + '$');
        return this.allGames()
          .then(entries => entries.find(entry => re.test(entry.name)))
          .then(entry => {
            if (entry === undefined) {
              return Promise.reject(new vortex_api_1.types.GameEntryNotFound(namePattern, STORE_ID));
            }
            else {
              return Promise.resolve(entry);
            }
          });
      }
      launchGame(appInfo, api) {
        return this.getExecInfo(appInfo)
          .then(execInfo => api.runExecutable(execInfo.execPath, execInfo.arguments, {
            cwd: path.dirname(execInfo.execPath),
            suggestDeploy: true,
            shell: true,
          }));
      }
      getExecInfo(appId) {
        return this.allGames()
          .then(entries => {
            const gameEntry = entries.find(entry => entry.appid === appId);
            return (gameEntry === undefined)
              ? Promise.reject(new vortex_api_1.types.GameEntryNotFound(appId, STORE_ID))
              : this.mClientPath.then((basePath) => {
                const gogClientExec = {
                  execPath: path.join(basePath, GOG_EXEC),
                  arguments: ['/command=runGame',
                    `/gameId=${gameEntry.appid}`,
                    `path="${gameEntry.gamePath}"`],
                };
                return Promise.resolve(gogClientExec);
              });
          });
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
      getGameStorePath() {
        return (!!this.mClientPath)
          ? this.mClientPath.then(basePath => Promise.resolve(path.join(basePath, 'GalaxyClient.exe')))
          : Promise.resolve(undefined);
      }
      identifyGame(gamePath, fallback) {
        return Promise.all([this.fileExists(path.join(gamePath, 'gog.ico')), fallback(gamePath)])
          .then(([custom, fallback]) => {
            if (custom !== fallback) {
              (0, vortex_api_1.log)('warn', '(gog) game identification inconclusive', {
                gamePath,
                custom,
                fallback,
              });
            }
            return custom || fallback;
          });
      }
      fileExists(filePath) {
        return vortex_api_1.fs.statAsync(filePath)
          .then(() => true)
          .catch(() => false);
      }
      getGameEntries() {
        return (!!this.mClientPath)
          ? new Promise((resolve, reject) => {
            try {
              winapi.WithRegOpen('HKEY_LOCAL_MACHINE', REG_GOG_GAMES, hkey => {
                const keys = winapi.RegEnumKeys(hkey);
                const gameEntries = keys.map(key => {
                  try {
                    const gameEntry = {
                      appid: winapi.RegGetValue(hkey, key.key, 'gameID').value,
                      gamePath: winapi.RegGetValue(hkey, key.key, 'path').value,
                      name: winapi.RegGetValue(hkey, key.key, 'startMenu').value,
                      gameStoreId: STORE_ID,
                    };
                    return gameEntry;
                  }
                  catch (err) {
                    (0, vortex_api_1.log)('error', 'gamestore-gog: failed to create game entry', err);
                    return undefined;
                  }
                }).filter(entry => !!entry);
                return resolve(gameEntries);
              });
            }
            catch (err) {
              return (err.code === 'ENOENT') ? resolve([]) : reject(err);
            }
          })
          : Promise.resolve([]);
      }
    }
    function main(context) {
      const instance = process.platform === 'win32' ? new GoGLauncher() : undefined;
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
//# sourceMappingURL=bundledPlugins/gamestore-gog/gamestore-gog.js.map