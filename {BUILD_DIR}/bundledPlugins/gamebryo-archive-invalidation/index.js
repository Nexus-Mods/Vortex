/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/bsaRedirection.ts":
/*!*******************************!*\
  !*** ./src/bsaRedirection.ts ***!
  \*******************************/
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
exports.toggleInvalidation = void 0;
const constants_1 = __webpack_require__(/*! ./constants */ "./src/constants.ts");
const gameSupport_1 = __webpack_require__(/*! ./util/gameSupport */ "./src/util/gameSupport.ts");
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const vortex_parse_ini_1 = __importStar(__webpack_require__(/*! vortex-parse-ini */ "vortex-parse-ini"));
function genIniTweaksIni(api) {
    const gameId = vortex_api_1.selectors.activeGameId(api.store.getState());
    const parser = new vortex_parse_ini_1.default(new vortex_parse_ini_1.WinapiFormat());
    const archivesKey = (0, gameSupport_1.archiveListKey)(gameId);
    return parser.read((0, gameSupport_1.iniPath)(gameId))
        .then(ini => {
        let archives = (0, gameSupport_1.defaultArchives)(gameId);
        if ((ini.data['Archive'] !== undefined) && (ini.data['Archive'][archivesKey] !== undefined)) {
            archives = ini.data['Archive'][archivesKey];
        }
        return bluebird_1.default.resolve(`[Archive]
bInvalidateOlderFiles=1
bUseArchives=1
${archivesKey}=${constants_1.REDIRECTION_FILE}, ${archives}`);
    });
}
function enableBSARedirection(api) {
    const store = api.store;
    const gameMode = vortex_api_1.selectors.activeGameId(store.getState());
    if (!(0, gameSupport_1.isSupported)(gameMode)) {
        return bluebird_1.default.resolve(undefined);
    }
    const gamePath = vortex_api_1.util.getSafe(store.getState(), ['settings', 'gameMode', 'discovered', gameMode, 'path'], undefined);
    if (gamePath === undefined) {
        return bluebird_1.default.resolve(undefined);
    }
    const iniBaseName = path.basename((0, gameSupport_1.iniName)(gameMode), '.ini');
    const redirectionIni = `BSA Redirection [${iniBaseName}].ini`;
    const mod = {
        id: constants_1.REDIRECTION_MOD,
        state: 'installed',
        attributes: {
            name: constants_1.REDIRECTION_MOD,
        },
        installationPath: constants_1.REDIRECTION_MOD,
        type: '',
    };
    const installPath = vortex_api_1.selectors.installPath(store.getState());
    const iniTweaksPath = path.join(installPath, constants_1.REDIRECTION_MOD, 'Ini Tweaks');
    const invalidationPath = path.join(installPath, constants_1.REDIRECTION_MOD, constants_1.REDIRECTION_FILE);
    const dummyFile = path.join(path.dirname(invalidationPath), 'dummy', 'dummy.dds');
    const createDummy = () => vortex_api_1.fs.ensureDirWritableAsync(path.dirname(dummyFile))
        .then(() => vortex_api_1.fs.writeFileAsync(dummyFile, '', { encoding: 'utf8' })
        .catch(err => err.code !== 'EEXIST' ? bluebird_1.default.reject(err) : bluebird_1.default.resolve()));
    const cleanupDummy = () => bluebird_1.default.mapSeries([dummyFile, path.dirname(dummyFile)], iter => vortex_api_1.fs.removeAsync(iter).catch(err => bluebird_1.default.resolve()));
    return new bluebird_1.default((resolve, reject) => {
        api.events.emit('create-mod', gameMode, mod, (error) => {
            if (error !== null) {
                return reject(error);
            }
            return resolve();
        });
    })
        .then(() => createDummy())
        .then(() => vortex_api_1.fs.ensureDirAsync(iniTweaksPath))
        .then(() => vortex_api_1.fs.forcePerm(api.translate, () => {
        return api.openArchive(invalidationPath, {
            version: (0, gameSupport_1.bsaVersion)(gameMode).toString(),
            create: true,
        })
            .then(archive => archive.addFile(path.join('dummy', path.basename(dummyFile)), dummyFile)
            .then(() => archive.write()));
    }, invalidationPath))
        .then(() => cleanupDummy())
        .then(() => genIniTweaksIni(api))
        .then(data => vortex_api_1.fs.writeFileAsync(path.join(iniTweaksPath, redirectionIni), data))
        .then(() => {
        const profile = vortex_api_1.selectors.activeProfile(store.getState());
        store.dispatch(vortex_api_1.actions.setModEnabled(profile.id, constants_1.REDIRECTION_MOD, true));
        store.dispatch(vortex_api_1.actions.setINITweakEnabled(gameMode, constants_1.REDIRECTION_MOD, redirectionIni, true));
    })
        .catch(err => {
        if (err['path'] === undefined) {
            err['path'] = invalidationPath;
        }
        return bluebird_1.default.reject(err);
    });
}
function toggleInvalidation(api, gameMode) {
    const mods = vortex_api_1.util.getSafe(api.store.getState(), ['persistent', 'mods', gameMode], {});
    if (mods[constants_1.REDIRECTION_MOD] !== undefined) {
        api.events.emit('remove-mod', gameMode, constants_1.REDIRECTION_MOD);
        return bluebird_1.default.resolve();
    }
    else {
        return enableBSARedirection(api)
            .catch(vortex_api_1.util.NotSupportedError, err => {
            api.showErrorNotification('Failed to add invalidation mod', 'The extension providing BSA support has been disabled or removed. '
                + 'Without it, Vortex can\'t provide BSA redirection.', {
                allowReport: false,
            });
            api.events.emit('remove-mod', gameMode, constants_1.REDIRECTION_MOD);
        })
            .catch(err => {
            api.showErrorNotification('Failed to add invalidation mod', err);
            api.events.emit('remove-mod', gameMode, constants_1.REDIRECTION_MOD);
        });
    }
}
exports.toggleInvalidation = toggleInvalidation;


/***/ }),

/***/ "./src/constants.ts":
/*!**************************!*\
  !*** ./src/constants.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.REDIRECTION_FILE = exports.REDIRECTION_MOD = void 0;
exports.REDIRECTION_MOD = 'Vortex Archive Invalidation';
exports.REDIRECTION_FILE = 'Vortex - BSA Redirection.bsa';


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
const filesNewer_1 = __importDefault(__webpack_require__(/*! ./util/filesNewer */ "./src/util/filesNewer.ts"));
const gameSupport_1 = __webpack_require__(/*! ./util/gameSupport */ "./src/util/gameSupport.ts");
const Settings_1 = __importDefault(__webpack_require__(/*! ./views/Settings */ "./src/views/Settings.tsx"));
const bsaRedirection_1 = __webpack_require__(/*! ./bsaRedirection */ "./src/bsaRedirection.ts");
const constants_1 = __webpack_require__(/*! ./constants */ "./src/constants.ts");
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function testArchivesAge(api) {
    const state = api.store.getState();
    const gameId = vortex_api_1.selectors.activeGameId(state);
    if (!(0, gameSupport_1.isSupported)(gameId)) {
        return bluebird_1.default.resolve(undefined);
    }
    const gamePath = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', gameId, 'path'], undefined);
    if (gamePath === undefined) {
        return bluebird_1.default.resolve(undefined);
    }
    const game = vortex_api_1.util.getGame(gameId);
    const dataPath = game.getModPaths(gamePath)[''];
    const age = (0, gameSupport_1.targetAge)(gameId);
    if (age === undefined) {
        return bluebird_1.default.resolve(undefined);
    }
    return (0, filesNewer_1.default)(dataPath, (0, gameSupport_1.fileFilter)(gameId), age)
        .then((files) => {
        if (files.length === 0) {
            return bluebird_1.default.resolve(undefined);
        }
        return bluebird_1.default.resolve({
            description: {
                short: 'Loose files may not get loaded',
                long: 'Due to oddities in the game engine, some loose files will not ' +
                    'get loaded unless we change the filetime on the vanilla BSA/BA2 files. ' +
                    'There is no drawback to doing this.',
            },
            severity: 'warning',
            automaticFix: () => new bluebird_1.default((fixResolve, fixReject) => bluebird_1.default.map(files, file => vortex_api_1.fs.utimesAsync(path.join(dataPath, file), age.getTime() / 1000, age.getTime() / 1000))
                .then((stats) => {
                fixResolve();
                return bluebird_1.default.resolve(undefined);
            })
                .catch(err => {
                api.store.dispatch(vortex_api_1.actions.addNotification({
                    type: 'error',
                    title: 'Failed to change file times',
                    message: err.code === 'EPERM'
                        ? 'Game files are write protected'
                        : err.message,
                }));
                fixResolve();
            })),
        });
    })
        .catch(vortex_api_1.util.UserCanceled, () => bluebird_1.default.resolve(undefined))
        .catch((err) => {
        api.showErrorNotification('Failed to read bsa/ba2 files.', err, {
            allowReport: err.code !== 'ENOENT',
        });
        return bluebird_1.default.resolve(undefined);
    });
}
function applyIniSettings(api, profile, iniFile) {
    if (iniFile.data.Archive === undefined) {
        iniFile.data.Archive = {};
    }
    iniFile.data.Archive.bInvalidateOlderFiles = 1;
    iniFile.data.Archive.sResourceDataDirsFinal = '';
}
function useBSARedirection(gameMode) {
    return (0, gameSupport_1.isSupported)(gameMode) && ((0, gameSupport_1.bsaVersion)(gameMode) !== undefined);
}
function init(context) {
    (0, gameSupport_1.initGameSupport)(context.api);
    context.registerTest('archive-backdate', 'gamemode-activated', () => testArchivesAge(context.api));
    context.registerToDo('bsa-redirection', 'workaround', (state) => {
        const gameMode = vortex_api_1.selectors.activeGameId(state);
        return {
            gameMode,
            mods: vortex_api_1.util.getSafe(state, ['persistent', 'mods', gameMode], {}),
        };
    }, 'workaround', 'Archive Invalidation', (props) => (0, bsaRedirection_1.toggleInvalidation)(context.api, props.gameMode), (props) => useBSARedirection(props.gameMode), (t, props) => ((props.mods[constants_1.REDIRECTION_MOD] !== undefined) ? t('Yes') : t('No')), undefined);
    context.registerSettings('Workarounds', Settings_1.default, undefined, () => useBSARedirection(vortex_api_1.selectors.activeGameId(context.api.store.getState())));
    context.once(() => {
        context.api.onAsync('apply-settings', (profile, filePath, ini) => {
            (0, vortex_api_1.log)('debug', 'apply AI settings', { gameId: profile.gameId, filePath });
            if ((0, gameSupport_1.isSupported)(profile.gameId)
                && (filePath.toLowerCase() === (0, gameSupport_1.iniPath)(profile.gameId).toLowerCase())) {
                applyIniSettings(context.api, profile, ini);
            }
            return bluebird_1.default.resolve();
        });
    });
    return true;
}
exports["default"] = init;


/***/ }),

/***/ "./src/util/filesNewer.ts":
/*!********************************!*\
  !*** ./src/util/filesNewer.ts ***!
  \********************************/
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
function filesNewer(searchPath, nameFilter, minAge) {
    return vortex_api_1.fs.readdirAsync(searchPath)
        .then((files) => {
        const matches = files.filter(nameFilter);
        return bluebird_1.default.map(matches, file => vortex_api_1.fs.statAsync(path.join(searchPath, file))
            .then((stats) => bluebird_1.default.resolve({
            name: file,
            stats,
        })));
    })
        .then((fileStats) => fileStats.filter(file => file.stats.mtime > minAge)
        .map(file => file.name));
}
exports["default"] = filesNewer;


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
exports.defaultArchives = exports.archiveListKey = exports.iniPath = exports.iniName = exports.mygamesPath = exports.bsaVersion = exports.targetAge = exports.fileFilter = exports.isSupported = exports.initGameSupport = void 0;
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const gameSupport = vortex_api_1.util.makeOverlayableDictionary({
    skyrim: {
        fileFilter: (fileName) => {
            const fileNameL = fileName.toLowerCase();
            return (path.extname(fileNameL) === '.bsa')
                && (fileNameL.startsWith('skyrim - ')
                    || (fileNameL.startsWith('hearthfires'))
                    || (fileNameL.startsWith('dragonborn'))
                    || (fileNameL.startsWith('highrestexturepack')));
        },
        targetAge: new Date(2008, 10, 1),
        mygamesPath: 'skyrim',
        iniName: 'Skyrim.ini',
        archiveListKey: 'SResourceArchiveList',
        defaultArchives: ['Skyrim - Misc.bsa', 'Skyrim - Shaders.bsa', 'Skyrim - Textures.bsa',
            'Skyrim - Interface.bsa', 'Skyrim - Animations.bsa', 'Skyrim - Meshes.bsa',
            'Skyrim - Sounds.bsa'],
    },
    enderal: {
        fileFilter: (fileName) => {
            const fileNameL = fileName.toLowerCase();
            return (path.extname(fileNameL) === '.bsa')
                && (fileNameL.startsWith('skyrim - ')
                    || (fileNameL.startsWith('E - '))
                    || (fileNameL.startsWith('L - ')));
        },
        targetAge: new Date(2008, 10, 1),
        mygamesPath: 'enderal',
        iniName: 'enderal.ini',
        archiveListKey: 'SResourceArchiveList',
        defaultArchives: ['Skyrim - Misc.bsa', 'Skyrim - Shaders.bsa', 'Skyrim - Textures.bsa',
            'Skyrim - Interface.bsa', 'Skyrim - Animations.bsa', 'Skyrim - Meshes.bsa',
            'Skyrim - Sounds.bsa',
            'E - Meshes.bsa', 'E - Music.bsa', 'E - Scripts.bsa', 'E - Sounds.bsa',
            'E - Textures1.bsa', 'E - Textures2.bsa', 'E - Textures3.bsa',
            'L - Textures.bsa', 'L - Voices.bsa'],
    },
    skyrimse: {
        fileFilter: (fileName) => fileName.startsWith('Skyrim - ')
            && path.extname(fileName).toLowerCase() === '.bsa',
        targetAge: new Date(2008, 10, 1),
        mygamesPath: 'Skyrim Special Edition',
        iniName: 'Skyrim.ini',
        archiveListKey: 'SResourceArchiveList',
        defaultArchives: ['Skyrim - Misc.bsa', 'Skyrim - Shaders.bsa', 'Skyrim - Interface.bsa',
            'Skyrim - Animations.bsa', 'Skyrim - Meshes0.bsa',
            'Skyrim - Meshes1.bsa', 'Skyrim - Sounds.bsa'],
    },
    skyrimvr: {
        fileFilter: (fileName) => fileName.startsWith('Skyrim - ')
            && path.extname(fileName).toLowerCase() === '.bsa',
        targetAge: new Date(2008, 10, 1),
        mygamesPath: 'Skyrim VR',
        iniName: 'SkyrimVR.ini',
        archiveListKey: 'SResourceArchiveList',
        defaultArchives: ['Skyrim - Misc.bsa', 'Skyrim - Shaders.bsa', 'Skyrim - Interface.bsa',
            'Skyrim - Animations.bsa', 'Skyrim - Meshes0.bsa', 'Skyrim - Meshes1.bsa',
            'Skyrim - Sounds.bsa'],
    },
    fallout4: {
        fileFilter: (fileName) => {
            const fileNameL = fileName.toLowerCase();
            return path.extname(fileNameL) === '.ba2'
                && (fileNameL.startsWith('fallout4 - ')
                    || fileNameL.startsWith('dlccoast - ')
                    || fileNameL.startsWith('dlcrobot - ')
                    || fileNameL.startsWith('dlcworkshop')
                    || fileNameL.startsWith('dlcnukaworld - '));
        },
        targetAge: new Date(2008, 10, 1),
        mygamesPath: 'Fallout4',
        iniName: 'Fallout4.ini',
        archiveListKey: 'SResourceArchiveList',
        defaultArchives: ['Fallout4 - Voices.ba2', 'Fallout4 - Meshes.ba2',
            'Fallout4 - MeshesExtra.ba2', 'Fallout4 - Misc.ba2',
            'Fallout4 - Sounds.ba2', 'Fallout4 - Materials.ba2'],
    },
    fallout4vr: {
        fileFilter: (fileName) => (fileName.startsWith('Fallout4 - ') || (fileName.startsWith('Fallout4_VR - ')))
            && path.extname(fileName).toLowerCase() === '.ba2',
        targetAge: new Date(2008, 10, 1),
        mygamesPath: 'Fallout4VR',
        iniName: 'Fallout4Custom.ini',
        archiveListKey: 'SResourceArchiveList',
        defaultArchives: ['Fallout4 - Voices.ba2', 'Fallout4 - Meshes.ba2',
            'Fallout4 - MeshesExtra.ba2', 'Fallout4 - Misc.ba2',
            'Fallout4 - Sounds.ba2', 'Fallout4 - Materials.ba2'],
    },
    fallout3: {
        fileFilter: (fileName) => path.extname(fileName) === '.bsa'
            && (fileName.startsWith('Fallout - ')
                || fileName.startsWith('BrokenSteel - ')
                || fileName.startsWith('Anchorage - ')
                || fileName.startsWith('PointLookout - ')
                || fileName.startsWith('Zeta - ')
                || fileName.startsWith('ThePitt - ')),
        targetAge: new Date(2006, 1, 1),
        bsaVersion: 0x68,
        mygamesPath: 'Fallout3',
        iniName: 'Fallout.ini',
        archiveListKey: 'SArchiveList',
        defaultArchives: ['Fallout - Textures.bsa', 'Fallout - Meshes.bsa', 'Fallout - Voices.bsa',
            'Fallout - Sound.bsa', 'Fallout - MenuVoices.bsa', 'Fallout - Misc.bsa'],
    },
    falloutnv: {
        fileFilter: (fileName) => path.extname(fileName) === '.bsa'
            && (fileName.startsWith('Fallout - ')
                || fileName.startsWith('DeadMoney -')
                || fileName.startsWith('HonestHearts - ')
                || fileName.startsWith('OldWorldBlues - ')
                || fileName.startsWith('LonesomeRoad - ')
                || fileName.startsWith('CaravanPack - ')
                || fileName.startsWith('ClassicPack - ')
                || fileName.startsWith('MercenaryPack - ')
                || fileName.startsWith('TribalPack - ')
                || fileName.startsWith('GunRunnersArsenal - ')),
        targetAge: new Date(2006, 1, 1),
        bsaVersion: 0x68,
        mygamesPath: 'FalloutNV',
        iniName: 'Fallout.ini',
        archiveListKey: 'SArchiveList',
        defaultArchives: ['Fallout - Textures.bsa', 'Fallout - Textures2.bsa', 'Fallout - Meshes.bsa',
            'Fallout - Voices1.bsa', 'Fallout - Sound.bsa', 'Fallout - Misc.bsa'],
    },
    starfield: {
        fileFilter: (fileName) => (fileName.match(/(starfield - |sfbgs)/))
            && path.extname(fileName).toLowerCase() === '.ba2',
        targetAge: new Date(2008, 10, 1),
        mygamesPath: 'Starfield',
        iniName: 'StarfieldCustom.ini',
        archiveListKey: 'SResourceArchiveList',
        defaultArchives: [],
    },
    oblivion: {
        fileFilter: (fileName) => path.extname(fileName) === '.bsa'
            && (fileName.startsWith('Oblivion - ')
                || fileName.startsWith('DLC')
                || fileName.startsWith('Knights')),
        targetAge: new Date(2006, 1, 1),
        bsaVersion: 0x67,
        mygamesPath: 'Oblivion',
        iniName: 'Oblivion.ini',
        archiveListKey: 'SArchiveList',
        defaultArchives: ['Oblivion - Meshes.bsa', 'Oblivion - Textures - Compressed.bsa',
            'Oblivion - Sounds.bsa', 'Oblivion - Voices1.bsa',
            'Oblivion - Voices2.bsa', 'Oblivion - Misc.bsa'],
    },
}, {
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
    xbox: {
        skyrimse: {
            mygamesPath: 'Skyrim Special Edition MS',
        },
        fallout4: {
            mygamesPath: 'Fallout4 MS',
        },
    },
}, (gameId) => gameStoreForGame(gameId));
let gameStoreForGame = () => undefined;
function initGameSupport(api) {
    gameStoreForGame = (gameId) => { var _a; return (_a = vortex_api_1.selectors.discoveryByGame(api.store.getState(), gameId)) === null || _a === void 0 ? void 0 : _a.store; };
}
exports.initGameSupport = initGameSupport;
function isSupported(gameId) {
    return gameSupport.has(gameId);
}
exports.isSupported = isSupported;
function falseFunc() {
    return false;
}
function fileFilter(gameId) {
    var _a;
    return (_a = gameSupport.get(gameId, 'fileFilter')) !== null && _a !== void 0 ? _a : falseFunc;
}
exports.fileFilter = fileFilter;
function targetAge(gameId) {
    return gameSupport.get(gameId, 'targetAge');
}
exports.targetAge = targetAge;
function bsaVersion(gameId) {
    return gameSupport.get(gameId, 'bsaVersion');
}
exports.bsaVersion = bsaVersion;
function mygamesPath(gameMode) {
    return path.join(vortex_api_1.util.getVortexPath('documents'), 'My Games', gameSupport.get(gameMode, 'mygamesPath'));
}
exports.mygamesPath = mygamesPath;
function iniName(gameMode) {
    return gameSupport.get(gameMode, 'iniName');
}
exports.iniName = iniName;
function iniPath(gameMode) {
    return path.join(mygamesPath(gameMode), gameSupport.get(gameMode, 'iniName'));
}
exports.iniPath = iniPath;
function archiveListKey(gameMode) {
    return gameSupport.get(gameMode, 'archiveListKey');
}
exports.archiveListKey = archiveListKey;
function defaultArchives(gameMode) {
    return gameSupport.get(gameMode, 'defaultArchives');
}
exports.defaultArchives = defaultArchives;


/***/ }),

/***/ "./src/views/Settings.tsx":
/*!********************************!*\
  !*** ./src/views/Settings.tsx ***!
  \********************************/
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
const gameSupport_1 = __webpack_require__(/*! ../util/gameSupport */ "./src/util/gameSupport.ts");
const bsaRedirection_1 = __webpack_require__(/*! ../bsaRedirection */ "./src/bsaRedirection.ts");
const constants_1 = __webpack_require__(/*! ../constants */ "./src/constants.ts");
const React = __importStar(__webpack_require__(/*! react */ "react"));
const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
class Settings extends vortex_api_1.ComponentEx {
    constructor() {
        super(...arguments);
        this.toggle = (enabled) => {
            const { gameMode } = this.props;
            (0, bsaRedirection_1.toggleInvalidation)(this.context.api, gameMode)
                .then(() => null);
        };
    }
    render() {
        const { t, gameMode, mods } = this.props;
        if (!(0, gameSupport_1.isSupported)(gameMode) || ((0, gameSupport_1.bsaVersion)(gameMode) === undefined)) {
            return null;
        }
        return (React.createElement("form", null,
            React.createElement(react_bootstrap_1.FormGroup, { controlId: 'redirection' },
                React.createElement(react_bootstrap_1.ControlLabel, null, t('Archive Invalidation')),
                React.createElement(vortex_api_1.Toggle, { checked: (mods !== undefined) && (mods[constants_1.REDIRECTION_MOD] !== undefined), onToggle: this.toggle }, t('BSA redirection')),
                React.createElement(react_bootstrap_1.HelpBlock, null, t('This adds a mod to vortex that provides Archive Invalidation '
                    + 'similar to mods like "Archive Invalidation Invalidated".')))));
    }
}
function mapStateToProps(state) {
    const gameMode = vortex_api_1.selectors.activeGameId(state);
    return {
        gameMode,
        mods: state.persistent.mods[gameMode],
    };
}
function mapDispatchToProps(dispatch) {
    return {};
}
exports["default"] = (0, react_i18next_1.withTranslation)(['common'])((0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)(Settings));


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

/***/ "vortex-api":
/*!*****************************!*\
  !*** external "vortex-api" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("vortex-api");

/***/ }),

/***/ "vortex-parse-ini":
/*!***********************************!*\
  !*** external "vortex-parse-ini" ***!
  \***********************************/
/***/ ((module) => {

module.exports = require("vortex-parse-ini");

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
//# sourceMappingURL=bundledPlugins/gamebryo-archive-invalidation/gamebryo-archive-invalidation.js.map