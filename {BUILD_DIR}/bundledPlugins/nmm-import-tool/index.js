/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/actions/session.ts":
/*!********************************!*\
  !*** ./src/actions/session.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.selectImportFolder = exports.setMods = exports.setImportStep = void 0;
const redux_act_1 = __webpack_require__(/*! redux-act */ "redux-act");
exports.setImportStep = (0, redux_act_1.createAction)('SET_NMM_IMPORT_STEP');
exports.setMods = (0, redux_act_1.createAction)('SET_MODS');
exports.selectImportFolder = (0, redux_act_1.createAction)('SELECT_IMPORT_FOLDER');


/***/ }),

/***/ "./src/importedModAttributes.tsx":
/*!***************************************!*\
  !*** ./src/importedModAttributes.tsx ***!
  \***************************************/
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
exports.LOCAL = exports.FILENAME = exports.MOD_VERSION = exports.MOD_NAME = exports.MOD_ID = void 0;
const React = __importStar(__webpack_require__(/*! react */ "react"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
exports.MOD_ID = {
    id: 'id',
    name: 'Mod Id',
    description: 'Nexus id of the mod',
    icon: 'id-badge',
    calc: (mod) => mod.nexusId,
    placement: 'both',
    isToggleable: true,
    isSortable: true,
    isDefaultVisible: false,
    edit: {},
};
exports.MOD_NAME = {
    id: 'name',
    name: 'Mod Name',
    description: 'The Name of the mod',
    icon: 'quote-left',
    calc: (mod) => mod.modName,
    placement: 'both',
    isToggleable: true,
    isSortable: true,
    filter: new vortex_api_1.TableTextFilter(true),
    edit: {},
    sortFunc: (lhs, rhs, locale) => {
        return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
    },
};
exports.MOD_VERSION = {
    id: 'version',
    name: 'Mod Version',
    description: 'The mod version',
    icon: 'map-marker',
    calc: (mod) => mod.modVersion,
    placement: 'both',
    isToggleable: true,
    isSortable: true,
    filter: new vortex_api_1.TableTextFilter(false),
    sortFunc: (lhs, rhs, locale) => {
        return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
    },
    edit: {},
};
exports.FILENAME = {
    id: 'filename',
    name: 'Mod Archive',
    description: 'The filename of the mod archive',
    icon: 'file-picture-o',
    calc: (mod) => mod.modFilename,
    placement: 'both',
    isToggleable: true,
    isSortable: true,
    isDefaultVisible: false,
    filter: new vortex_api_1.TableTextFilter(true),
    edit: {},
};
exports.LOCAL = {
    id: 'local',
    name: 'Duplicate',
    description: 'Whether the mod/archive is already managed by Vortex',
    icon: 'level-up',
    customRenderer: (mod, detail, t) => {
        return mod.isAlreadyManaged ? (React.createElement(vortex_api_1.tooltip.Icon, { id: `import-duplicate-${mod.nexusId}`, tooltip: t('This archive is already managed by Vortex'), name: 'feedback-warning' })) : null;
    },
    calc: mod => mod.isAlreadyManaged,
    placement: 'table',
    isToggleable: true,
    isSortable: true,
    filter: new vortex_api_1.TableTextFilter(true),
    edit: {},
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
const session_1 = __webpack_require__(/*! ./actions/session */ "./src/actions/session.ts");
const session_2 = __webpack_require__(/*! ./reducers/session */ "./src/reducers/session.ts");
const ImportDialog_1 = __importDefault(__webpack_require__(/*! ./views/ImportDialog */ "./src/views/ImportDialog.tsx"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
let appPath;
function nmmConfigExists() {
    try {
        if (appPath === undefined) {
            appPath = vortex_api_1.util.getVortexPath('appData');
        }
        const base = path.resolve(appPath, '..', 'local', 'Black_Tree_Gaming');
        vortex_api_1.fs.statSync(base);
        return true;
    }
    catch (err) {
        return false;
    }
}
const isGameSupported = (context) => {
    const state = context.api.store.getState();
    const gameId = vortex_api_1.selectors.activeGameId(state);
    return ([
        'skyrim', 'skyrimse', 'skyrimvr',
        'morrowind', 'oblivion', 'fallout3',
        'falloutnv', 'fallout4', 'fallout4vr',
        'enderal', 'monsterhunterworld', 'witcher2',
        'witcher3', 'xrebirth', 'xcom2',
        'worldoftanks', 'warthunder', 'teso',
        'stateofdecay', 'starbound', 'legendsofgrimrock',
        'dragonsdogma', 'dragonage', 'dragonage2',
        'darksouls', 'darksouls2', 'breakingwheel',
        'nomanssky',
    ].indexOf(gameId) !== -1);
};
function init(context) {
    if (process.platform !== 'win32') {
        return false;
    }
    context.registerReducer(['session', 'modimport'], session_2.sessionReducer);
    const gameModeActive = (store) => vortex_api_1.selectors.activeGameId(store.getState()) !== undefined
        ? true
        : false;
    context.registerDialog('nmm-import', ImportDialog_1.default, () => ({}));
    context.registerAction('mod-icons', 115, 'import', {}, 'Import From NMM', () => {
        context.api.store.dispatch((0, session_1.setImportStep)('start'));
    }, () => isGameSupported(context));
    context.registerToDo('import-nmm', 'search', () => ({}), 'import', 'Import from NMM', () => {
        context.api.store.dispatch((0, session_1.setImportStep)('start'));
        context.api.events.emit('analytics-track-click-event', 'Dashboard', 'NMM Import');
    }, () => nmmConfigExists() && gameModeActive(context.api.store), '', 100);
    context.once(() => {
        context.api.setStylesheet('nmm-import-tool', path.join(__dirname, 'import-tool.scss'));
    });
    return true;
}
exports["default"] = init;


/***/ }),

/***/ "./src/reducers/session.ts":
/*!*********************************!*\
  !*** ./src/reducers/session.ts ***!
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
exports.sessionReducer = void 0;
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const actions = __importStar(__webpack_require__(/*! ../actions/session */ "./src/actions/session.ts"));
exports.sessionReducer = {
    reducers: {
        [actions.setImportStep]: (state, payload) => vortex_api_1.util.setSafe(state, ['importStep'], payload),
        [actions.selectImportFolder]: (state, payload) => {
            const importFolder = payload;
            return vortex_api_1.util.setSafe(state, ['selectFolder'], importFolder);
        },
    },
    defaults: {
        importStep: undefined,
        importedMods: {},
        selectFolder: false,
        selectedProfile: undefined,
    },
};


/***/ }),

/***/ "./src/types/nmmEntries.ts":
/*!*********************************!*\
  !*** ./src/types/nmmEntries.ts ***!
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
exports.ParseError = void 0;
const util = __importStar(__webpack_require__(/*! util */ "util"));
function ParseError(message) {
    this.message = message;
    Error.captureStackTrace(this, ParseError);
}
exports.ParseError = ParseError;
util.inherits(ParseError, Error);
ParseError.prototype.name = 'ParseError';


/***/ }),

/***/ "./src/util/TraceImport.ts":
/*!*********************************!*\
  !*** ./src/util/TraceImport.ts ***!
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const os = __importStar(__webpack_require__(/*! os */ "os"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const util_1 = __webpack_require__(/*! util */ "util");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
class TraceImport {
    constructor() {
        const now = new Date();
        const name = `nmm_import-${now.getTime()}`;
        this.mPath = path.join(vortex_api_1.util.getVortexPath('userData'), name);
    }
    get logFilePath() {
        return path.join(this.mPath, 'migration.log');
    }
    initDirectory(importPath) {
        return vortex_api_1.fs.ensureDirAsync(this.mPath)
            .then(() => vortex_api_1.fs.createWriteStream(this.logFilePath))
            .then(stream => {
            this.mLogFile = stream;
            return vortex_api_1.fs.copyAsync(path.join(importPath, 'VirtualInstall', 'VirtualModConfig.xml'), path.join(this.mPath, 'VirtualModConfig.xml'));
        })
            .catch(err => (err.code === 'ENOENT')
            ? bluebird_1.default.resolve()
            : bluebird_1.default.reject(err));
    }
    finish() {
        this.mLogFile.end();
        this.mLogFile = undefined;
    }
    log(level, message, extra) {
        let fullMessage = message;
        if (extra !== undefined) {
            fullMessage += ' (' + (0, util_1.inspect)(extra, { depth: null }).replace('\n', os.EOL) + ')';
        }
        this.mLogFile.write(fullMessage + os.EOL);
    }
    writeFile(name, content) {
        return vortex_api_1.fs.writeFileAsync(path.join(this.mPath, name), content);
    }
}
exports["default"] = TraceImport;


/***/ }),

/***/ "./src/util/categories.ts":
/*!********************************!*\
  !*** ./src/util/categories.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getCategories = void 0;
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function parseCategories(data) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, 'text/xml');
    const categories = xmlDoc.querySelectorAll('categoryManager categoryList category');
    const items = [...Array(categories.length).keys()].map(i => categories.item(i));
    return items.reduce((prev, item) => {
        const categoryName = item.getElementsByTagName('name')[0].textContent;
        if (categoryName !== 'Unassigned') {
            prev[item.getAttribute('ID')] = categoryName;
        }
        return prev;
    }, {});
}
function getCategories(categoriesPath) {
    return vortex_api_1.fs.readFileAsync(categoriesPath)
        .then(data => {
        if (data.compare(Buffer.from([0xEF, 0xBB, 0xBF]), 0, 3, 0, 3) === 0) {
            data = data.slice(3);
        }
        return parseCategories(data.toString('utf-8'));
    });
}
exports.getCategories = getCategories;


/***/ }),

/***/ "./src/util/findInstances.ts":
/*!***********************************!*\
  !*** ./src/util/findInstances.ts ***!
  \***********************************/
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
function convertGameId(input) {
    if (input === 'skyrimse') {
        return 'SkyrimSE';
    }
    else if (input === 'falloutnv') {
        return 'FalloutNV';
    }
    return input.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
}
function getVirtualFolder(userConfig, gameId) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(userConfig, 'text/xml');
    let item = xmlDoc
        .querySelector(`setting[name="VirtualFolder"] item[modeId="${convertGameId(gameId)}" i] string`);
    if (item === null) {
        return bluebird_1.default.resolve(undefined);
    }
    const virtualPath = item.textContent;
    let nmmLinkPath = '';
    item = xmlDoc
        .querySelector(`setting[name="HDLinkFolder"] item[modeId="${convertGameId(gameId)}" i] string`);
    if (item !== null) {
        nmmLinkPath = item.textContent;
    }
    item = xmlDoc
        .querySelector(`setting[name="ModFolder"] item[modeId="${convertGameId(gameId)}" i] string`);
    if (item === null) {
        return bluebird_1.default.resolve(undefined);
    }
    const modsPath = item.textContent;
    const setting = [virtualPath, nmmLinkPath, modsPath, '0'];
    return vortex_api_1.fs.statAsync(modsPath)
        .then(stats => bluebird_1.default.resolve([
        virtualPath,
        nmmLinkPath,
        modsPath,
        stats.birthtimeMs.toString()
    ]))
        .catch(err => bluebird_1.default.resolve(setting));
}
function findInstances(gameId) {
    const base = path.resolve(vortex_api_1.util.getVortexPath('appData'), '..', 'local', 'Black_Tree_Gaming');
    return vortex_api_1.fs.readdirAsync(base)
        .filter((fileName) => vortex_api_1.fs.statAsync(path.join(base, fileName))
        .then(stat => stat.isDirectory()))
        .then((instances) => bluebird_1.default.map(instances, instance => vortex_api_1.fs.readdirAsync(path.join(base, instance))
        .then((versions) => bluebird_1.default.map(versions, version => vortex_api_1.fs.readFileAsync(path.join(base, instance, version, 'user.config'))
        .then((data) => getVirtualFolder(data.toString(), gameId))))))
        .then(result => {
        const set = result.reduce((prev, value) => {
            value.forEach(val => {
                if (val !== undefined) {
                    if (prev[val[0].toUpperCase()] !== undefined) {
                        const existingVal = prev[val[0].toUpperCase()];
                        if ((existingVal[2] !== val[2])
                            && (parseInt(existingVal[3], 10) < parseInt(val[3], 10))) {
                            prev[val[0].toUpperCase()] = val;
                        }
                    }
                    else {
                        prev[val[0].toUpperCase()] = val;
                    }
                }
            });
            return prev;
        }, {});
        return Object.keys(set).map(key => set[key]);
    })
        .catch(err => (err.code === 'ENOENT') ? bluebird_1.default.resolve([]) : bluebird_1.default.reject(err));
}
exports["default"] = findInstances;


/***/ }),

/***/ "./src/util/import.ts":
/*!****************************!*\
  !*** ./src/util/import.ts ***!
  \****************************/
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
const modFileImport_1 = __webpack_require__(/*! ./modFileImport */ "./src/util/modFileImport.ts");
const vortexImports_1 = __webpack_require__(/*! ./vortexImports */ "./src/util/vortexImports.ts");
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const shortid_1 = __webpack_require__(/*! shortid */ "../../node_modules/shortid/index.js");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function getInner(ele) {
    if ((ele !== undefined) && (ele !== null)) {
        const node = ele.childNodes[0];
        if (node !== undefined) {
            return node.nodeValue;
        }
    }
    return undefined;
}
function enhance(sourcePath, input, nmmCategories, vortexCategory) {
    const id = path.basename(input.modFilename, path.extname(input.modFilename));
    const cacheBasePath = path.resolve(sourcePath, 'cache', id);
    return vortex_api_1.fs.readFileAsync(path.join(cacheBasePath, 'cacheInfo.txt'))
        .then(data => {
        const fields = data.toString().split('@@');
        return vortex_api_1.fs.readFileAsync(path.join(cacheBasePath, (fields[1] === '-') ? '' : fields[1], 'fomod', 'info.xml'));
    })
        .then(infoXmlData => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(infoXmlData.toString(), 'text/xml');
        const customName = getInner(xmlDoc.querySelector('fomod Name'));
        let categoryId = getInner(xmlDoc.querySelector('fomod CustomCategoryId'))
            || getInner(xmlDoc.querySelector('fomod CategoryId'));
        const category = categoryId !== undefined ? nmmCategories[categoryId] : undefined;
        categoryId = (category !== undefined)
            ? vortexCategory(category)
            : undefined;
        return Object.assign(Object.assign({}, input), { archiveId: (0, shortid_1.generate)(), categoryId,
            customName });
    })
        .catch(err => (Object.assign(Object.assign({}, input), { archiveId: (0, shortid_1.generate)() })));
}
function importArchives(api, gameId, trace, modsPath, mods, categories, progress) {
    const store = api.store;
    const state = store.getState();
    const vortexCategories = state.persistent.categories[gameId];
    const makeVortexCategory = (name) => {
        const existing = Object.keys(vortexCategories).find(key => vortexCategories[key].name === name);
        if (existing !== undefined) {
            return existing;
        }
        if (vortexCategories['nmm_0'] === undefined) {
            trace.log('info', 'Adding root for imported NMM categories');
            store.dispatch(vortex_api_1.actions.setCategory(gameId, 'nmm_0', { name: 'Imported from NMM', order: 0, parentCategory: undefined }));
        }
        let id = 1;
        while (vortexCategories[`nmm_${id}`] !== undefined) {
            ++id;
        }
        trace.log('info', 'NMM category couldn\'t be matched, importing', name);
        store.dispatch(vortex_api_1.actions.setCategory(gameId, `nmm_${id}`, { name, order: 0, parentCategory: 'nmm_0' }));
        return `nmm_${id}`;
    };
    const errors = [];
    const transferArchiveFile = (source, dest, mod, size) => {
        return (0, modFileImport_1.transferArchive)(source, dest).then(() => {
            const downloads = vortex_api_1.util.getSafe(state, ['persistent', 'downloads', 'files'], undefined);
            if (downloads === undefined) {
                return bluebird_1.default.resolve();
            }
            const archiveIds = Object.keys(downloads);
            const filtered = archiveIds.filter(id => downloads[id].localPath === mod.modFilename);
            filtered.forEach(id => {
                mod.archiveId = id;
                store.dispatch(vortex_api_1.actions.removeDownload(id));
            });
            return bluebird_1.default.resolve();
        })
            .then(() => {
            store.dispatch(vortex_api_1.actions.addLocalDownload(mod.archiveId, gameId, mod.modFilename, size));
            return bluebird_1.default.resolve();
        });
    };
    return trace.writeFile('parsedMods.json', JSON.stringify(mods))
        .then(() => {
        const importedArchives = [];
        trace.log('info', 'transfer archive files');
        const downloadPath = vortex_api_1.selectors.downloadPath(state);
        return bluebird_1.default.map(mods, mod => enhance(modsPath, mod, categories, makeVortexCategory))
            .then(modsEx => bluebird_1.default.mapSeries(modsEx, (mod, idx) => {
            trace.log('info', 'transferring', JSON.stringify(mod.modFilename, undefined, 2));
            progress(mod.modName, idx);
            const archivePath = path.join(mod.archivePath, mod.modFilename);
            return vortex_api_1.fs.statAsync(archivePath)
                .then(stats => transferArchiveFile(archivePath, downloadPath, mod, stats.size))
                .tap(() => importedArchives.push(mod))
                .catch(err => {
                trace.log('error', 'Failed to import mod archive', archivePath + ' - ' + err.message);
                errors.push(mod.modFilename);
            });
        })
            .then(() => {
            trace.log('info', 'Finished transferring mod archives');
            if (importedArchives.length > 0) {
                (0, vortexImports_1.addMetaData)(gameId, importedArchives, api);
                api.events.emit('did-import-downloads', importedArchives.map(arch => arch.archiveId));
            }
        }));
    })
        .then(() => {
        trace.finish();
        return errors;
    });
}
exports["default"] = importArchives;


/***/ }),

/***/ "./src/util/modFileImport.ts":
/*!***********************************!*\
  !*** ./src/util/modFileImport.ts ***!
  \***********************************/
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
exports.transferArchive = void 0;
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function transferArchive(modArchivePath, destSavePath) {
    return vortex_api_1.fs.copyAsync(modArchivePath, path.join(destSavePath, path.basename(modArchivePath)));
}
exports.transferArchive = transferArchive;
function byLength(lhs, rhs) {
    return lhs.length - rhs.length;
}


/***/ }),

/***/ "./src/util/nmmVirtualConfigParser.ts":
/*!********************************************!*\
  !*** ./src/util/nmmVirtualConfigParser.ts ***!
  \********************************************/
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
exports.parseModEntries = exports.parseNMMConfigFile = exports.isConfigEmpty = void 0;
const nmmEntries_1 = __webpack_require__(/*! ../types/nmmEntries */ "./src/types/nmmEntries.ts");
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const modmeta = __importStar(__webpack_require__(/*! modmeta-db */ "modmeta-db"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function getModInfoList(xmlData) {
    return new bluebird_1.default((resolve, reject) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
        const version = xmlDoc.getElementsByTagName('virtualModActivator')[0];
        if ((version === null) || (version === undefined)) {
            return reject(new nmmEntries_1.ParseError('The selected folder does not contain a valid VirtualModConfig.xml file.'));
        }
        if (version.getAttribute('fileVersion') !== '0.3.0.0') {
            return reject(new nmmEntries_1.ParseError('The selected folder contains an older VirtualModConfig.xml file,' +
                'you need to upgrade your NMM before proceeding with the mod import.'));
        }
        return resolve(xmlDoc.getElementsByTagName('modInfo'));
    });
}
function isConfigEmpty(configFilePath) {
    return vortex_api_1.fs.readFileAsync(configFilePath)
        .then(data => getModInfoList(data.toString('utf-8')))
        .then(modInfoList => {
        return ((modInfoList === undefined) || (modInfoList.length === 0))
            ? bluebird_1.default.resolve(true)
            : bluebird_1.default.resolve(false);
    })
        .catch(err => bluebird_1.default.resolve(true));
}
exports.isConfigEmpty = isConfigEmpty;
function parseNMMConfigFile(nmmFilePath, mods) {
    return vortex_api_1.fs.readFileAsync(nmmFilePath)
        .then(data => parseModEntries(data.toString('utf-8'), mods)
        .then(modEntries => modEntries.filter(entry => entry !== undefined)))
        .catch(err => bluebird_1.default.reject(new nmmEntries_1.ParseError('The selected folder does not contain a VirtualModConfig.xml file.')));
}
exports.parseNMMConfigFile = parseNMMConfigFile;
function parseModEntries(xmlData, mods) {
    const modListSet = new Set(Object.keys(mods || {}).map((key) => mods[key].id));
    return getModInfoList(xmlData)
        .then(modInfoList => {
        if ((modInfoList === undefined) || (modInfoList.length <= 0)) {
            return bluebird_1.default.reject(new nmmEntries_1.ParseError('The selected folder contains an empty VirtualModConfig.xml file.'));
        }
        return bluebird_1.default.map(Array.from(modInfoList), (modInfo) => {
            const res = {
                nexusId: modInfo.getAttribute('modId'),
                vortexId: undefined,
                downloadId: parseInt(modInfo.getAttribute('downloadId'), 10) || undefined,
                modName: modInfo.getAttribute('modName'),
                modFilename: modInfo.getAttribute('modFileName'),
                archivePath: modInfo.getAttribute('modFilePath'),
                modVersion: modInfo.getAttribute('FileVersion'),
                importFlag: true,
                archiveMD5: null,
                isAlreadyManaged: false,
            };
            const archiveName = path.basename(res.modFilename, path.extname(res.modFilename));
            res.vortexId = vortex_api_1.util.deriveInstallName(archiveName, {});
            res.isAlreadyManaged = modListSet.has(res.vortexId);
            const modArchiveFilePath = path.join(res.archivePath, res.modFilename);
            return vortex_api_1.fs.statAsync(modArchiveFilePath)
                .then(() => modmeta.genHash(modArchiveFilePath))
                .then((hashResult) => {
                res.archiveMD5 = hashResult.md5sum;
                return bluebird_1.default.resolve(res);
            })
                .catch(() => bluebird_1.default.resolve(undefined));
        });
    });
}
exports.parseModEntries = parseModEntries;
exports["default"] = parseNMMConfigFile;


/***/ }),

/***/ "./src/util/util.ts":
/*!**************************!*\
  !*** ./src/util/util.ts ***!
  \**************************/
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
exports.getLocalAssetUrl = exports.generateModEntries = exports.calculateModsCapacity = exports.validate = exports.isNMMRunning = exports.createModEntry = exports.getArchives = exports.fileChecksum = exports.testAccess = exports.getCapacityInformation = exports.calculateArchiveSize = exports.getVirtualConfigFilePath = exports.getCategoriesFilePath = void 0;
const crypto_1 = __webpack_require__(/*! crypto */ "crypto");
const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
const url_1 = __webpack_require__(/*! url */ "url");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const winapi = __importStar(__webpack_require__(/*! winapi-bindings */ "winapi-bindings"));
const nmmVirtualConfigParser_1 = __webpack_require__(/*! ./nmmVirtualConfigParser */ "./src/util/nmmVirtualConfigParser.ts");
const _LINKS = {
    TO_CONSIDER: 'https://wiki.nexusmods.com/index.php/Importing_from_Nexus_Mod_Manager:_Things_to_consider',
    UNMANAGED: 'https://wiki.nexusmods.com/index.php/Importing_from_Nexus_Mod_Manager:_Things_to_consider#Unmanaged_Files',
    FILE_CONFLICTS: 'https://wiki.nexusmods.com/index.php/File_Conflicts:_Nexus_Mod_Manager_vs_Vortex',
    MANAGE_CONFLICTS: 'https://wiki.nexusmods.com/index.php/Managing_File_Conflicts',
    DOCUMENTATION: 'https://wiki.nexusmods.com/index.php/Category:Vortex',
};
const MIN_DISK_SPACE_OFFSET = (500 * (1e+6));
const archiveExtLookup = new Set([
    '.zip', '.7z', '.rar', '.bz2', '.bzip2', '.gz', '.gzip', '.xz', '.z',
]);
function getCategoriesFilePath(modsPath) {
    return path_1.default.join(modsPath, 'categories', 'Categories.xml');
}
exports.getCategoriesFilePath = getCategoriesFilePath;
function getVirtualConfigFilePath(source) {
    return path_1.default.join(source, 'VirtualInstall', 'VirtualModConfig.xml');
}
exports.getVirtualConfigFilePath = getVirtualConfigFilePath;
function calculateArchiveSize(mod) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const stats = yield vortex_api_1.fs.statAsync(path_1.default.join(mod.archivePath, mod.modFilename));
            return Promise.resolve(stats.size);
        }
        catch (err) {
            return (err instanceof vortex_api_1.util.UserCanceled)
                ? Promise.resolve(0)
                : Promise.reject(err);
        }
    });
}
exports.calculateArchiveSize = calculateArchiveSize;
function getCapacityInformation(dirPath) {
    const rootPath = winapi.GetVolumePathName(dirPath);
    const totalFreeBytes = winapi.GetDiskFreeSpaceEx(rootPath).free - MIN_DISK_SPACE_OFFSET;
    return {
        rootPath,
        totalFreeBytes,
    };
}
exports.getCapacityInformation = getCapacityInformation;
function testAccess(t, source) {
    return __awaiter(this, void 0, void 0, function* () {
        if (source === undefined) {
            return Promise.resolve();
        }
        const dirElements = yield vortex_api_1.fs.readdirAsync(source)
            .filter(el => archiveExtLookup.has(path_1.default.extname(el)));
        if (dirElements.length === 0) {
            return Promise.resolve();
        }
        const filePath = path_1.default.join(path_1.default.join(source, dirElements[0]));
        try {
            yield fileChecksum(filePath);
        }
        catch (err) {
            (0, vortex_api_1.log)('error', 'Failed to generate MD5 hash', err);
            return (err.code !== 'EPERM')
                ? Promise.reject(err)
                : Promise.reject(new Error(t('Vortex is unable to read/open one or more of '
                    + 'your archives - please ensure you have full permissions to those files, and '
                    + 'that NMM is not running in the background before trying again. '
                    + 'Additionally, now would be a good time to add an exception for Vortex to '
                    + 'your Anti-Virus software (if you have one)', { ns: 'common' })));
        }
    });
}
exports.testAccess = testAccess;
function fileChecksum(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const stackErr = new Error();
        return new Promise((resolve, reject) => {
            try {
                const hash = (0, crypto_1.createHash)('md5');
                const stream = vortex_api_1.fs.createReadStream(filePath);
                stream.on('data', (data) => {
                    hash.update(data);
                });
                stream.on('end', () => {
                    stream.close();
                    stream.destroy();
                    return resolve(hash.digest('hex'));
                });
                stream.on('error', (err) => {
                    err.stack = stackErr.stack;
                    reject(err);
                });
            }
            catch (err) {
                err.stack = stackErr.stack;
                reject(err);
            }
        });
    });
}
exports.fileChecksum = fileChecksum;
function getArchives(source, parsedMods) {
    return __awaiter(this, void 0, void 0, function* () {
        const knownArchiveExt = (filePath) => (!!filePath)
            ? archiveExtLookup.has(path_1.default.extname(filePath).toLowerCase())
            : false;
        const modFileNames = new Set(Object.keys(parsedMods)
            .map(key => parsedMods[key].modFilename));
        return vortex_api_1.fs.readdirAsync(source)
            .filter((filePath) => knownArchiveExt(filePath))
            .then((archives) => archives.filter(archive => !modFileNames.has(archive)))
            .catch((err) => {
            this.nextState.error = err.message;
            return Promise.resolve([]);
        });
    });
}
exports.getArchives = getArchives;
function createModEntry(sourcePath, input, existingDownloads) {
    const getInner = (ele) => {
        if ((ele !== undefined) && (ele !== null)) {
            const node = ele.childNodes[0];
            if (node !== undefined) {
                return node.nodeValue;
            }
        }
        return undefined;
    };
    const isDuplicate = () => {
        return (existingDownloads !== undefined)
            ? existingDownloads.has(input)
            : false;
    };
    const id = path_1.default.basename(input, path_1.default.extname(input));
    const cacheBasePath = path_1.default.resolve(sourcePath, 'cache', id);
    return fileChecksum(path_1.default.join(sourcePath, input))
        .then(md5 => vortex_api_1.fs.readFileAsync(path_1.default.join(cacheBasePath, 'cacheInfo.txt'))
        .then(data => {
        const fields = data.toString().split('@@');
        return vortex_api_1.fs.readFileAsync(path_1.default.join(cacheBasePath, (fields[1] === '-') ? '' : fields[1], 'fomod', 'info.xml'));
    })
        .then(infoXmlData => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(infoXmlData.toString(), 'text/xml');
        const modName = getInner(xmlDoc.querySelector('Name')) || id;
        const version = getInner(xmlDoc.querySelector('Version')) || '';
        const modId = getInner(xmlDoc.querySelector('Id')) || '';
        const downloadId = () => {
            try {
                return Number.parseInt(getInner(xmlDoc.querySelector('DownloadId')), 10);
            }
            catch (err) {
                return 0;
            }
        };
        return Promise.resolve({
            nexusId: modId,
            vortexId: '',
            downloadId: downloadId(),
            modName,
            modFilename: input,
            archivePath: sourcePath,
            modVersion: version,
            archiveMD5: md5,
            importFlag: true,
            isAlreadyManaged: isDuplicate(),
        });
    })
        .catch(err => {
        (0, vortex_api_1.log)('error', 'could not parse the mod\'s cache information', err);
        return Promise.resolve({
            nexusId: '',
            vortexId: '',
            downloadId: 0,
            modName: path_1.default.basename(input, path_1.default.extname(input)),
            modFilename: input,
            archivePath: sourcePath,
            modVersion: '',
            archiveMD5: md5,
            importFlag: true,
            isAlreadyManaged: isDuplicate(),
        });
    }));
}
exports.createModEntry = createModEntry;
function isNMMRunning() {
    const processes = winapi.GetProcessList();
    const runningExes = processes.reduce((prev, entry) => {
        prev[entry.exeFile.toLowerCase()] = entry;
        return prev;
    }, {});
    return Object.keys(runningExes).find(key => key === 'nexusclient.exe') !== undefined;
}
exports.isNMMRunning = isNMMRunning;
function validate(source) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield (0, nmmVirtualConfigParser_1.isConfigEmpty)(path_1.default.join(source, 'VirtualInstall', 'VirtualModConfig.xml'));
        const nmmRunning = isNMMRunning();
        return Promise.resolve({
            nmmModsEnabled: !res,
            nmmRunning,
        });
    });
}
exports.validate = validate;
function calculateModsCapacity(modList, cb) {
    return __awaiter(this, void 0, void 0, function* () {
        const modCapacityInfo = {};
        for (const mod of modList) {
            cb(null, mod.modFilename);
            try {
                const archiveSizeBytes = yield calculateArchiveSize(mod);
                modCapacityInfo[mod.modFilename] = archiveSizeBytes;
            }
            catch (err) {
                cb(err, mod.modFilename);
                modCapacityInfo[mod.modFilename] = 0;
            }
        }
        return Promise.resolve(modCapacityInfo);
    });
}
exports.calculateModsCapacity = calculateModsCapacity;
function generateModEntries(api, source, parsedMods, cb) {
    return __awaiter(this, void 0, void 0, function* () {
        const state = api.getState();
        let existingDownloads;
        const downloads = vortex_api_1.util.getSafe(state, ['persistent', 'downloads', 'files'], undefined);
        if ((downloads !== undefined) && (Object.keys(downloads).length > 0)) {
            existingDownloads = new Set(Object.keys(downloads).map(key => downloads[key].localPath));
        }
        const archives = yield getArchives(source[0], parsedMods);
        const generated = {};
        for (const archive of archives) {
            const mod = yield createModEntry(source[2], archive, existingDownloads);
            cb(null, mod.modFilename);
            generated[mod.modFilename] = mod;
        }
        return Promise.resolve(generated);
    });
}
exports.generateModEntries = generateModEntries;
function getLocalAssetUrl(fileName) {
    return (0, url_1.pathToFileURL)(path_1.default.join(__dirname, fileName)).href;
}
exports.getLocalAssetUrl = getLocalAssetUrl;


/***/ }),

/***/ "./src/util/vortexImports.ts":
/*!***********************************!*\
  !*** ./src/util/vortexImports.ts ***!
  \***********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.addMetaData = void 0;
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function addMetaData(gameID, modEntries, api) {
    bluebird_1.default.map(modEntries, modEntry => {
        if (!!modEntry.categoryId) {
            api.store.dispatch(vortex_api_1.actions.setDownloadModInfo(modEntry.archiveId, 'custom.category', modEntry.categoryId));
        }
        if (!!modEntry.nexusId) {
            api.store.dispatch(vortex_api_1.actions.setDownloadModInfo(modEntry.archiveId, 'source', 'nexus'));
            api.store.dispatch(vortex_api_1.actions.setDownloadModInfo(modEntry.archiveId, 'nexus.ids.modId', modEntry.nexusId));
            api.store.dispatch(vortex_api_1.actions.setDownloadModInfo(modEntry.archiveId, 'nexus.ids.gameId', gameID));
            if (!!modEntry.modVersion) {
                api.store.dispatch(vortex_api_1.actions.setDownloadModInfo(modEntry.archiveId, 'version', modEntry.modVersion));
            }
            api.store.dispatch(vortex_api_1.actions.setDownloadModInfo(modEntry.archiveId, 'game', gameID));
            api.store.dispatch(vortex_api_1.actions.setDownloadModInfo(modEntry.archiveId, 'name', modEntry.modName));
        }
        else {
            const match = modEntry.modFilename.match(/-([0-9]+)-/);
            if (match !== null) {
                api.store.dispatch(vortex_api_1.actions.setDownloadModInfo(modEntry.archiveId, 'source', 'nexus'));
                api.store.dispatch(vortex_api_1.actions.setDownloadModInfo(modEntry.archiveId, 'nexus.ids.modId', match[1]));
            }
        }
    });
}
exports.addMetaData = addMetaData;


/***/ }),

/***/ "./src/views/ImportDialog.tsx":
/*!************************************!*\
  !*** ./src/views/ImportDialog.tsx ***!
  \************************************/
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
const session_1 = __webpack_require__(/*! ../actions/session */ "./src/actions/session.ts");
const nmmEntries_1 = __webpack_require__(/*! ../types/nmmEntries */ "./src/types/nmmEntries.ts");
const categories_1 = __webpack_require__(/*! ../util/categories */ "./src/util/categories.ts");
const findInstances_1 = __importDefault(__webpack_require__(/*! ../util/findInstances */ "./src/util/findInstances.ts"));
const import_1 = __importDefault(__webpack_require__(/*! ../util/import */ "./src/util/import.ts"));
const nmmVirtualConfigParser_1 = __importDefault(__webpack_require__(/*! ../util/nmmVirtualConfigParser */ "./src/util/nmmVirtualConfigParser.ts"));
const TraceImport_1 = __importDefault(__webpack_require__(/*! ../util/TraceImport */ "./src/util/TraceImport.ts"));
const importedModAttributes_1 = __webpack_require__(/*! ../importedModAttributes */ "./src/importedModAttributes.tsx");
const React = __importStar(__webpack_require__(/*! react */ "react"));
const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const util_1 = __webpack_require__(/*! ../util/util */ "./src/util/util.ts");
class ImportDialog extends vortex_api_1.ComponentEx {
    constructor(props) {
        super(props);
        this.importSelected = (entries) => {
            this.onGroupAction(entries, true);
        };
        this.dontImportSelected = (entries) => {
            this.onGroupAction(entries, false);
        };
        this.isNextDisabled = () => {
            const { importStep } = this.props;
            const { error, modsToImport, capacityInformation } = this.state;
            const enabled = (modsToImport !== undefined)
                ? Object.keys(modsToImport).filter(id => this.isModEnabled(modsToImport[id]))
                : [];
            const totalFree = capacityInformation.totalFreeBytes;
            const hasSpace = capacityInformation.totalNeededBytes > totalFree;
            return (error !== undefined)
                || ((importStep === 'setup') && (modsToImport === undefined))
                || ((importStep === 'setup') && (enabled.length === 0))
                || ((importStep === 'setup') && (hasSpace));
        };
        this.openLink = (evt) => {
            evt.preventDefault();
            const link = evt.currentTarget.getAttribute('data-link');
            vortex_api_1.util.opn(link).catch(() => null);
        };
        this.renderSource = option => {
            return React.createElement(react_bootstrap_1.MenuItem, { key: option, eventKey: option }, option[0]);
        };
        this.toggleInstallOnFinish = () => {
            const { installModsOnFinish } = this.state;
            this.nextState.installModsOnFinish = !installModsOnFinish;
        };
        this.revalidate = () => {
            const { selectedSource } = this.state;
            return (0, util_1.validate)(selectedSource[0])
                .then(res => {
                this.nextState.nmmModsEnabled = res.nmmModsEnabled;
                this.nextState.nmmRunning = res.nmmRunning;
                this.nextState.busy = false;
            });
        };
        this.openLog = (evt) => {
            evt.preventDefault();
            vortex_api_1.util.opn(this.mTrace.logFilePath).catch(err => undefined);
        };
        this.selectSource = eventKey => {
            this.nextState.selectedSource = eventKey;
        };
        this.nop = () => undefined;
        this.cancel = () => {
            this.props.onSetStep(undefined);
        };
        this.initState({
            busy: false,
            sources: undefined,
            modsToImport: undefined,
            parsedMods: undefined,
            selectedSource: [],
            error: undefined,
            importEnabled: {},
            modsCapacity: {},
            counter: 0,
            progress: undefined,
            failedImports: [],
            nmmModsEnabled: false,
            nmmRunning: false,
            autoSortEnabled: false,
            capacityInformation: {
                rootPath: '',
                totalNeededBytes: 0,
                totalFreeBytes: 0,
                hasCalculationErrors: false,
            },
            installModsOnFinish: false,
            successfullyImported: [],
        });
        this.actions = [
            {
                icon: 'checkbox-checked',
                title: 'Import',
                action: this.importSelected,
                singleRowAction: false,
            },
            {
                icon: 'checkbox-unchecked',
                title: 'Don\'t Import',
                action: this.dontImportSelected,
                singleRowAction: false,
            },
        ];
        this.mStatus = {
            id: 'status',
            name: 'Import',
            description: 'The import status of the mod',
            icon: 'level-up',
            calc: (mod) => this.isModEnabled(mod) ? 'Import' : 'Don\'t import',
            placement: 'both',
            isToggleable: true,
            isSortable: true,
            isVolatile: true,
            edit: {
                inline: true,
                choices: () => [
                    { key: 'yes', text: 'Import' },
                    { key: 'no', text: 'Don\'t import' },
                ],
                onChangeValue: (mod, value) => {
                    this.nextState.importEnabled[mod.modFilename] = (value === undefined)
                        ? mod.isAlreadyManaged
                            ? !(this.state.importEnabled[mod.modFilename] === true)
                            : !(this.state.importEnabled[mod.modFilename] !== false)
                        : value === 'yes';
                    ++this.nextState.counter;
                    this.recalculate();
                },
            },
        };
    }
    UNSAFE_componentWillReceiveProps(newProps) {
        if (this.props.importStep !== newProps.importStep) {
            if (newProps.importStep === 'start') {
                this.resetStateData();
                this.start();
            }
            else if (newProps.importStep === 'setup') {
                this.setup();
            }
            else if (newProps.importStep === 'working') {
                this.startImport();
            }
            else if (newProps.importStep === 'review') {
                this.nextState.successfullyImported = this.getSuccessfullyImported();
            }
        }
    }
    render() {
        const { t, importStep } = this.props;
        const { error, sources, capacityInformation } = this.state;
        const canCancel = ((['start', 'setup'].indexOf(importStep) !== -1)
            || ((importStep === 'working') && (!this.canImport()))
            || (error !== undefined));
        const nextLabel = ((sources !== undefined) && (sources.length > 0))
            ? this.nextLabel(importStep)
            : undefined;
        const onClick = () => (importStep !== 'review')
            ? this.next() : this.finish();
        return (React.createElement(vortex_api_1.Modal, { id: 'import-dialog', show: importStep !== undefined, onHide: this.nop },
            React.createElement(vortex_api_1.Modal.Header, null,
                React.createElement(vortex_api_1.Modal.Title, null, t('Nexus Mod Manager (NMM) Import Tool')),
                this.renderCurrentStep()),
            React.createElement(vortex_api_1.Modal.Body, null, error !== undefined
                ? React.createElement(react_bootstrap_1.Alert, { bsStyle: 'danger' }, error)
                : this.renderContent(importStep)),
            React.createElement(vortex_api_1.Modal.Footer, null,
                importStep === 'setup' && capacityInformation.hasCalculationErrors ? (React.createElement(react_bootstrap_1.Alert, { bsStyle: 'danger' }, t('Vortex cannot validate NMM\'s mod/archive files - this usually occurs when '
                    + 'the NMM configuration is corrupt'))) : null,
                canCancel ? React.createElement(react_bootstrap_1.Button, { onClick: this.cancel }, t('Cancel')) : null,
                nextLabel ? (React.createElement(react_bootstrap_1.Button, { disabled: this.isNextDisabled(), onClick: onClick }, nextLabel)) : null)));
    }
    resetStateData() {
        this.nextState.sources = undefined;
        this.nextState.modsToImport = undefined;
        this.nextState.parsedMods = undefined;
        this.nextState.selectedSource = [];
        this.nextState.error = undefined;
        this.nextState.importEnabled = {};
        this.nextState.counter = 0;
        this.nextState.progress = undefined;
        this.nextState.failedImports = [];
        this.nextState.capacityInformation = {
            rootPath: '',
            totalNeededBytes: 0,
            totalFreeBytes: 0,
            hasCalculationErrors: false,
        };
        this.nextState.installModsOnFinish = false;
        this.nextState.autoSortEnabled = false;
        this.nextState.successfullyImported = [];
    }
    canImport() {
        const { nmmModsEnabled, nmmRunning } = this.state;
        return !nmmModsEnabled && !nmmRunning;
    }
    onGroupAction(entries, enable) {
        const { importEnabled, modsToImport } = this.state;
        if (modsToImport === undefined) {
            return bluebird_1.default.resolve();
        }
        entries.forEach((key) => {
            if (importEnabled[key] !== undefined && importEnabled[key] === enable) {
                return;
            }
            this.nextState.importEnabled[key] = enable;
        });
        this.recalculate();
    }
    recalculate() {
        const { modsToImport } = this.state;
        const validCalcState = ((modsToImport !== undefined)
            && (Object.keys(modsToImport).length > 0));
        this.nextState.capacityInformation.hasCalculationErrors = false;
        this.nextState.capacityInformation.totalNeededBytes = validCalcState
            ? this.calcArchiveFiles()
            : 0;
    }
    getModNumber() {
        const { modsToImport } = this.state;
        if (modsToImport === undefined) {
            return undefined;
        }
        const modList = Object.keys(modsToImport).map(id => modsToImport[id]);
        const enabledMods = modList.filter(mod => this.isModEnabled(mod));
        return `${enabledMods.length} / ${modList.length}`;
    }
    onStartUp() {
        const { selectedSource } = this.state;
        const { parsedMods } = this.nextState;
        if (selectedSource === undefined || parsedMods === undefined) {
            return bluebird_1.default.resolve();
        }
        const progCB = (err, mod) => {
            if (err) {
                this.nextState.capacityInformation.hasCalculationErrors = true;
            }
            this.nextState.progress = { mod, pos: 0 };
        };
        return this.populateModsTable(progCB)
            .then(mods => {
            this.nextState.modsToImport = mods;
            const modList = Object.keys(mods)
                .map(id => mods[id]);
            return this.getModsCapacity(modList, progCB);
        });
    }
    getModsCapacity(modList, cb) {
        return (0, util_1.calculateModsCapacity)(modList, cb)
            .then((modCapacityInfo) => {
            this.nextState.modsCapacity = modCapacityInfo;
            this.recalculate();
        });
    }
    calcArchiveFiles() {
        const { modsCapacity, modsToImport } = this.nextState;
        return Object.keys(modsCapacity)
            .filter(id => this.modWillBeEnabled(modsToImport[id]))
            .map(id => modsCapacity[id])
            .reduce((total, archiveBytes) => total + archiveBytes, 0);
    }
    getSuccessfullyImported() {
        const { failedImports, modsToImport } = this.state;
        const enabledMods = Object.keys(modsToImport !== null && modsToImport !== void 0 ? modsToImport : [])
            .map(id => modsToImport[id])
            .filter(mod => this.isModEnabled(mod));
        if (failedImports === undefined || failedImports.length === 0) {
            return enabledMods;
        }
        return enabledMods.filter(mod => failedImports.find(fail => fail === mod.modName) === undefined);
    }
    renderCapacityInfo(instance) {
        const { t } = this.props;
        return (React.createElement("div", null,
            React.createElement("h3", { className: (instance.totalNeededBytes > instance.totalFreeBytes)
                    ? 'disk-space-insufficient'
                    : 'disk-space-sufficient' }, t('{{rootPath}} - Size required: {{required}} / {{available}}', {
                replace: {
                    rootPath: instance.rootPath,
                    required: instance.hasCalculationErrors
                        ? '???'
                        : vortex_api_1.util.bytesToString(instance.totalNeededBytes),
                    available: vortex_api_1.util.bytesToString(instance.totalFreeBytes),
                },
            }))));
    }
    renderCurrentStep() {
        const { t, importStep } = this.props;
        return (React.createElement(vortex_api_1.Steps, { step: importStep, style: { marginBottom: 32 } },
            React.createElement(vortex_api_1.Steps.Step, { key: 'start', stepId: 'start', title: t('Start'), description: t('Introduction') }),
            React.createElement(vortex_api_1.Steps.Step, { key: 'setup', stepId: 'setup', title: t('Setup'), description: t('Select Mods to import') }),
            React.createElement(vortex_api_1.Steps.Step, { key: 'working', stepId: 'working', title: t('Import'), description: t('Magic happens') }),
            React.createElement(vortex_api_1.Steps.Step, { key: 'review', stepId: 'review', title: t('Review'), description: t('Import result') })));
    }
    getLink(link, text) {
        const { t } = this.props;
        return (React.createElement("a", { "data-link": link, onClick: this.openLink }, t(`${text}`)));
    }
    renderContent(state) {
        switch (state) {
            case 'start': return this.renderStart();
            case 'setup': return this.renderSelectMods();
            case 'working': return (this.canImport()) ? this.renderWorking() : this.renderValidation();
            case 'review': return this.renderReview();
            default: return null;
        }
    }
    renderStart() {
        const { t } = this.props;
        const { sources, selectedSource } = this.state;
        const positives = [
            'Copy over all archives found inside the selected NMM installation.',
            'Provide the option to install imported archives at the end of the '
                + 'import process.',
            'Leave your existing NMM installation disabled, but functionally intact.',
        ];
        const negatives = [
            'Import any mod files in your data folder that are not managed by NMM.',
            'Import your FOMOD options.',
            'Preserve your plugin load order, as plugins will be rearranged according '
                + 'to LOOT rules once enabled.',
        ];
        const renderItem = (text, idx, positive) => (React.createElement("div", { key: idx, className: 'import-description-item' },
            React.createElement(vortex_api_1.Icon, { name: positive ? 'feedback-success' : 'feedback-error' }),
            React.createElement("p", null, t(text))));
        const renderPositives = () => (React.createElement("div", { className: 'import-description-column import-description-positive' },
            React.createElement("h4", null, t('The import tool will:')),
            React.createElement("span", null, positives.map((positive, idx) => renderItem(positive, idx, true)))));
        const renderNegatives = () => (React.createElement("div", { className: 'import-description-column import-description-negative' },
            React.createElement("h4", null, t('The import tool won’t:')),
            React.createElement("span", null, negatives.map((negative, idx) => renderItem(negative, idx, false)))));
        return (React.createElement("span", { className: 'import-start-container' },
            React.createElement("div", null,
                t('This is an import tool that allows you to bring your mod archives over from an '
                    + 'existing NMM installation.'),
                " ",
                React.createElement("br", null)),
            React.createElement("div", { className: 'start-info' },
                renderPositives(),
                renderNegatives()),
            sources === undefined
                ? React.createElement(vortex_api_1.Spinner, null)
                : sources.length === 0
                    ? this.renderNoSources()
                    : this.renderSources(sources, selectedSource)));
    }
    renderNoSources() {
        const { t } = this.props;
        return (React.createElement("span", { className: 'import-errors' },
            React.createElement(vortex_api_1.Icon, { name: 'feedback-error' }),
            ' ',
            t('No NMM install found with mods for this game. ' +
                'Please note that only NMM >= 0.63 is supported.')));
    }
    renderSources(sources, selectedSource) {
        const { t } = this.props;
        return (React.createElement("div", null,
            t('If you have multiple instances of NMM installed you can select which one '
                + 'to import here:'),
            React.createElement("br", null),
            React.createElement(react_bootstrap_1.SplitButton, { id: 'import-select-source', title: selectedSource !== undefined ? selectedSource[0] || '' : '', onSelect: this.selectSource }, sources.map(this.renderSource))));
    }
    renderValidation() {
        const { t } = this.props;
        const { busy, nmmModsEnabled, nmmRunning } = this.state;
        const content = (React.createElement("div", { className: 'is-not-valid' },
            React.createElement("div", { className: 'not-valid-title' },
                React.createElement(vortex_api_1.Icon, { name: 'input-cancel' }),
                React.createElement("h2", null, t('Can\'t continue'))),
            React.createElement(react_bootstrap_1.ListGroup, null,
                nmmModsEnabled ? (React.createElement(react_bootstrap_1.ListGroupItem, null,
                    React.createElement("h4", null, t('Please disable all mods in NMM')),
                    React.createElement("p", null,
                        t('NMM and Vortex would interfere with each other if they both '
                            + 'tried to manage the same mods.'),
                        t('You don\'t have to uninstall the mods, just disable them.')),
                    React.createElement("img", { src: (0, util_1.getLocalAssetUrl)('disablenmm.png') }))) : null,
                nmmRunning ? (React.createElement(react_bootstrap_1.ListGroupItem, null,
                    React.createElement("h4", null, t('Please close NMM')),
                    React.createElement("p", null, t('NMM needs to be closed during the import process and generally '
                        + 'while Vortex is installing mods otherwise it may interfere.')))) : null),
            React.createElement("div", { className: 'revalidate-area' },
                React.createElement(vortex_api_1.tooltip.IconButton, { id: 'revalidate-button', icon: busy ? 'spinner' : 'refresh', tooltip: busy ? t('Checking') : t('Check again'), disabled: busy, onClick: this.revalidate }, t('Check again')))));
        return content;
    }
    renderSelectMods() {
        const { t } = this.props;
        const { counter, modsToImport, progress, capacityInformation } = this.state;
        const calcProgress = (!!progress)
            ? (React.createElement("span", null,
                React.createElement("h3", null, t('Calculating required disk space. Thank you for your patience.')),
                t('Scanning: {{mod}}', { replace: { mod: progress.mod } })))
            : (React.createElement("span", null,
                React.createElement("h3", null, t('Processing NMM cache information. Thank you for your patience.')),
                t('Looking up archives..')));
        const content = (modsToImport === undefined)
            ? (React.createElement("div", { className: 'status-container' },
                React.createElement(vortex_api_1.Icon, { name: 'spinner' }),
                calcProgress)) : (React.createElement(vortex_api_1.Table, { tableId: 'mods-to-import', data: modsToImport, dataId: counter, actions: this.actions, staticElements: [
                this.mStatus, importedModAttributes_1.MOD_ID, importedModAttributes_1.MOD_NAME, importedModAttributes_1.MOD_VERSION, importedModAttributes_1.FILENAME, importedModAttributes_1.LOCAL
            ] }));
        const modNumberText = this.getModNumber();
        return (React.createElement("div", { className: 'import-mods-selection' },
            content,
            (modNumberText !== undefined)
                ? (React.createElement("div", null,
                    React.createElement("h3", null, t(`Importing: ${this.getModNumber()} mods`)),
                    this.renderCapacityInfo(capacityInformation)))
                : null));
    }
    renderWorking() {
        const { t } = this.props;
        const { progress, modsToImport } = this.state;
        if (progress === undefined) {
            return null;
        }
        const enabledMods = Object.keys(modsToImport).filter(id => this.isModEnabled(modsToImport[id]));
        const perc = Math.floor((progress.pos * 100) / enabledMods.length);
        return (React.createElement("div", { className: 'import-working-container' },
            React.createElement(vortex_api_1.EmptyPlaceholder, { icon: 'folder-download', text: t('Importing Mods...'), subtext: t('This might take a while, please be patient') }),
            t('Currently importing: {{mod}}', { replace: { mod: progress.mod } }),
            React.createElement(react_bootstrap_1.ProgressBar, { now: perc, label: `${perc}%` })));
    }
    renderEnableModsOnFinishToggle() {
        const { t } = this.props;
        const { successfullyImported, installModsOnFinish } = this.state;
        return successfullyImported.length > 0 ? (React.createElement("div", null,
            React.createElement(vortex_api_1.Toggle, { checked: installModsOnFinish, onToggle: this.toggleInstallOnFinish }, t('Install imported mods')))) : null;
    }
    renderReviewSummary() {
        const { t } = this.props;
        const { successfullyImported } = this.state;
        return successfullyImported.length > 0 ? (React.createElement("div", null,
            t('Your selected mod archives have been imported successfully. You can decide now '),
            t('whether you would like to start the installation for all imported mods,'),
            " ",
            React.createElement("br", null),
            t('or whether you want to install these yourself at a later time.'),
            React.createElement("br", null),
            React.createElement("br", null),
            this.renderEnableModsOnFinishToggle())) : null;
    }
    renderReview() {
        const { t } = this.props;
        const { failedImports } = this.state;
        return (React.createElement("div", { className: 'import-working-container' },
            failedImports.length === 0
                ? (React.createElement("span", { className: 'import-success' },
                    React.createElement(vortex_api_1.Icon, { name: 'feedback-success' }),
                    " ",
                    t('Import successful'),
                    React.createElement("br", null))) : (React.createElement("span", { className: 'import-errors' },
                React.createElement(vortex_api_1.Icon, { name: 'feedback-error' }),
                " ",
                t('There were errors'))),
            React.createElement("span", { className: 'import-review-text' },
                t('You can review the log at: '),
                React.createElement("a", { onClick: this.openLog }, this.mTrace.logFilePath)),
            React.createElement("br", null),
            React.createElement("br", null),
            React.createElement("span", null,
                this.renderReviewSummary(),
                React.createElement("br", null),
                React.createElement("br", null))));
    }
    nextLabel(step) {
        const { t } = this.props;
        switch (step) {
            case 'start': return t('Next');
            case 'setup': return t('Start Import');
            case 'working': return null;
            case 'review': return t('Finish');
        }
    }
    next() {
        const { onSetStep, importStep } = this.props;
        const currentIdx = ImportDialog.STEPS.indexOf(importStep);
        onSetStep(ImportDialog.STEPS[currentIdx + 1]);
    }
    finish() {
        const { installModsOnFinish } = this.state;
        const imported = this.getSuccessfullyImported();
        if (imported.length === 0) {
            this.next();
            return;
        }
        if (installModsOnFinish) {
            this.installMods(imported);
        }
        this.next();
    }
    installMods(modEntries) {
        const state = this.context.api.store.getState();
        const downloads = vortex_api_1.util.getSafe(state, ['persistent', 'downloads', 'files'], undefined);
        if (downloads === undefined) {
            return bluebird_1.default.reject(new Error('persistent.downloads.files is empty!'));
        }
        const archiveIds = Object.keys(downloads).filter(key => modEntries.find(mod => mod.modFilename === downloads[key].localPath) !== undefined);
        return bluebird_1.default.each(archiveIds, archiveId => {
            this.context.api.events.emit('start-install-download', archiveId, true);
        });
    }
    start() {
        const { downloadPath } = this.props;
        this.nextState.error = undefined;
        this.nextState.autoSortEnabled = vortex_api_1.util.getSafe(this.context.api.store.getState(), ['settings', 'plugins', 'autosort'], false);
        try {
            const capInfo = (0, util_1.getCapacityInformation)(downloadPath);
            this.nextState.capacityInformation = Object.assign(Object.assign({}, this.state.capacityInformation), { rootPath: capInfo.rootPath, totalFreeBytes: capInfo.totalFreeBytes });
        }
        catch (err) {
            this.context.api.showErrorNotification('Unable to start import process', err, {
                allowReport: [2, 3, 5].indexOf(err.systemCode) === -1,
            });
            this.cancel();
        }
        return (0, findInstances_1.default)(this.props.gameId)
            .then(found => {
            this.nextState.sources = found;
            this.nextState.selectedSource = found[0];
        })
            .catch(err => {
            this.nextState.error = err.message;
        });
    }
    setup() {
        const { gameId } = this.props;
        const state = this.context.api.store.getState();
        const mods = state.persistent.mods[gameId] || {};
        const virtualPath = (0, util_1.getVirtualConfigFilePath)(this.state.selectedSource[0]);
        return (0, util_1.testAccess)(this.props.t, this.state.selectedSource[2])
            .then(() => (0, nmmVirtualConfigParser_1.default)(virtualPath, mods))
            .catch(err => (err instanceof nmmEntries_1.ParseError)
            ? bluebird_1.default.resolve([])
            : bluebird_1.default.reject(err))
            .then((modEntries) => {
            this.nextState.parsedMods = modEntries.reduce((prev, value) => {
                prev[value.modFilename] = value;
                return prev;
            }, {});
        })
            .catch(err => {
            this.nextState.error = err.message;
        }).finally(() => this.onStartUp());
    }
    populateModsTable(cb) {
        const { t } = this.props;
        const { selectedSource, parsedMods } = this.state;
        const api = this.context.api;
        return (0, util_1.generateModEntries)(api, selectedSource, parsedMods, cb)
            .catch(err => {
            (0, vortex_api_1.log)('error', 'Failed to create mod entry', err);
            const errorMessage = (err.code === 'EPERM')
                ? t('"{{permFile}}" is access protected. Please ensure your account has '
                    + 'full read/write permissions to your game\'s NMM mods folder and try again.', { replace: { permFile: err.path } })
                : err.message;
            this.nextState.error = errorMessage;
            return bluebird_1.default.resolve({});
        });
    }
    modWillBeEnabled(mod) {
        return ((this.nextState.importEnabled[mod.modFilename] !== false) &&
            !((this.nextState.importEnabled[mod.modFilename] === undefined) && mod.isAlreadyManaged));
    }
    isModEnabled(mod) {
        return ((this.state.importEnabled[mod.modFilename] !== false) &&
            !((this.state.importEnabled[mod.modFilename] === undefined) && mod.isAlreadyManaged));
    }
    startImport() {
        const { gameId } = this.props;
        const { autoSortEnabled, modsToImport, selectedSource } = this.state;
        if (autoSortEnabled) {
            this.context.api.events.emit('autosort-plugins', false);
        }
        const startImportProcess = () => {
            if (autoSortEnabled) {
                this.context.api.events.emit('autosort-plugins', true);
            }
            try {
                this.mTrace = new TraceImport_1.default();
            }
            catch (err) {
                if (err.code === 'EEXIST') {
                    return bluebird_1.default.delay(1000).then(() => startImportProcess());
                }
                else {
                    this.context.api.showErrorNotification('Failed to initialize trace log for NMM import', err);
                    return bluebird_1.default.resolve();
                }
            }
            const modList = Object.keys(modsToImport).map(id => modsToImport[id]);
            const enabledMods = modList.filter(mod => this.isModEnabled(mod));
            const modsPath = selectedSource[2];
            this.mTrace.initDirectory(selectedSource[0]);
            return (0, categories_1.getCategories)((0, util_1.getCategoriesFilePath)(modsPath))
                .catch(err => {
                this.mTrace.log('error', 'Failed to import categories from NMM', err);
                return bluebird_1.default.resolve({});
            })
                .then(categories => {
                this.mTrace.log('info', 'NMM Mods (count): ' + modList.length +
                    ' - Importing (count):' + enabledMods.length);
                this.context.api.events.emit('enable-download-watch', false);
                return (0, import_1.default)(this.context.api, gameId, this.mTrace, modsPath, enabledMods, categories, (mod, pos) => {
                    this.nextState.progress = { mod, pos };
                })
                    .then(errors => {
                    this.context.api.events.emit('enable-download-watch', true);
                    this.nextState.failedImports = errors;
                    this.props.onSetStep('review');
                });
            })
                .catch(err => {
                this.context.api.events.emit('enable-download-watch', true);
                this.nextState.error = err.message;
            });
        };
        const validateLoop = () => this.canImport()
            ? startImportProcess()
            : setTimeout(() => validateLoop(), 2000);
        this.nextState.busy = true;
        return this.revalidate()
            .then(() => validateLoop());
    }
}
ImportDialog.STEPS = ['start', 'setup', 'working', 'review'];
function mapStateToProps(state) {
    const gameId = vortex_api_1.selectors.activeGameId(state);
    return {
        gameId,
        importStep: state.session.modimport.importStep || undefined,
        downloadPath: vortex_api_1.selectors.downloadPath(state),
        installPath: gameId !== undefined ? vortex_api_1.selectors.installPathForGame(state, gameId) : undefined,
    };
}
function mapDispatchToProps(dispatch) {
    return {
        onSetStep: (step) => dispatch((0, session_1.setImportStep)(step)),
    };
}
exports["default"] = (0, react_i18next_1.withTranslation)(['common'])((0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)(ImportDialog));


/***/ }),

/***/ "../../node_modules/shortid/index.js":
/*!*******************************************!*\
  !*** ../../node_modules/shortid/index.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


module.exports = __webpack_require__(/*! ./lib/index */ "../../node_modules/shortid/lib/index.js");


/***/ }),

/***/ "../../node_modules/shortid/lib/alphabet.js":
/*!**************************************************!*\
  !*** ../../node_modules/shortid/lib/alphabet.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var randomFromSeed = __webpack_require__(/*! ./random/random-from-seed */ "../../node_modules/shortid/lib/random/random-from-seed.js");

var ORIGINAL = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-';
var alphabet;
var previousSeed;

var shuffled;

function reset() {
    shuffled = false;
}

function setCharacters(_alphabet_) {
    if (!_alphabet_) {
        if (alphabet !== ORIGINAL) {
            alphabet = ORIGINAL;
            reset();
        }
        return;
    }

    if (_alphabet_ === alphabet) {
        return;
    }

    if (_alphabet_.length !== ORIGINAL.length) {
        throw new Error('Custom alphabet for shortid must be ' + ORIGINAL.length + ' unique characters. You submitted ' + _alphabet_.length + ' characters: ' + _alphabet_);
    }

    var unique = _alphabet_.split('').filter(function(item, ind, arr){
       return ind !== arr.lastIndexOf(item);
    });

    if (unique.length) {
        throw new Error('Custom alphabet for shortid must be ' + ORIGINAL.length + ' unique characters. These characters were not unique: ' + unique.join(', '));
    }

    alphabet = _alphabet_;
    reset();
}

function characters(_alphabet_) {
    setCharacters(_alphabet_);
    return alphabet;
}

function setSeed(seed) {
    randomFromSeed.seed(seed);
    if (previousSeed !== seed) {
        reset();
        previousSeed = seed;
    }
}

function shuffle() {
    if (!alphabet) {
        setCharacters(ORIGINAL);
    }

    var sourceArray = alphabet.split('');
    var targetArray = [];
    var r = randomFromSeed.nextValue();
    var characterIndex;

    while (sourceArray.length > 0) {
        r = randomFromSeed.nextValue();
        characterIndex = Math.floor(r * sourceArray.length);
        targetArray.push(sourceArray.splice(characterIndex, 1)[0]);
    }
    return targetArray.join('');
}

function getShuffled() {
    if (shuffled) {
        return shuffled;
    }
    shuffled = shuffle();
    return shuffled;
}

/**
 * lookup shuffled letter
 * @param index
 * @returns {string}
 */
function lookup(index) {
    var alphabetShuffled = getShuffled();
    return alphabetShuffled[index];
}

module.exports = {
    characters: characters,
    seed: setSeed,
    lookup: lookup,
    shuffled: getShuffled
};


/***/ }),

/***/ "../../node_modules/shortid/lib/build.js":
/*!***********************************************!*\
  !*** ../../node_modules/shortid/lib/build.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var encode = __webpack_require__(/*! ./encode */ "../../node_modules/shortid/lib/encode.js");
var alphabet = __webpack_require__(/*! ./alphabet */ "../../node_modules/shortid/lib/alphabet.js");

// Ignore all milliseconds before a certain time to reduce the size of the date entropy without sacrificing uniqueness.
// This number should be updated every year or so to keep the generated id short.
// To regenerate `new Date() - 0` and bump the version. Always bump the version!
var REDUCE_TIME = 1459707606518;

// don't change unless we change the algos or REDUCE_TIME
// must be an integer and less than 16
var version = 6;

// Counter is used when shortid is called multiple times in one second.
var counter;

// Remember the last time shortid was called in case counter is needed.
var previousSeconds;

/**
 * Generate unique id
 * Returns string id
 */
function build(clusterWorkerId) {

    var str = '';

    var seconds = Math.floor((Date.now() - REDUCE_TIME) * 0.001);

    if (seconds === previousSeconds) {
        counter++;
    } else {
        counter = 0;
        previousSeconds = seconds;
    }

    str = str + encode(alphabet.lookup, version);
    str = str + encode(alphabet.lookup, clusterWorkerId);
    if (counter > 0) {
        str = str + encode(alphabet.lookup, counter);
    }
    str = str + encode(alphabet.lookup, seconds);

    return str;
}

module.exports = build;


/***/ }),

/***/ "../../node_modules/shortid/lib/decode.js":
/*!************************************************!*\
  !*** ../../node_modules/shortid/lib/decode.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


var alphabet = __webpack_require__(/*! ./alphabet */ "../../node_modules/shortid/lib/alphabet.js");

/**
 * Decode the id to get the version and worker
 * Mainly for debugging and testing.
 * @param id - the shortid-generated id.
 */
function decode(id) {
    var characters = alphabet.shuffled();
    return {
        version: characters.indexOf(id.substr(0, 1)) & 0x0f,
        worker: characters.indexOf(id.substr(1, 1)) & 0x0f
    };
}

module.exports = decode;


/***/ }),

/***/ "../../node_modules/shortid/lib/encode.js":
/*!************************************************!*\
  !*** ../../node_modules/shortid/lib/encode.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var randomByte = __webpack_require__(/*! ./random/random-byte */ "../../node_modules/shortid/lib/random/random-byte-browser.js");

function encode(lookup, number) {
    var loopCounter = 0;
    var done;

    var str = '';

    while (!done) {
        str = str + lookup( ( (number >> (4 * loopCounter)) & 0x0f ) | randomByte() );
        done = number < (Math.pow(16, loopCounter + 1 ) );
        loopCounter++;
    }
    return str;
}

module.exports = encode;


/***/ }),

/***/ "../../node_modules/shortid/lib/index.js":
/*!***********************************************!*\
  !*** ../../node_modules/shortid/lib/index.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var alphabet = __webpack_require__(/*! ./alphabet */ "../../node_modules/shortid/lib/alphabet.js");
var encode = __webpack_require__(/*! ./encode */ "../../node_modules/shortid/lib/encode.js");
var decode = __webpack_require__(/*! ./decode */ "../../node_modules/shortid/lib/decode.js");
var build = __webpack_require__(/*! ./build */ "../../node_modules/shortid/lib/build.js");
var isValid = __webpack_require__(/*! ./is-valid */ "../../node_modules/shortid/lib/is-valid.js");

// if you are using cluster or multiple servers use this to make each instance
// has a unique value for worker
// Note: I don't know if this is automatically set when using third
// party cluster solutions such as pm2.
var clusterWorkerId = __webpack_require__(/*! ./util/cluster-worker-id */ "../../node_modules/shortid/lib/util/cluster-worker-id-browser.js") || 0;

/**
 * Set the seed.
 * Highly recommended if you don't want people to try to figure out your id schema.
 * exposed as shortid.seed(int)
 * @param seed Integer value to seed the random alphabet.  ALWAYS USE THE SAME SEED or you might get overlaps.
 */
function seed(seedValue) {
    alphabet.seed(seedValue);
    return module.exports;
}

/**
 * Set the cluster worker or machine id
 * exposed as shortid.worker(int)
 * @param workerId worker must be positive integer.  Number less than 16 is recommended.
 * returns shortid module so it can be chained.
 */
function worker(workerId) {
    clusterWorkerId = workerId;
    return module.exports;
}

/**
 *
 * sets new characters to use in the alphabet
 * returns the shuffled alphabet
 */
function characters(newCharacters) {
    if (newCharacters !== undefined) {
        alphabet.characters(newCharacters);
    }

    return alphabet.shuffled();
}

/**
 * Generate unique id
 * Returns string id
 */
function generate() {
  return build(clusterWorkerId);
}

// Export all other functions as properties of the generate function
module.exports = generate;
module.exports.generate = generate;
module.exports.seed = seed;
module.exports.worker = worker;
module.exports.characters = characters;
module.exports.decode = decode;
module.exports.isValid = isValid;


/***/ }),

/***/ "../../node_modules/shortid/lib/is-valid.js":
/*!**************************************************!*\
  !*** ../../node_modules/shortid/lib/is-valid.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


var alphabet = __webpack_require__(/*! ./alphabet */ "../../node_modules/shortid/lib/alphabet.js");

function isShortId(id) {
    if (!id || typeof id !== 'string' || id.length < 6 ) {
        return false;
    }

    var characters = alphabet.characters();
    var len = id.length;
    for(var i = 0; i < len;i++) {
        if (characters.indexOf(id[i]) === -1) {
            return false;
        }
    }
    return true;
}

module.exports = isShortId;


/***/ }),

/***/ "../../node_modules/shortid/lib/random/random-byte-browser.js":
/*!********************************************************************!*\
  !*** ../../node_modules/shortid/lib/random/random-byte-browser.js ***!
  \********************************************************************/
/***/ ((module) => {



var crypto = typeof window === 'object' && (window.crypto || window.msCrypto); // IE 11 uses window.msCrypto

function randomByte() {
    if (!crypto || !crypto.getRandomValues) {
        return Math.floor(Math.random() * 256) & 0x30;
    }
    var dest = new Uint8Array(1);
    crypto.getRandomValues(dest);
    return dest[0] & 0x30;
}

module.exports = randomByte;


/***/ }),

/***/ "../../node_modules/shortid/lib/random/random-from-seed.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/shortid/lib/random/random-from-seed.js ***!
  \*****************************************************************/
/***/ ((module) => {



// Found this seed-based random generator somewhere
// Based on The Central Randomizer 1.3 (C) 1997 by Paul Houle (houle@msc.cornell.edu)

var seed = 1;

/**
 * return a random number based on a seed
 * @param seed
 * @returns {number}
 */
function getNextValue() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed/(233280.0);
}

function setSeed(_seed_) {
    seed = _seed_;
}

module.exports = {
    nextValue: getNextValue,
    seed: setSeed
};


/***/ }),

/***/ "../../node_modules/shortid/lib/util/cluster-worker-id-browser.js":
/*!************************************************************************!*\
  !*** ../../node_modules/shortid/lib/util/cluster-worker-id-browser.js ***!
  \************************************************************************/
/***/ ((module) => {



module.exports = 0;


/***/ }),

/***/ "bluebird":
/*!***************************!*\
  !*** external "bluebird" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("bluebird");

/***/ }),

/***/ "modmeta-db":
/*!*****************************!*\
  !*** external "modmeta-db" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("modmeta-db");

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

/***/ "redux-act":
/*!****************************!*\
  !*** external "redux-act" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("redux-act");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

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

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "os":
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

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
//# sourceMappingURL=bundledPlugins/nmm-import-tool/nmm-import-tool.js.map