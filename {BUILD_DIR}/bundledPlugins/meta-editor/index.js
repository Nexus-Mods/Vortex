/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	const __webpack_modules__ = ({

/***/ "./src/actions.ts":
/*!************************!*\
  !*** ./src/actions.ts ***!
  \************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.setShowMetaEditor = void 0;
      const redux_act_1 = __webpack_require__(/*! redux-act */ "redux-act");
      exports.setShowMetaEditor = (0, redux_act_1.createAction)('SET_SHOW_METAEDITOR');


/***/ }),

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


      const __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const MetaEditorDialog_1 = __webpack_require__(/*! ./views/MetaEditorDialog */ "./src/views/MetaEditorDialog.tsx");
      const actions_1 = __webpack_require__(/*! ./actions */ "./src/actions.ts");
      const reducers_1 = __webpack_require__(/*! ./reducers */ "./src/reducers.ts");
      const path = __webpack_require__(/*! path */ "path");
      const semver = __webpack_require__(/*! semver */ "semver");
      const url = __webpack_require__(/*! url */ "url");
      const util_1 = __webpack_require__(/*! util */ "util");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      function getEmptyData(filePath, fileInfo) {
        const fileName = filePath !== undefined
          ? path.basename(filePath, path.extname(filePath))
          : '';
        return {
          fileName,
          fileSizeBytes: fileInfo !== undefined ? fileInfo.size : 0,
          gameId: fileInfo.game,
          fileVersion: '',
          fileMD5: fileInfo !== undefined ? fileInfo.fileMD5 : '',
          sourceURI: '',
          rules: [],
          details: {},
        };
      }
      function retrieveInfoImpl(api, downloadId) {
        return __awaiter(this, void 0, void 0, function* () {
          if (downloadId === undefined) {
            return undefined;
          }
          const state = api.getState();
          const downloads = state.persistent.downloads.files;
          const downloadPath = vortex_api_1.selectors.downloadPath(state);
          if (downloads[downloadId].localPath === undefined) {
            return undefined;
          }
          const filePath = path.join(downloadPath, downloads[downloadId].localPath);
          api.sendNotification({
            id: 'meta-lookup',
            type: 'activity',
            message: 'Mod lookup...',
          });
          try {
            const info = yield api.lookupModMeta({
              filePath,
              fileMD5: downloads[downloadId].fileMD5,
              fileSize: downloads[downloadId].size,
              gameId: downloads[downloadId].game[0],
            });
            api.dismissNotification('meta-lookup');
            if (info.length > 0) {
              return Object.assign({ fileName: filePath, fileMD5: downloads[downloadId].fileMD5, fileSizeBytes: downloads[downloadId].size, gameId: downloads[downloadId].game }, info[0].value);
            }
          }
          catch (err) {
            (0, vortex_api_1.log)('info', 'Failed to look up mod meta information', { err: (0, util_1.inspect)(err) });
            api.dismissNotification('meta-lookup');
          }
          return getEmptyData(filePath, downloads[downloadId]);
        });
      }
      function validateVersion(version) {
        return semver.valid(version) === null ? 'error' : 'success';
      }
      function validateURI(uri) {
        return url.parse(uri).host === null ? 'error' : 'success';
      }
      function main(context) {
        context.registerReducer(['session', 'metaEditor'], reducers_1.default);
        const retrieveInfo = (visibleId) => retrieveInfoImpl(context.api, visibleId);
        context.registerDialog('meta-editor-dialog', MetaEditorDialog_1.default, () => ({
          retrieveInfo,
          validateVersion,
          validateURI,
        }));
        context.registerAction('downloads-action-icons', 100, 'edit', {}, 'View Meta Data', (instanceIds) => {
          context.api.store.dispatch((0, actions_1.setShowMetaEditor)(instanceIds[0]));
        }, (instanceIds) => {
          const state = context.api.store.getState();
          return state.persistent.downloads.files[instanceIds[0]].state === 'finished';
        });
        context.once(() => {
          context.api.setStylesheet('meta-editor', path.join(__dirname, 'metaeditor.scss'));
        });
        return true;
      }
      exports["default"] = main;


/***/ }),

/***/ "./src/reducers.ts":
/*!*************************!*\
  !*** ./src/reducers.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const actions = __webpack_require__(/*! ./actions */ "./src/actions.ts");
      const sessionReducer = {
        reducers: {
          [actions.setShowMetaEditor]: (state, payload) => vortex_api_1.util.setSafe(state, ['showDialog'], payload),
        },
        defaults: {
          showDialog: false,
        },
      };
      exports["default"] = sessionReducer;


/***/ }),

/***/ "./src/views/MetaEditorDialog.tsx":
/*!****************************************!*\
  !*** ./src/views/MetaEditorDialog.tsx ***!
  \****************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


      const __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const actions_1 = __webpack_require__(/*! ../actions */ "./src/actions.ts");
      const RuleEditor_1 = __webpack_require__(/*! ./RuleEditor */ "./src/views/RuleEditor.tsx");
      const immutability_helper_1 = __webpack_require__(/*! immutability-helper */ "immutability-helper");
      const React = __webpack_require__(/*! react */ "react");
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      class MetaEditorDialog extends vortex_api_1.ComponentEx {
        constructor(props) {
          super(props);
          this.renderRule = (rule, index) => {
            const { t } = this.props;
            return (React.createElement(react_bootstrap_1.ListGroupItem, { key: `rule-${index}` },
                                        rule.type,
                                        " - ",
                                        this.renderReference(rule.reference),
                                        React.createElement("div", { className: 'rule-actions pull-right' },
                                                            React.createElement(vortex_api_1.tooltip.Button, { id: `rule-${index}`, tooltip: t('Remove'), onClick: this.removeRule },
                                                                                React.createElement(vortex_api_1.Icon, { name: 'remove' })))));
          };
          this.renderReference = (reference) => {
            if (reference.fileMD5 !== undefined) {
              return reference.fileMD5;
            }
            else {
              return `${reference.logicalFileName} - ${reference.versionMatch}`;
            }
          };
          this.removeRule = (evt) => {
            const idSegmented = evt.currentTarget.id.split('-');
            const idx = idSegmented[idSegmented.length - 1];
            this.setState((0, immutability_helper_1.default)(this.state, { info: {
              rules: { $splice: [[idx, 1]] },
            } }));
          };
          this.addRule = (type, reference) => {
            const rule = { type, reference };
            this.setState(vortex_api_1.util.pushSafe(this.state, ['info', 'rules'], rule), () => {
              this.hideRuleEditor();
            });
          };
          this.save = () => {
            this.context.api.saveModMeta(this.state.info);
            this.close();
          };
          this.cancel = () => {
            this.close();
          };
          this.showRuleEditor = () => {
            this.setState((0, immutability_helper_1.default)(this.state, {
              showRuleEditor: { $set: true },
            }));
          };
          this.hideRuleEditor = () => {
            this.setState((0, immutability_helper_1.default)(this.state, {
              showRuleEditor: { $set: false },
            }));
          };
          this.changeLogicalFileName = (event) => {
            this.setField('logicalFileName', event.target.value);
          };
          this.changeFileVersion = (event) => {
            this.setField('fileVersion', event.target.value);
          };
          this.changeSourceURI = (event) => {
            this.setField('sourceURI', event.target.value);
          };
          this.close = () => {
            this.props.onHide();
          };
          this.initState({
            info: undefined,
            showRuleEditor: false,
          });
        }
        componentDidUpdate(prevProps) {
          if (this.props.visibleId !== prevProps.visibleId) {
            this.triggerInfoUpdate(this.props.visibleId);
          }
        }
        triggerInfoUpdate(visibleId) {
          return __awaiter(this, void 0, void 0, function* () {
            try {
              this.nextState.info = yield this.props.retrieveInfo(visibleId);
            }
            catch (err) {
              this.props.onShowError('failed to fetch mod info', err);
            }
          });
        }
        render() {
          const { t, validateURI, validateVersion } = this.props;
          const { info, showRuleEditor } = this.state;
          if (info === undefined) {
            return null;
          }
          const fvState = validateVersion(info.fileVersion);
          const urlState = validateURI(info.sourceURI);
          return (React.createElement(react_bootstrap_1.Modal, { show: info !== undefined, onHide: this.close },
                                      React.createElement(react_bootstrap_1.Modal.Header, null,
                                                          React.createElement(react_bootstrap_1.Modal.Title, null, info.logicalFileName)),
                                      React.createElement(react_bootstrap_1.Modal.Body, null,
                                                          React.createElement("form", null,
                                                                              React.createElement(react_bootstrap_1.FormGroup, null,
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null, t('File Name')),
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { type: 'text', value: info.logicalFileName, onChange: this.changeLogicalFileName })),
                                                                              React.createElement(react_bootstrap_1.FormGroup, { validationState: fvState },
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null, t('File Version')),
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { type: 'text', value: info.fileVersion, onChange: this.changeFileVersion }),
                                                                                                  React.createElement(vortex_api_1.FormFeedback, null)),
                                                                              React.createElement(react_bootstrap_1.FormGroup, { validationState: urlState },
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null, t('Source URL')),
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { type: 'text', value: info.sourceURI, onChange: this.changeSourceURI }),
                                                                                                  React.createElement(vortex_api_1.FormFeedback, null)),
                                                                              React.createElement(react_bootstrap_1.FormGroup, null,
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null,
                                                                                                                      t('Rules'),
                                                                                                                      ' ',
                                                                                                                      React.createElement(vortex_api_1.tooltip.Button, { className: 'btn-embed', tooltip: t('Add'), id: 'add-rule', onClick: this.showRuleEditor },
                                                                                                                                          React.createElement(vortex_api_1.Icon, { name: 'add' }))),
                                                                                                  React.createElement(react_bootstrap_1.ListGroup, null, info.rules !== undefined ? info.rules.map(this.renderRule) : null))),
                                                          React.createElement(RuleEditor_1.default, { fileName: info.logicalFileName, show: showRuleEditor, onHide: this.hideRuleEditor, onConfirm: this.addRule })),
                                      React.createElement(react_bootstrap_1.Modal.Footer, null,
                                                          React.createElement(vortex_api_1.tooltip.Button, { id: 'cancel-meta-btn', tooltip: t('Cancel'), onClick: this.cancel }, t('Cancel')),
                                                          React.createElement(vortex_api_1.tooltip.Button, { id: 'save-meta-btn', tooltip: t('Save in local DB'), onClick: this.save }, t('Save')))));
        }
        setField(key, value) {
          this.setState((0, immutability_helper_1.default)(this.state, { info: {
            [key]: { $set: value },
          } }));
        }
      }
      function mapStateToProps(state) {
        return {
          downloads: state.persistent.downloads.files,
          visibleId: state.session.metaEditor.showDialog,
          downloadPath: vortex_api_1.selectors.downloadPath(state),
        };
      }
      function mapDispatchToProps(dispatch) {
        return {
          onHide: () => dispatch((0, actions_1.setShowMetaEditor)(undefined)),
          onShowError: (title, details, options) => vortex_api_1.util.showError(dispatch, title, details, options),
        };
      }
      exports["default"] = (0, react_i18next_1.withTranslation)(['common'])((0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)(MetaEditorDialog));


/***/ }),

/***/ "./src/views/RuleEditor.tsx":
/*!**********************************!*\
  !*** ./src/views/RuleEditor.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


      Object.defineProperty(exports, "__esModule", ({ value: true }));
      const immutability_helper_1 = __webpack_require__(/*! immutability-helper */ "immutability-helper");
      const React = __webpack_require__(/*! react */ "react");
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const MD5Expression = /[a-f0-9]{32}/;
      class RuleEditor extends vortex_api_1.ComponentEx {
        constructor(props) {
          super(props);
          this.renderMetaForm = () => {
            const { t } = this.props;
            const { modId, logicalFileName, versionMatch } = this.state;
            return (React.createElement("form", null,
                                        React.createElement(react_bootstrap_1.FormGroup, null,
                                                            React.createElement(react_bootstrap_1.ControlLabel, null, t('Mod ID')),
                                                            React.createElement(react_bootstrap_1.FormControl, { type: 'text', value: modId, onChange: this.setModId })),
                                        React.createElement(react_bootstrap_1.FormGroup, null,
                                                            React.createElement(react_bootstrap_1.ControlLabel, null, t('Logical File Name')),
                                                            React.createElement(react_bootstrap_1.FormControl, { type: 'text', value: logicalFileName, onChange: this.setFileName })),
                                        React.createElement(react_bootstrap_1.FormGroup, null,
                                                            React.createElement(react_bootstrap_1.ControlLabel, null, t('Version Match')),
                                                            React.createElement(react_bootstrap_1.FormControl, { type: 'text', value: versionMatch, onChange: this.setVersionMatch }))));
          };
          this.renderMD5Form = () => {
            const { t } = this.props;
            const { md5 } = this.state;
            const md5state = md5 === '' ? undefined
              : md5 === '...' ? 'pending'
              : md5.match(MD5Expression) ? 'success' : 'error';
            return (React.createElement("form", null,
                                        React.createElement(react_bootstrap_1.FormGroup, { validationState: md5state },
                                                            React.createElement(react_bootstrap_1.ControlLabel, null, t('File Hash')),
                                                            React.createElement(react_bootstrap_1.FormControl, { type: 'text', value: md5, onChange: this.setMD5 }),
                                                            React.createElement(vortex_api_1.FormFeedback, null))));
          };
          this.nop = () => undefined;
          this.setMD5 = (evt) => {
            this.setField('md5', evt.target.value);
          };
          this.setModId = (evt) => {
            this.setField('modId', evt.target.value);
          };
          this.setFileName = (evt) => {
            this.setField('logicalFileName', evt.target.value);
          };
          this.setVersionMatch = (evt) => {
            this.setField('versionMatch', evt.target.value);
          };
          this.setRefType = (e) => {
            this.setState((0, immutability_helper_1.default)(this.state, {
              refType: { $set: e },
            }));
          };
          this.setRuleType = (evt) => {
            this.setState((0, immutability_helper_1.default)(this.state, {
              ruleType: { $set: evt.target.value },
            }));
          };
          this.browseForArchive = () => {
            let filePath;
            this.context.api.selectFile({})
              .then((selectedFile) => {
                filePath = selectedFile;
                return this.context.api.lookupModMeta({ filePath })
                  .catch(() => []);
              })
              .then((result) => {
                this.setState((0, immutability_helper_1.default)(this.state, { md5: { $set: '...' } }));
                const { genHash } = __webpack_require__(/*! modmeta-db */ "modmeta-db");
                return genHash(filePath)
                  .catch(err => undefined);
              })
              .then((hash) => {
                if (hash !== undefined) {
                  this.setState((0, immutability_helper_1.default)(this.state, {
                    refType: { $set: 'md5' },
                    md5: { $set: hash.md5sum },
                  }));
                }
              });
          };
          this.hide = () => {
            this.clear();
            this.props.onHide();
          };
          this.confirm = () => {
            const { onConfirm } = this.props;
            const { ruleType } = this.state;
            this.clear();
            if (this.state.refType === 'meta') {
              onConfirm(ruleType, {
                logicalFileName: this.state.logicalFileName,
                versionMatch: this.state.versionMatch,
              });
            }
            else {
              onConfirm(ruleType, {
                fileMD5: this.state.md5,
              });
            }
          };
          this.state = {
            md5: '',
            modId: '',
            logicalFileName: '',
            versionMatch: '',
            refType: 'meta',
            ruleType: 'requires',
          };
        }
        render() {
          const { t, fileName, show } = this.props;
          const { refType, ruleType } = this.state;
          return (React.createElement(react_bootstrap_1.Modal, { show: show, onHide: this.nop },
                                      React.createElement(react_bootstrap_1.Modal.Header, null,
                                                          React.createElement(react_bootstrap_1.Modal.Title, null, fileName)),
                                      React.createElement(react_bootstrap_1.Modal.Body, null,
                                                          React.createElement("form", null,
                                                                              React.createElement(react_bootstrap_1.FormGroup, null,
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null, t('Rule Type')),
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { componentClass: 'select', value: ruleType, onChange: this.setRuleType },
                                                                                                                      React.createElement("option", { value: 'before' }, t('Always load before')),
                                                                                                                      React.createElement("option", { value: 'after' }, t('Always load after')),
                                                                                                                      React.createElement("option", { value: 'requires' }, t('Requires')),
                                                                                                                      React.createElement("option", { value: 'conflicts' }, t('Conflicts')),
                                                                                                                      React.createElement("option", { value: 'recommends' }, t('Recommends')),
                                                                                                                      React.createElement("option", { value: 'provides' }, t('Provides the same as'))))),
                                                          React.createElement(react_bootstrap_1.Nav, { bsStyle: 'pills', activeKey: refType, onSelect: this.setRefType },
                                                                              React.createElement(react_bootstrap_1.NavItem, { eventKey: 'meta' }, "Meta"),
                                                                              React.createElement(react_bootstrap_1.NavItem, { eventKey: 'md5' }, "MD5")),
                                                          this.state.refType === 'meta' ? this.renderMetaForm() : null,
                                                          this.state.refType === 'md5' ? this.renderMD5Form() : null,
                                                          React.createElement(react_bootstrap_1.Button, { onClick: this.browseForArchive }, t('Browse'))),
                                      React.createElement(react_bootstrap_1.Modal.Footer, null,
                                                          React.createElement(react_bootstrap_1.Button, { onClick: this.hide }, t('Cancel')),
                                                          React.createElement(react_bootstrap_1.Button, { onClick: this.confirm }, t('Save')))));
        }
        setField(key, value) {
          this.setState((0, immutability_helper_1.default)(this.state, {
            [key]: { $set: value },
          }));
        }
        clear() {
          this.setState((0, immutability_helper_1.default)(this.state, {
            md5: { $set: '' },
            modId: { $set: '' },
            logicalFileName: { $set: '' },
            versionMatch: { $set: '' },
          }));
        }
      }
      exports["default"] = (0, react_i18next_1.withTranslation)(['common', 'meta-editor'])(RuleEditor);


/***/ }),

/***/ "immutability-helper":
/*!**************************************!*\
  !*** external "immutability-helper" ***!
  \**************************************/
/***/ ((module) => {

      module.exports = require("immutability-helper");

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

/***/ "semver":
/*!*************************!*\
  !*** external "semver" ***!
  \*************************/
/***/ ((module) => {

      module.exports = require("semver");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

      module.exports = require("url");

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
//# sourceMappingURL=bundledPlugins/meta-editor/meta-editor.js.map