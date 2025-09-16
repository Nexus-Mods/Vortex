/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	const __webpack_modules__ = ({

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


      const __importDefault = (this && this.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.NotFound = void 0;
      const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      class NotFound extends Error {
        constructor() {
          super('not found');
          this.name = this.constructor.name;
        }
      }
      exports.NotFound = NotFound;
      function safeGetTimestamp(input) {
        if (input === null) {
          return null;
        }
        return input.getTime();
      }
      function findLocalInfo(game) {
        let normalize;
        if (game.path === undefined) {
          if ((game.details !== undefined) && (game.details['steamAppId'])) {
            return bluebird_1.default.resolve({
              appid: game.details['steamAppId'],
              lastUpdated: null,
            });
          }
          else {
            return bluebird_1.default.reject(new NotFound());
          }
        }
        return vortex_api_1.util.getNormalizeFunc(game.path)
          .then(normalizeFunc => {
            normalize = normalizeFunc;
            return vortex_api_1.util.steam.allGames();
          })
          .then((entries) => {
            const searchPath = normalize(game.path);
            const steamGame = entries.find(entry => normalize(entry.gamePath) === searchPath);
            if (steamGame === undefined) {
              if ((game.details !== undefined) && (game.details['steamAppId'] !== undefined)) {
                return bluebird_1.default.resolve({
                  appid: game.details['steamAppId'],
                  lastUpdated: null,
                });
              }
              else {
                return bluebird_1.default.reject(new NotFound());
              }
            }
            else {
              return bluebird_1.default.resolve({
                appid: steamGame.appid,
                lastUpdated: steamGame.lastUpdated !== undefined
                  ? new Date(steamGame.lastUpdated)
                  : null,
              });
            }
          });
      }
      function queryGameSteam(api, game) {
        let foundSteamGame;
        return findLocalInfo(game)
          .then(localInfo => {
            foundSteamGame = localInfo;
            const url = `https://store.steampowered.com/api/appdetails?appids=${foundSteamGame.appid}`;
            (0, vortex_api_1.log)('debug', 'requesting game info from steam store', { url });
            return vortex_api_1.util.jsonRequest(url);
          })
          .then((dat) => {
            dat = dat[foundSteamGame.appid];
            if (dat['success'] !== true) {
              (0, vortex_api_1.log)('warn', 'steam store request was unsuccessful', { dat });
              return {};
            }
            dat = dat['data'];
            const ret = {
              release_date: {
                title: 'Release Date',
                value: vortex_api_1.util.getSafe(dat, ['release_date', 'date'], null),
                type: 'date',
              },
              last_updated: {
                title: 'Last Updated',
                value: safeGetTimestamp(foundSteamGame.lastUpdated),
                type: 'date',
              },
              website: {
                title: 'Website',
                value: vortex_api_1.util.getSafe(dat, ['website'], null),
                type: 'url',
              },
              metacritic_score: {
                title: 'Score (Metacritic)',
                value: vortex_api_1.util.getSafe(dat, ['metacritic', 'score'], null),
              },
            };
            return ret;
          })
          .catch(err => {
            if (!(err instanceof NotFound)) {
              (0, vortex_api_1.log)('warn', 'failed to request info from steam', { gameId: game.id, err: err.message });
            }
            return {};
          });
      }
      function main(context) {
        context.registerGameInfoProvider('steam', 50, 604800000, ['release_date', 'last_updated', 'website', 'metacritic_score'], game => queryGameSteam(context.api, game));
        return true;
      }
      exports["default"] = main;


/***/ }),

/***/ "bluebird":
/*!***************************!*\
  !*** external "bluebird" ***!
  \***************************/
/***/ ((module) => {

      module.exports = require("bluebird");

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
/******/ 	const __webpack_exports__ = __webpack_require__("./src/index.ts");
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=bundledPlugins/gameinfo-steam/gameinfo-steam.js.map