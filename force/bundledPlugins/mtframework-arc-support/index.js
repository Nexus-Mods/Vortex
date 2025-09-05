/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/shortid/index.js":
/*!***************************************!*\
  !*** ./node_modules/shortid/index.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


module.exports = __webpack_require__(/*! ./lib/index */ "./node_modules/shortid/lib/index.js");


/***/ }),

/***/ "./node_modules/shortid/lib/alphabet.js":
/*!**********************************************!*\
  !*** ./node_modules/shortid/lib/alphabet.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var randomFromSeed = __webpack_require__(/*! ./random/random-from-seed */ "./node_modules/shortid/lib/random/random-from-seed.js");

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

/***/ "./node_modules/shortid/lib/build.js":
/*!*******************************************!*\
  !*** ./node_modules/shortid/lib/build.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var encode = __webpack_require__(/*! ./encode */ "./node_modules/shortid/lib/encode.js");
var alphabet = __webpack_require__(/*! ./alphabet */ "./node_modules/shortid/lib/alphabet.js");

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

/***/ "./node_modules/shortid/lib/decode.js":
/*!********************************************!*\
  !*** ./node_modules/shortid/lib/decode.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


var alphabet = __webpack_require__(/*! ./alphabet */ "./node_modules/shortid/lib/alphabet.js");

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

/***/ "./node_modules/shortid/lib/encode.js":
/*!********************************************!*\
  !*** ./node_modules/shortid/lib/encode.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var randomByte = __webpack_require__(/*! ./random/random-byte */ "./node_modules/shortid/lib/random/random-byte-browser.js");

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

/***/ "./node_modules/shortid/lib/index.js":
/*!*******************************************!*\
  !*** ./node_modules/shortid/lib/index.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var alphabet = __webpack_require__(/*! ./alphabet */ "./node_modules/shortid/lib/alphabet.js");
var encode = __webpack_require__(/*! ./encode */ "./node_modules/shortid/lib/encode.js");
var decode = __webpack_require__(/*! ./decode */ "./node_modules/shortid/lib/decode.js");
var build = __webpack_require__(/*! ./build */ "./node_modules/shortid/lib/build.js");
var isValid = __webpack_require__(/*! ./is-valid */ "./node_modules/shortid/lib/is-valid.js");

// if you are using cluster or multiple servers use this to make each instance
// has a unique value for worker
// Note: I don't know if this is automatically set when using third
// party cluster solutions such as pm2.
var clusterWorkerId = __webpack_require__(/*! ./util/cluster-worker-id */ "./node_modules/shortid/lib/util/cluster-worker-id-browser.js") || 0;

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

/***/ "./node_modules/shortid/lib/is-valid.js":
/*!**********************************************!*\
  !*** ./node_modules/shortid/lib/is-valid.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


var alphabet = __webpack_require__(/*! ./alphabet */ "./node_modules/shortid/lib/alphabet.js");

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

/***/ "./node_modules/shortid/lib/random/random-byte-browser.js":
/*!****************************************************************!*\
  !*** ./node_modules/shortid/lib/random/random-byte-browser.js ***!
  \****************************************************************/
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

/***/ "./node_modules/shortid/lib/random/random-from-seed.js":
/*!*************************************************************!*\
  !*** ./node_modules/shortid/lib/random/random-from-seed.js ***!
  \*************************************************************/
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

/***/ "./node_modules/shortid/lib/util/cluster-worker-id-browser.js":
/*!********************************************************************!*\
  !*** ./node_modules/shortid/lib/util/cluster-worker-id-browser.js ***!
  \********************************************************************/
/***/ ((module) => {



module.exports = 0;


/***/ }),

/***/ "./src/ARCWrapper.ts":
/*!***************************!*\
  !*** ./src/ARCWrapper.ts ***!
  \***************************/
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
const child_process_1 = __webpack_require__(/*! child_process */ "child_process");
const path = __importStar(__webpack_require__(/*! path */ "path"));
const shortid_1 = __webpack_require__(/*! shortid */ "./node_modules/shortid/index.js");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
function quote(input) {
    return '"' + input + '"';
}
const winPathRE = /([a-zA-Z]:\\(?:[\w ]+\\)*[\w ]+(?:\.\w+)*)/;
class ARCWrapper {
    constructor(api) {
        console.log("ARCWrapper constructor", api);
        this.mApi = api;
    }
    list(archivePath, options) {
        const outputFile = archivePath + '.verbose.txt';
        let output = [];
        return this.run('l', [quote(archivePath)], options || {})
            .then(() => vortex_api_1.fs.readFileAsync(outputFile))
            .then(data => {
            output = this.parseList(data.toString()).map(entry => entry.path);
            return vortex_api_1.fs.unlinkAsync(outputFile);
        })
            .then(() => output);
    }
    extract(archivePath, outputPath, options) {
        const ext = path.extname(archivePath);
        const baseName = path.basename(archivePath, ext);
        const id = (0, shortid_1.generate)();
        const tempPath = path.join(path.dirname(archivePath), id + '_' + baseName);
        return vortex_api_1.fs.moveAsync(archivePath, tempPath + ext)
            .then(() => this.run('x', ['-txt', quote(tempPath + ext)], options || {}))
            .then(() => vortex_api_1.fs.moveAsync(tempPath + ext, archivePath))
            .then(() => vortex_api_1.fs.moveAsync(tempPath, outputPath, { overwrite: true }))
            .then(() => vortex_api_1.fs.moveAsync(tempPath + ext + '.txt', outputPath + '.arc.txt', { overwrite: true }).catch(() => null));
    }
    create(archivePath, source, options) {
        const args = [];
        return vortex_api_1.fs.statAsync(source + '.arc.txt')
            .then(() => {
            args.push('-txt');
        })
            .catch(err => {
            (0, vortex_api_1.log)('warn', 'file order file missing', { source, error: err.message });
        })
            .then(() => this.run('c', [...args, quote(source)], options || {}))
            .then(() => vortex_api_1.fs.moveAsync(source + '.arc', archivePath, { overwrite: true }));
    }
    parseList(input) {
        const res = [];
        let current;
        input.split('\n').forEach(line => {
            const arr = line.trim().split('=');
            if (arr.length !== 2) {
                return;
            }
            const [key, value] = arr;
            if (key === 'Path') {
                if (current !== undefined) {
                    res.push(current);
                }
                current = {
                    path: value,
                };
            }
            else if (current !== undefined) {
                current[key] = value;
            }
        });
        return res;
    }
    run(command, parameters, options) {
        return new bluebird_1.default((resolve, reject) => {
            let args = [
                '-' + command,
                options.game !== undefined ? '-' + options.game : '-DD',
                '-pc',
                '-texRE6',
                '-alwayscomp',
            ];
            if (options.version !== undefined) {
                args.push('-v');
                args.push(options.version.toFixed());
            }
            else {
                args.push('-v', '7');
            }
            args = args.concat(parameters);
            const process = (0, child_process_1.spawn)(quote(path.join(__dirname, 'ARCtool.exe')), args, {
                shell: true,
            });
            const errorLines = [];
            process.on('error', (err) => reject(err));
            process.on('close', (code) => {
                if (code !== 0) {
                    (0, vortex_api_1.log)('error', 'ARCtool.exe failed with status code ' + code);
                    this.mApi.showErrorNotification('ARCtool has failed.', 'ARCtool.exe failed with status code ' + code, {
                        allowReport: false
                    });
                    return reject(new vortex_api_1.util.ProcessCanceled('ARCtool.exe failed with status code ' + code));
                }
                if (errorLines.length !== 0) {
                    const err = new Error(errorLines.join('\n'));
                    err['attachLogOnReport'] = true;
                    return reject(err);
                }
                return resolve();
            });
            process.stdout.on('data', data => {
                const lines = data.toString().split('\n');
                lines.forEach(line => {
                    if (line.startsWith('Error')) {
                        errorLines.push(line.replace(winPathRE, '"$1"'));
                    }
                });
            });
            process.stderr.on('data', data => {
                data.toString().split('\n').forEach(line => errorLines.push(line));
            });
        });
    }
}
exports["default"] = ARCWrapper;


/***/ }),

/***/ "./src/AttribDashlet.tsx":
/*!*******************************!*\
  !*** ./src/AttribDashlet.tsx ***!
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
Object.defineProperty(exports, "__esModule", ({ value: true }));
const React = __importStar(__webpack_require__(/*! react */ "react"));
const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const api = __importStar(__webpack_require__(/*! vortex-api */ "vortex-api"));
const { Dashlet } = api;
const ARCTOOL_THREAD = 'http://residentevilmodding.boards.net/thread/5774/arctool';
const DOWNLOAD_PAGE = 'http://www.fluffyquack.com/tools';
class AttribDashlet extends vortex_api_1.PureComponentEx {
    constructor() {
        super(...arguments);
        this.openThread = () => {
            vortex_api_1.util.opn(ARCTOOL_THREAD);
        };
        this.openDLPage = () => {
            vortex_api_1.util.opn(DOWNLOAD_PAGE);
        };
    }
    render() {
        const { t } = this.props;
        return (React.createElement(Dashlet, { title: t('Support for this game is made possible using ARCtool'), className: 'dashlet-arcsupport' },
            React.createElement("div", null, t('Shared with kind permission by {{author}}', { replace: { author: 'FluffyQuack' } })),
            React.createElement("hr", null),
            React.createElement("div", null,
                t('Official Release Thread: '),
                React.createElement("a", { onClick: this.openThread }, ARCTOOL_THREAD)),
            React.createElement("div", null,
                t('Newest version is always available at: '),
                React.createElement("a", { onClick: this.openDLPage }, DOWNLOAD_PAGE),
                "/ARCtool.rar")));
    }
}
exports["default"] = (0, react_i18next_1.withTranslation)(['common', 'arc-support'])(AttribDashlet);


/***/ }),

/***/ "./src/gameSupport.ts":
/*!****************************!*\
  !*** ./src/gameSupport.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.arcVersion = exports.arcGameId = exports.gameSupported = void 0;
const gameSupport = {
    dragonsdogma: {
        arcId: 'DD',
        arcVersion: 7,
    },
};
function gameSupported(gameMode) {
    return gameSupport[gameMode] !== undefined;
}
exports.gameSupported = gameSupported;
function arcGameId(gameMode) {
    return (gameMode !== undefined)
        ? gameSupport[gameMode].arcId
        : undefined;
}
exports.arcGameId = arcGameId;
function arcVersion(gameMode) {
    return (gameMode !== undefined)
        ? gameSupport[gameMode].arcVersion
        : undefined;
}
exports.arcVersion = arcVersion;


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
const ARCWrapper_1 = __importDefault(__webpack_require__(/*! ./ARCWrapper */ "./src/ARCWrapper.ts"));
const AttribDashlet_1 = __importDefault(__webpack_require__(/*! ./AttribDashlet */ "./src/AttribDashlet.tsx"));
const gameSupport_1 = __webpack_require__(/*! ./gameSupport */ "./src/gameSupport.ts");
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const fs = __importStar(__webpack_require__(/*! fs */ "fs"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
class ARCHandler {
    constructor(api, fileName, options) {
        this.mArchivePath = fileName;
        this.mGame = (0, gameSupport_1.arcGameId)(options.gameId);
        this.mVersion = (0, gameSupport_1.arcVersion)(options.gameId);
        this.mArc = new ARCWrapper_1.default(api);
    }
    readDir(dirPath) {
        return this.mArc.list(this.mArchivePath, { game: this.mGame, version: this.mVersion })
            .then(list => list
            .filter(entry => entry.startsWith(dirPath))
            .map(entry => entry.substr(dirPath.length)));
    }
    extractAll(outputPath) {
        return this.mArc.extract(this.mArchivePath, outputPath, { game: this.mGame, version: this.mVersion });
    }
    create(sourcePath) {
        return this.mArc.create(this.mArchivePath, sourcePath, { game: this.mGame, version: this.mVersion });
    }
}
function createARCHandler(api, fileName, options) {
    (0, vortex_api_1.log)('info', 'createARCHandler');
    return bluebird_1.default.resolve(new ARCHandler(api, fileName, options));
}
function isSupported(state) {
    const gameMode = vortex_api_1.selectors.activeGameId(state);
    return ['dragonsdogma'].indexOf(gameMode) !== -1;
}
function init(context) {
    try {
        fs.statSync(path.join(__dirname, 'ARCtool.exe'));
    }
    catch (err) {
        (0, vortex_api_1.log)('warn', 'To use MT Framework games (Dragon\'s Dogma) you need to download ARCtool.rar '
            + `from http://www.fluffyquack.com/tools/ and unpack it to ${__dirname}`);
        return false;
    }
    context.registerArchiveType('arc', (fileName, options) => createARCHandler(context.api, fileName, options));
    context.registerDashlet('ARC Support', 1, 2, 250, AttribDashlet_1.default, isSupported, () => ({}), undefined);
    return true;
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

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("fs");

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

/***/ "react-i18next":
/*!********************************!*\
  !*** external "react-i18next" ***!
  \********************************/
/***/ ((module) => {

module.exports = require("react-i18next");

/***/ }),

/***/ "vortex-api":
/*!*****************************!*\
  !*** external "vortex-api" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("vortex-api");

/***/ }),

/***/ "child_process":
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
/***/ ((module) => {

module.exports = require("child_process");

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
//# sourceMappingURL=bundledPlugins/mtframework-arc-support/mtframework-arc-support.js.map