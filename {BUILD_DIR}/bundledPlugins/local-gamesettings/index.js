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
const gameSupport_1 = __webpack_require__(/*! ./util/gameSupport */ "./src/util/gameSupport.ts");
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function copyGameSettings(sourcePath, destinationPath, files, copyType) {
    return bluebird_1.default.map(files, gameSetting => {
        let source = path.join(sourcePath, gameSetting.name);
        let destination = path.join(destinationPath, path.basename(gameSetting.name));
        const destinationOrig = destination;
        if (copyType.startsWith('Glo')) {
            source += '.base';
        }
        else if (copyType.endsWith('Glo')) {
            destination += '.base';
        }
        (0, vortex_api_1.log)('debug', 'copying profile inis', { source, destination });
        return vortex_api_1.fs.copyAsync(source, destination, { noSelfCopy: true })
            .catch(err => {
            if (gameSetting.optional) {
                return bluebird_1.default.resolve();
            }
            switch (copyType) {
                case 'BacGlo': return vortex_api_1.fs.copyAsync(destination, source, { noSelfCopy: true });
                case 'ProGlo': return vortex_api_1.fs.copyAsync(destination, source, { noSelfCopy: true });
                default: return bluebird_1.default.reject(err);
            }
        })
            .then(() => copyType.endsWith('Glo')
            ? vortex_api_1.fs.copyAsync(source, destinationOrig, { noSelfCopy: true })
                .then(() => vortex_api_1.fs.copyAsync(source, destinationOrig + '.baked', { noSelfCopy: true }))
                .catch({ code: 'ENOENT' }, err => gameSetting.optional ? bluebird_1.default.resolve() : bluebird_1.default.reject(err))
            : bluebird_1.default.resolve());
    })
        .then(() => undefined);
}
function checkGlobalFiles(oldProfile, newProfile) {
    let fileList = [];
    if ((oldProfile !== undefined) && (0, gameSupport_1.gameSupported)(oldProfile.gameId)) {
        fileList = fileList.concat((0, gameSupport_1.gameSettingsFiles)(oldProfile.gameId, (0, gameSupport_1.mygamesPath)(oldProfile.gameId)));
    }
    if ((newProfile !== undefined) && (0, gameSupport_1.gameSupported)(newProfile.gameId)) {
        fileList = fileList.concat((0, gameSupport_1.gameSettingsFiles)(newProfile.gameId, (0, gameSupport_1.mygamesPath)(newProfile.gameId)));
    }
    fileList = vortex_api_1.util.unique(fileList, item => item.name);
    return bluebird_1.default.filter(fileList, file => file.optional
        ? bluebird_1.default.resolve(false)
        : vortex_api_1.fs.statAsync(file.name).then(() => false).catch(() => true))
        .then((missingFiles) => {
        if (missingFiles.length > 0) {
            return bluebird_1.default.resolve(missingFiles);
        }
        else {
            return bluebird_1.default.resolve(null);
        }
    });
}
function updateLocalGameSettings(featureId, oldProfile, newProfile) {
    let copyFiles = bluebird_1.default.resolve();
    if (!!oldProfile
        && (oldProfile.features !== undefined)
        && oldProfile.features[featureId]
        && (0, gameSupport_1.gameSupported)(oldProfile.gameId)) {
        const myGames = (0, gameSupport_1.mygamesPath)(oldProfile.gameId);
        const gameSettings = (0, gameSupport_1.gameSettingsFiles)(oldProfile.gameId, null);
        copyFiles = copyFiles
            .then(() => (oldProfile.pendingRemove === true)
            ? bluebird_1.default.resolve()
            : copyGameSettings(myGames, (0, gameSupport_1.profilePath)(oldProfile), gameSettings, 'GloPro'))
            .then(() => copyGameSettings((0, gameSupport_1.backupPath)(oldProfile), myGames, gameSettings, 'BacGlo'));
    }
    if (!!newProfile
        && (newProfile.features !== undefined)
        && (newProfile.features[featureId])
        && (0, gameSupport_1.gameSupported)(newProfile.gameId)) {
        const myGames = (0, gameSupport_1.mygamesPath)(newProfile.gameId);
        const gameSettings = (0, gameSupport_1.gameSettingsFiles)(newProfile.gameId, null);
        copyFiles = copyFiles
            .then(() => copyGameSettings(myGames, (0, gameSupport_1.backupPath)(newProfile), gameSettings, 'GloBac'))
            .then(() => copyGameSettings((0, gameSupport_1.profilePath)(newProfile), myGames, gameSettings, 'ProGlo'));
    }
    return bluebird_1.default.resolve(copyFiles);
}
function onSwitchGameProfile(store, oldProfile, newProfile) {
    return checkGlobalFiles(oldProfile, newProfile)
        .then(missingFiles => {
        if ((missingFiles !== undefined) && (missingFiles !== null)) {
            const fileList = missingFiles.map(fileName => `"${fileName.name}"`).join('\n');
            vortex_api_1.util.showError(store.dispatch, 'An error occurred activating profile', 'Files are missing or not writeable:\n' + fileList + '\n\n' +
                'Some games need to be run at least once before they can be modded.', { allowReport: false });
            return false;
        }
        return updateLocalGameSettings('local_game_settings', oldProfile, newProfile)
            .then(() => true)
            .catch(vortex_api_1.util.UserCanceled, err => {
            (0, vortex_api_1.log)('info', 'User canceled game settings update', err);
            return false;
        })
            .catch((err) => {
            vortex_api_1.util.showError(store.dispatch, 'An error occurred applying game settings', {
                error: err,
                'Old Game': (oldProfile || { gameId: 'none' }).gameId,
                'New Game': (newProfile || { gameId: 'none' }).gameId,
            });
            return false;
        });
    });
}
function onDeselectGameProfile(store, profile) {
    if (!profile || !(0, gameSupport_1.gameSupported)(profile.gameId)) {
        return bluebird_1.default.resolve(true);
    }
    return checkGlobalFiles(undefined, profile)
        .then(missingFiles => {
        if ((missingFiles !== undefined) && (missingFiles !== null)) {
            const fileList = missingFiles.map(fileName => `"${fileName.name}"`).join('\n');
            vortex_api_1.util.showError(store.dispatch, 'An error occurred activating profile', 'Files are missing or not writeable:\n' + fileList + '\n\n' +
                'Some games need to be run at least once before they can be modded.', { allowReport: false });
            return false;
        }
    })
        .then(() => {
        const myGames = (0, gameSupport_1.mygamesPath)(profile.gameId);
        const gameSettings = (0, gameSupport_1.gameSettingsFiles)(profile.gameId, null);
        return copyGameSettings(myGames, (0, gameSupport_1.profilePath)(profile), gameSettings, 'GloPro')
            .then(() => true);
    });
}
function bakeSettings(api, profile) {
    if (profile === undefined) {
        return bluebird_1.default.resolve();
    }
    const state = api.store.getState();
    const gameMods = state.persistent.mods[profile.gameId] || [];
    const mods = Object.keys(gameMods)
        .filter(key => vortex_api_1.util.getSafe(profile, ['modState', key, 'enabled'], false))
        .map(key => gameMods[key]);
    return vortex_api_1.util.sortMods(profile.gameId, mods, api)
        .then(sortedMods => api.emitAndAwait('bake-settings', profile.gameId, sortedMods, profile));
}
function init(context) {
    (0, gameSupport_1.initGameSupport)(context.api);
    context.registerProfileFeature('local_game_settings', 'boolean', 'settings', 'Game Settings', 'This profile has its own game settings', () => (0, gameSupport_1.gameSupported)(vortex_api_1.selectors.activeGameId(context.api.store.getState())));
    context.once(() => {
        const store = context.api.store;
        context.api.events.on('profile-will-change', (nextProfileId, enqueue) => {
            const state = store.getState();
            const oldProfileId = vortex_api_1.util.getSafe(state, ['settings', 'profiles', 'activeProfileId'], undefined);
            const oldProfile = state.persistent.profiles[oldProfileId];
            const newProfile = state.persistent.profiles[nextProfileId];
            const oldGameId = vortex_api_1.util.getSafe(oldProfile, ['gameId'], undefined);
            const newGameId = vortex_api_1.util.getSafe(newProfile, ['gameId'], undefined);
            if (oldGameId === newGameId) {
                enqueue(() => {
                    return bakeSettings(context.api, oldProfile)
                        .then(() => onSwitchGameProfile(store, oldProfile, newProfile)
                        .then(() => bakeSettings(context.api, newProfile))
                        .then(() => null));
                });
            }
            else {
                const lastActiveProfileId = newProfile !== undefined
                    ? vortex_api_1.selectors.lastActiveProfileForGame(state, newProfile.gameId)
                    : undefined;
                const lastActiveProfile = newProfile !== undefined
                    ? state.persistent.profiles[lastActiveProfileId]
                    : undefined;
                enqueue(() => bakeSettings(context.api, oldProfile)
                    .then(() => onDeselectGameProfile(store, oldProfile))
                    .tap(() => bakeSettings(context.api, lastActiveProfile))
                    .then((success) => success && (newProfile !== undefined)
                    ? onSwitchGameProfile(store, lastActiveProfile, newProfile)
                    : bluebird_1.default.resolve(success))
                    .then(() => bakeSettings(context.api, newProfile))
                    .catch(vortex_api_1.util.CycleError, err => {
                    (0, vortex_api_1.log)('warn', 'settings couldn\'t be baked because mod rules contain cycles', err);
                })
                    .catch(err => {
                    const usercanceled = (err instanceof vortex_api_1.util.UserCanceled);
                    context.api.showErrorNotification('failed to swap game settings file', err, { allowReport: !usercanceled });
                })
                    .then(() => null));
            }
        });
    });
    return true;
}
exports["default"] = init;


/***/ }),

/***/ "./src/util/gameSupport.ts":
/*!*********************************!*\
  !*** ./src/util/gameSupport.ts ***!
  \*********************************/
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
exports.backupPath = exports.profilePath = exports.gameSettingsFiles = exports.mygamesPath = exports.gameSupported = exports.initGameSupport = void 0;
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const gameSupport = vortex_api_1.util.makeOverlayableDictionary({
    skyrim: {
        mygamesPath: 'skyrim',
        gameSettingsFiles: ['Skyrim.ini', 'SkyrimPrefs.ini'],
    },
    enderal: {
        mygamesPath: 'Enderal',
        gameSettingsFiles: ['Enderal.ini', 'EnderalPrefs.ini'],
    },
    skyrimse: {
        mygamesPath: 'Skyrim Special Edition',
        gameSettingsFiles: ['Skyrim.ini', 'SkyrimPrefs.ini',
            { name: 'SkyrimCustom.ini', optional: true }],
    },
    enderalspecialedition: {
        mygamesPath: 'Enderal Special Edition',
        gameSettingsFiles: ['Enderal.ini', 'EnderalPrefs.ini'],
    },
    skyrimvr: {
        mygamesPath: 'Skyrim VR',
        gameSettingsFiles: ['Skyrim.ini', 'SkyrimVR.ini', 'SkyrimPrefs.ini'],
    },
    fallout3: {
        mygamesPath: 'Fallout3',
        gameSettingsFiles: ['Fallout.ini', 'FalloutPrefs.ini',
            { name: 'FalloutCustom.ini', optional: true }],
    },
    fallout4: {
        mygamesPath: 'Fallout4',
        gameSettingsFiles: ['Fallout4.ini', 'Fallout4Prefs.ini',
            { name: 'Fallout4Custom.ini', optional: true }],
    },
    fallout4vr: {
        mygamesPath: 'Fallout4VR',
        gameSettingsFiles: ['Fallout4Custom.ini', 'Fallout4Prefs.ini'],
    },
    starfield: {
        mygamesPath: 'Starfield',
        gameSettingsFiles: ['StarfieldCustom.ini', 'StarfieldPrefs.ini'],
    },
    falloutnv: {
        mygamesPath: 'FalloutNV',
        gameSettingsFiles: ['Fallout.ini', 'FalloutPrefs.ini',
            { name: 'FalloutCustom.ini', optional: true }],
    },
    oblivion: {
        mygamesPath: 'Oblivion',
        gameSettingsFiles: ['Oblivion.ini'],
    },
    oblivionremastered: {
        mygamesPath: path.join('Oblivion Remastered', 'Saved', 'Config', 'Windows'),
        gameSettingsFiles: ['Altar.ini'],
    },
}, {
    xbox: {
        skyrimse: {
            mygamesPath: 'Skyrim Special Edition MS',
        },
        fallout4: {
            mygamesPath: 'Fallout4 MS',
        },
    },
    gog: {
        skyrimse: {
            mygamesPath: 'Skyrim Special Edition GOG',
        },
        enderalspecialedition: {
            mygamesPath: 'Enderal Special Edition GOG',
        },
    },
    epic: {
        skyrimse: {
            mygamesPath: 'Skyrim Special Edition EPIC',
        },
        fallout4: {
            mygamesPath: 'Fallout4 EPIC',
        },
    },
    enderalseOverlay: {
        enderalspecialedition: {
            mygamesPath: 'Skyrim Special Edition',
            gameSettingsFiles: ['Skyrim.ini', 'SkyrimPrefs.ini',
                { name: 'SkyrimCustom.ini', optional: true }],
        },
    },
}, (gameId) => {
    const discovery = discoveryForGame(gameId);
    if (((discovery === null || discovery === void 0 ? void 0 : discovery.path) !== undefined)
        && (gameId === 'enderalspecialedition')
        && discovery.path.includes('skyrim')) {
        return 'enderalseOverlay';
    }
    else {
        return discovery === null || discovery === void 0 ? void 0 : discovery.store;
    }
});
let discoveryForGame = () => undefined;
function initGameSupport(api) {
    discoveryForGame = (gameId) => vortex_api_1.selectors.discoveryByGame(api.store.getState(), gameId);
}
exports.initGameSupport = initGameSupport;
function gameSupported(gameMode) {
    return gameSupport.has(gameMode);
}
exports.gameSupported = gameSupported;
function mygamesPath(gameMode) {
    return path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', gameSupport.get(gameMode, 'mygamesPath'));
}
exports.mygamesPath = mygamesPath;
function gameSettingsFiles(gameMode, customPath) {
    const fileNames = gameSupport.get(gameMode, 'gameSettingsFiles');
    const mapFile = (input) => typeof (input) === 'string'
        ? { name: input, optional: false }
        : input;
    if (customPath === null) {
        return fileNames.map(mapFile);
    }
    else {
        return fileNames
            .map(mapFile)
            .map(input => ({ name: path.join(customPath, input.name), optional: input.optional }));
    }
}
exports.gameSettingsFiles = gameSettingsFiles;
function profilePath(profile) {
    return path.join(vortex_api_1.util.getVortexPath('userData'), profile.gameId, 'profiles', profile.id);
}
exports.profilePath = profilePath;
function backupPath(profile) {
    return path.join(vortex_api_1.util.getVortexPath('userData'), profile.gameId);
}
exports.backupPath = backupPath;


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
//# sourceMappingURL=bundledPlugins/local-gamesettings/local-gamesettings.js.map