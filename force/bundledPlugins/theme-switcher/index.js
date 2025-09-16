/******/ (() => { // webpackBootstrap
/******/ 	const __webpack_modules__ = ({

/***/ "./build/Release/fontmanager":
/*!********************************!*\
  !*** external "./fontmanager" ***!
  \********************************/
/***/ ((module) => {

      "use strict";
      module.exports = require("./fontmanager");

/***/ }),

/***/ "./node_modules/font-scanner/index.js":
/*!********************************************!*\
  !*** ./node_modules/font-scanner/index.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      let fontManager;
      try {
        fontManager = __webpack_require__(/*! ./build/Release/fontmanager */ "./build/Release/fontmanager");
      } catch (releaseNotFoundError) {
        try {
          fontManager = __webpack_require__(/*! ./build/Debug/fontmanager */ "./build/Release/fontmanager");
        } catch (debugNotFoundError) {
          throw new Error('There is no built binary for font-manager');
        }
      }

      module.exports = {
        findFontSync: (fontDescriptor) => fontManager.findFontSync(fontDescriptor),
        findFont: (fontDescriptor) => fontManager.findFont(fontDescriptor),
        findFontsSync: (fontDescriptor) => fontManager.findFontsSync(fontDescriptor),
        findFonts: (fontDescriptor) => fontManager.findFonts(fontDescriptor),
        getAvailableFontsSync: () => fontManager.getAvailableFontsSync(),
        getAvailableFonts: () => fontManager.getAvailableFonts(),
        substituteFontSync: (postscriptName, text) => fontManager.substituteFontSync(postscriptName, text),
        substituteFont: (postscriptName, text) => fontManager.substituteFont(postscriptName, text)
      };


/***/ }),

/***/ "./src/SettingsTheme.tsx":
/*!*******************************!*\
  !*** ./src/SettingsTheme.tsx ***!
  \*******************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

      "use strict";

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
      const ThemeEditor_1 = __importDefault(__webpack_require__(/*! ./ThemeEditor */ "./src/ThemeEditor.tsx"));
      const React = __importStar(__webpack_require__(/*! react */ "react"));
      const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      class SettingsTheme extends vortex_api_1.ComponentEx {
        constructor(props) {
          super(props);
          this.refresh = () => {
            const { currentTheme } = this.props;
            this.props.onSelectTheme(currentTheme);
          };
          this.saveTheme = (variables) => {
            const { currentTheme, onSaveTheme } = this.props;
            onSaveTheme(currentTheme, variables);
          };
          this.onClone = () => {
            this.cloneTheme(this.props.currentTheme, this.props.themes);
          };
          this.remove = () => {
            const { t, currentTheme, onShowDialog } = this.props;
            (0, vortex_api_1.log)('info', 'removing theme', currentTheme);
            if (!currentTheme || !this.isCustom(currentTheme)) {
              throw new Error('invalid theme');
            }
            onShowDialog('question', t('Confirm removal'), {
              text: t('Are you sure you want to remove the theme "{{theme}}"', {
                replace: { theme: currentTheme },
              }),
            }, [
              { label: 'Cancel' },
              {
                label: 'Confirm',
                action: () => {
                  this.props.onRemoveTheme(currentTheme);
                },
              },
            ]);
          };
          this.selectTheme = (evt) => {
            this.context.api.events.emit('analytics-track-click-event', 'Themes', 'Select theme');
            this.props.onSelectTheme(evt.currentTarget.value);
          };
          this.isCustom = (themeName) => {
            return this.props.isThemeCustom(themeName);
          };
          this.initState({
            availableFonts: [],
            variables: {},
            editable: false,
          });
        }
        UNSAFE_componentWillMount() {
          this.nextState.availableFonts = Array.from(new Set([
            'Inter',
            'Roboto',
            'BebasNeue',
            'Montserrat',
          ]));
          this.nextState.editable = this.isCustom(this.props.currentTheme);
          return this.updateVariables(this.props.currentTheme);
        }
        UNSAFE_componentWillReceiveProps(newProps) {
          if (this.props.currentTheme !== newProps.currentTheme) {
            this.updateVariables(newProps.currentTheme);
            this.nextState.editable = this.isCustom(newProps.currentTheme);
          }
        }
        render() {
          const { t, currentTheme, themes } = this.props;
          const { editable, variables } = this.state;
          return (React.createElement("div", { style: { position: 'relative' } },
                                      React.createElement("form", null,
                                                          React.createElement(react_bootstrap_1.FormGroup, { controlId: 'themeSelect' },
                                                                              React.createElement(react_bootstrap_1.ControlLabel, null, t('Theme')),
                                                                              React.createElement(react_bootstrap_1.InputGroup, { style: { width: 300 } },
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { componentClass: 'select', onChange: this.selectTheme, value: currentTheme }, themes.map(iter => {
                                                                                                    const theme = this.props.locationToName(iter);
                                                                                                    return this.renderTheme(theme, theme);
                                                                                                  })),
                                                                                                  React.createElement(react_bootstrap_1.InputGroup.Button, null,
                                                                                                                      React.createElement(react_bootstrap_1.Button, { bsStyle: 'primary', onClick: this.onClone }, t('Clone')),
                                                                                                                      editable
                                                                                                                        ? React.createElement(react_bootstrap_1.Button, { bsStyle: 'primary', onClick: this.remove }, t('Remove'))
                                                                                                                        : null)),
                                                                              editable ? null : (React.createElement(react_bootstrap_1.Alert, { bsStyle: 'info' }, t('Please clone this theme to modify it.'))))),
                                      React.createElement(ThemeEditor_1.default, { t: t, themeName: currentTheme, theme: variables, onApply: this.saveTheme, disabled: !editable, onEditStyle: this.props.onEditStyle, getAvailableFonts: this.props.getAvailableFonts }),
                                      editable
                                        ? (React.createElement(vortex_api_1.tooltip.IconButton, { style: { position: 'absolute', top: 20, right: 20 }, className: 'btn-embed', icon: 'refresh', tooltip: t('Reload'), onClick: this.refresh })) : null));
        }
        renderTheme(key, name) {
          return React.createElement("option", { key: key, value: key }, name);
        }
        updateVariables(themeName) {
          return __awaiter(this, void 0, void 0, function* () {
            this.nextState.variables = yield this.props.readThemeVariables(themeName);
          });
        }
        cloneTheme(themeName, themes, error) {
          const { t, onCloneTheme } = this.props;
          const existing = new Set(themes.map(theme => this.props.locationToName(theme).toUpperCase()));
          return this.props.onShowDialog('question', 'Enter a name', {
            bbcode: error !== undefined ? `[color=red]${t(error)}[/color]` : undefined,
            input: [{
              id: 'name',
              placeholder: 'Theme Name',
              value: themeName !== '__default' ? themeName : '',
            }],
            condition: (content) => {
              let _a, _b;
              const res = [];
              const { value } = (_b = (_a = content.input) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : {};
              if ((value !== undefined) && (existing.has(value.toUpperCase()))) {
                res.push({
                  id: 'name',
                  errorText: 'Name already used',
                  actions: ['Clone'],
                });
              }
              if ((value !== undefined) && !vortex_api_1.util.isFilenameValid(value)) {
                res.push({
                  id: 'name',
                  errorText: 'Invalid symbols in name',
                  actions: ['Clone'],
                });
              }
              return res;
            },
          }, [{ label: 'Cancel' }, { label: 'Clone' }])
            .then(res => {
              if (res.action === 'Clone') {
                return onCloneTheme(themeName, res.input.name);
              }
              return Promise.resolve();
            })
            .catch(err => {
              if (err instanceof vortex_api_1.util.ArgumentInvalid) {
                return this.cloneTheme(themeName, themes, err.message);
              }
              this.props.onShowError('Failed to clone theme', err);
            });
        }
      }
      function mapStateToProps(state) {
        return {
          currentTheme: state.settings.interface.currentTheme,
        };
      }
      function mapDispatchToProps(dispatch) {
        return {
          onShowError: (title, details) => vortex_api_1.util.showError(dispatch, title, details),
          onShowDialog: (type, title, content, dialogActions) => dispatch(vortex_api_1.actions.showDialog(type, title, content, dialogActions)),
        };
      }
      function SettingsThemeWrapper(props) {
        const [themes, setThemes] = React.useState(undefined);
        React.useEffect(() => {
          (() => __awaiter(this, void 0, void 0, function* () {
            const result = yield props.readThemes();
            setThemes(result);
          }))();
        }, []);
        if (themes !== undefined) {
          return React.createElement(SettingsTheme, Object.assign({}, props, { themes: themes }));
        }
        return null;
      }
      const SettingsThemeConnected = (0, react_i18next_1.withTranslation)(['common', 'theme-switcher'])((0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)(SettingsThemeWrapper));
      exports["default"] = SettingsThemeConnected;


/***/ }),

/***/ "./src/ThemeEditor.tsx":
/*!*****************************!*\
  !*** ./src/ThemeEditor.tsx ***!
  \*****************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

      "use strict";

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
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      function toHex(num) {
        let res = num.toString(16);
        if (num < 16) {
          res = '0' + res;
        }
        return res;
      }
      function colorToHex(color) {
        return '#'
        + toHex(color.r)
        + toHex(color.g)
        + toHex(color.b);
      }
      function colorFromHex(colorHex) {
        const parts = colorHex.substr(1).match(/.{2}/g);
        return {
          r: parseInt(parts[0], 16),
          g: parseInt(parts[1], 16),
          b: parseInt(parts[2], 16),
        };
      }
      function renderColorBox(color) {
        return (React.createElement("div", { style: {
          width: 16,
          height: 16,
          display: 'inline-block',
          border: 'solid 1px gray',
          marginLeft: 4,
          backgroundColor: colorToHex(color),
        } }));
      }
      class ColorPreview extends React.Component {
        constructor() {
          super(...arguments);
          this.onUpdate = (event) => {
            const { name, onUpdateColor } = this.props;
            onUpdateColor(name, event.target.value);
          };
        }
        render() {
          const { color, disabled } = this.props;
          const content = (React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                                               React.createElement("input", { type: "color", value: colorToHex(color), disabled: disabled, onChange: this.onUpdate, style: { width: '40px', height: '30px', border: 'none', cursor: disabled ? 'default' : 'pointer' } }),
                                               React.createElement("span", null, colorToHex(color))));
          return content;
        }
      }
      const colorDefaults = [
        { name: 'brand-primary', value: '#D78F46' },
        { name: 'brand-highlight', value: '#00C1FF' },
        { name: 'brand-success', value: '#86B951' },
        { name: 'brand-info', value: '#00C1FF' },
        { name: 'brand-warning', value: '#FF7300' },
        { name: 'brand-danger', value: '#FF1C38' },
        { name: 'brand-bg', value: '#2A2C2B' },
        { name: 'brand-menu', value: '#4C4C4C' },
        { name: 'brand-secondary', value: '#D78F46' },
        { name: 'brand-clickable', value: '#D78F46' },
        { name: 'text-color', value: '#eeeeee' },
        { name: 'text-color-disabled', value: '#bbbbbb' },
        { name: 'link-color', value: '#D78F46' },
      ];
      const defaultTheme = {
        colors: {},
        fontSize: 12,
        fontFamily: 'Inter',
        fontFamilyHeadings: 'Inter',
        hidpiScale: 100,
        margin: 30,
        dashletHeight: 120,
        titlebarRows: 2,
        dark: true,
      };
      const standardFonts = [
        'Inter',
        'Roboto',
        'Montserrat',
        'BebasNeue',
        'sans-serif',
        'serif',
        'Arial',
        'Courier New',
        'Georgia',
        'Impact',
        'Marlett',
        'Monaco',
        'Tahoma',
        'Times New Roman',
        'Verdana',
      ];
      class ThemeEditor extends vortex_api_1.ComponentEx {
        constructor(props) {
          super(props);
          this.readFont = () => {
            this.props.getAvailableFonts().then(fonts => this.nextState.availableFonts = fonts);
          };
          this.renderEntry = (entry, value) => {
            const { disabled } = this.props;
            return (React.createElement(react_bootstrap_1.Col, { key: entry.name, sm: 4, md: 4, lg: 4, style: { display: 'inline-flex' } },
                                        React.createElement("span", { style: { marginRight: 'auto' } }, entry.name),
                                        React.createElement(ColorPreview, { name: entry.name, color: colorFromHex(value || entry.value), onUpdateColor: this.updateColor, disabled: disabled })));
          };
          this.editManually = () => {
            const { disabled, themeName } = this.props;
            if (disabled) {
              return;
            }
            this.props.onEditStyle(themeName);
          };
          this.revert = () => {
            this.setColors(this.props.theme);
            this.setFontSize(this.props.theme);
            this.setHiDPIScale(this.props.theme);
            this.setFontFamily(this.props.theme);
            this.setFontFamilyHeadings(this.props.theme);
            this.setMargin(this.props.theme);
            this.setDark(this.props.theme);
            this.setTitlebarRows(this.props.theme);
          };
          this.apply = () => {
            let fontFamily = this.state.fontFamily;
            if (!['serif', 'sans-serif'].includes(fontFamily)) {
              fontFamily = `"${fontFamily}"`;
            }
            const theme = Object.assign(Object.assign({}, this.state.colors), { 'font-size-base': this.state.fontSize.toString() + 'px', 'hidpi-scale-factor': this.state.hidpiScale.toString() + '%', 'font-family-base': fontFamily, 'font-family-headings': '"' + this.state.fontFamilyHeadings + '"', 'gutter-width': this.state.margin.toString() + 'px', 'dashlet-height': `${this.state.dashletHeight}px`, 'dark-theme': this.state.dark ? 'true' : 'false', 'titlebar-rows': this.state.titlebarRows.toString() });
            const grayNames = ['gray-lighter', 'gray-light', 'gray', 'gray-dark', 'gray-darker'];
            let grayColors = ['DEE2E6', 'DDDDDD', 'A9A9A9', '4C4C4C', '2A2C2B'];
            if (this.state.dark) {
              grayColors = grayColors.reverse();
            }
            grayNames.forEach((id, idx) => { theme[id] = '#' + grayColors[idx]; });
            this.props.onApply(theme);
          };
          this.updateColor = (name, color) => {
            this.nextState.colors[name] = color;
          };
          this.onChangeFontSize = (evt) => {
            this.nextState.fontSize = evt.currentTarget.value;
          };
          this.onChangeHiDPIScale = (evt) => {
            this.nextState.hidpiScale = evt.currentTarget.value;
          };
          this.onChangeFontFamily = (evt) => {
            this.nextState.fontFamily = evt.currentTarget.value;
          };
          this.onChangeFontFamilyHeadings = (evt) => {
            this.nextState.fontFamilyHeadings = evt.currentTarget.value;
          };
          this.onChangeMargin = evt => {
            this.nextState.margin = evt.currentTarget.value;
          };
          this.onChangeDashletHeight = evt => {
            this.nextState.dashletHeight = evt.currentTarget.value;
          };
          this.onChangeTitlebarRows = evt => {
            this.nextState.titlebarRows = evt.currentTarget.value;
          };
          this.onChangeDark = newValue => {
            this.nextState.dark = newValue;
          };
          this.initState(Object.assign(Object.assign({}, defaultTheme), { availableFonts: standardFonts }));
        }
        componentDidMount() {
          this.setColors(this.props.theme);
          this.setFontSize(this.props.theme);
          this.setHiDPIScale(this.props.theme);
          this.setFontFamily(this.props.theme);
          this.setFontFamilyHeadings(this.props.theme);
          this.setMargin(this.props.theme);
          this.setDashletHeight(this.props.theme);
          this.setDark(this.props.theme);
          this.setTitlebarRows(this.props.theme);
        }
        UNSAFE_componentWillReceiveProps(newProps) {
          if (newProps.theme !== this.props.theme) {
            this.setColors(newProps.theme);
            this.setFontSize(newProps.theme);
            this.setHiDPIScale(newProps.theme);
            this.setFontFamily(newProps.theme);
            this.setFontFamilyHeadings(newProps.theme);
            this.setMargin(newProps.theme);
            this.setDashletHeight(newProps.theme);
            this.setDark(newProps.theme);
            this.setTitlebarRows(this.props.theme);
          }
        }
        render() {
          const { t, disabled } = this.props;
          const { colors, dark, dashletHeight, fontFamily, fontFamilyHeadings, fontSize, margin, titlebarRows } = this.state;
          const availableFonts = this.state.availableFonts.slice(0);
          if (!availableFonts.includes(fontFamily)) {
            availableFonts.push(fontFamily);
          }
          const buckets = colorDefaults.reduce((prev, value, idx) => {
            if (idx < ThemeEditor.BUCKETS) {
              prev[idx % ThemeEditor.BUCKETS] = [];
            }
            prev[idx % ThemeEditor.BUCKETS].push(value);
            return prev;
          }, new Array(ThemeEditor.BUCKETS));
          return (React.createElement("div", null,
                                      React.createElement(react_bootstrap_1.Form, { disabled: disabled, horizontal: true },
                                                          React.createElement(react_bootstrap_1.FormGroup, null,
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 4 },
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null,
                                                                                                                      t('Font Size:'),
                                                                                                                      " ",
                                                                                                                      fontSize)),
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 8 },
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { type: 'range', value: fontSize, min: 8, max: 24, onChange: this.onChangeFontSize, disabled: disabled }))),
                                                          React.createElement(react_bootstrap_1.FormGroup, null,
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 4 },
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null, t('Margins:'))),
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 8 },
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { type: 'range', value: margin, min: 0, max: 80, onChange: this.onChangeMargin, disabled: disabled }))),
                                                          React.createElement(react_bootstrap_1.FormGroup, null,
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 4 },
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null, t('Font Family:'))),
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 4 },
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { componentClass: 'select', onChange: this.onChangeFontFamily, value: fontFamily, disabled: disabled }, availableFonts.map(this.renderFontOption))),
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 4 },
                                                                                                  React.createElement(react_bootstrap_1.Button, { onClick: this.readFont }, t('Read system fonts')),
                                                                                                  React.createElement(vortex_api_1.More, { id: 'more-system-fonts', name: t('System Fonts') }, t('Makes all system fonts installed on the system available in the Font dropdowns. '
                            + 'This function seems to cause Vortex to crash for a very small number '
                            + 'of users and we have not been able to identify what sets the '
                            + 'affected systems apart yet.')))),
                                                          React.createElement(react_bootstrap_1.FormGroup, null,
                                                                              React.createElement(react_bootstrap_1.Col, { smOffset: 4, sm: 8 },
                                                                                                  React.createElement(react_bootstrap_1.FormControl.Static, { style: { fontFamily, fontSize: fontSize.toString() + 'px' } }, t('The quick brown fox jumps over the lazy dog')))),
                                                          React.createElement(react_bootstrap_1.FormGroup, null,
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 4 },
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null, t('Font Family (Headings):'))),
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 8 },
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { componentClass: 'select', onChange: this.onChangeFontFamilyHeadings, value: fontFamilyHeadings, disabled: disabled }, availableFonts.map(this.renderFontOption)))),
                                                          React.createElement(react_bootstrap_1.FormGroup, null,
                                                                              React.createElement(react_bootstrap_1.Col, { smOffset: 4, sm: 8 },
                                                                                                  React.createElement(react_bootstrap_1.FormControl.Static, { style: {
                                                                                                    fontFamily: fontFamilyHeadings,
                                                                                                    fontSize: fontSize.toString() + 'px',
                                                                                                    textTransform: 'uppercase',
                                                                                                  } }, t('The quick brown fox jumps over the lazy dog')))),
                                                          React.createElement(react_bootstrap_1.FormGroup, null,
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 4 },
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null,
                                                                                                                      t('Dashlet Height:'),
                                                                                                                      " ",
                                                                                                                      dashletHeight,
                                                                                                                      "px",
                                                                                                                      React.createElement(vortex_api_1.More, { id: 'more-dashlet-height', name: t('Dashlet Height') }, t('Every dashlet (the widgets on the Dashboards) has a height that is a '
                                + 'multiple of this value and a width of either 1/3, 2/3 or 3/3 of the '
                                + 'window width. Here you can adjust the base height of dashlets but '
                                + 'we can\'t promise every dashlet will look good or even be usable with '
                                + 'non-default height.')))),
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 8 },
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { type: 'range', value: dashletHeight, min: 50, max: 1000, step: 4, onChange: this.onChangeDashletHeight, disabled: disabled }))),
                                                          React.createElement(react_bootstrap_1.FormGroup, null,
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 4 },
                                                                                                  React.createElement(react_bootstrap_1.ControlLabel, null,
                                                                                                                      t('Titlebar Rows:'),
                                                                                                                      " ",
                                                                                                                      titlebarRows)),
                                                                              React.createElement(react_bootstrap_1.Col, { sm: 8 },
                                                                                                  React.createElement(react_bootstrap_1.FormControl, { type: 'range', value: titlebarRows, min: 1, max: 3, step: 1, onChange: this.onChangeTitlebarRows, disabled: disabled })))),
                                      React.createElement(react_bootstrap_1.Panel, null,
                                                          React.createElement("div", { className: 'panel-body' },
                                                                              React.createElement(react_bootstrap_1.Grid, { style: { width: '100%' } }, buckets[0].map((value, idx) => {
                                                                                return (React.createElement(react_bootstrap_1.Row, { key: idx }, buckets.map(bucket => bucket[idx] !== undefined
                                                                                  ? this.renderEntry(bucket[idx], colors[bucket[idx].name])
                                                                                  : null)));
                                                                              })))),
                                      React.createElement(vortex_api_1.Toggle, { checked: dark, onToggle: this.onChangeDark, disabled: disabled },
                                                          t('Dark Theme'),
                                                          React.createElement(vortex_api_1.More, { id: 'more-dark-theme', name: t('Dark Theme') }, t('When this is enabled, grays are essentially inverted, so a light gray becomes '
                    + 'a dark gray and vice versa.\n'
                    + 'If your theme is mostly light foreground colors on dark background, this '
                    + 'will produce better contrast.'))),
                                      disabled ? null : React.createElement("a", { onClick: this.editManually }, t('Edit CSS manually...')),
                                      disabled ? null : (React.createElement("div", { className: 'pull-right' },
                                                                             React.createElement(react_bootstrap_1.Button, { bsStyle: 'primary', onClick: this.revert }, t('Revert')),
                                                                             React.createElement(react_bootstrap_1.Button, { bsStyle: 'primary', onClick: this.apply }, t('Apply'))))));
        }
        renderFontOption(name) {
          return (React.createElement("option", { key: name }, name));
        }
        setFontSize(theme) {
          this.nextState.fontSize = (theme['font-size-base'] !== undefined)
            ? parseInt(theme['font-size-base'], 10)
            : defaultTheme.fontSize;
        }
        setHiDPIScale(theme) {
          this.nextState.hidpiScale = (theme['hidpi-scale-factor'] !== undefined)
            ? parseInt(theme['hidpi-scale-factor'], 10)
            : defaultTheme.hidpiScale;
        }
        setFontFamily(theme) {
          const fontFamily = theme['font-family-base'] || defaultTheme.fontFamily;
          this.nextState.fontFamily = fontFamily.replace(/^"|"$/g, '');
        }
        setFontFamilyHeadings(theme) {
          const fontFamily = theme['font-family-headings'] || defaultTheme.fontFamilyHeadings;
          this.nextState.fontFamilyHeadings = fontFamily.replace(/^"|"$/g, '');
        }
        setMargin(theme) {
          this.nextState.margin = theme['gutter-width'] !== undefined
            ? parseInt(theme['gutter-width'], 10)
            : defaultTheme.margin;
        }
        setDashletHeight(theme) {
          if (theme['dashlet-height'] !== undefined) {
            this.nextState.dashletHeight = parseInt(theme['dashlet-height'], 10);
          }
        }
        setDark(theme) {
          const dark = theme['dark-theme'] !== undefined
            ? theme['dark-theme'] === 'true'
            : defaultTheme.dark;
          this.nextState.dark = dark;
        }
        setTitlebarRows(theme) {
          if (theme['titlebar-rows'] !== undefined) {
            this.nextState.titlebarRows = parseInt(theme['titlebar-rows'], 10);
          }
        }
        setColors(theme) {
          this.nextState.colors = {};
          colorDefaults.forEach(entry => {
            if (colorDefaults.find(color => color.name === entry.name) !== undefined) {
              this.nextState.colors[entry.name] = theme[entry.name] || entry.value;
            }
          });
        }
      }
      ThemeEditor.BUCKETS = 3;
      exports["default"] = ThemeEditor;


/***/ }),

/***/ "./src/actions.ts":
/*!************************!*\
  !*** ./src/actions.ts ***!
  \************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

      "use strict";

      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.selectTheme = void 0;
      const redux_act_1 = __webpack_require__(/*! redux-act */ "redux-act");
      exports.selectTheme = (0, redux_act_1.createAction)('SELECT_UI_THEME');


/***/ }),

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

      "use strict";

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
      const ops = __importStar(__webpack_require__(/*! ./operations */ "./src/operations.ts"));
      const reducers_1 = __importDefault(__webpack_require__(/*! ./reducers */ "./src/reducers.ts"));
      const SettingsTheme_1 = __importDefault(__webpack_require__(/*! ./SettingsTheme */ "./src/SettingsTheme.tsx"));
      const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
      const path = __importStar(__webpack_require__(/*! path */ "path"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      function applyThemeSync(api, theme) {
        (0, vortex_api_1.log)('debug', 'applyThemeSync called', { theme });
        if (theme === null) {
          (0, vortex_api_1.log)('debug', 'Clearing theme stylesheets');
          api.setStylesheet('variables', undefined);
          api.setStylesheet('details', undefined);
          api.setStylesheet('fonts', undefined);
          api.setStylesheet('style', undefined);
          return;
        }
        const themeDir = path.join(__dirname, 'themes', theme);
        (0, vortex_api_1.log)('debug', 'applyThemeSync setting theme paths', {
          theme,
          themeDir,
          variablesPath: path.join(themeDir, 'variables'),
          detailsPath: path.join(themeDir, 'details'),
          fontsPath: path.join(themeDir, 'fonts'),
          stylePath: path.join(themeDir, 'style')
        });
        api.setStylesheet('variables', path.join(themeDir, 'variables'));
        api.setStylesheet('details', path.join(themeDir, 'details'));
        api.setStylesheet('fonts', path.join(themeDir, 'fonts'));
        api.setStylesheet('style', path.join(themeDir, 'style'));
        (0, vortex_api_1.log)('info', 'Theme stylesheets set synchronously', { theme, themeDir });
      }
      function applyTheme(api, theme, initial) {
        (0, vortex_api_1.log)('debug', 'applyTheme() called', {
          theme,
          initial,
          timestamp: new Date().toISOString()
        });
        if (!initial) {
          (0, vortex_api_1.log)('debug', 'Clearing existing stylesheets');
          api.clearStylesheet();
        }
        if (theme === null) {
          (0, vortex_api_1.log)('debug', 'Applying null theme - clearing all stylesheets');
          api.setStylesheet('variables', undefined);
          api.setStylesheet('details', undefined);
          api.setStylesheet('fonts', undefined);
          api.setStylesheet('style', undefined);
          return;
        }
        return vortex_api_1.util.readExtensibleDir('theme', path.join(__dirname, 'themes'), (0, util_1.themesPath)())
          .then(themes => {
            (0, vortex_api_1.log)('debug', 'Available themes found', {
              themesCount: themes.length,
              themesList: themes.map(t => path.basename(t)),
              requestedTheme: theme
            });
            const selected = themes.find(iter => path.basename(iter) === theme);
            if (selected === undefined) {
              (0, vortex_api_1.log)('warn', 'Requested theme not found', {
                requestedTheme: theme,
                availableThemes: themes.map(t => path.basename(t))
              });
              return Promise.resolve();
            }
            (0, vortex_api_1.log)('debug', 'Selected theme path', {
              theme,
              selectedPath: selected
            });
            return Promise.resolve()
              .then(() => {
                (0, vortex_api_1.log)('debug', 'Loading variables stylesheet', { path: path.join(selected, 'variables') });
                api.setStylesheet('variables', path.join(selected, 'variables'));
              })
              .then(() => {
                (0, vortex_api_1.log)('debug', 'Loading details stylesheet', { path: path.join(selected, 'details') });
                api.setStylesheet('details', path.join(selected, 'details'));
              })
              .then(() => {
                (0, vortex_api_1.log)('debug', 'Loading fonts stylesheet', { path: path.join(selected, 'fonts') });
                api.setStylesheet('fonts', path.join(selected, 'fonts'));
              })
              .then(() => {
                (0, vortex_api_1.log)('debug', 'Loading style stylesheet', { path: path.join(selected, 'style') });
                api.setStylesheet('style', path.join(selected, 'style'));
              })
              .then(() => {
                (0, vortex_api_1.log)('debug', 'Theme stylesheets set, waiting for CSS injection verification');
                setTimeout(() => {
                  let _a, _b, _c;
                  const themeElement = document.getElementById('theme');
                  const headElement = document.getElementsByTagName('head')[0];
                  (0, vortex_api_1.log)('debug', 'CSS injection verification check', {
                    themeElementExists: !!themeElement,
                    themeElementContent: ((_a = themeElement === null || themeElement === void 0 ? void 0 : themeElement.innerHTML) === null || _a === void 0 ? void 0 : _a.substring(0, 200)) || 'none',
                    themeElementContentLength: ((_b = themeElement === null || themeElement === void 0 ? void 0 : themeElement.innerHTML) === null || _b === void 0 ? void 0 : _b.length) || 0,
                    totalHeadChildren: ((_c = headElement === null || headElement === void 0 ? void 0 : headElement.children) === null || _c === void 0 ? void 0 : _c.length) || 0,
                    headChildrenWithThemeId: Array.from((headElement === null || headElement === void 0 ? void 0 : headElement.children) || []).filter(el => el.id === 'theme').length,
                    timestamp: new Date().toISOString()
                  });
                  if (!themeElement || !themeElement.innerHTML) {
                    (0, vortex_api_1.log)('warn', 'CSS injection verification FAILED - theme element missing or empty', {
                      theme,
                      selectedPath: selected,
                      themeElementExists: !!themeElement,
                      themeElementContent: (themeElement === null || themeElement === void 0 ? void 0 : themeElement.innerHTML) || 'none'
                    });
                  }
                  else {
                    (0, vortex_api_1.log)('info', 'CSS injection verification SUCCESS - theme element found with content', {
                      theme,
                      selectedPath: selected,
                      contentLength: themeElement.innerHTML.length,
                      contentPreview: themeElement.innerHTML.substring(0, 100)
                    });
                  }
                }, 500);
              })
              .then(() => {
                (0, vortex_api_1.log)('info', 'Theme applied successfully', { theme, selectedPath: selected });
              });
          });
      }
      function editStyle(api, themeName) {
        const stylePath = path.join(ops.themePath(themeName), 'style.scss');
        return vortex_api_1.fs.ensureFileAsync(stylePath)
          .then(() => vortex_api_1.util.opn(stylePath)
            .catch(vortex_api_1.util.MissingInterpreter, (err) => {
              api.showDialog('error', 'No handler found', {
                text: 'You don\'t have an editor associated with scss files. '
                + 'You can fix this by opening the following file from your file explorer, '
                + 'pick your favorite text editor and when prompted, choose to always open '
                + 'that file type with that editor.',
                message: err.url,
              }, [
                { label: 'Close' },
              ]);
            })
            .catch(err => {
              (0, vortex_api_1.log)('error', 'failed to open', err);
            }));
      }
      function init(context) {
        context.registerReducer(['settings', 'interface'], reducers_1.default);
        const onCloneTheme = (themeName, newName) => ops.cloneTheme(context.api, themeName, newName);
        const onSelectTheme = (theme) => ops.selectTheme(context.api, theme);
        const saveTheme = (themeName, variables) => ops.saveTheme(context.api, themeName, variables);
        const removeTheme = (themeName) => ops.removeTheme(context.api, themeName);
        const onEditStyle = (themeName) => editStyle(context.api, themeName);
        context.registerSettings('Theme', SettingsTheme_1.default, () => ({
          readThemes: ops.readThemes,
          onCloneTheme,
          onSelectTheme,
          readThemeVariables: ops.readThemeVariables,
          onSaveTheme: saveTheme,
          onRemoveTheme: removeTheme,
          locationToName: ops.themeName,
          nameToLocation: ops.themePath,
          isThemeCustom: ops.isThemeCustom,
          onEditStyle,
          getAvailableFonts: util_1.getAvailableFonts,
        }));
        context.once(() => {
          (0, vortex_api_1.log)('debug', 'Theme-switcher extension context.once() callback');
          const store = context.api.store;
          const currentState = store.getState();
          const currentTheme = currentState.settings.interface.currentTheme;
          (0, vortex_api_1.log)('debug', 'Theme-switcher extension applying theme immediately in context.once()', {
            currentTheme,
            settingsInterface: currentState.settings.interface,
            hasStore: !!store,
            hasEvents: !!context.api.events
          });
          if (currentTheme) {
            applyThemeSync(context.api, currentTheme);
          }
          context.api.events.on('select-theme', (selectedThemePath) => {
            (0, vortex_api_1.log)('debug', 'select-theme event received', {
              selectedThemePath,
              timestamp: new Date().toISOString()
            });
            applyTheme(context.api, selectedThemePath, false);
          });
          context.api.events.on('apply-theme', (themeName) => {
            (0, vortex_api_1.log)('debug', 'apply-theme event received', {
              themeName,
              timestamp: new Date().toISOString()
            });
            applyTheme(context.api, themeName, false);
          });
          context.api.events.on('startup', () => {
            (0, vortex_api_1.log)('debug', 'Startup event received - re-applying theme as safety net', {
              currentTheme,
              timestamp: new Date().toISOString()
            });
            const state = context.api.store.getState();
            const activeTheme = state.settings.interface.currentTheme;
            if (activeTheme) {
              setTimeout(() => {
                (0, vortex_api_1.log)('debug', 'Re-applying theme after startup delay (safety net)', { theme: activeTheme });
                applyTheme(context.api, activeTheme, false);
              }, 500);
            }
          });
        });
        return true;
      }
      exports["default"] = init;


/***/ }),

/***/ "./src/operations.ts":
/*!***************************!*\
  !*** ./src/operations.ts ***!
  \***************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

      "use strict";

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
      exports.isThemeCustom = exports.removeTheme = exports.readThemeVariables = exports.cloneTheme = exports.selectTheme = exports.saveTheme = exports.themePath = exports.themeName = exports.readThemes = void 0;
      const path = __importStar(__webpack_require__(/*! path */ "path"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const actions = __importStar(__webpack_require__(/*! ./actions */ "./src/actions.ts"));
      const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
      let themes = [];
      function readThemes() {
        const bundledPath = path.join(__dirname, 'themes');
        return vortex_api_1.util.readExtensibleDir('theme', bundledPath, (0, util_1.themesPath)())
          .tap(extThemes => {
            themes = extThemes;
          });
      }
      exports.readThemes = readThemes;
      function themeName(location) {
        return path.basename(location);
      }
      exports.themeName = themeName;
      function themePath(themeName) {
        themeName = themeName.replace(/^__/, '');
        return themes.find(theme => path.basename(theme) === themeName);
      }
      exports.themePath = themePath;
      function saveThemeInternal(outputPath, variables) {
        const theme = Object.keys(variables)
          .map(name => `\$${name}: ${variables[name]};`);
        return vortex_api_1.fs.writeFileAsync(path.join(outputPath, 'variables.scss'), '// Automatically generated. Changes to this file will be overwritten.\r\n'
        + theme.join('\r\n'));
      }
      function saveTheme(api, themeName, variables) {
        const t = api.translate;
        saveThemeInternal(path.join((0, util_1.themesPath)(), themeName), variables)
          .then(() => {
            api.events.emit('select-theme', themeName);
          })
          .catch(err => {
            api.showErrorNotification(t('Unable to save theme'), err, { allowReport: err.code !== 'ENOENT' });
          });
      }
      exports.saveTheme = saveTheme;
      function selectTheme(api, theme) {
        api.store.dispatch(actions.selectTheme(theme));
        api.events.emit('select-theme', theme);
      }
      exports.selectTheme = selectTheme;
      function cloneTheme(api, themeName, newName) {
        const t = api.translate;
        if (newName && (themes.findIndex(iter => path.basename(iter) === newName) === -1)) {
          const targetPath = path.join((0, util_1.themesPath)(), newName);
          const sourcePath = themePath(themeName);
          if (sourcePath === undefined) {
            return Promise.reject(new Error('no path for current theme'));
          }
          api.events.emit('analytics-track-click-event', 'Themes', 'Clone theme');
          return vortex_api_1.fs.ensureDirAsync(targetPath)
            .then(() => readThemeVariables(themeName))
            .then(variables => saveThemeInternal(path.join((0, util_1.themesPath)(), newName), variables))
            .then(() => (sourcePath !== undefined)
              ? vortex_api_1.fs.readdirAsync(sourcePath)
              : Promise.resolve([]))
            .map(files => vortex_api_1.fs.copyAsync(path.join(sourcePath, files), path.join(targetPath, files)))
            .then(() => {
              themes.push(targetPath);
              selectTheme(api, newName);
            })
            .catch(err => api.showErrorNotification(t('Failed to read theme directory'), err, { allowReport: err.code !== 'ENOENT' }));
        }
        else {
          return Promise.reject(new vortex_api_1.util.ArgumentInvalid('Name already used'));
        }
      }
      exports.cloneTheme = cloneTheme;
      function readThemeVariables(themeName) {
        const currentThemePath = themePath(themeName);
        if (currentThemePath === undefined) {
          (0, vortex_api_1.log)('warn', 'theme not found', themeName);
          return Promise.resolve({});
        }
        return vortex_api_1.fs.readFileAsync(path.join(currentThemePath, 'variables.scss'))
          .then(data => {
            const variables = {};
            data.toString('utf-8').split('\r\n').forEach(line => {
              const [key, value] = line.split(':');
              if (value !== undefined) {
                variables[key.substr(1)] = value.trim().replace(/;*$/, '');
              }
            });
            return variables;
          })
          .catch(() => {
            return {};
          });
      }
      exports.readThemeVariables = readThemeVariables;
      function removeTheme(api, themeName) {
        selectTheme(api, 'default');
        const currentThemePath = themePath(themeName);
        this.nextState.themes = themes
          .filter(iter => iter !== currentThemePath);
        return vortex_api_1.fs.removeAsync(currentThemePath)
          .then(() => {
            (0, vortex_api_1.log)('info', 'removed theme', themeName);
          })
          .catch(err => {
            (0, vortex_api_1.log)('error', 'failed to remove theme', { err });
          });
      }
      exports.removeTheme = removeTheme;
      function isThemeCustom(themeName) {
        const themeFilePath = themePath(themeName);
        if (themeFilePath === undefined) {
          return false;
        }
        return vortex_api_1.util.isChildPath(themeFilePath, (0, util_1.themesPath)());
      }
      exports.isThemeCustom = isThemeCustom;


/***/ }),

/***/ "./src/reducers.ts":
/*!*************************!*\
  !*** ./src/reducers.ts ***!
  \*************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

      "use strict";

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
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const actions = __importStar(__webpack_require__(/*! ./actions */ "./src/actions.ts"));
      const getDefaultTheme = () => {
        if (process.platform === 'darwin') {
          return 'macos-tahoe';
        }
        return '__default';
      };
      const settingsReducer = {
        reducers: {
          [actions.selectTheme]: (state, payload) => {
            (0, vortex_api_1.log)('debug', 'Theme reducer: selectTheme action dispatched', {
              previousTheme: state.currentTheme,
              newTheme: payload,
              timestamp: new Date().toISOString()
            });
            const newState = vortex_api_1.util.setSafe(state, ['currentTheme'], payload);
            (0, vortex_api_1.log)('debug', 'Theme reducer: state updated', {
              oldState: state,
              newState,
              currentTheme: newState.currentTheme
            });
            return newState;
          },
        },
        defaults: {
          currentTheme: getDefaultTheme(),
        },
      };
      (0, vortex_api_1.log)('debug', 'Theme reducer initialized with defaults', {
        platform: process.platform,
        defaultTheme: process.platform === 'darwin' ? 'macos-tahoe' : '__default'
      });
      exports["default"] = settingsReducer;


/***/ }),

/***/ "./src/util.ts":
/*!*********************!*\
  !*** ./src/util.ts ***!
  \*********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

      "use strict";

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
      exports.getAvailableFonts = exports.themesPath = void 0;
      const path = __importStar(__webpack_require__(/*! path */ "path"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      function themesPath() {
        return path.join(vortex_api_1.util.getVortexPath('userData'), 'themes');
      }
      exports.themesPath = themesPath;
      const DEFAULT_FONTS = [
        'Inter',
        'Roboto',
        'Montserrat',
        'BebasNeue',
        'Arial',
        'Helvetica',
        'Times New Roman',
        'Courier New',
        'Verdana',
        'Georgia'
      ];
      const getAvailableFontImpl = () => {
        try {
          const fontScanner = __webpack_require__(/*! font-scanner */ "./node_modules/font-scanner/index.js");
          return fontScanner.getAvailableFonts()
            .then((fonts) => Array.from(new Set([
              ...DEFAULT_FONTS,
              ...(fonts || []).map(font => font.family).sort(),
            ])));
        }
        catch (err) {
          (0, vortex_api_1.log)('warn', 'font-scanner not available, using default fonts', err);
          return Promise.resolve(DEFAULT_FONTS);
        }
      };
      const getAvailableFonts = vortex_api_1.util.makeRemoteCall('get-available-fonts', getAvailableFontImpl);
      exports.getAvailableFonts = getAvailableFonts;


/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

      "use strict";
      module.exports = require("path");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

      "use strict";
      module.exports = require("react");

/***/ }),

/***/ "react-bootstrap":
/*!**********************************!*\
  !*** external "react-bootstrap" ***!
  \**********************************/
/***/ ((module) => {

      "use strict";
      module.exports = require("react-bootstrap");

/***/ }),

/***/ "react-i18next":
/*!********************************!*\
  !*** external "react-i18next" ***!
  \********************************/
/***/ ((module) => {

      "use strict";
      module.exports = require("react-i18next");

/***/ }),

/***/ "react-redux":
/*!******************************!*\
  !*** external "react-redux" ***!
  \******************************/
/***/ ((module) => {

      "use strict";
      module.exports = require("react-redux");

/***/ }),

/***/ "redux-act":
/*!****************************!*\
  !*** external "redux-act" ***!
  \****************************/
/***/ ((module) => {

      "use strict";
      module.exports = require("redux-act");

/***/ }),

/***/ "vortex-api":
/*!*****************************!*\
  !*** external "vortex-api" ***!
  \*****************************/
/***/ ((module) => {

      "use strict";
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
//# sourceMappingURL=bundledPlugins/theme-switcher/theme-switcher.js.map