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
const missingOblivionFonts_1 = __importStar(__webpack_require__(/*! ./util/missingOblivionFonts */ "./src/util/missingOblivionFonts.ts"));
const missingSkyrimFonts_1 = __importDefault(__webpack_require__(/*! ./util/missingSkyrimFonts */ "./src/util/missingSkyrimFonts.ts"));
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const vortex_parse_ini_1 = __importStar(__webpack_require__(/*! vortex-parse-ini */ "vortex-parse-ini"));
const parser = new vortex_parse_ini_1.default(new vortex_parse_ini_1.WinapiFormat());
function fixOblivionFonts(iniFile, missingFonts, gameId) {
    return new bluebird_1.default((fixResolve, fixReject) => {
        try {
            Object.keys(iniFile.data.Fonts)
                .forEach((key) => {
                if (missingFonts.find((item) => {
                    return item === iniFile.data.Fonts[key];
                }) !== undefined) {
                    const keyL = key.toLowerCase();
                    if (missingOblivionFonts_1.oblivionDefaultFonts[keyL] !== undefined) {
                        iniFile.data.Fonts[key] = missingOblivionFonts_1.oblivionDefaultFonts[keyL];
                    }
                    else {
                        delete iniFile.data.Fonts[key];
                    }
                }
            });
            parser.write((0, gameSupport_1.iniPath)(gameId), iniFile)
                .then(() => fixResolve())
                .catch(err => fixReject(err));
        }
        catch (err) {
            fixReject(err);
        }
    });
}
function testOblivionFontsImpl(api) {
    const store = api.store;
    const gameId = vortex_api_1.selectors.activeGameId(store.getState());
    if (gameId !== 'oblivion') {
        return bluebird_1.default.resolve(undefined);
    }
    let iniFile;
    return parser.read((0, gameSupport_1.iniPath)(gameId))
        .then((iniFileIn) => {
        iniFile = iniFileIn;
        return (0, missingOblivionFonts_1.default)(store, iniFile, gameId);
    })
        .then((missingFonts) => {
        if (missingFonts.length === 0) {
            return bluebird_1.default.resolve(undefined);
        }
        const fontList = missingFonts.join('\n');
        return bluebird_1.default.resolve({
            description: {
                short: 'Fonts missing.',
                long: 'Fonts referenced in oblivion.ini don\'t seem to be installed:\n' +
                    fontList,
            },
            severity: 'error',
            automaticFix: () => fixOblivionFonts(iniFile, missingFonts, gameId),
        });
    })
        .catch((err) => bluebird_1.default.resolve({
        description: {
            short: 'Failed to read Oblivion.ini.',
            long: err.toString(),
        },
        severity: 'error',
    }));
}
const defaultFonts = {};
function testSkyrimFontsImpl(context) {
    const store = context.api.store;
    const gameId = vortex_api_1.selectors.activeGameId(store.getState());
    const gameDiscovery = vortex_api_1.util.getSafe(store.getState(), ['settings', 'gameMode', 'discovered', gameId], undefined);
    if (['skyrim', 'enderal', 'skyrimse', 'skyrimvr'].indexOf(gameId) === -1) {
        return bluebird_1.default.resolve(undefined);
    }
    if ((gameDiscovery === undefined) || (gameDiscovery.path === undefined)) {
        return bluebird_1.default.resolve(undefined);
    }
    const game = vortex_api_1.util.getGame(gameId);
    const interfacePath = path.join(game.getModPaths(gameDiscovery.path)[''], 'Skyrim - Interface.bsa');
    const prom = defaultFonts[gameId] !== undefined
        ? bluebird_1.default.resolve(undefined)
        : context.api.openArchive(interfacePath)
            .then((archive) => archive.readDir('interface')
            .tap(() => {
            var _a;
            if (((_a = archive['mHandler']) === null || _a === void 0 ? void 0 : _a.closeArchive) !== undefined) {
                archive['mHandler'].closeArchive();
            }
            archive = null;
        }))
            .then((files) => {
            defaultFonts[gameId] = new Set(files
                .filter(name => path.extname(name) === '.swf')
                .map(name => path.join('interface', name)));
        })
            .catch((err) => {
            if (err instanceof vortex_api_1.util.NotSupportedError) {
                (0, vortex_api_1.log)('info', 'Not checking font list because bsa archive support not available');
                return bluebird_1.default.reject(err);
            }
            return vortex_api_1.fs.statAsync(interfacePath)
                .then(() => {
                context.api.showErrorNotification('Failed to read default fonts', err, {
                    message: interfacePath,
                    allowReport: false,
                });
                return bluebird_1.default.reject(new vortex_api_1.util.ProcessCanceled('default fonts unknown'));
            })
                .catch(() => {
                context.api.showErrorNotification('"Skyrim - Interface.bsa" appears to be missing', err, {
                    id: 'skyrim_interface_bsa_missing',
                    allowReport: false,
                });
                return bluebird_1.default.reject(new vortex_api_1.util.ProcessCanceled('default fonts unknown'));
            });
        });
    return prom
        .then(() => (0, missingSkyrimFonts_1.default)(store.getState(), defaultFonts[gameId], gameId))
        .then((missingFonts) => {
        if (missingFonts.length === 0) {
            return bluebird_1.default.resolve(undefined);
        }
        const fontList = missingFonts.join('\n');
        return bluebird_1.default.resolve({
            description: {
                short: 'Fonts missing.',
                long: 'Fonts referenced in fontconfig.txt don\'t seem to be installed:\n' +
                    fontList,
            },
            severity: 'error',
        });
    })
        .catch(vortex_api_1.util.NotSupportedError, () => bluebird_1.default.resolve(undefined))
        .catch(vortex_api_1.util.ProcessCanceled, () => bluebird_1.default.resolve(undefined))
        .catch((err) => {
        return bluebird_1.default.resolve({
            description: {
                short: 'Failed to read fontconfig.txt.',
                long: err.toString(),
            },
            severity: 'error',
        });
    });
}
function init(context) {
    (0, gameSupport_1.initGameSupport)(context.api);
    const testOblivionFonts = () => testOblivionFontsImpl(context.api);
    const testSkyrimFonts = () => testSkyrimFontsImpl(context);
    context.registerTest('oblivion-fonts', 'gamemode-activated', testOblivionFonts);
    context.registerTest('skyrim-fonts', 'gamemode-activated', testSkyrimFonts);
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
exports.iniPath = exports.mygamesPath = exports.gameSupported = exports.initGameSupport = exports.gameSupportXboxPass = void 0;
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
exports.gameSupportXboxPass = {
    skyrimse: {
        mygamesPath: 'Skyrim Special Edition MS',
    },
    fallout4: {
        mygamesPath: 'Fallout4 MS',
    },
};
const gameSupport = vortex_api_1.util.makeOverlayableDictionary({
    skyrim: {
        mygamesPath: 'skyrim',
        iniName: 'Skyrim.ini',
    },
    enderal: {
        mygamesPath: 'enderal',
        iniName: 'Enderal.ini',
    },
    skyrimse: {
        mygamesPath: 'Skyrim Special Edition',
        iniName: 'Skyrim.ini',
    },
    enderalspecialedition: {
        mygamesPath: 'Enderal Special Edition',
        iniName: 'Enderal.ini',
    },
    skyrimvr: {
        mygamesPath: 'Skyrim VR',
        iniName: 'SkyrimVR.ini',
    },
    fallout3: {
        mygamesPath: 'Fallout3',
        iniName: 'Fallout.ini',
    },
    fallout4: {
        mygamesPath: 'Fallout4',
        iniName: 'Fallout4.ini',
    },
    fallout4vr: {
        mygamesPath: 'Fallout4VR',
        iniName: 'Fallout4Custom.ini',
    },
    falloutnv: {
        mygamesPath: 'FalloutNV',
        iniName: 'Fallout.ini',
    },
    starfield: {
        mygamesPath: 'Starfield',
        iniName: 'StarfieldCustom.ini',
    },
    oblivion: {
        mygamesPath: 'Oblivion',
        iniName: 'Oblivion.ini',
    },
}, {
    xbox: exports.gameSupportXboxPass,
    gog: {
        skyrimse: {
            mygamesPath: 'Skyrim Special Edition GOG',
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
            iniName: 'Skyrim.ini',
        },
    }
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
function iniPath(gameMode) {
    return path.join(mygamesPath(gameMode), gameSupport.get(gameMode, 'iniName'));
}
exports.iniPath = iniPath;


/***/ }),

/***/ "./src/util/missingOblivionFonts.ts":
/*!******************************************!*\
  !*** ./src/util/missingOblivionFonts.ts ***!
  \******************************************/
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
exports.oblivionDefaultFonts = void 0;
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
exports.oblivionDefaultFonts = {
    sfontfile_1: 'Data\\Fonts\\Kingthings_Regular.fnt',
    sfontfile_2: 'Data\\Fonts\\Kingthings_Shadowed.fnt',
    sfontfile_3: 'Data\\Fonts\\Tahoma_Bold_Small.fnt',
    sfontfile_4: 'Data\\Fonts\\Daedric_Font.fnt',
    sfontfile_5: 'Data\\Fonts\\Handwritten.fnt',
};
const defaultFontSet = new Set(Object.values(exports.oblivionDefaultFonts).map(font => font.toLowerCase()));
function missingOblivionFont(store, iniFile, gameId) {
    const discovery = vortex_api_1.selectors.discoveryByGame(store.getState(), gameId);
    if ((discovery === undefined) || (discovery.path === undefined)) {
        return bluebird_1.default.resolve([]);
    }
    const missingFonts = [];
    const fonts = [];
    Object.keys(iniFile.data.Fonts || {})
        .forEach((key) => {
        if (!defaultFontSet.has(iniFile.data.Fonts[key].toLowerCase())) {
            fonts.push(iniFile.data.Fonts[key]);
        }
    });
    return bluebird_1.default.each(fonts, (font) => vortex_api_1.fs.statAsync(path.join(discovery.path, font))
        .catch(() => { missingFonts.push(font); }))
        .then(() => bluebird_1.default.resolve(missingFonts));
}
exports["default"] = missingOblivionFont;


/***/ }),

/***/ "./src/util/missingSkyrimFonts.ts":
/*!****************************************!*\
  !*** ./src/util/missingSkyrimFonts.ts ***!
  \****************************************/
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
function missingSkyrimFonts(state, skyrimDefaultFonts, gameId) {
    const gameDiscovery = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', gameId], undefined);
    const game = vortex_api_1.util.getGame(gameId);
    const modPath = game.getModPaths(gameDiscovery.path)[''];
    const fontconfigTxt = path.join(modPath, 'interface', 'fontconfig.txt');
    return vortex_api_1.fs.readFileAsync(fontconfigTxt)
        .then((fontconfig) => {
        const rows = fontconfig.toString().split('\n');
        const fonts = rows.filter(row => row.startsWith('fontlib '))
            .map(row => row.trim().replace(/^fontlib +["'](.*)["'].*/, '$1').toLowerCase());
        const removedFonts = fonts
            .filter((font) => !skyrimDefaultFonts.has(font));
        return bluebird_1.default.map(removedFonts, (font) => {
            const fontFile = path.join(modPath, font);
            return vortex_api_1.fs.statAsync(fontFile)
                .then(() => null)
                .catch(() => fontFile);
        });
    })
        .then((missingFonts) => bluebird_1.default.resolve(missingFonts.filter(font => font !== null)))
        .catch(() => bluebird_1.default.resolve([]));
}
exports["default"] = missingSkyrimFonts;


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
//# sourceMappingURL=bundledPlugins/gamebryo-test-settings/gamebryo-test-settings.js.map