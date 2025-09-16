/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	const __webpack_modules__ = ({

/***/ "./src/gameSupport.ts":
/*!****************************!*\
  !*** ./src/gameSupport.ts ***!
  \****************************/
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
      exports.appDataPath = exports.settingsPath = exports.initGameSupport = void 0;
      const path = __importStar(__webpack_require__(/*! path */ "path"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const localAppData = (() => {
        let cached;
        return () => {
          if (cached === undefined) {
            cached = process.env.LOCALAPPDATA
                || path.resolve(vortex_api_1.util.getVortexPath('appData'), '..', 'Local');
          }
          return cached;
        };
      })();
      const gameSupport = vortex_api_1.util.makeOverlayableDictionary({
        fallout3: {
          settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Fallout3'),
          appDataPath: () => path.join(localAppData(), 'Fallout3'),
        },
        falloutnv: {
          settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'FalloutNV'),
          appDataPath: () => path.join(localAppData(), 'FalloutNV'),
        },
        fallout4: {
          settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Fallout4'),
          appDataPath: () => path.join(localAppData(), 'Fallout4'),
        },
        fallout4vr: {
          settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Fallout4VR'),
          appDataPath: () => path.join(localAppData(), 'Fallout4VR'),
        },
        starfield: {
          settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Starfield'),
          appDataPath: () => path.join(localAppData(), 'Starfield'),
        },
        oblivion: {
          settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Oblivion'),
          appDataPath: () => path.join(localAppData(), 'Oblivion'),
        },
        skyrim: {
          settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Skyrim'),
          appDataPath: () => path.join(localAppData(), 'Skyrim'),
        },
        skyrimse: {
          settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Skyrim Special Edition'),
          appDataPath: () => path.join(localAppData(), 'Skyrim Special Edition'),
        },
        skyrimvr: {
          settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'SkyrimVR'),
          appDataPath: () => path.join(localAppData(), 'SkyrimVR'),
        },
      }, {
        xbox: {
          skyrimse: {
            settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Skyrim Special Edition MS'),
            appDataPath: () => path.join(localAppData(), 'Skyrim Special Edition MS'),
          },
          fallout4: {
            settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Fallout4 MS'),
            appDataPath: () => path.join(localAppData(), 'Fallout4 MS'),
          },
        },
        gog: {
          skyrimse: {
            settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Skyrim Special Edition GOG'),
            appDataPath: () => path.join(localAppData(), 'Skyrim Special Edition GOG'),
          },
          enderalspecialedition: {
            settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Enderal Special Edition GOG'),
            appDataPath: () => path.join(localAppData(), 'Enderal Special Edition GOG'),
          },
        },
        epic: {
          skyrimse: {
            settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Skyrim Special Edition EPIC'),
            appDataPath: () => path.join(localAppData(), 'Skyrim Special Edition EPIC'),
          },
          fallout4: {
            settingsPath: () => path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', 'Fallout4 EPIC'),
            appDataPath: () => path.join(localAppData(), 'Fallout4 EPIC'),
          },
        },
      }, gameId => gameStoreForGame(gameId));
      let gameStoreForGame = () => undefined;
      function initGameSupport(api) {
        gameStoreForGame = (gameId) => { let _a; return (_a = vortex_api_1.selectors.discoveryByGame(api.store.getState(), gameId)) === null || _a === void 0 ? void 0 : _a.store; };
      }
      exports.initGameSupport = initGameSupport;
      function settingsPath(game) {
        let _a, _b, _c, _d;
        return (_b = (_a = gameSupport.get(game.id, 'settingsPath')) === null || _a === void 0 ? void 0 : _a()) !== null && _b !== void 0 ? _b : (_d = (_c = game.details) === null || _c === void 0 ? void 0 : _c.settingsPath) === null || _d === void 0 ? void 0 : _d.call(_c);
      }
      exports.settingsPath = settingsPath;
      function appDataPath(game) {
        let _a, _b, _c, _d;
        return (_b = (_a = gameSupport.get(game.id, 'appDataPath')) === null || _a === void 0 ? void 0 : _a()) !== null && _b !== void 0 ? _b : (_d = (_c = game.details) === null || _c === void 0 ? void 0 : _c.appDataPath) === null || _d === void 0 ? void 0 : _d.call(_c);
      }
      exports.appDataPath = appDataPath;


/***/ }),

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
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
      const gameSupport_1 = __webpack_require__(/*! ./gameSupport */ "./src/gameSupport.ts");
      const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
      const path = __importStar(__webpack_require__(/*! path */ "path"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      function init(context) {
        (0, gameSupport_1.initGameSupport)(context.api);
        context.registerAction('mod-icons', 300, 'open-ext', {}, 'Open Mod Staging Folder', () => {
          const store = context.api.store;
          vortex_api_1.util.opn(vortex_api_1.selectors.installPath(store.getState())).catch(err => undefined);
        });
        context.registerAction('mod-icons', 300, 'open-ext', {}, 'Open Game Folder', () => {
          const state = context.api.store.getState();
          const gameId = vortex_api_1.selectors.activeGameId(state);
          getGameInstallPath(state, gameId).then((installPath) => {
            openPath(installPath);
          }).catch(e => { context.api.showErrorNotification('Failed to open game folder', e); });
        });
        context.registerAction('download-actions', 100, 'open-ext', {}, 'Open Folder', () => {
          const state = context.api.getState();
          const dlPath = vortex_api_1.selectors.downloadPath(state);
          vortex_api_1.util.opn(dlPath).catch(() => undefined);
        });
        context.registerAction('mod-icons', 300, 'open-ext', {}, 'Open Game Mods Folder', () => {
          const state = context.api.store.getState();
          const gameRef = vortex_api_1.util.getGame(vortex_api_1.selectors.activeGameId(state));
          getGameInstallPath(state, gameRef.id).then((installPath) => {
            let modPath = ((!!gameRef.details) && (!!gameRef.details.customOpenModsPath))
              ? gameRef.details.customOpenModsPath
              : gameRef.queryModPath(installPath);
            if (!path.isAbsolute(modPath)) {
              modPath = path.join(installPath, modPath) + path.sep;
            }
            openPath(modPath, installPath);
          }).catch(e => { context.api.showErrorNotification('Failed to open the game mods folder', e); });
        });
        context.registerAction('mod-icons', 300, 'open-ext', {}, 'Open Game Settings Folder', () => {
          const state = context.api.getState();
          const gameId = vortex_api_1.selectors.activeGameId(state);
          const game = vortex_api_1.util.getGame(gameId);
          const target = (0, gameSupport_1.settingsPath)(game);
          if (target !== undefined) {
            openPath(target);
          }
        }, () => {
          const state = context.api.getState();
          const gameId = vortex_api_1.selectors.activeGameId(state);
          const game = vortex_api_1.util.getGame(gameId);
          return (0, gameSupport_1.settingsPath)(game) !== undefined;
        });
        context.registerAction('mod-icons', 300, 'open-ext', {}, 'Open Game Application Data Folder', () => {
          const state = context.api.getState();
          const gameId = vortex_api_1.selectors.activeGameId(state);
          const game = vortex_api_1.util.getGame(gameId);
          const target = (0, gameSupport_1.appDataPath)(game);
          if (target !== undefined) {
            openPath(target);
          }
        }, () => {
          const state = context.api.getState();
          const gameId = vortex_api_1.selectors.activeGameId(state);
          const game = vortex_api_1.util.getGame(gameId);
          return (0, gameSupport_1.appDataPath)(game) !== undefined;
        });
        context.registerAction('mods-action-icons', 100, 'open-ext', {}, 'Open in File Manager', (instanceIds) => {
          const store = context.api.store;
          const installPath = vortex_api_1.selectors.installPath(store.getState());
          const modPath = path.join(installPath, instanceIds[0]);
          openPath(modPath, installPath);
        }, instanceIds => {
          const state = context.api.store.getState();
          const gameMode = vortex_api_1.selectors.activeGameId(state);
          return vortex_api_1.util.getSafe(state.persistent.mods, [gameMode, instanceIds[0]], undefined) !== undefined;
        });
        context.registerAction('mods-action-icons', 100, 'open-ext', {}, 'Open Archive', (instanceIds) => {
          let _a;
          const state = context.api.getState();
          const downloadPath = vortex_api_1.selectors.downloadPath(state);
          const mod = vortex_api_1.util.getSafe(state.persistent.mods, [vortex_api_1.selectors.activeGameId(state), instanceIds[0]], undefined);
          const downloadId = (_a = mod === null || mod === void 0 ? void 0 : mod.archiveId) !== null && _a !== void 0 ? _a : instanceIds[0];
          const download = vortex_api_1.util.getSafe(state.persistent.downloads.files, [downloadId], undefined);
          if (!download) {
            context.api.showErrorNotification('Failed to open mod archive', 'The mod archive could not be found.', { allowReport: false });
            return;
          }
          const modArchivePath = path.join(downloadPath, download.localPath);
          openPath(modArchivePath, downloadPath);
        }, instanceIds => {
          let _a;
          const state = context.api.store.getState();
          const gameMode = vortex_api_1.selectors.activeGameId(state);
          const mod = vortex_api_1.util.getSafe(state.persistent.mods, [gameMode, instanceIds[0]], undefined);
          const downloadId = (_a = mod === null || mod === void 0 ? void 0 : mod.archiveId) !== null && _a !== void 0 ? _a : instanceIds[0];
          return vortex_api_1.util.getSafe(state.persistent.downloads.files, [downloadId], undefined) !== undefined;
        });
        context.registerAction('download-icons', 300, 'open-ext', {}, 'Open in File Manager', () => {
          const store = context.api.store;
          vortex_api_1.util.opn(vortex_api_1.selectors.downloadPath(store.getState())).catch(err => undefined);
        });
        return true;
      }
      function getGameInstallPath(state, gameId) {
        return new bluebird_1.default((resolve, reject) => {
          const discoveredPath = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', gameId, 'path'], undefined);
          if (discoveredPath === undefined) {
            reject(new Error(`Could not resolve game path for "${gameId}"`));
          }
          else {
            resolve(discoveredPath);
          }
        });
      }
      function openPath(mainPath, fallbackPath) {
        vortex_api_1.fs.statAsync(mainPath)
          .then(() => vortex_api_1.util.opn(mainPath).catch(() => undefined))
          .catch(() => (fallbackPath !== undefined)
            ? vortex_api_1.util.opn(fallbackPath).catch(() => undefined)
            : undefined)
          .then(() => null);
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
//# sourceMappingURL=bundledPlugins/open-directory/open-directory.js.map