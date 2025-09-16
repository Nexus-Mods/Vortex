/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	const __webpack_modules__ = ({

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
      const LoadOrder_1 = __importDefault(__webpack_require__(/*! ./views/LoadOrder */ "./src/views/LoadOrder.tsx"));
      const sync_1 = __webpack_require__(/*! ./sync */ "./src/sync.ts");
      const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
      const path = __importStar(__webpack_require__(/*! path */ "path"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const poe2LocalLowPath = path.resolve(vortex_api_1.util.getVortexPath('appData'), '..', 'LocalLow', 'Obsidian Entertainment', 'Pillars of Eternity II');
      const tools = [];
      const MODIFIABLE_WIN_APPS = 'modifiablewindowsapps';
      const MS_ID = 'VersusEvil.PillarsofEternity2-PC';
      const STEAM_ID = '560130';
      function genAttributeExtractor(api) {
        return (modInfo, modPath) => {
          const gameMode = vortex_api_1.selectors.activeGameId(api.store.getState());
          if ((modPath === undefined) || (gameMode !== 'pillarsofeternity2')) {
            return bluebird_1.default.resolve({});
          }
          return vortex_api_1.fs.readFileAsync(path.join(modPath, 'manifest.json'), { encoding: 'utf-8' })
            .catch(() => '{}')
            .then(jsonData => {
              try {
                const data = JSON.parse(vortex_api_1.util.deBOM(jsonData));
                const res = {
                  minGameVersion: vortex_api_1.util.getSafeCI(data, ['SupportedGameVersion', 'min'], '1.0'),
                  maxGameVersion: vortex_api_1.util.getSafeCI(data, ['SupportedGameVersion', 'max'], '9.0'),
                };
                return res;
              }
              catch (err) {
                (0, vortex_api_1.log)('warn', 'Invalid manifest.json', { modPath });
                return {};
              }
            });
        };
      }
      function findGame() {
        return vortex_api_1.util.GameStoreHelper.findByAppId([STEAM_ID, MS_ID])
          .catch(err => vortex_api_1.util.steam.findByName('Pillars of Eternity II: Deadfire'))
          .then(game => game.gamePath);
      }
      function modPath(discoveryPath) {
        return (discoveryPath.includes('ModifiableWindowsApps'))
          ? path.join('PillarsOfEternity2_Data', 'override')
          : path.join('PillarsOfEternityII_Data', 'override');
      }
      function modConfig() {
        return path.join(poe2LocalLowPath, 'modconfig.json');
      }
      function prepareForModding(discovery) {
        return createModConfigFile().then(() => vortex_api_1.fs.ensureDirWritableAsync(path.join(discovery.path, modPath(discovery.path))));
      }
      function createModConfigFile() {
        return vortex_api_1.fs.statAsync(modConfig())
          .then(st => bluebird_1.default.resolve())
          .catch(err => {
            if (err.code === 'ENOENT') {
              return writeModConfigFile();
            }
            else {
              return bluebird_1.default.reject(err);
            }
          });
      }
      function executable(discoveryPath) {
        if (discoveryPath === undefined) {
          return 'PillarsOfEternityII.exe';
        }
        else {
          return (discoveryPath.toLowerCase().includes(MODIFIABLE_WIN_APPS))
            ? 'PillarsOfEternity2.exe'
            : 'PillarsOfEternityII.exe';
        }
      }
      function writeModConfigFile() {
        const data = {
          Entries: [],
        };
        return vortex_api_1.fs.ensureFileAsync(modConfig())
          .then(() => vortex_api_1.fs.writeFileAsync(modConfig(), JSON.stringify(data, undefined, 2), { encoding: 'utf-8' }));
      }
      function requiresLauncher(gamePath) {
        return (gamePath.toLowerCase().includes(MODIFIABLE_WIN_APPS))
          ? bluebird_1.default.resolve({
            launcher: 'xbox',
            addInfo: {
              appId: MS_ID,
              parameters: [
                { appExecName: 'App' },
              ],
            }
          })
          : bluebird_1.default.resolve(undefined);
      }
      const emptyObj = {};
      function init(context) {
        context.registerGame({
          id: 'pillarsofeternity2',
          name: 'Pillars Of Eternity II:\tDeadfire',
          mergeMods: false,
          queryPath: findGame,
          queryModPath: (discoveryPath) => modPath(discoveryPath),
          logo: 'gameart.png',
          executable,
          requiresLauncher,
          requiredFiles: [],
          supportedTools: tools,
          setup: prepareForModding,
          environment: {
            SteamAPPId: STEAM_ID,
          },
          details: {
            steamAppId: +STEAM_ID,
          },
        });
        context.registerMainPage('sort-none', 'Load Order', LoadOrder_1.default, {
          id: 'pillars2-loadorder',
          hotkey: 'E',
          group: 'per-game',
          visible: () => vortex_api_1.selectors.activeGameId(context.api.store.getState()) === 'pillarsofeternity2',
          props: () => {
            const state = context.api.store.getState();
            return {
              mods: state.persistent.mods['pillarsofeternity2'] || emptyObj,
              profile: vortex_api_1.selectors.activeProfile(state),
              loadOrder: (0, sync_1.getLoadOrder)(),
              onSetLoadOrder: (order) => {
                (0, sync_1.setLoadOrder)(order);
              },
            };
          },
        });
        context.registerAttributeExtractor(100, genAttributeExtractor(context.api));
        context.once(() => {
          context.api.events.on('gamemode-activated', (gameMode) => {
            if (gameMode === 'pillarsofeternity2') {
              (0, sync_1.startWatch)(context.api.store.getState())
                .catch(vortex_api_1.util.DataInvalid, err => {
                  const errorMessage = 'Your mod configuration file is invalid, you must remove/fix '
                        + 'this file for the mods to function correctly. The file is '
                        + 'located in: '
                        + '"C:\\Users\\{YOUR_USERNAME}\\AppData\\LocalLow\\Obsidian Entertainment\\Pillars of Eternity II\\modconfig.json"';
                  context.api.showErrorNotification('Invalid modconfig.json file', errorMessage, { allowReport: false });
                })
                .catch(err => {
                  context.api.showErrorNotification('Failed to update modorder', err);
                });
            }
            else {
              (0, sync_1.stopWatch)();
            }
          });
          context.api.setStylesheet('game-pillarsofeternity2', path.join(__dirname, 'stylesheet.scss'));
        });
        return true;
      }
      exports["default"] = init;


/***/ }),

/***/ "./src/sync.ts":
/*!*********************!*\
  !*** ./src/sync.ts ***!
  \*********************/
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
      exports.stopWatch = exports.startWatch = exports.setLoadOrder = exports.getLoadOrder = void 0;
      const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
      const path = __importStar(__webpack_require__(/*! path */ "path"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const poe2Path = path.resolve(vortex_api_1.util.getVortexPath('appData'), '..', 'LocalLow', 'Obsidian Entertainment', 'Pillars of Eternity II');
      let watcher;
      let loadOrder = vortex_api_1.util.makeReactive({});
      function modConfig() {
        return path.join(poe2Path, 'modconfig.json');
      }
      function updateLoadOrder(tries = 3) {
        return vortex_api_1.fs.readFileAsync(modConfig(), { encoding: 'utf-8' })
          .catch(() => '{}')
          .then(jsonData => {
            try {
              const data = JSON.parse(vortex_api_1.util.deBOM(jsonData));
              loadOrder = (data.Entries || []).reduce((prev, entry, idx) => {
                prev[entry.FolderName] = {
                  pos: idx,
                  enabled: entry.Enabled,
                };
                return prev;
              }, {});
            }
            catch (err) {
              (0, vortex_api_1.log)('debug', 'update load order', { tries });
              if (tries > 0) {
                return bluebird_1.default.delay(100).then(() => updateLoadOrder(tries - 1));
              }
              else {
                return (err.message.indexOf('Unexpected token') !== -1)
                  ? bluebird_1.default.reject(new vortex_api_1.util.DataInvalid('Invalid config file'))
                  : bluebird_1.default.reject(err);
              }
            }
          });
      }
      function getLoadOrder() {
        return loadOrder;
      }
      exports.getLoadOrder = getLoadOrder;
      function setLoadOrder(order) {
        loadOrder = order;
        vortex_api_1.fs.readFileAsync(modConfig(), { encoding: 'utf-8' })
          .catch(() => '{}')
          .then(jsonData => {
            const data = JSON.parse(vortex_api_1.util.deBOM(jsonData));
            data.Entries = Object.keys(loadOrder)
              .sort((lhs, rhs) => loadOrder[lhs].pos - loadOrder[rhs].pos)
              .reduce((prev, key) => {
                prev.push({ FolderName: key, Enabled: loadOrder[key].enabled });
                return prev;
              }, []);
            return vortex_api_1.fs.writeFileAsync(modConfig(), JSON.stringify(data, undefined, 2), { encoding: 'utf-8' });
          });
      }
      exports.setLoadOrder = setLoadOrder;
      function startWatch(state) {
        const discovery = state.settings.gameMode.discovered['pillarsofeternity2'];
        if (discovery === undefined) {
          return bluebird_1.default.reject(new Error('Pillars of Eternity 2 wasn\'t discovered'));
        }
        const loDebouncer = new vortex_api_1.util.Debouncer(() => {
          return updateLoadOrder();
        }, 200);
        watcher = vortex_api_1.fs.watch(modConfig(), {}, () => {
          loDebouncer.schedule();
        });
        watcher.on('error', err => {
          (0, vortex_api_1.log)('error', 'failed to watch poe2 mod directory for changes', { message: err.message });
        });
        return updateLoadOrder();
      }
      exports.startWatch = startWatch;
      function stopWatch() {
        if (watcher !== undefined) {
          watcher.close();
          watcher = undefined;
        }
      }
      exports.stopWatch = stopWatch;


/***/ }),

/***/ "./src/views/DraggableList.tsx":
/*!*************************************!*\
  !*** ./src/views/DraggableList.tsx ***!
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
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      const react_dnd_1 = __webpack_require__(/*! react-dnd */ "react-dnd");
      const ReactDOM = __importStar(__webpack_require__(/*! react-dom */ "react-dom"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      class DraggableItem extends React.Component {
        constructor() {
          super(...arguments);
          this.setRef = ref => {
            const { connectDragSource, connectDropTarget } = this.props;
            const node = ReactDOM.findDOMNode(ref);
            connectDragSource(node);
            connectDropTarget(node);
          };
        }
        render() {
          const { isDragging, item } = this.props;
          return (React.createElement(this.props.itemRenderer, { className: isDragging ? 'dragging' : undefined, item: item, ref: this.setRef }));
        }
      }
      const DND_TYPE = 'poe2-plugin-entry';
      function collectDrag(connect, monitor) {
        return {
          connectDragSource: connect.dragSource(),
          isDragging: monitor.isDragging(),
        };
      }
      function collectDrop(connect, monitor) {
        return {
          connectDropTarget: connect.dropTarget(),
        };
      }
      const entrySource = {
        beginDrag(props) {
          return {
            index: props.index,
            item: props.item,
            containerId: props.containerId,
            take: (list) => props.take(props.item, list),
          };
        },
        endDrag(props, monitor) {
          props.apply();
        },
      };
      const entryTarget = {
        hover(props, monitor, component) {
          const { containerId, index, item, take } = monitor.getItem();
          const hoverIndex = props.index;
          if (index === hoverIndex) {
            return;
          }
          const hoverBoundingRect = ReactDOM.findDOMNode(component).getBoundingClientRect();
          const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
          const clientOffset = monitor.getClientOffset();
          const hoverClientY = clientOffset.y - hoverBoundingRect.top;
          if (((index < hoverIndex) && (hoverClientY < hoverMiddleY))
            || ((index > hoverIndex) && (hoverClientY > hoverMiddleY))) {
            return;
          }
          props.onChangeIndex(index, hoverIndex, containerId !== props.containerId, take);
          monitor.getItem().index = hoverIndex;
          if (containerId !== props.containerId) {
            monitor.getItem().containerId = props.containerId;
            monitor.getItem().take = (list) => props.take(item, list);
          }
        },
        drop(props) {
          props.apply();
        },
      };
      const Draggable = (0, react_dnd_1.DropTarget)(DND_TYPE, entryTarget, collectDrop)((0, react_dnd_1.DragSource)(DND_TYPE, entrySource, collectDrag)(DraggableItem));
      class DraggableList extends vortex_api_1.ComponentEx {
        constructor(props) {
          super(props);
          this.changeIndex = (oldIndex, newIndex, changeContainer, take) => {
            if (oldIndex === undefined) {
              return;
            }
            const copy = this.state.ordered.slice();
            const item = take(changeContainer ? undefined : copy);
            copy.splice(newIndex, 0, item);
            this.nextState.ordered = copy;
          };
          this.take = (item, list) => {
            const { ordered } = this.nextState;
            let res = item;
            const index = ordered.findIndex(iter => iter.id === item.id);
            if (index !== -1) {
              if (list !== undefined) {
                res = list.splice(index, 1)[0];
              }
              else {
                const copy = ordered.slice();
                res = copy.splice(index, 1)[0];
                this.nextState.ordered = copy;
              }
            }
            return res;
          };
          this.apply = () => {
            this.props.apply(this.state.ordered);
          };
          this.initState({
            ordered: props.items.slice(0),
          });
          this.applyDebouncer = new vortex_api_1.util.Debouncer(() => {
            this.apply();
            return null;
          }, 500);
        }
        UNSAFE_componentWillReceiveProps(newProps) {
          if (this.props.items !== newProps.items) {
            this.nextState.ordered = newProps.items.slice(0);
          }
        }
        render() {
          const { connectDropTarget, id, itemRenderer } = this.props;
          const { ordered } = this.state;
          return connectDropTarget((React.createElement("div", { style: { overflow: 'auto', maxHeight: '100%' } },
                                                        React.createElement(react_bootstrap_1.ListGroup, null, ordered.map((item, idx) => (React.createElement(Draggable, { containerId: id, key: item.id, item: item, index: idx, itemRenderer: itemRenderer, take: this.take, onChangeIndex: this.changeIndex, apply: this.apply })))))));
        }
      }
      const containerTarget = {
        hover(props, monitor, component) {
          const { containerId, index, item, take } = monitor.getItem();
          if (containerId !== props.id) {
            component.changeIndex(index, 0, true, take);
            monitor.getItem().index = 0;
            monitor.getItem().containerId = props.id;
            monitor.getItem().take = (list) => component.take(item, list);
          }
        },
      };
      function containerCollect(connect, monitor) {
        return {
          connectDropTarget: connect.dropTarget(),
        };
      }
      exports["default"] = (0, react_dnd_1.DropTarget)(DND_TYPE, containerTarget, containerCollect)(DraggableList);


/***/ }),

/***/ "./src/views/LoadOrder.tsx":
/*!*********************************!*\
  !*** ./src/views/LoadOrder.tsx ***!
  \*********************************/
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
      const DraggableList_1 = __importDefault(__webpack_require__(/*! ./DraggableList */ "./src/views/DraggableList.tsx"));
      const LoadOrderEntry_1 = __importDefault(__webpack_require__(/*! ./LoadOrderEntry */ "./src/views/LoadOrderEntry.tsx"));
      const React = __importStar(__webpack_require__(/*! react */ "react"));
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const PanelX = react_bootstrap_1.Panel;
      class LoadOrder extends vortex_api_1.ComponentEx {
        constructor(props) {
          super(props);
          this.applyEnabled = (ordered) => {
            this.nextState.enabled = ordered;
            this.nextState.disabled = this.state.disabled.filter(entry => ordered.find(item => item.id === entry.id) === undefined);
            this.mWriteDebouncer.schedule();
          };
          this.applyDisabled = (ordered) => {
            this.nextState.disabled = ordered;
            this.nextState.enabled = this.state.enabled.filter(entry => ordered.find(item => item.id === entry.id) === undefined);
            this.mWriteDebouncer.schedule();
          };
          this.initState({
            enabled: [],
            disabled: [],
          });
          this.mWriteDebouncer = new vortex_api_1.util.Debouncer(() => {
            const { enabled, disabled } = this.state;
            const newOrder = {};
            const numEnabled = enabled.length;
            enabled.forEach((item, idx) => newOrder[item.id] = { pos: idx, enabled: true });
            disabled.forEach((item, idx) => newOrder[item.id] = { pos: numEnabled + idx, enabled: false });
            this.props.onSetLoadOrder(newOrder);
            return null;
          }, 2000);
        }
        componentDidMount() {
          this.updateState(this.props);
        }
        UNSAFE_componentWillReceiveProps(newProps) {
          if ((this.props.loadOrder !== newProps.loadOrder)
            || (this.props.mods !== newProps.mods)
            || (this.props.profile !== newProps.profile)) {
            this.updateState(newProps);
          }
        }
        render() {
          const { t } = this.props;
          const { enabled, disabled } = this.state;
          return (React.createElement(vortex_api_1.MainPage, null,
                                      React.createElement(vortex_api_1.MainPage.Body, null,
                                                          React.createElement(react_bootstrap_1.Panel, { id: 'pillars2-plugin-panel' },
                                                                              React.createElement(PanelX.Body, null,
                                                                                                  React.createElement(vortex_api_1.DNDContainer, { style: { height: '100%' } },
                                                                                                                      React.createElement(vortex_api_1.FlexLayout, { type: 'row' },
                                                                                                                                          React.createElement(vortex_api_1.FlexLayout.Flex, null,
                                                                                                                                                              React.createElement(vortex_api_1.FlexLayout, { type: 'column' },
                                                                                                                                                                                  React.createElement(vortex_api_1.FlexLayout.Fixed, null,
                                                                                                                                                                                                      React.createElement("h4", null, t('Enabled'))),
                                                                                                                                                                                  React.createElement(vortex_api_1.FlexLayout.Flex, null,
                                                                                                                                                                                                      React.createElement(DraggableList_1.default, { id: 'enabled', items: enabled, itemRenderer: LoadOrderEntry_1.default, apply: this.applyEnabled })))),
                                                                                                                                          React.createElement(vortex_api_1.FlexLayout.Flex, null,
                                                                                                                                                              React.createElement(vortex_api_1.FlexLayout, { type: 'column' },
                                                                                                                                                                                  React.createElement(vortex_api_1.FlexLayout.Fixed, null,
                                                                                                                                                                                                      React.createElement("h4", null, t('Disabled'))),
                                                                                                                                                                                  React.createElement(vortex_api_1.FlexLayout.Flex, null,
                                                                                                                                                                                                      React.createElement(DraggableList_1.default, { id: 'disabled', items: disabled, itemRenderer: LoadOrderEntry_1.default, apply: this.applyDisabled })))))))))));
        }
        updateState(props) {
          const { mods, loadOrder, profile } = props;
          const sorted = Object.keys(loadOrder || {})
            .filter(lo => (mods[lo] !== undefined)
            && vortex_api_1.util.getSafe(profile, ['modState', lo, 'enabled'], false))
            .sort((lhs, rhs) => loadOrder[lhs].pos - loadOrder[rhs].pos);
          const mapToItem = (id) => ({ id, name: vortex_api_1.util.renderModName(mods[id]) });
          this.nextState.enabled = sorted
            .filter(id => loadOrder[id].enabled)
            .map(mapToItem);
          this.nextState.disabled = [].concat(sorted.filter(id => !loadOrder[id].enabled), Object.keys(mods)
            .filter(id => (loadOrder[id] === undefined)
            && vortex_api_1.util.getSafe(profile, ['modState', id, 'enabled'], false))).map(mapToItem);
        }
      }
      exports["default"] = (0, react_i18next_1.withTranslation)(['common', 'game-pillarsofeternity2'])(LoadOrder);


/***/ }),

/***/ "./src/views/LoadOrderEntry.tsx":
/*!**************************************!*\
  !*** ./src/views/LoadOrderEntry.tsx ***!
  \**************************************/
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
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      class PluginEntry extends React.Component {
        render() {
          const { className, item } = this.props;
          let classes = ['plugin-entry'];
          if (className !== undefined) {
            classes = classes.concat(className.split(' '));
          }
          return (React.createElement(react_bootstrap_1.ListGroupItem, { className: classes.join(' ') }, item.name));
        }
      }
      exports["default"] = PluginEntry;


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

/***/ "react-dnd":
/*!****************************!*\
  !*** external "react-dnd" ***!
  \****************************/
/***/ ((module) => {

      module.exports = require("react-dnd");

/***/ }),

/***/ "react-dom":
/*!****************************!*\
  !*** external "react-dom" ***!
  \****************************/
/***/ ((module) => {

      module.exports = require("react-dom");

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
//# sourceMappingURL=game-pillarsofeternity2.js.map