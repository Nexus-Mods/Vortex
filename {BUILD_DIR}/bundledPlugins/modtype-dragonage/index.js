/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/constants.ts":
/*!**************************!*\
  !*** ./src/constants.ts ***!
  \**************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DA_GAMES = void 0;
const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
exports.DA_GAMES = {
    DragonAge1: {
        id: 'dragonage',
        modPath: path_1.default.join(vortex_api_1.util.getVortexPath('documents'), 'BioWare', 'Dragon Age'),
    },
    DragonAge2: {
        id: 'dragonage2',
        modPath: path_1.default.join(vortex_api_1.util.getVortexPath('documents'), 'BioWare', 'Dragon Age 2'),
        getAddinsFolder: (api) => {
            const state = api.getState();
            const discovery = vortex_api_1.selectors.discoveryByGame(state, 'dragonage2');
            return (discovery === null || discovery === void 0 ? void 0 : discovery.path)
                ? path_1.default.join(discovery.path, 'addins')
                : path_1.default.join(vortex_api_1.util.getVortexPath('documents'), 'BioWare', 'Dragon Age 2');
        },
    },
};


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
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const migrations_1 = __webpack_require__(/*! ./migrations */ "./src/migrations.ts");
const constants_1 = __webpack_require__(/*! ./constants */ "./src/constants.ts");
const DA_MODULE_ERF_SUFFIX = '_module.erf';
function testDazip(instructions) {
    return bluebird_1.default.resolve(false);
}
function testSupportedOuter(files) {
    const dazips = files.filter(file => !file.endsWith(path.sep) && path.extname(file) === '.dazip');
    return bluebird_1.default.resolve({
        supported: dazips.length > 0,
        requiredFiles: dazips,
    });
}
function shortestPath(lhs, rhs) {
    return lhs.split(path.sep).length - rhs.split(path.sep).length;
}
function testSupportedInner(files, gameId) {
    const unsupported = () => bluebird_1.default.resolve({ supported: false, requiredFiles: [] });
    if (!isDragonAge(gameId)) {
        return unsupported();
    }
    if (files.find(file => file.toLowerCase().split(path.sep).includes('contents')) === undefined) {
        return unsupported();
    }
    const manifests = files.filter(iter => path.basename(iter.toLowerCase()) === 'manifest.xml');
    if (manifests.length === 0) {
        return unsupported();
    }
    const shortest = (manifests.sort(shortestPath))[0];
    const basePath = path.dirname(shortest);
    if (basePath !== '.') {
        const extraFiles = files.filter(iter => !iter.startsWith(basePath));
        if (extraFiles.length !== 0) {
            return unsupported();
        }
    }
    return bluebird_1.default.resolve({
        supported: true,
        requiredFiles: [],
    });
}
function installOuter(files, destinationPath, gameId, progressDelegate) {
    const dazips = files.filter(file => !file.endsWith(path.sep) && path.extname(file) === '.dazip');
    (0, vortex_api_1.log)('debug', 'install nested', dazips);
    const instructions = dazips.map((dazip) => ({
        type: 'submodule',
        key: dazip,
        path: path.join(destinationPath, dazip),
        submoduleType: 'dazip',
    }));
    return bluebird_1.default.resolve({ instructions });
}
function installInner(files, destinationPath, gameId, progressDelegate) {
    const result = {
        instructions: [{
                type: 'setmodtype',
                value: 'dazip',
            }],
    };
    const manifests = files.filter(iter => path.basename(iter.toLowerCase()) === 'manifest.xml');
    const shortest = (manifests.sort(shortestPath))[0];
    const basePath = path.dirname(shortest);
    let modName;
    const sep = `${path.sep}${path.sep}`;
    const addinsPathRE = new RegExp(['contents', 'addins', `[^${sep}]+`].join(sep) + sep, 'i');
    const addinsPath = files.find(filePath => addinsPathRE.test(filePath));
    if (addinsPath !== undefined) {
        const segments = addinsPath.split(path.sep);
        const addinsIdx = segments.findIndex(seg => seg.toLowerCase() === 'addins');
        modName = segments[addinsIdx + 1];
    }
    else {
        const moduleERF = files.find(file => path.basename(file).includes(DA_MODULE_ERF_SUFFIX));
        if (moduleERF !== undefined) {
            modName = path.basename(moduleERF).replace(DA_MODULE_ERF_SUFFIX, '');
        }
    }
    files.forEach(filePath => {
        if (filePath.endsWith(path.sep)) {
            return;
        }
        if (filePath === shortest) {
            result.instructions.push({
                type: 'copy',
                source: filePath,
                destination: (modName !== undefined)
                    ? path.join('addins', modName, shortest)
                    : filePath,
            });
            return;
        }
        if ((basePath !== '.') && (filePath.toLowerCase().startsWith(basePath.toLowerCase()))) {
            filePath = filePath.slice(basePath.length + 1);
        }
        let filePathSplit = filePath.split(path.sep);
        if (filePathSplit[0].toLowerCase() === 'contents') {
            filePathSplit = filePathSplit.slice(1);
        }
        result.instructions.push({
            type: 'copy',
            source: filePath,
            destination: path.join(...filePathSplit),
        });
    });
    return bluebird_1.default.resolve(result);
}
function isDragonAge(gameId) {
    return [constants_1.DA_GAMES.DragonAge1.id, constants_1.DA_GAMES.DragonAge2.id].indexOf(gameId) !== -1;
}
function init(context) {
    const getPath = (game) => {
        if (game.id === constants_1.DA_GAMES.DragonAge1.id) {
            return constants_1.DA_GAMES.DragonAge1.getAddinsFolder
                ? constants_1.DA_GAMES.DragonAge1.getAddinsFolder(context.api)
                : constants_1.DA_GAMES.DragonAge1.modPath;
        }
        else if (game.id === constants_1.DA_GAMES.DragonAge2.id) {
            return constants_1.DA_GAMES.DragonAge2.getAddinsFolder
                ? constants_1.DA_GAMES.DragonAge2.getAddinsFolder(context.api)
                : constants_1.DA_GAMES.DragonAge2.modPath;
        }
    };
    context.registerModType('dazip', 25, isDragonAge, getPath, testDazip, {
        name: 'Dragon Age AddIn',
    });
    context.registerInstaller('dazipOuter', 15, testSupportedOuter, installOuter);
    context.registerInstaller('dazipInner', 15, testSupportedInner, installInner);
    context.registerMigration((old) => (0, migrations_1.migrate100)(context, old));
    return true;
}
exports["default"] = init;


/***/ }),

/***/ "./src/migrations.ts":
/*!***************************!*\
  !*** ./src/migrations.ts ***!
  \***************************/
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.migrate100 = void 0;
const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
const semver_1 = __importDefault(__webpack_require__(/*! semver */ "semver"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const constants_1 = __webpack_require__(/*! ./constants */ "./src/constants.ts");
function migrate100(context, oldVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        if (semver_1.default.gte(oldVersion, '1.0.0')) {
            return Promise.resolve();
        }
        const da2Game = constants_1.DA_GAMES.DragonAge2;
        const state = context.api.getState();
        const discovery = vortex_api_1.selectors.discoveryByGame(state, da2Game.id);
        const activatorId = vortex_api_1.selectors.activatorForGame(state, da2Game.id);
        const activator = vortex_api_1.util.getActivator(activatorId);
        if (!(discovery === null || discovery === void 0 ? void 0 : discovery.path) || !activator) {
            return Promise.resolve();
        }
        const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', da2Game.id], {});
        const addins = Object.values(mods).filter(mod => mod.type === 'dazip');
        if (addins.length === 0) {
            return Promise.resolve();
        }
        const modsPath = path_1.default.join(discovery.path, da2Game.modPath);
        return context.api.awaitUI()
            .then(() => vortex_api_1.fs.ensureDirWritableAsync(modsPath))
            .then(() => context.api.emitAndAwait('purge-mods-in-path', da2Game.id, 'dazip', modsPath))
            .then(() => context.api.store.dispatch(vortex_api_1.actions.setDeploymentNecessary(da2Game.id, true)));
    });
}
exports.migrate100 = migrate100;


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

/***/ "semver":
/*!*************************!*\
  !*** external "semver" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("semver");

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
//# sourceMappingURL=bundledPlugins/modtype-dragonage/modtype-dazip.js.map