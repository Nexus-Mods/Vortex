/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/ThemeToCSS.ts":
/*!***************************!*\
  !*** ./src/ThemeToCSS.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ThemeToCSS = void 0;
class ThemeToCSS {
    static getCSSInjectString(rules) {
        const variables = this.transformRules(rules);
        return (`
      html::-webkit-scrollbar {
        display: none;
      }
    `);
    }
    static transformRules(rules) {
        return rules
            .filter(rule => (rule.selectorText !== undefined)
            && rule.selectorText.startsWith('#variable'))
            .reduce((prev, rule) => {
            const [id, type, key] = rule.selectorText.split(' ');
            prev[key.slice(1)] = rule.style[type.slice(1)];
            return prev;
        }, {});
    }
}
exports.ThemeToCSS = ThemeToCSS;


/***/ }),

/***/ "./src/actions/session.ts":
/*!********************************!*\
  !*** ./src/actions/session.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.closeTutorials = exports.setTutorialOpen = void 0;
const redux_act_1 = __webpack_require__(/*! redux-act */ "redux-act");
exports.setTutorialOpen = (0, redux_act_1.createAction)('TOGGLE_TUTORIAL', (tutorialId, isOpen) => ({ tutorialId, isOpen }));
exports.closeTutorials = (0, redux_act_1.createAction)('CLOSE_TUTORIALS');


/***/ }),

/***/ "./src/controls/TutorialButton.tsx":
/*!*****************************************!*\
  !*** ./src/controls/TutorialButton.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VIDEO_HEIGHT = exports.VIDEO_WIDTH = void 0;
const React = __webpack_require__(/*! react */ "react");
const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
const ReactDOM = __webpack_require__(/*! react-dom */ "react-dom");
const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
const session_1 = __webpack_require__(/*! ../actions/session */ "./src/actions/session.ts");
const tutorialManager_1 = __webpack_require__(/*! ../tutorialManager */ "./src/tutorialManager.ts");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
exports.VIDEO_WIDTH = 560;
exports.VIDEO_HEIGHT = 315;
class TutorialButton extends vortex_api_1.ComponentEx {
    constructor(props) {
        super(props);
        this.onFullscreen = (fullscreen) => {
            this.nextState.fullscreen = fullscreen;
        };
        this.onNewWindow = (url) => {
            vortex_api_1.util.opn(url).catch(() => null);
        };
        this.stopClickEvent = (e) => {
            e.stopPropagation();
        };
        this.openLink = () => {
            vortex_api_1.util.opn(this.props.video.attribution.link).catch(err => null);
        };
        this.getRef = () => {
            const { container } = this.props;
            if (container !== undefined) {
                return container;
            }
            return this.mRef;
        };
        this.setRef = ref => {
            this.mRef = ref;
            if (ref !== null) {
                this.mRef = ReactDOM.findDOMNode(this.mRef);
            }
        };
        this.show = evt => {
            const { onClick, onShow, video, isOpen } = this.props;
            evt.preventDefault();
            onShow(video.id, !isOpen);
            if (onClick) {
                onClick(false);
            }
        };
        this.hide = evt => {
            const { onShow, video } = this.props;
            evt.preventDefault();
            onShow(video.id, false);
        };
        this.getBounds = () => {
            const { container } = this.props;
            return container !== undefined ? container.getBoundingClientRect() : {
                left: 0,
                top: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                right: window.innerWidth,
                bottom: window.innerHeight,
            };
        };
        this.initState({
            fullscreen: false,
        });
    }
    render() {
        const { dropdown, children, video, t, tutorialId, orientation, isOpen } = this.props;
        const { fullscreen } = this.state;
        if (video === undefined) {
            return null;
        }
        let iconButton;
        if (video.group === 'todo') {
            iconButton = this.renderTodo();
        }
        else {
            if (dropdown) {
                iconButton = this.renderDropdownButton(t, video.name);
            }
            else {
                iconButton = this.renderButton(t, video.name);
            }
        }
        const popOverTitle = (React.createElement("div", { className: 'popover-title-container' },
            React.createElement("h3", null, t(video.name)),
            React.createElement(vortex_api_1.tooltip.IconButton, { icon: 'close-slim', tooltip: t('Dismiss'), className: 'btn-embed btn-dismiss', onClick: this.hide })));
        const popover = (React.createElement(react_bootstrap_1.Popover, { id: `popover-${video.group}-${video.id}`, className: `tutorial-popover ${fullscreen ? 'tutorial-popover-fullscreen' : ''}`, title: popOverTitle, onClick: this.stopClickEvent },
            React.createElement("div", null,
                React.createElement(vortex_api_1.Webview, { style: { width: exports.VIDEO_WIDTH, height: exports.VIDEO_HEIGHT }, src: (0, tutorialManager_1.default)(video.ytId, video.start, video.end), allowFullScreen: true, onNewWindow: this.onNewWindow, onFullscreen: this.onFullscreen }),
                children ? children.split('\n\n').map((paragraph) => React.createElement("p", { key: video.id }, paragraph)) : null),
            React.createElement("div", { className: 'tutorial-footer' },
                React.createElement("a", { onClick: this.openLink },
                    React.createElement(vortex_api_1.Icon, { name: 'open-in-browser' }),
                    ' ',
                    t('More Videos by {{author}}', { replace: { author: video.attribution.author } })))));
        const overlay = (React.createElement(vortex_api_1.Overlay, { show: tutorialId === video.id && isOpen, onHide: this.hide, orientation: orientation === 'horizontal' ? 'horizontal' : 'vertical', target: this.getRef, getBounds: this.getBounds }, popover));
        if (dropdown) {
            return (React.createElement("li", { className: 'tutorial-button-instance', role: 'presentation' },
                overlay,
                iconButton));
        }
        else {
            return (React.createElement("div", { className: 'tutorial-button-instance' },
                overlay,
                iconButton));
        }
    }
    renderTodo() {
        return (React.createElement("div", { className: 'tutorial-link tutorial-link-todo', ref: this.setRef }));
    }
    renderDropdownButton(t, name) {
        const { container } = this.props;
        return (React.createElement("a", { ref: container !== undefined ? null : this.setRef, onClick: this.show, role: 'menuitem' }, t(name)));
    }
    renderButton(t, name) {
        return (React.createElement("div", { className: 'tutorial-link', ref: this.setRef },
            React.createElement(vortex_api_1.tooltip.IconButton, { tooltip: t(name), onClick: this.show, icon: 'video' },
                React.createElement("div", { className: 'button-text' }, t(name)))));
    }
}
function mapStateToProps(state) {
    return {
        tutorialId: state.session.tutorials.currentTutorial.tutorialId,
        isOpen: state.session.tutorials.currentTutorial.isOpen,
    };
}
function mapDispatchToProps(dispatch) {
    return {
        onShow: (id, open) => dispatch((0, session_1.setTutorialOpen)(id, open)),
    };
}
exports["default"] = (0, react_i18next_1.withTranslation)(['common'])((0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)(TutorialButton));


/***/ }),

/***/ "./src/controls/TutorialDropdown.tsx":
/*!*******************************************!*\
  !*** ./src/controls/TutorialDropdown.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const React = __webpack_require__(/*! react */ "react");
const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
const ReactDOM = __webpack_require__(/*! react-dom */ "react-dom");
const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const TutorialButton_1 = __webpack_require__(/*! ./TutorialButton */ "./src/controls/TutorialButton.tsx");
class TutorialDropdown extends vortex_api_1.ComponentEx {
    constructor(props) {
        super(props);
        this.onToggle = (value) => {
            this.nextState.show = value;
        };
        this.setRef = ref => {
            this.mRef = ref;
            if (ref !== null) {
                this.mRef = ReactDOM.findDOMNode(this.mRef);
            }
        };
        this.initState({
            show: false,
        });
    }
    render() {
        const { show } = this.state;
        const { t, groupName, videos } = this.props;
        let titleContent;
        titleContent = (React.createElement("div", { className: 'tutorial-dropdown-title' },
            React.createElement(vortex_api_1.Icon, { name: 'video' }),
            React.createElement("div", { className: 'button-text' }, t('Tutorials'))));
        return (React.createElement(react_bootstrap_1.DropdownButton, { onToggle: this.onToggle, open: show, ref: this.setRef, className: 'tutorial-dropdown-group', title: titleContent, id: 'tutorial-dropdown' + groupName }, videos.map((video) => React.createElement(TutorialButton_1.default, { onClick: this.onToggle, container: this.mRef, key: video.group + video.id, dropdown: true, video: video }))));
    }
}
exports["default"] = (0, react_i18next_1.withTranslation)(['common'])(TutorialDropdown);


/***/ }),

/***/ "./src/reducers/session.ts":
/*!*********************************!*\
  !*** ./src/reducers/session.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const actions = __webpack_require__(/*! ../actions/session */ "./src/actions/session.ts");
const INVALID_TUTORIAL_ID = -1;
const sessionReducer = {
    reducers: {
        [actions.setTutorialOpen]: (state, payload) => {
            const { tutorialId, isOpen } = payload;
            const vidOpen = (state.currentTutorial.tutorialId !== payload.tutorialId)
                ? true
                : isOpen;
            return (vortex_api_1.util.setSafe(state, ['currentTutorial'], { tutorialId, isOpen: vidOpen }));
        },
        [actions.closeTutorials]: (state) => {
            return (vortex_api_1.util.setSafe(state, ['currentTutorial'], {
                tutorialId: INVALID_TUTORIAL_ID,
                isOpen: false,
            }));
        },
    },
    defaults: {
        currentTutorial: {
            tutorialId: INVALID_TUTORIAL_ID,
            isOpen: false,
        },
    },
};
exports["default"] = sessionReducer;


/***/ }),

/***/ "./src/tutorialManager.ts":
/*!********************************!*\
  !*** ./src/tutorialManager.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getTutorialData = exports.TODO_GROUP = void 0;
const YoutubeInfo_1 = __webpack_require__(/*! ./types/YoutubeInfo */ "./src/types/YoutubeInfo.ts");
const YOUTUBE_LINK = 'https://www.youtube.com/embed/';
exports.TODO_GROUP = 'todo';
const ICONBAR_GROUPS = {
    plugins: 'gamebryo-plugin-icons',
    mods: 'mod-icons',
};
const regexPattern = /^([0-5][0-9]|[0-9])(:|\.)[0-5][0-9]$/;
const VIDEO_IDS = {
    intro: 'sD9xKao_u30',
    installing: 'OrZM9LSuDhU',
    fomods: 'dWcHiamHhCA',
    plugins: 'BRo8I32ASSw',
    conflicts: 'eSkurhkPSyw',
};
const ATTRIBUTIONS = {
    gopher: {
        author: 'Gopher',
        link: 'https://www.gophersvids.com/',
    },
};
const TUTORIAL_DATA = {
    [ICONBAR_GROUPS.plugins]: [
        (0, YoutubeInfo_1.createTutorialVideo)(VIDEO_IDS.plugins, 'Data files', '1.13', '3.35', ATTRIBUTIONS.gopher, ICONBAR_GROUPS.plugins),
        (0, YoutubeInfo_1.createTutorialVideo)(VIDEO_IDS.plugins, 'Master files', '3.36', '6.36', ATTRIBUTIONS.gopher, ICONBAR_GROUPS.plugins),
        (0, YoutubeInfo_1.createTutorialVideo)(VIDEO_IDS.plugins, 'Load Order', '6.37', '9.52', ATTRIBUTIONS.gopher, ICONBAR_GROUPS.plugins),
        (0, YoutubeInfo_1.createTutorialVideo)(VIDEO_IDS.plugins, 'LOOT Groups', '9.53', '17.20', ATTRIBUTIONS.gopher, ICONBAR_GROUPS.plugins),
        (0, YoutubeInfo_1.createTutorialVideo)(VIDEO_IDS.plugins, 'Dependencies', '17.20', '19.28', ATTRIBUTIONS.gopher, ICONBAR_GROUPS.plugins),
    ],
    [ICONBAR_GROUPS.mods]: [
        (0, YoutubeInfo_1.createTutorialVideo)(VIDEO_IDS.installing, 'Install Mods', '1.02', '7.10', ATTRIBUTIONS.gopher, ICONBAR_GROUPS.mods),
        (0, YoutubeInfo_1.createTutorialVideo)(VIDEO_IDS.fomods, 'Scripted Installers', '0.25', '10.41', ATTRIBUTIONS.gopher, ICONBAR_GROUPS.mods),
        (0, YoutubeInfo_1.createTutorialVideo)(VIDEO_IDS.conflicts, 'Resolving Conflicts', '1.36', '11.40', ATTRIBUTIONS.gopher, ICONBAR_GROUPS.mods),
    ],
    [exports.TODO_GROUP]: [
        (0, YoutubeInfo_1.createTutorialVideo)(VIDEO_IDS.intro, 'Vortex Introduction', '2.05', '8.14', ATTRIBUTIONS.gopher, exports.TODO_GROUP),
    ],
};
function getTutorialData(group) {
    if (group && group in TUTORIAL_DATA) {
        return TUTORIAL_DATA[group];
    }
    return TUTORIAL_DATA;
}
exports.getTutorialData = getTutorialData;
function getEmbedLink(id, start, end) {
    const srcLink = YOUTUBE_LINK;
    let startSeconds = 0;
    let endSeconds = 0;
    if (typeof start === 'number') {
        startSeconds = start;
    }
    else if (typeof start === 'string') {
        startSeconds = convertTimeToSeconds(start);
    }
    else {
        startSeconds = 0;
    }
    if (typeof end === 'number') {
        endSeconds = end;
    }
    else if (typeof start === 'string') {
        endSeconds = convertTimeToSeconds(end);
    }
    else {
        endSeconds = 0;
    }
    return srcLink + id + '?start=' + startSeconds + '&end=' + endSeconds + ';autoplay=1';
}
function convertTimeToSeconds(time) {
    if (regexPattern.test(time)) {
        const timeArray = time.split(/(?:\.|\:)+/);
        const totalSeconds = (+timeArray[0]) * 60 + (+timeArray[1]);
        return totalSeconds;
    }
}
exports["default"] = getEmbedLink;


/***/ }),

/***/ "./src/types/YoutubeInfo.ts":
/*!**********************************!*\
  !*** ./src/types/YoutubeInfo.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createTutorialVideo = exports.nextId = void 0;
exports.nextId = 0;
function createTutorialVideo(ytId, name, start, end, attribution, group) {
    return { id: exports.nextId++, ytId, name, start, end, attribution, group: group || 'Tutorials' };
}
exports.createTutorialVideo = createTutorialVideo;


/***/ }),

/***/ "./src/views/DocumentationView.tsx":
/*!*****************************************!*\
  !*** ./src/views/DocumentationView.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const React = __webpack_require__(/*! react */ "react");
const react_bootstrap_1 = __webpack_require__(/*! react-bootstrap */ "react-bootstrap");
const ReactDOM = __webpack_require__(/*! react-dom */ "react-dom");
const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const ThemeToCSS_1 = __webpack_require__(/*! ../ThemeToCSS */ "./src/ThemeToCSS.ts");
const VORTEX_DOCUMENTS_URL = 'https://github.com/Nexus-Mods/Vortex/wiki';
const ALLOWED_DOMAINS = [
    'https://nexus-mods.github.io',
    'https://modding.wiki',
    'https://github.com/nexus-mods/vortex/wiki',
];
const LOGIN_URL = 'https://modding.wiki/login';
class DocumentationView extends vortex_api_1.ComponentEx {
    constructor(props) {
        super(props);
        this.mRef = null;
        this.onExternalLink = (link) => {
            const { onShowDialog } = this.props;
            this.navigate(this.state.history[this.state.historyIdx]);
            onShowDialog('question', 'External Link', {
                text: 'For your safety the knowledge base browser is limited to Vortex\'s GitHub wiki domain. '
                    + 'A link you\'ve clicked lies outside this domain and can only be viewed in your regular '
                    + 'browser - please ensure you trust the URL below before allowing Vortex to open that page '
                    + 'in your default browser.',
                message: link,
            }, [
                { label: 'Cancel' },
                { label: 'Continue', action: () => vortex_api_1.util.opn(link).catch(() => null) },
            ]);
        };
        this.onLoading = (loading) => {
            this.nextState.loading = loading;
        };
        this.navigate = (url) => {
            if (this.mMounted) {
                try {
                    this.mWebView.stop();
                    this.mWebView.src = url;
                    this.nextState.loading = false;
                }
                catch (err) {
                    (0, vortex_api_1.log)('warn', 'failed to navigate', { url, error: err.message });
                }
            }
        };
        this.navBack = () => {
            const { history, historyIdx } = this.state;
            const newPos = Math.max(0, historyIdx - 1);
            this.nextState.historyIdx = newPos;
            this.mWebView.loadURL(history[newPos]);
        };
        this.navHome = () => {
            const { history, historyIdx } = this.state;
            const newPos = Math.min(history.length - 1, historyIdx + 1);
            this.nextState.historyIdx = newPos;
            this.mWebView.loadURL(VORTEX_DOCUMENTS_URL);
        };
        this.navForward = () => {
            const { history, historyIdx } = this.state;
            const newPos = Math.min(history.length - 1, historyIdx + 1);
            this.nextState.historyIdx = newPos;
            this.mWebView.loadURL(history[newPos]);
        };
        this.openBrowser = () => {
            const { history, historyIdx } = this.state;
            vortex_api_1.util.opn(history[historyIdx]).catch(err => null);
        };
        this.setRef = ref => {
            this.mRef = ref;
            if (ref !== null) {
                this.mWebView = ReactDOM.findDOMNode(this.mRef);
                Object.keys(this.mCallbacks).forEach(event => {
                    this.mWebView.addEventListener(event, this.mCallbacks[event]);
                });
            }
            else {
                Object.keys(this.mCallbacks).forEach(event => {
                    this.mWebView.removeEventListener(event, this.mCallbacks[event]);
                });
            }
        };
        this.initState({
            loading: false,
            history: [VORTEX_DOCUMENTS_URL],
            historyIdx: 0,
        });
        this.mCallbacks = {
            'did-finish-load': () => {
                const newUrl = this.mWebView.getURL();
                if (newUrl.toLowerCase() === LOGIN_URL) {
                    this.navigate(this.state.history[this.state.historyIdx]);
                    vortex_api_1.util.opn(newUrl).catch(() => null);
                    return;
                }
                const isAllowed = ALLOWED_DOMAINS.some(domain => newUrl.toLowerCase().startsWith(domain));
                if (!isAllowed) {
                    this.onExternalLink(newUrl);
                    return;
                }
                if (newUrl !== this.nextState.history[this.nextState.historyIdx]) {
                    this.nextState.history.splice(this.nextState.historyIdx + 1, 9999, newUrl);
                    ++this.nextState.historyIdx;
                }
                const cssString = ThemeToCSS_1.ThemeToCSS.getCSSInjectString(this.getThemeSheet());
                this.mWebView.insertCSS(cssString);
            },
        };
    }
    componentDidMount() {
        this.mMounted = true;
        this.context.api.events.on('navigate-knowledgebase', this.navigate);
    }
    componentWillUnmount() {
        this.context.api.events.removeListener('navigate-knowledgebase', this.navigate);
        this.mMounted = false;
    }
    render() {
        const { t } = this.props;
        const { loading, history, historyIdx } = this.state;
        return (React.createElement(vortex_api_1.MainPage, null,
            React.createElement(vortex_api_1.MainPage.Header, null,
                React.createElement("div", { className: 'header-navigation' },
                    React.createElement(vortex_api_1.tooltip.IconButton, { icon: 'nav-back', onClick: this.navBack, disabled: historyIdx === 0, tooltip: t('Back') }),
                    React.createElement(vortex_api_1.tooltip.IconButton, { icon: 'highlight-home', onClick: this.navHome, disabled: historyIdx === 0, tooltip: t('Home') }),
                    React.createElement(vortex_api_1.tooltip.IconButton, { icon: 'nav-forward', onClick: this.navForward, disabled: historyIdx === history.length - 1, tooltip: t('Forward') })),
                React.createElement("div", { className: 'flex-fill' }),
                React.createElement("div", { className: 'header-navigation-right' },
                    React.createElement(vortex_api_1.tooltip.IconButton, { icon: 'open-in-browser', onClick: this.openBrowser, tooltip: t('Open in Browser') }))),
            React.createElement(vortex_api_1.MainPage.Body, null,
                React.createElement(vortex_api_1.FlexLayout, { type: 'column', className: 'documentation' },
                    React.createElement(react_bootstrap_1.Panel, null,
                        React.createElement(react_bootstrap_1.Panel.Body, null,
                            loading ? this.renderWait() : null,
                            React.createElement(vortex_api_1.Webview, { style: {
                                    visibility: loading ? 'hidden' : 'visible',
                                    width: '100%',
                                    height: loading ? 0 : '100%',
                                }, src: VORTEX_DOCUMENTS_URL, onLoading: this.onLoading, ref: this.setRef })))))));
    }
    renderWait() {
        return (React.createElement("div", { style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
            } },
            React.createElement(vortex_api_1.Spinner, { style: {
                    width: '64px',
                    height: '64px',
                } })));
    }
    getThemeSheet() {
        for (let i = 0; i < document.styleSheets.length; ++i) {
            if (document.styleSheets[i].ownerNode.id === 'theme') {
                return Array.from(document.styleSheets[i].rules);
            }
        }
        return [];
    }
}
function mapStateToProps(state) {
    return {};
}
function mapDispatchToProps(dispatch) {
    return {
        onShowDialog: (type, title, content, dialogActions) => dispatch(vortex_api_1.actions.showDialog(type, title, content, dialogActions)),
    };
}
exports["default"] = (0, react_redux_1.connect)(mapStateToProps, mapDispatchToProps)((0, react_i18next_1.withTranslation)(['common'])(DocumentationView));


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
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
/*!***********************!*\
  !*** ./src/index.tsx ***!
  \***********************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
const path = __webpack_require__(/*! path */ "path");
const React = __webpack_require__(/*! react */ "react");
const session_1 = __webpack_require__(/*! ./actions/session */ "./src/actions/session.ts");
const TutorialButton_1 = __webpack_require__(/*! ./controls/TutorialButton */ "./src/controls/TutorialButton.tsx");
const TutorialDropdown_1 = __webpack_require__(/*! ./controls/TutorialDropdown */ "./src/controls/TutorialDropdown.tsx");
const session_2 = __webpack_require__(/*! ./reducers/session */ "./src/reducers/session.ts");
const tutorialManager_1 = __webpack_require__(/*! ./tutorialManager */ "./src/tutorialManager.ts");
const DocumentationView_1 = __webpack_require__(/*! ./views/DocumentationView */ "./src/views/DocumentationView.tsx");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const WIKI_TOPICS = {
    ['adding-games']: 'users/ui/games#finding-a-game',
    ['creating-themes']: 'developer/creating-a-theme',
    ['deployment-methods']: 'users/deployment-methods',
    ['downloading']: 'users/download-from-nexusmods',
    ['external-changes']: 'users/External-Changes',
    ['keyboard-shortcuts']: 'users/keyboard-shortcuts',
    ['file-conflicts']: 'users/managing-file-conflicts',
    ['load-order-about']: 'users/vortex-approach-to-load-order',
    ['load-order']: 'users/managing-your-load-order',
    ['profiles']: 'users/setting-up-profiles',
};
const WIKI_URL = 'https://modding.wiki/en/vortex';
function generateUrl(wikiId) {
    const topicId = WIKI_TOPICS[wikiId] || undefined;
    if (topicId === undefined) {
        return undefined;
    }
    return `${WIKI_URL}/${topicId}`;
}
function init(context) {
    context.registerReducer(['session', 'tutorials'], session_2.default);
    context.registerMainPage('details', 'Knowledge Base', DocumentationView_1.default, {
        hotkeyRaw: 'F1',
        group: 'global',
    });
    const tutData = (0, tutorialManager_1.getTutorialData)();
    Object.keys(tutData).forEach((key) => {
        if (key === tutorialManager_1.TODO_GROUP) {
            const element = tutData[key][0];
            context.registerToDo('todo-tutorial-vid', 'more', undefined, 'video', 'Introduction Video', () => {
                const { store } = context.api;
                store.dispatch((0, session_1.setTutorialOpen)(element.id, !vortex_api_1.util.getSafe(store.getState(), ['session', 'tutorials', 'currentTutorial', 'isOpen'], false)));
                context.api.events.emit('analytics-track-click-event', 'Dashboard', 'Intro Video');
            }, undefined, (t) => (React.createElement(TutorialButton_1.default, { video: element })), 5);
        }
        else {
            if (tutData[key].length === 1) {
                const element = tutData[key][0];
                context.registerAction(key, 400, TutorialButton_1.default, {}, () => ({
                    video: element,
                }));
            }
            else {
                context.registerAction(key, 400, TutorialDropdown_1.default, {}, () => ({
                    groupName: key,
                    videos: tutData[key],
                }));
            }
        }
    });
    context.once(() => {
        context.api.setStylesheet('documentation', path.join(__dirname, 'documentation.scss'));
        context.api.onStateChange(['session', 'base', 'mainPage'], () => {
            const { store } = context.api;
            if (false !== vortex_api_1.util.getSafe(store.getState(), ['session', 'tutorials', 'currentTutorial', 'isOpen'], false)) {
                store.dispatch((0, session_1.closeTutorials)());
            }
        });
        context.api.events.on('open-knowledge-base', (wikiId) => {
            context.api.events.emit('show-main-page', 'Knowledge Base');
            const url = generateUrl(wikiId);
            if (url !== undefined) {
                setTimeout(() => {
                    context.api.events.emit('navigate-knowledgebase', url);
                }, 2000);
            }
        });
    });
    return true;
}
exports["default"] = init;

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=bundledPlugins/documentation/documentation.js.map