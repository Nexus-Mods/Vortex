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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const archiveData = [
    {
        gameId: 'skyrim',
        gameName: 'Skyrim (2011)',
        version: [104, 103],
        type: 'BSA',
    },
    {
        gameId: 'skyrimse',
        gameName: 'Skyrim Special Edition',
        version: [105],
        type: 'BSA',
    },
    {
        gameId: 'skyrimvr',
        gameName: 'Skyrim VR',
        version: [105],
        type: 'BSA',
    },
    {
        gameId: 'oblivion',
        gameName: 'Oblivion',
        version: [103],
        type: 'BSA',
    },
    {
        gameId: 'fallout3',
        gameName: 'Fallout 3',
        version: [104],
        type: 'BSA',
    },
    {
        gameId: 'newvegas',
        gameName: 'Fallout New Vegas',
        version: [104],
        type: 'BSA',
    },
    {
        gameId: 'fallout4',
        gameName: 'Fallout 4',
        version: [8, 7, 1],
        type: 'BA2',
    },
    {
        gameId: 'fallout4vr',
        gameName: 'Fallout 4 VR',
        version: [1],
        type: 'BA2',
    },
    {
        gameId: 'fallout76',
        gameName: 'Fallout 76',
        version: [1],
        type: 'BA2',
    },
    {
        gameId: 'starfield',
        gameName: 'Starfield',
        version: [3, 2, 1],
        type: 'BA2',
    },
];
function runTest(context) {
    const state = context.api.getState();
    const plugInfo = vortex_api_1.util.getSafe(state, ['session', 'plugins', 'pluginInfo'], {});
    return checkForErrors(context.api, plugInfo);
}
function main(context) {
    context.requireExtension('gamebryo-plugin-management');
    context.registerTest('incompatible-mod-archives', 'plugins-changed', () => runTest(context));
    return true;
}
function checkForErrors(api, pluginsObj) {
    return __awaiter(this, void 0, void 0, function* () {
        const state = api.getState();
        const activeGameId = vortex_api_1.selectors.activeGameId(state);
        const gameData = archiveData.find(g => g.gameId === activeGameId);
        if (!gameData) {
            return bluebird_1.default.resolve(undefined);
        }
        if (!pluginsObj || !Object.keys(pluginsObj)) {
            return bluebird_1.default.resolve(undefined);
        }
        const plugins = Object.keys(pluginsObj)
            .map(k => pluginsObj[k])
            .sort((a, b) => a.loadOrder > b.loadOrder ? 1 : -1);
        const archiveLoaders = plugins.filter(p => !p.isNative
            && p.loadsArchive
            && vortex_api_1.util.getSafe(state, ['loadOrder', p.id, 'enabled'], false));
        const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', activeGameId], {});
        const discovery = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', activeGameId, 'path'], undefined);
        const dataFolder = discovery ? path.join(discovery, 'data') : undefined;
        const normalize = (fileName) => {
            const noExt = path.basename(fileName, path.extname(fileName)).toLowerCase();
            return noExt.normalize('NFC');
        };
        const checkNotifId = 'checking-archives-all';
        try {
            const dataFiles = yield vortex_api_1.fs.readdirAsync(dataFolder);
            const dataArchives = dataFiles.filter(f => ['.ba2', '.bsa'].includes(path.extname(f)));
            const archivesToCheck = archiveLoaders.reduce((accum, plugin) => {
                const arcs = dataArchives
                    .filter(a => normalize(a).startsWith(normalize(plugin.name)))
                    .map(a => ({ name: a, plugin: plugin.name }));
                accum = accum.concat(arcs);
                return accum;
            }, []);
            if (!archivesToCheck.length) {
                return bluebird_1.default.resolve(undefined);
            }
            let pos = 0;
            const progress = (archiveName) => {
                api.store.dispatch(vortex_api_1.actions.addNotification({
                    id: checkNotifId,
                    progress: (pos * 100) / archivesToCheck.length,
                    title: 'Checking archives',
                    message: archiveName,
                    type: 'activity',
                }));
                ++pos;
            };
            const issues = yield archivesToCheck.reduce((accumP, archive) => __awaiter(this, void 0, void 0, function* () {
                const accum = yield accumP;
                progress(archive.name);
                try {
                    const version = yield streamArchiveVersion(path.join(dataFolder, archive.name));
                    if (gameData.version.includes(version)) {
                        return accum;
                    }
                    const plugin = plugins.find(p => p.name === archive.plugin);
                    const mod = plugin ? mods[plugin.modId] : undefined;
                    accum.push({
                        name: archive.name,
                        version,
                        validVersion: gameData.version.join('/'),
                        plugin,
                        mod,
                    });
                    return accum;
                }
                catch (err) {
                    (0, vortex_api_1.log)('error', 'Error checking archive versions', err);
                    return accum;
                }
            }), Promise.resolve([]));
            api.dismissNotification(checkNotifId);
            return ((issues === null || issues === void 0 ? void 0 : issues.length) > 0)
                ? genTestResult(api, issues, gameData)
                : bluebird_1.default.resolve(undefined);
        }
        catch (err) {
            api.dismissNotification(checkNotifId);
            api.showErrorNotification('Error checking for archive errors', err);
            return bluebird_1.default.resolve(undefined);
        }
    });
}
function genTestResult(api, issues, gameData) {
    const t = api.translate;
    const thisGame = gameData.gameName;
    const groupedErrors = issues.reduce((accum, cur) => {
        if (cur.mod) {
            accum[cur.mod.id] = [].concat(accum[cur.mod.id] || [], cur);
        }
        else {
            accum.noMod.push(cur);
        }
        return accum;
    }, { noMod: [] });
    const errorsByMod = Object.keys(groupedErrors).map(key => {
        const group = groupedErrors[key];
        const mod = key !== 'noMod' ? group[0].mod : { id: '', attributes: {} };
        const attr = mod.attributes;
        const modName = attr.customName || attr.logicalFileName || attr.name || mod.id;
        if (!group.length) {
            return '';
        }
        const archiveErrors = group.map(a => {
            const games = archiveData
                .filter(g => g.version.includes(a.version[0]))
                .map(g => g.gameName).join('/') || t('an unknown game');
            const plugin = a.plugin.name;
            const errMsg = t('Is loaded by {{plugin}}, but is intended for use in {{games}}.', { replace: { plugin, games } });
            return `[*][b]${a.name}[/b] - ${errMsg}`;
        });
        const groupInfo = modName
            ? modName
            : t('not managed by Vortex');
        return `[h5]${t('Incompatible Archives')} ${groupInfo}:[/h5]`
            + `[list]${archiveErrors.join('\n')}[/list]<br/><br/>`;
    });
    return bluebird_1.default.resolve({
        description: {
            short: 'Incompatible mod archive(s)',
            long: t('Some of the archives in your load order are incompatible with {{thisGame}}. '
                + 'Using incompatible archives may cause your game to crash on load.', { replace: { thisGame } })
                + `${errorsByMod.join()}`
                + t('You can fix this problem yourself by removing any mods that are not intended to be used with {{thisGame}}. '
                    + 'If you downloaded these mods from the correct game site at Nexus Mods, you should inform the mod author of this issue. '
                    + 'Archives for this game must be {{ext}} files (v{{ver}}).', { replace: { thisGame, ext: gameData.type, ver: gameData.version.join('/') } }),
        },
        severity: 'error',
    });
}
function streamArchiveVersion(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const stream = vortex_api_1.fs.createReadStream(filePath, { start: 0, end: 8 });
        return new Promise((resolve, reject) => {
            const data = Buffer.alloc(9);
            stream.on('data', chunk => {
                data.fill(chunk);
                const versionBytes = data.slice(4, 8);
                const version = versionBytes.reduce((accum, entry) => accum += entry, 0);
                resolve(version);
            });
            stream.on('error', () => resolve(0));
        })
            .finally(() => stream.destroy());
    });
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
//# sourceMappingURL=bundledPlugins/gamebryo-archive-check/gamebryo-archive-check.js.map