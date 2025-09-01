/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

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
const DOWNLOAD_PAGE = 'https://aluigi.altervista.org/quickbms.htm';
const api = __importStar(__webpack_require__(/*! vortex-api */ "vortex-api"));
const { Dashlet } = api;
class QBMSAttribDashlet extends vortex_api_1.PureComponentEx {
    constructor() {
        super(...arguments);
        this.openQBMSPage = () => {
            vortex_api_1.util.opn(DOWNLOAD_PAGE).catch(err => null);
        };
    }
    render() {
        const { t } = this.props;
        return (React.createElement(Dashlet, { title: t('Support for this game is made possible using QuickBMS'), className: 'dashlet-quickbms' },
            React.createElement("div", null, t('Special thanks to {{author}} for developing this tool', { replace: { author: 'Luigi Auriemma' } })),
            React.createElement("div", null,
                t('You can find the QBMS home page: '),
                React.createElement("a", { onClick: this.openQBMSPage }, DOWNLOAD_PAGE))));
    }
}
exports["default"] = (0, react_i18next_1.withTranslation)(['common', 'qbms-support'])(QBMSAttribDashlet);


/***/ }),

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
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
const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
const AttribDashlet_1 = __importDefault(__webpack_require__(/*! ./AttribDashlet */ "./src/AttribDashlet.tsx"));
const types_1 = __webpack_require__(/*! ./types */ "./src/types.ts");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const GAME_SUPPORT = [];
const DEPRECATED_NOTIF_ID = 'deprecated-qbms-call';
let _GAMEMODE_SUPPORTED = false;
function showAttrib(state) {
    const gameMode = vortex_api_1.selectors.activeGameId(state);
    return GAME_SUPPORT.includes(gameMode);
}
function queryAttachment(data) {
    return vortex_api_1.fs.statAsync(data.filePath)
        .then(() => Promise.resolve(data))
        .catch(err => Promise.resolve(undefined));
}
function successfulOp(context, props, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = 'qbms-success-notif';
        const state = context.api.store.getState();
        const notifications = vortex_api_1.util.getSafe(state, ['session', 'notifications', 'notifications'], []);
        if ((props.quiet !== true) && notifications.find(notif => notif.id === id) === undefined) {
            context.api.sendNotification({
                id,
                type: 'success',
                message: 'QBMS operation completed',
                displayMS: 3000,
            });
        }
        if (props.callback !== undefined) {
            props.callback(undefined, data);
        }
        return Promise.resolve();
    });
}
function errorHandler(api, props, err) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const { callback, gameMode } = props;
        const state = api.store.getState();
        const contributed = (_a = vortex_api_1.selectors.gameById(state, gameMode)) === null || _a === void 0 ? void 0 : _a.contributed;
        const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', gameMode], {});
        const modKeys = Object.keys(mods);
        const attachments = [{
                id: 'installedMods',
                type: 'data',
                data: modKeys.join('\n') || 'None',
                description: 'List of installed mods',
            }];
        const qbmsLog = {
            filePath: path_1.default.join(vortex_api_1.util.getVortexPath('userData'), 'quickbms.log'),
            description: 'QuickBMS log file',
        };
        const vortexLog = {
            filePath: path_1.default.join(vortex_api_1.util.getVortexPath('userData'), 'vortex.log'),
            description: 'Vortex log file',
        };
        let addedAttachments = [];
        if (props.additionalAttachments !== undefined) {
            addedAttachments = yield props.additionalAttachments();
        }
        if (err instanceof types_1.UnregisteredGameError) {
            err['message'] += ' - did you forget to call qbmsRegisterGame?';
        }
        else if (err instanceof types_1.QuickBMSError) {
            err['message'] += '\n\n' + err.errorLines;
        }
        return Promise.all([qbmsLog, vortexLog, ...addedAttachments].map(file => queryAttachment(file)))
            .then(files => {
            const validAttachments = files.filter(file => !!file);
            validAttachments.forEach(att => {
                attachments.push({
                    id: path_1.default.basename(att.filePath),
                    type: 'file',
                    data: att.filePath,
                    description: att.description,
                });
            });
        })
            .then(() => {
            if (_GAMEMODE_SUPPORTED) {
                if (props.quiet !== true) {
                    api.showErrorNotification('failed to execute qbms operation', err, { allowReport: contributed !== undefined, attachments });
                }
                if (callback) {
                    callback(err, undefined);
                }
            }
            else {
                if (callback) {
                    (0, vortex_api_1.log)('info', 'qbms encountered an error', err.message);
                    callback(new vortex_api_1.util.ProcessCanceled('[QBMS] ' + err.message), undefined);
                }
            }
        });
    });
}
function testGameRegistered(props) {
    return (!GAME_SUPPORT.includes(props.gameMode))
        ? Promise.reject(new types_1.UnregisteredGameError(props.gameMode))
        : Promise.resolve();
}
function sanitizeProps(props, opType) {
    if (props.qbmsOptions === undefined) {
        props.qbmsOptions = {
            wildCards: ['{}'],
        };
    }
    if (opType === 'reimport' && props.qbmsOptions.allowResize === undefined) {
        props.qbmsOptions.allowResize = false;
    }
    if (opType === 'write' && props.operationPath !== undefined && props.operationPath.endsWith(path_1.default.sep)) {
        props.operationPath = props.operationPath.substr(0, props.operationPath.length - 1);
    }
    return props;
}
function list(context, props) {
    props = sanitizeProps(props, 'list');
    return (__webpack_require__(/*! ./quickbms */ "./src/quickbms.ts").list)(props)
        .then(listEntries => (props.callback !== undefined)
        ? successfulOp(context, props, listEntries)
        : Promise.resolve())
        .catch(err => errorHandler(context.api, props, err));
}
function extract(context, props) {
    props = sanitizeProps(props, 'extract');
    return (__webpack_require__(/*! ./quickbms */ "./src/quickbms.ts").extract)(props)
        .then(() => (props.callback !== undefined)
        ? successfulOp(context, props)
        : Promise.resolve())
        .catch(err => errorHandler(context.api, props, err));
}
function write(context, props) {
    props = sanitizeProps(props, 'write');
    return (__webpack_require__(/*! ./quickbms */ "./src/quickbms.ts").write)(props)
        .then(() => (props.callback !== undefined)
        ? successfulOp(context, props)
        : Promise.resolve())
        .catch(err => errorHandler(context.api, props, err));
}
function reImport(context, props) {
    props = sanitizeProps(props, 'reimport');
    return (__webpack_require__(/*! ./quickbms */ "./src/quickbms.ts").reImport)(props)
        .then(() => (props.callback !== undefined)
        ? successfulOp(context, props)
        : Promise.resolve())
        .catch(err => errorHandler(context.api, props, err));
}
function raiseDeprecatedAPINotification(context) {
    const state = context.api.store.getState();
    const notifications = vortex_api_1.util.getSafe(state, ['session', 'notifications', 'notifications'], []);
    if (notifications.find(not => not.id === DEPRECATED_NOTIF_ID) === undefined) {
        context.api.sendNotification({
            id: DEPRECATED_NOTIF_ID,
            message: 'Game extension is using deprecated QBMS API calls',
            type: 'warning',
            noDismiss: true,
            actions: [
                {
                    title: 'More',
                    action: () => context.api.showDialog('info', 'Deprecated QB API', {
                        text: 'This extension is using deprecated QBMS API calls which will eventually be removed - '
                            + 'please inform the extension developer to update it ASAP!',
                    }, [{ label: 'Close' }]),
                },
            ],
        });
    }
}
function init(context) {
    context.registerDashlet('QBMS Support', 1, 2, 250, AttribDashlet_1.default, showAttrib, () => ({}), undefined);
    context.registerAPI('qbmsRegisterGame', (gameMode) => {
        GAME_SUPPORT.push(gameMode);
    }, { minArguments: 1 });
    context.registerAPI('qbmsList', (props) => list(context, props), { minArguments: 1 });
    context.registerAPI('qbmsExtract', (props) => extract(context, props), { minArguments: 1 });
    context.registerAPI('qbmsWrite', (props) => write(context, props), { minArguments: 1 });
    context.registerAPI('qbmsReimport', (props) => reImport(context, props), { minArguments: 1 });
    context.once(() => {
        context.api.events.on('gamemode-activated', (gameMode) => {
            context.api.dismissNotification(DEPRECATED_NOTIF_ID);
            _GAMEMODE_SUPPORTED = GAME_SUPPORT.includes(gameMode);
        });
        context.api.events.on('quickbms-operation', (bmsScriptPath, archivePath, inPath, opType, options, callback) => {
            raiseDeprecatedAPINotification(context);
            const state = context.api.store.getState();
            const activeGameId = vortex_api_1.selectors.activeGameId(state);
            const props = {
                gameMode: activeGameId,
                bmsScriptPath,
                archivePath,
                operationPath: inPath,
                qbmsOptions: options,
                callback,
            };
            if (!GAME_SUPPORT.includes(activeGameId)) {
                return testGameRegistered(props)
                    .catch(err => errorHandler(context.api, props, err));
            }
            switch (opType) {
                case 'extract':
                    return extract(context, props);
                case 'reimport':
                    return reImport(context, props);
                case 'write':
                    return write(context, props);
                case 'list':
                default:
                    return list(context, props);
            }
        });
    });
    return true;
}
exports["default"] = init;


/***/ }),

/***/ "./src/quickbms.ts":
/*!*************************!*\
  !*** ./src/quickbms.ts ***!
  \*************************/
/***/ (function(module, exports, __webpack_require__) {


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
const types_1 = __webpack_require__(/*! ./types */ "./src/types.ts");
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const child_process_1 = __webpack_require__(/*! child_process */ "child_process");
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const FILTER_FILE_PATH = path.join(vortex_api_1.util.getVortexPath('userData'), 'temp', 'qbms', 'filters.txt');
const LOG_FILE_PATH = path.join(vortex_api_1.util.getVortexPath('userData'), 'quickbms.log');
const TIMEOUT_MSEC = 15000;
const CHECK_TIME_MSEC = 5000;
const QUICK_BMS_ERRORMSG = [
    'success',
    'encountered an unknown error',
    'unable to allocate memory, memory errors',
    'missing input file',
    'unable to write output file',
    'file compression error (Review BMS script)',
    'file encryption error (Review BMS script)',
    'external dll file has reported an error',
    'BMS script syntax error',
    'invalid quickbms arguments provided',
    'error accessing input/output folder',
    'user/external application has terminated quickBMS',
    'extra IO error',
    'failed to update quickbms',
    'QBMS has timed out',
];
function quote(input) {
    return '"' + input + '"';
}
function parseList(input, wildCards) {
    const lines = input.split('\n');
    const wildCardRgx = /{}|\*/g;
    const regexps = wildCards.reduce((accum, wildCard) => {
        if (wildCardRgx.test(wildCard)) {
            const replacement = wildCard.replace(wildCardRgx, '.*');
            accum.push(new RegExp(replacement, 'g'));
        }
        return accum;
    }, []);
    const findMatch = (filePath) => {
        if (wildCards.includes(filePath)) {
            return true;
        }
        let matched = false;
        for (const rgx of regexps) {
            if (rgx.test(filePath)) {
                matched = true;
                break;
            }
        }
        return matched;
    };
    const filtered = lines.filter(line => !!line && !line.includes('- filter'));
    const res = filtered.reduce((accum, line) => {
        const arr = line.trim().split(' ').filter(entry => !!entry);
        if (arr.length === 3) {
            const [offset, size, filePath] = arr;
            if (findMatch(filePath)) {
                accum.push({ offset, size, filePath });
            }
        }
        return accum;
    }, []);
    return res;
}
function validateArguments(archivePath, bmsScriptPath, outPath, options) {
    if (path.extname(bmsScriptPath) !== '.bms') {
        return bluebird_1.default.reject(new vortex_api_1.util.ArgumentInvalid('bmsScriptPath'));
    }
    if (!path.isAbsolute(archivePath)) {
        return bluebird_1.default.reject(new vortex_api_1.util.ArgumentInvalid('archivePath'));
    }
    if (!path.isAbsolute(outPath)) {
        return bluebird_1.default.reject(new vortex_api_1.util.ArgumentInvalid('outPath'));
    }
    return bluebird_1.default.resolve();
}
function run(command, parameters, options) {
    let timer;
    let isClosed = false;
    let lastMessageReceived;
    let wstream;
    const createLog = (!!options.createLog || (command === 'l'));
    if (createLog) {
        wstream = vortex_api_1.fs.createWriteStream(LOG_FILE_PATH);
    }
    return new bluebird_1.default((resolve, reject) => {
        let args = [
            (!!command) ? ' -' + command : undefined,
            (options.allowResize !== undefined)
                ? (!options.allowResize)
                    ? '-r'
                    : '-r -r'
                : undefined,
            (!!options.quiet) ? '-q' : undefined,
            (!!options.overwrite) ? '-o' : undefined,
            (!!options.caseSensitive) ? '-I' : undefined,
            (!!options.keepTemporaryFiles) ? '-T' : undefined,
            (!!options.wildCards) ? '-f ' + quote(FILTER_FILE_PATH) : undefined,
        ];
        args = args.filter(arg => arg !== undefined).concat(parameters);
        let process;
        try {
            process = (0, child_process_1.spawn)(quote(path.join(__dirname, 'quickbms_4gb_files.exe')), args, {
                shell: true,
            });
        }
        catch (err) {
            return reject(err);
        }
        if (timer === undefined) {
            lastMessageReceived = Date.now();
            timer = setTimeout(() => checkTimer(), CHECK_TIME_MSEC);
        }
        const onNewMessage = () => {
            lastMessageReceived = Date.now();
        };
        const stdInErrs = [];
        const checkTimer = () => {
            if ((lastMessageReceived + TIMEOUT_MSEC) <= Date.now()) {
                process.kill();
                clearTimeout(timer);
                timer = undefined;
            }
            else {
                if (!isClosed) {
                    try {
                        process.stdin.write('\x20', (err) => {
                            stdInErrs.push(JSON.stringify(err, undefined, 2));
                        });
                        timer = setTimeout(() => checkTimer(), CHECK_TIME_MSEC);
                    }
                    catch (err) {
                        isClosed = true;
                        (0, vortex_api_1.log)('error', 'failed to send keep alive', err);
                        clearTimeout(timer);
                        timer = undefined;
                    }
                }
                else {
                    clearTimeout(timer);
                    timer = undefined;
                }
            }
        };
        const stdOutLines = [];
        const stdErrLines = [];
        process.on('error', (err) => {
            if (createLog) {
                wstream.close();
            }
            return reject(err);
        });
        process.on('close', (code, signal) => {
            isClosed = true;
            if (signal === 'SIGTERM') {
                if (!createLog) {
                    wstream = vortex_api_1.fs.createWriteStream(LOG_FILE_PATH);
                }
                const timeoutDump = [].concat(['QBMS has timed out!'], stdErrLines, stdOutLines, stdInErrs);
                timeoutDump.forEach(line => wstream.write(line + '\n'));
                wstream.close();
                wstream = undefined;
                return reject(new types_1.QuickBMSError(`quickbms(${signal}) - ${QUICK_BMS_ERRORMSG[14]}`, stdErrLines));
            }
            if (!!wstream) {
                wstream.close();
                wstream = undefined;
            }
            if (code !== 0) {
                const errorMsg = (code > QUICK_BMS_ERRORMSG.length - 1)
                    ? QUICK_BMS_ERRORMSG[1]
                    : QUICK_BMS_ERRORMSG[code];
                return reject(new types_1.QuickBMSError(`quickbms(${code}) - ` + errorMsg, stdErrLines));
            }
            const hasErrors = stdErrLines.find(line => line.indexOf('Error:') !== -1) !== undefined;
            if (hasErrors) {
                return reject(new Error(stdErrLines.join('\n')));
            }
            return resolve();
        });
        process.stdout.on('data', data => {
            onNewMessage();
            const formatted = data.toString().split('\n');
            formatted.forEach(line => {
                const formattedLine = line.replace(/\\/g, '/');
                stdOutLines.push(formattedLine);
                if (createLog) {
                    wstream.write(formattedLine + '\n');
                }
            });
        });
        process.stderr.on('data', data => {
            onNewMessage();
            const formatted = data.toString().split('\n');
            formatted.forEach(line => {
                stdErrLines.push(line);
            });
        });
    });
}
function createFiltersFile(wildCards) {
    return vortex_api_1.fs.ensureDirAsync(path.dirname(FILTER_FILE_PATH))
        .then(() => vortex_api_1.fs.writeFileAsync(FILTER_FILE_PATH, wildCards.join('\n'))
        .then(() => bluebird_1.default.resolve())
        .catch(err => bluebird_1.default.reject(err)));
}
function removeFiltersFile() {
    return vortex_api_1.fs.statAsync(FILTER_FILE_PATH)
        .then(() => vortex_api_1.fs.removeAsync(FILTER_FILE_PATH))
        .catch(err => (err.code === 'ENOENT')
        ? bluebird_1.default.resolve()
        : bluebird_1.default.reject(err));
}
function reImport(props) {
    const { archivePath, bmsScriptPath, qbmsOptions, operationPath } = props;
    return validateArguments(archivePath, bmsScriptPath, operationPath, qbmsOptions)
        .then(() => (!!qbmsOptions.wildCards)
        ? createFiltersFile(qbmsOptions.wildCards)
        : bluebird_1.default.resolve())
        .then(() => (qbmsOptions.allowResize !== undefined)
        ? bluebird_1.default.resolve()
        : bluebird_1.default.reject(new vortex_api_1.util.ArgumentInvalid('Re-import version was not specified')))
        .then(() => run('w', [quote(bmsScriptPath), quote(archivePath), quote(operationPath)], qbmsOptions))
        .then(() => removeFiltersFile());
}
function extract(props) {
    const { archivePath, bmsScriptPath, qbmsOptions, operationPath } = props;
    return validateArguments(archivePath, bmsScriptPath, operationPath, qbmsOptions)
        .then(() => (!!qbmsOptions.wildCards)
        ? createFiltersFile(qbmsOptions.wildCards)
        : undefined)
        .then(() => run(undefined, [quote(bmsScriptPath), quote(archivePath), quote(operationPath)], qbmsOptions))
        .then(() => removeFiltersFile());
}
function list(props) {
    const { archivePath, bmsScriptPath, qbmsOptions, operationPath } = props;
    return validateArguments(archivePath, bmsScriptPath, operationPath, qbmsOptions)
        .then(() => (!!qbmsOptions.wildCards)
        ? createFiltersFile(qbmsOptions.wildCards)
        : bluebird_1.default.resolve())
        .then(() => run('l', [quote(bmsScriptPath), quote(archivePath), quote(operationPath)], qbmsOptions))
        .then(() => removeFiltersFile())
        .then(() => vortex_api_1.fs.readFileAsync(LOG_FILE_PATH, { encoding: 'utf-8' }))
        .then(data => {
        const fileEntries = parseList(data, qbmsOptions.wildCards);
        return bluebird_1.default.resolve(fileEntries);
    });
}
function write(props) {
    const { archivePath, bmsScriptPath, qbmsOptions, operationPath } = props;
    return validateArguments(archivePath, bmsScriptPath, operationPath, qbmsOptions)
        .then(() => run('w', [quote(bmsScriptPath), quote(archivePath), quote(operationPath)], qbmsOptions));
}
module.exports = {
    reImport,
    list,
    write,
    extract,
};


/***/ }),

/***/ "./src/types.ts":
/*!**********************!*\
  !*** ./src/types.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UnregisteredGameError = exports.QuickBMSError = void 0;
class QuickBMSError extends Error {
    constructor(message, stdErrLines) {
        super(message);
        this.name = 'QuickBMSError';
        const filtered = this.trimContact(stdErrLines);
        this.mErrorLines = (filtered.length > 40)
            ? filtered.slice(filtered.length - 40).join('\n')
            : filtered.join('\n');
    }
    get errorLines() {
        return this.mErrorLines;
    }
    trimContact(stdErrLines) {
        return stdErrLines.filter((line, idx) => (idx > 10)
            ? true : !line.toLowerCase().includes('luigi'));
    }
}
exports.QuickBMSError = QuickBMSError;
class UnregisteredGameError extends Error {
    constructor(gameMode) {
        super(`${gameMode} is not a qbms registered game`);
    }
}
exports.UnregisteredGameError = UnregisteredGameError;


/***/ }),

/***/ "bluebird":
/*!***************************!*\
  !*** external "bluebird" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("bluebird");

/***/ }),

/***/ "child_process":
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
/***/ ((module) => {

module.exports = require("child_process");

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
//# sourceMappingURL=bundledPlugins/quickbms-support/quickbms-support.js.map