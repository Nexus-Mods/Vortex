/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	const __webpack_modules__ = ({

/***/ "./src/Errors.ts":
/*!***********************!*\
  !*** ./src/Errors.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, exports) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.AutoInstallDisabledError = exports.InvalidAPICallError = exports.NotPremiumError = void 0;
      class NotPremiumError extends Error {
        constructor() {
          super('User is not premium');
          this.name = 'NotPremiumError';
        }
      }
      exports.NotPremiumError = NotPremiumError;
      class InvalidAPICallError extends Error {
        constructor(violations) {
          super('Invalid object received via API call');
          this.name = 'InvalidObjectError';
          this.mViolations = violations.map(vi => vi.message);
        }
      }
      exports.InvalidAPICallError = InvalidAPICallError;
      class AutoInstallDisabledError extends Error {
        constructor(dl) {
          super('Auto install is disabled');
          this.name = 'AutoInstallDisabledError';
          this.mDownloadInfo = dl;
        }
      }
      exports.AutoInstallDisabledError = AutoInstallDisabledError;


/***/ }),

/***/ "./src/common.ts":
/*!***********************!*\
  !*** ./src/common.ts ***!
  \***********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


      const __importDefault = (this && this.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.getDownload = exports.getLatestVersion = exports.addGameSupport = exports.getSupportMap = exports.UMM_ID = exports.UMM_EXE = exports.NEXUS = void 0;
      const semver_1 = __importDefault(__webpack_require__(/*! semver */ "semver"));
      exports.NEXUS = 'www.nexusmods.com';
      exports.UMM_EXE = 'UnityModManager.exe';
      exports.UMM_ID = 'UnityModManager';
      const GAME_SUPPORT = {};
      const getSupportMap = () => GAME_SUPPORT;
      exports.getSupportMap = getSupportMap;
      const addGameSupport = (gameConf) => {
        GAME_SUPPORT[gameConf.gameId] = gameConf;
      };
      exports.addGameSupport = addGameSupport;
      const DEFAULT_VERSION = '0.24.2';
      const AVAILABLE = {
        '0.21.8-b': {
          domainId: 'site',
          modId: '21',
          fileId: '484',
          archiveName: 'UnityModManager-21-0-21-8b.zip',
          allowAutoInstall: true,
          githubUrl: 'https://github.com/IDCs/unity-mod-manager/releases/tag/0.21.8b',
        },
        '0.23.5-b': {
          domainId: 'site',
          modId: '21',
          fileId: '1180',
          archiveName: 'UnityModManager-21-0-23-5b.zip',
          allowAutoInstall: true,
          githubUrl: 'https://github.com/IDCs/unity-mod-manager/releases/tag/0.23.5b',
        },
        '0.24.2': {
          domainId: 'site',
          modId: '21',
          fileId: '1359',
          archiveName: 'UnityModManager-21-0-24-2.zip',
          allowAutoInstall: true,
          githubUrl: 'https://github.com/IDCs/unity-mod-manager/releases/tag/0.24.2',
        },
      };
      const getLatestVersion = () => {
        const versions = Object.keys(AVAILABLE);
        const latestVersion = versions.reduce((prev, iter) => {
          if (semver_1.default.gt(iter, prev)) {
            prev = iter;
          }
          return prev;
        }, DEFAULT_VERSION);
        return latestVersion;
      };
      exports.getLatestVersion = getLatestVersion;
      const getDownload = (gameConf) => {
        const download = ((gameConf.ummVersion !== undefined)
        && Object.keys(AVAILABLE).includes(gameConf.ummVersion))
          ? AVAILABLE[gameConf.ummVersion] : AVAILABLE[(0, exports.getLatestVersion)()];
        return Object.assign(Object.assign({}, download), { gameId: gameConf.gameId });
      };
      exports.getDownload = getDownload;


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
      const __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
      const __importDefault = (this && this.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const path = __importStar(__webpack_require__(/*! path */ "path"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const validation_1 = __webpack_require__(/*! ./validationCode/validation */ "./src/validationCode/validation.ts");
      const common_1 = __webpack_require__(/*! ./common */ "./src/common.ts");
      const ummDownloader_1 = __webpack_require__(/*! ./ummDownloader */ "./src/ummDownloader.ts");
      const Errors_1 = __webpack_require__(/*! ./Errors */ "./src/Errors.ts");
      const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
      const AttribDashlet_1 = __importDefault(__webpack_require__(/*! ./views/AttribDashlet */ "./src/views/AttribDashlet.tsx"));
      function showAttrib(state) {
        const gameMode = vortex_api_1.selectors.activeGameId(state);
        return (0, common_1.getSupportMap)()[gameMode] !== undefined;
      }
      function isSupported(gameId) {
        const gameConf = (0, common_1.getSupportMap)()[gameId];
        return gameConf !== undefined;
      }
      function isUMMApp(files) {
        return files.find(file => (0, util_1.isUMMExecPred)(file)) !== undefined;
      }
      function testUmmApp(files, gameId) {
        const supported = ((isSupported(gameId)) && (isUMMApp(files)));
        return Promise.resolve({
          supported,
          requiredFiles: [],
        });
      }
      function installUMM(api, files, destinationPath, gameId) {
        const execFile = files.find(file => (0, util_1.isUMMExecPred)(file));
        const idx = execFile.indexOf(common_1.UMM_EXE);
        const installDir = vortex_api_1.selectors.installPathForGame(api.store.getState(), gameId);
        const expectedDestination = path.join(installDir, path.basename(destinationPath, '.installing'));
        const fileInstructions = files.map(file => {
          return {
            type: 'copy',
            source: file,
            destination: file.substr(idx),
          };
        });
        const modTypeInstruction = {
          type: 'setmodtype',
          value: 'umm',
        };
        const attribInstr = {
          type: 'attribute',
          key: 'customFileName',
          value: 'Unity Mod Manager',
        };
        const instructions = [].concat(fileInstructions, modTypeInstruction, attribInstr);
        (0, util_1.setUMMPath)(api, expectedDestination, gameId);
        return Promise.resolve({ instructions });
      }
      function genOnGameModeActivated(api, gameId) {
        return __awaiter(this, void 0, void 0, function* () {
          if (!isSupported(gameId)) {
            return;
          }
          try {
            yield (0, ummDownloader_1.ensureUMM)(api, gameId);
          }
          catch (err) {
            if (!(err instanceof Errors_1.NotPremiumError)) {
              api.showErrorNotification('Failed to ensure UMM installation', err);
            }
          }
        });
      }
      function genOnCheckUpdate(api, gameId, mods) {
        return __awaiter(this, void 0, void 0, function* () {
          if (!isSupported(gameId)) {
            return;
          }
          try {
            yield (0, ummDownloader_1.ensureUMM)(api, gameId);
          }
          catch (err) {
            if (!(err instanceof Errors_1.NotPremiumError)) {
              api.showErrorNotification('Failed to ensure UMM installation', err);
            }
          }
        });
      }
      const modTypeTest = (0, util_1.toBlue)(() => Promise.resolve(false));
      function init(context) {
        const getPath = (game) => {
          const state = context.api.getState();
          const gameConf = (0, common_1.getSupportMap)()[game.id];
          const discovery = state.settings.gameMode.discovered[game.id];
          if (gameConf !== undefined && (discovery === null || discovery === void 0 ? void 0 : discovery.path) !== undefined) {
            return path.join(discovery.path, common_1.UMM_ID);
          }
          else {
            return undefined;
          }
        };
        context.registerInstaller('umm-installer', 15, (0, util_1.toBlue)((files, gameId) => testUmmApp(files, gameId)), (0, util_1.toBlue)((files, dest, gameId) => installUMM(context.api, files, dest, gameId)));
        context.registerModType('umm', 15, isSupported, () => undefined, modTypeTest, {
          mergeMods: true,
          name: 'Unity Mod Manager',
          deploymentEssential: false,
        });
        context.registerAPI('ummAddGame', (gameConf, callback) => {
          const validationErrors = (0, validation_1.validateIUMMGameConfig)(gameConf);
          if (validationErrors.length === 0) {
            (0, common_1.addGameSupport)(gameConf);
          }
          else {
            const error = new Errors_1.InvalidAPICallError(validationErrors);
            if (callback !== undefined) {
              callback(error);
            }
            else {
              context.api.showErrorNotification('Failed to register UMM game', error, { allowReport: false });
            }
          }
        }, { minArguments: 1 });
        context.registerDashlet('UMM Support', 1, 2, 250, AttribDashlet_1.default, showAttrib, () => ({}), undefined);
        context.once(() => {
          context.api.events.on('gamemode-activated', (gameMode) => genOnGameModeActivated(context.api, gameMode));
          context.api.events.on('check-mods-version', (gameId, mods) => genOnCheckUpdate(context.api, gameId, mods));
        });
        return true;
      }
      exports["default"] = init;


/***/ }),

/***/ "./src/ummDownloader.ts":
/*!******************************!*\
  !*** ./src/ummDownloader.ts ***!
  \******************************/
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
      const __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
      const __importDefault = (this && this.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.ensureUMM = void 0;
      const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const winapi = __importStar(__webpack_require__(/*! winapi-bindings */ "winapi-bindings"));
      const common_1 = __webpack_require__(/*! ./common */ "./src/common.ts");
      const Errors_1 = __webpack_require__(/*! ./Errors */ "./src/Errors.ts");
      const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
      function ensureUMM(api, gameMode, force) {
        return __awaiter(this, void 0, void 0, function* () {
          const state = api.getState();
          const gameId = (gameMode === undefined)
            ? vortex_api_1.selectors.activeGameId(state)
            : gameMode;
          const gameConf = (0, common_1.getSupportMap)()[gameId];
          if (gameConf === undefined || !gameConf.autoDownloadUMM) {
            return undefined;
          }
          const ummPath = yield findUMMPath();
          if (ummPath !== undefined) {
            (0, util_1.setUMMPath)(api, ummPath, gameMode);
            return undefined;
          }
          const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', gameId], {});
          const dl = (0, common_1.getDownload)(gameConf);
          const ummModIds = Object.keys(mods).filter(id => { let _a; return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === 'umm'; });
          const hasRequireVersion = ummModIds.reduce((prev, iter) => {
            let _a, _b;
            if (((_b = (_a = mods[iter]) === null || _a === void 0 ? void 0 : _a.attributes) === null || _b === void 0 ? void 0 : _b.fileId) === +dl.fileId) {
              prev = true;
            }
            return prev;
          }, false);
          if (!hasRequireVersion) {
            force = true;
          }
          try {
            const modId = yield download(api, dl, force);
            return modId;
          }
          catch (err) {
            if (err instanceof Errors_1.AutoInstallDisabledError) {
              (0, vortex_api_1.log)('debug', 'auto install is disabled', err);
              return Promise.resolve(undefined);
            }
            if (err instanceof Errors_1.NotPremiumError) {
              const t = api.translate;
              const replace = {
                game: gameMode,
                bl: '[br][/br][br][/br]',
              };
              api.showDialog('info', 'Unity Mod Manager Required', {
                bbcode: t('The {{game}} game extension requires a 3rd party mod '
                        + 'patching/injection tool called Unity Mod Manager (UMM).{{bl}}'
                        + 'Vortex can walk you through the download/installation process; once complete, UMM '
                        + 'will be available as a tool in your dashboard.'
                        + 'Depending on the modding pattern of {{game}}, UMM may be a hard requirement '
                        + 'for mods to function in-game, in which case you MUST have the tool installed '
                        + 'and configured to inject mods into your game. (run the tool for more info)', { replace }),
              }, [
                { label: 'Close' },
                {
                  label: 'Download UMM',
                  action: () => __awaiter(this, void 0, void 0, function* () {
                    try {
                      yield downloadFromGithub(api, dl);
                    }
                    catch (err2) {
                      err['attachLogOnReport'] = true;
                      api.showErrorNotification('Failed to download UMM dependency', err2);
                    }
                  }),
                  default: true,
                },
              ]);
              return Promise.reject(err);
            }
            (0, vortex_api_1.log)('error', 'failed to download default pack', err);
            return Promise.resolve(undefined);
          }
        });
      }
      exports.ensureUMM = ensureUMM;
      function downloadFromGithub(api, dlInfo) {
        return __awaiter(this, void 0, void 0, function* () {
          const t = api.translate;
          const replace = {
            archiveName: dlInfo.archiveName,
          };
          const instructions = t('Once you allow Vortex to browse to GitHub - '
            + 'Please scroll down and click on "{{archiveName}}"', { replace });
          return new Promise((resolve, reject) => {
            api.emitAndAwait('browse-for-download', dlInfo.githubUrl, instructions)
              .then((result) => {
                if (!result || !result.length) {
                  return reject(new vortex_api_1.util.UserCanceled());
                }
                if (!result[0].includes(dlInfo.archiveName)) {
                  return reject(new vortex_api_1.util.ProcessCanceled('Selected wrong download'));
                }
                api.events.emit('start-download', [result[0]], {}, undefined, (error, id) => __awaiter(this, void 0, void 0, function* () {
                  if (error !== null) {
                    return reject(error);
                  }
                  try {
                    const modId = yield finalize(api, dlInfo, id);
                    return resolve(modId);
                  }
                  catch (err) {
                    return reject(err);
                  }
                }), 'never');
              });
          })
            .catch(err => {
              if (err instanceof vortex_api_1.util.UserCanceled) {
                return Promise.resolve();
              }
              else if (err instanceof vortex_api_1.util.ProcessCanceled) {
                return downloadFromGithub(api, dlInfo);
              }
              else {
                return Promise.reject(err);
              }
            });
        });
      }
      function readRegistryKey(hive, key, name) {
        try {
          const instPath = winapi.RegGetValue(hive, key, name);
          if (!instPath) {
            throw new Error('empty registry key');
          }
          return instPath.value;
        }
        catch (err) {
          return undefined;
        }
      }
      function setRegistryKey(hive, key, name, value) {
        try {
          winapi.RegSetKeyValue(hive, key, name, value);
        }
        catch (err) {
          (0, vortex_api_1.log)('error', 'failed to set registry key', err);
        }
      }
      function findUMMPath() {
        return __awaiter(this, void 0, void 0, function* () {
          const value = readRegistryKey('HKEY_CURRENT_USER', 'Software\\UnityModManager', 'Path');
          try {
            yield vortex_api_1.fs.statAsync(path_1.default.join(value.toString(), common_1.UMM_EXE));
            return value.toString();
          }
          catch (err) {
            return undefined;
          }
        });
      }
      function install(api, downloadInfo, downloadId, force) {
        return __awaiter(this, void 0, void 0, function* () {
          const state = api.getState();
          if (downloadInfo.allowAutoInstall) {
            const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', downloadInfo.gameId], {});
            const modId = Object.keys(mods).find(id => mods[id].type === 'umm');
            const isInjectorInstalled = (force) ? false : (modId !== undefined);
            if (!isInjectorInstalled) {
              return new Promise((resolve, reject) => {
                api.events.emit('start-install-download', downloadId, true, (err, modId) => {
                  return (err) ? reject(err) : resolve(modId);
                });
              });
            }
            else {
              return Promise.resolve(modId);
            }
          }
          return Promise.reject(new Errors_1.AutoInstallDisabledError(downloadInfo));
        });
      }
      function finalize(api, downloadInfo, dlId, force) {
        return __awaiter(this, void 0, void 0, function* () {
          const state = api.getState();
          try {
            updateSupportedGames(api, downloadInfo);
            const modId = yield install(api, downloadInfo, dlId, force);
            if (modId === undefined) {
              throw new vortex_api_1.util.ProcessCanceled('UMM Installation failed.');
            }
            const staging = vortex_api_1.selectors.installPathForGame(state, downloadInfo.gameId);
            const mod = api.getState().persistent.mods[downloadInfo.gameId][modId];
            const ummPath = path_1.default.join(staging, mod.installationPath, common_1.UMM_EXE);
            setRegistryKey('HKEY_CURRENT_USER', 'Software\\UnityModManager', 'Path', path_1.default.dirname(ummPath));
            setRegistryKey('HKEY_CURRENT_USER', 'Software\\UnityModManager', 'ExePath', ummPath);
            (0, util_1.setUMMPath)(api, path_1.default.dirname(ummPath), downloadInfo.gameId);
            return Promise.resolve(modId);
          }
          catch (err) {
            return Promise.reject(err);
          }
        });
      }
      function download(api, downloadInfo, force) {
        let _a;
        return __awaiter(this, void 0, void 0, function* () {
          const { domainId, modId, fileId, archiveName, allowAutoInstall } = downloadInfo;
          const state = api.getState();
          if (!vortex_api_1.util.getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false)) {
            return Promise.reject(new Errors_1.NotPremiumError());
          }
          const downloadId = genDownloadInfo(api, archiveName).downloadId;
          if (downloadId !== undefined) {
            return finalize(api, downloadInfo, downloadId, force);
          }
          const autoInstallEnabled = (_a = state.settings.automation) === null || _a === void 0 ? void 0 : _a['install'];
          if (autoInstallEnabled) {
            api.store.dispatch(vortex_api_1.actions.setAutoInstall(false));
          }
          return api.emitAndAwait('nexus-download', domainId, modId, fileId, archiveName, allowAutoInstall)
            .then(() => __awaiter(this, void 0, void 0, function* () {
              const dlData = genDownloadInfo(api, downloadInfo.archiveName);
              return finalize(api, downloadInfo, dlData.downloadId, force);
            }))
            .catch((err) => __awaiter(this, void 0, void 0, function* () {
              if (err instanceof Errors_1.AutoInstallDisabledError) {
                return Promise.resolve();
              }
              (0, vortex_api_1.log)('error', 'failed to download from NexusMods.com', {
                dlInfo: JSON.stringify(downloadInfo, undefined, 2),
                error: err,
              });
              try {
                yield downloadFromGithub(api, downloadInfo);
                return Promise.resolve();
              }
              catch (err2) {
                err2['attachLogOnReport'] = true;
                api.showErrorNotification('Failed to download UMM dependency', err2);
              }
            }))
            .finally(() => {
              if (autoInstallEnabled) {
                api.store.dispatch(vortex_api_1.actions.setAutoInstall(true));
              }
            });
        });
      }
      function genDownloadInfo(api, archiveName) {
        const state = api.getState();
        const downloads = vortex_api_1.util.getSafe(state, ['persistent', 'downloads', 'files'], {});
        const downloadId = Object.keys(downloads).find(dId => downloads[dId].localPath.toUpperCase() === archiveName.toUpperCase());
        return { downloads, downloadId, state };
      }
      function updateSupportedGames(api, downloadInfo) {
        const { downloadId, downloads } = genDownloadInfo(api, downloadInfo.archiveName);
        if (downloadId === undefined) {
          throw new vortex_api_1.util.NotFound(`UMM download is missing: ${downloadInfo.archiveName}`);
        }
        const currentlySupported = downloads[downloadId].game;
        const supportedGames = new Set(currentlySupported.concat(Object.keys((0, common_1.getSupportMap)())));
        api.store.dispatch(vortex_api_1.actions.setCompatibleGames(downloadId, Array.from(supportedGames).sort((lhs, rhs) => lhs === 'site' ? -1 : lhs.length - rhs.length)));
      }


/***/ }),

/***/ "./src/util.ts":
/*!*********************!*\
  !*** ./src/util.ts ***!
  \*********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


      const __importDefault = (this && this.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.createUMMTool = exports.setUMMPath = exports.isUMMExecPred = exports.toBlue = void 0;
      const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
      const common_1 = __webpack_require__(/*! ./common */ "./src/common.ts");
      function toBlue(func) {
        return (...args) => bluebird_1.default.resolve(func(...args));
      }
      exports.toBlue = toBlue;
      function isUMMExecPred(filePath) {
        return path_1.default.basename(filePath).toLowerCase() === common_1.UMM_EXE.toLowerCase();
      }
      exports.isUMMExecPred = isUMMExecPred;
      function setUMMPath(api, resolvedPath, gameId) {
        const state = api.store.getState();
        const tools = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', gameId, 'tools'], {});
        const validTools = Object.keys(tools)
          .filter(key => { let _a; return !!((_a = tools[key]) === null || _a === void 0 ? void 0 : _a.path); })
          .map(key => tools[key]);
        const UMM = validTools.find(tool => isUMMExecPred(tool.path));
        const ummId = (((UMM === null || UMM === void 0 ? void 0 : UMM.path) !== undefined) && (path_1.default.dirname(UMM.path) === resolvedPath))
          ? UMM.id : common_1.UMM_ID;
        createUMMTool(api, resolvedPath, ummId, gameId);
      }
      exports.setUMMPath = setUMMPath;
      function createUMMTool(api, ummPath, toolId, gameId) {
        api.store.dispatch(vortex_api_1.actions.addDiscoveredTool(gameId, toolId, {
          id: toolId,
          name: 'Unity Mod Manager',
          logo: 'umm.png',
          executable: () => common_1.UMM_EXE,
          requiredFiles: [common_1.UMM_EXE],
          path: path_1.default.join(ummPath, common_1.UMM_EXE),
          hidden: false,
          custom: false,
          defaultPrimary: true,
          workingDirectory: ummPath,
        }, true));
      }
      exports.createUMMTool = createUMMTool;


/***/ }),

/***/ "./src/validationCode/validation.ts":
/*!******************************************!*\
  !*** ./src/validationCode/validation.ts ***!
  \******************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


      const __importDefault = (this && this.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.validateIUMMGameConfig = void 0;
      const types_validate_1 = __importDefault(__webpack_require__(/*! ./types.validate */ "./src/validationCode/types.validate.js"));
      function validateIUMMGameConfig(data) {
        const res = (0, types_validate_1.default)(data);
        return (res === false) ? types_validate_1.default.prototype.constructor.errors : [];
      }
      exports.validateIUMMGameConfig = validateIUMMGameConfig;


/***/ }),

/***/ "./src/views/AttribDashlet.tsx":
/*!*************************************!*\
  !*** ./src/views/AttribDashlet.tsx ***!
  \*************************************/
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
      const React = __importStar(__webpack_require__(/*! react */ "react"));
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const DOWNLOAD_PAGE = 'https://github.com/newman55/unity-mod-manager';
      class UMMAttribDashlet extends vortex_api_1.PureComponentEx {
        constructor() {
          super(...arguments);
          this.openPage = () => {
            vortex_api_1.util.opn(DOWNLOAD_PAGE).catch(err => null);
          };
        }
        render() {
          const { t } = this.props;
          return (React.createElement(vortex_api_1.Dashlet, { title: t('Support for this game is made possible using the Unity Mod Manager tool (UMM)'), className: 'dashlet-umm' },
                                      React.createElement("div", null, t('Special thanks to {{author}} and all other UMM contributors for developing this tool', { replace: { author: 'newman55', nl: '\n' } })),
                                      React.createElement("div", null,
                                                          t('UMM lives here: '),
                                                          React.createElement("a", { onClick: this.openPage }, DOWNLOAD_PAGE))));
        }
      }
      exports["default"] = (0, react_i18next_1.withTranslation)(['common', 'umm-modtype'])(UMMAttribDashlet);


/***/ }),

/***/ "./src/validationCode/types.validate.js":
/*!**********************************************!*\
  !*** ./src/validationCode/types.validate.js ***!
  \**********************************************/
/***/ ((module) => {

      module.exports = validate10;module.exports["default"] = validate10;const schema11 = {"$schema":"http://json-schema.org/draft-07/schema#","anyOf":[{"$ref":"#/definitions/IUMMGameConfig"}],"definitions":{"IUMMGameConfig":{"type":"object","properties":{"gameId":{"type":"string"},"autoDownloadUMM":{"type":"boolean"},"ummVersion":{"type":"string"}},"required":["gameId","autoDownloadUMM"]}},"exported":["IUMMGameConfig"]};const schema12 = {"type":"object","properties":{"gameId":{"type":"string"},"autoDownloadUMM":{"type":"boolean"},"ummVersion":{"type":"string"}},"required":["gameId","autoDownloadUMM"]};function validate10(data, {instancePath="", parentData, parentDataProperty, rootData=data}={}){let vErrors = null;let errors = 0;const _errs0 = errors;let valid0 = false;const _errs1 = errors;if(data && typeof data == "object" && !Array.isArray(data)){if(data.gameId === undefined){const err0 = {instancePath,schemaPath:"#/definitions/IUMMGameConfig/required",keyword:"required",params:{missingProperty: "gameId"},message:"must have required property '"+"gameId"+"'",schema:schema12.required,parentSchema:schema12,data};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}if(data.autoDownloadUMM === undefined){const err1 = {instancePath,schemaPath:"#/definitions/IUMMGameConfig/required",keyword:"required",params:{missingProperty: "autoDownloadUMM"},message:"must have required property '"+"autoDownloadUMM"+"'",schema:schema12.required,parentSchema:schema12,data};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}if(data.gameId !== undefined){const data0 = data.gameId;if(typeof data0 !== "string"){const err2 = {instancePath:instancePath+"/gameId",schemaPath:"#/definitions/IUMMGameConfig/properties/gameId/type",keyword:"type",params:{type: "string"},message:"must be string",schema:schema12.properties.gameId.type,parentSchema:schema12.properties.gameId,data:data0};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}}if(data.autoDownloadUMM !== undefined){const data1 = data.autoDownloadUMM;if(typeof data1 !== "boolean"){const err3 = {instancePath:instancePath+"/autoDownloadUMM",schemaPath:"#/definitions/IUMMGameConfig/properties/autoDownloadUMM/type",keyword:"type",params:{type: "boolean"},message:"must be boolean",schema:schema12.properties.autoDownloadUMM.type,parentSchema:schema12.properties.autoDownloadUMM,data:data1};if(vErrors === null){vErrors = [err3];}else {vErrors.push(err3);}errors++;}}if(data.ummVersion !== undefined){const data2 = data.ummVersion;if(typeof data2 !== "string"){const err4 = {instancePath:instancePath+"/ummVersion",schemaPath:"#/definitions/IUMMGameConfig/properties/ummVersion/type",keyword:"type",params:{type: "string"},message:"must be string",schema:schema12.properties.ummVersion.type,parentSchema:schema12.properties.ummVersion,data:data2};if(vErrors === null){vErrors = [err4];}else {vErrors.push(err4);}errors++;}}}else {const err5 = {instancePath,schemaPath:"#/definitions/IUMMGameConfig/type",keyword:"type",params:{type: "object"},message:"must be object",schema:schema12.type,parentSchema:schema12,data};if(vErrors === null){vErrors = [err5];}else {vErrors.push(err5);}errors++;}const _valid0 = _errs1 === errors;valid0 = valid0 || _valid0;if(!valid0){const err6 = {instancePath,schemaPath:"#/anyOf",keyword:"anyOf",params:{},message:"must match a schema in anyOf",schema:schema11.anyOf,parentSchema:schema11,data};if(vErrors === null){vErrors = [err6];}else {vErrors.push(err6);}errors++;}else {errors = _errs0;if(vErrors !== null){if(_errs0){vErrors.length = _errs0;}else {vErrors = null;}}}validate10.errors = vErrors;return errors === 0;}

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

/***/ "react-i18next":
/*!********************************!*\
  !*** external "react-i18next" ***!
  \********************************/
/***/ ((module) => {

      module.exports = require("react-i18next");

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

/***/ }),

/***/ "winapi-bindings":
/*!**********************************!*\
  !*** external "winapi-bindings" ***!
  \**********************************/
/***/ ((module) => {

      module.exports = require("winapi-bindings");

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
//# sourceMappingURL=bundledPlugins/modtype-umm/modtype-umm.js.map