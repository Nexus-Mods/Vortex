/******/ (() => { // webpackBootstrap
/******/ 	const __webpack_modules__ = ({

/***/ "./node_modules/bail/index.js":
/*!************************************!*\
  !*** ./node_modules/bail/index.js ***!
  \************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   bail: () => (/* binding */ bail)
/* harmony export */ });
/**
 * Throw a given error.
 *
 * @param {Error|null|undefined} [error]
 *   Maybe error.
 * @returns {asserts error is null|undefined}
 */
      function bail(error) {
        if (error) {
          throw error
        }
      }


/***/ }),

/***/ "./node_modules/comma-separated-tokens/index.js":
/*!******************************************************!*\
  !*** ./node_modules/comma-separated-tokens/index.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   parse: () => (/* binding */ parse),
/* harmony export */   stringify: () => (/* binding */ stringify)
/* harmony export */ });
/**
 * @typedef Options
 *   Configuration for `stringify`.
 * @property {boolean} [padLeft=true]
 *   Whether to pad a space before a token.
 * @property {boolean} [padRight=false]
 *   Whether to pad a space after a token.
 */

/**
 * @typedef {Options} StringifyOptions
 *   Please use `StringifyOptions` instead.
 */

/**
 * Parse comma-separated tokens to an array.
 *
 * @param {string} value
 *   Comma-separated tokens.
 * @returns {Array<string>}
 *   List of tokens.
 */
      function parse(value) {
  /** @type {Array<string>} */
        const tokens = []
        const input = String(value || '')
        let index = input.indexOf(',')
        let start = 0
  /** @type {boolean} */
        let end = false

        while (!end) {
          if (index === -1) {
            index = input.length
            end = true
          }

          const token = input.slice(start, index).trim()

          if (token || !end) {
            tokens.push(token)
          }

          start = index + 1
          index = input.indexOf(',', start)
        }

        return tokens
      }

/**
 * Serialize an array of strings or numbers to comma-separated tokens.
 *
 * @param {Array<string|number>} values
 *   List of tokens.
 * @param {Options} [options]
 *   Configuration for `stringify` (optional).
 * @returns {string}
 *   Comma-separated tokens.
 */
      function stringify(values, options) {
        const settings = options || {}

  // Ensure the last empty entry is seen.
        const input = values[values.length - 1] === '' ? [...values, ''] : values

        return input
          .join(
            (settings.padRight ? ' ' : '') +
        ',' +
        (settings.padLeft === false ? '' : ' ')
          )
          .trim()
      }


/***/ }),

/***/ "./node_modules/debug/src/browser.js":
/*!*******************************************!*\
  !*** ./node_modules/debug/src/browser.js ***!
  \*******************************************/
/***/ ((module, exports, __webpack_require__) => {

/* eslint-env browser */

/**
 * This is the web browser implementation of `debug()`.
 */

      exports.formatArgs = formatArgs;
      exports.save = save;
      exports.load = load;
      exports.useColors = useColors;
      exports.storage = localstorage();
      exports.destroy = (() => {
        let warned = false;

        return () => {
          if (!warned) {
            warned = true;
            console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
          }
        };
      })();

/**
 * Colors.
 */

      exports.colors = [
        '#0000CC',
        '#0000FF',
        '#0033CC',
        '#0033FF',
        '#0066CC',
        '#0066FF',
        '#0099CC',
        '#0099FF',
        '#00CC00',
        '#00CC33',
        '#00CC66',
        '#00CC99',
        '#00CCCC',
        '#00CCFF',
        '#3300CC',
        '#3300FF',
        '#3333CC',
        '#3333FF',
        '#3366CC',
        '#3366FF',
        '#3399CC',
        '#3399FF',
        '#33CC00',
        '#33CC33',
        '#33CC66',
        '#33CC99',
        '#33CCCC',
        '#33CCFF',
        '#6600CC',
        '#6600FF',
        '#6633CC',
        '#6633FF',
        '#66CC00',
        '#66CC33',
        '#9900CC',
        '#9900FF',
        '#9933CC',
        '#9933FF',
        '#99CC00',
        '#99CC33',
        '#CC0000',
        '#CC0033',
        '#CC0066',
        '#CC0099',
        '#CC00CC',
        '#CC00FF',
        '#CC3300',
        '#CC3333',
        '#CC3366',
        '#CC3399',
        '#CC33CC',
        '#CC33FF',
        '#CC6600',
        '#CC6633',
        '#CC9900',
        '#CC9933',
        '#CCCC00',
        '#CCCC33',
        '#FF0000',
        '#FF0033',
        '#FF0066',
        '#FF0099',
        '#FF00CC',
        '#FF00FF',
        '#FF3300',
        '#FF3333',
        '#FF3366',
        '#FF3399',
        '#FF33CC',
        '#FF33FF',
        '#FF6600',
        '#FF6633',
        '#FF9900',
        '#FF9933',
        '#FFCC00',
        '#FFCC33'
      ];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

// eslint-disable-next-line complexity
      function useColors() {
	// NB: In an Electron preload script, document will be defined but not fully
	// initialized. Since we know we're in Chrome, we'll just detect this case
	// explicitly
        if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
          return true;
        }

	// Internet Explorer and Edge do not support colors.
        if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
          return false;
        }

        let m;

	// Is webkit? http://stackoverflow.com/a/16459606/376773
	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	// eslint-disable-next-line no-return-assign
        return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
		// Is firebug? http://stackoverflow.com/a/398120/376773
		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
		// Is firefox >= v31?
		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
		(typeof navigator !== 'undefined' && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31) ||
		// Double check webkit in userAgent just in case we are in a worker
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
      }

/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

      function formatArgs(args) {
        args[0] = (this.useColors ? '%c' : '') +
		this.namespace +
		(this.useColors ? ' %c' : ' ') +
		args[0] +
		(this.useColors ? '%c ' : ' ') +
		'+' + module.exports.humanize(this.diff);

        if (!this.useColors) {
          return;
        }

        const c = 'color: ' + this.color;
        args.splice(1, 0, c, 'color: inherit');

	// The final "%c" is somewhat tricky, because there could be other
	// arguments passed either before or after the %c, so we need to
	// figure out the correct index to insert the CSS into
        let index = 0;
        let lastC = 0;
        args[0].replace(/%[a-zA-Z%]/g, match => {
          if (match === '%%') {
            return;
          }
          index++;
          if (match === '%c') {
			// We only are interested in the *last* %c
			// (the user may have provided their own)
            lastC = index;
          }
        });

        args.splice(lastC, 0, c);
      }

/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */
      exports.log = console.debug || console.log || (() => {});

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
      function save(namespaces) {
        try {
          if (namespaces) {
            exports.storage.setItem('debug', namespaces);
          } else {
            exports.storage.removeItem('debug');
          }
        } catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
        }
      }

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
      function load() {
        let r;
        try {
          r = exports.storage.getItem('debug') || exports.storage.getItem('DEBUG') ;
        } catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
        }

	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
        if (!r && typeof process !== 'undefined' && 'env' in process) {
          r = process.env.DEBUG;
        }

        return r;
      }

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

      function localstorage() {
        try {
		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
		// The Browser also has localStorage in the global context.
          return localStorage;
        } catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
        }
      }

      module.exports = __webpack_require__(/*! ./common */ "./node_modules/debug/src/common.js")(exports);

      const {formatters} = module.exports;

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

      formatters.j = function (v) {
        try {
          return JSON.stringify(v);
        } catch (error) {
          return '[UnexpectedJSONParseError]: ' + error.message;
        }
      };


/***/ }),

/***/ "./node_modules/debug/src/common.js":
/*!******************************************!*\
  !*** ./node_modules/debug/src/common.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */

      function setup(env) {
        createDebug.debug = createDebug;
        createDebug.default = createDebug;
        createDebug.coerce = coerce;
        createDebug.disable = disable;
        createDebug.enable = enable;
        createDebug.enabled = enabled;
        createDebug.humanize = __webpack_require__(/*! ms */ "./node_modules/ms/index.js");
        createDebug.destroy = destroy;

        Object.keys(env).forEach(key => {
          createDebug[key] = env[key];
        });

	/**
	* The currently active debug mode names, and names to skip.
	*/

        createDebug.names = [];
        createDebug.skips = [];

	/**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/
        createDebug.formatters = {};

	/**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/
        function selectColor(namespace) {
          let hash = 0;

          for (let i = 0; i < namespace.length; i++) {
            hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
          }

          return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
        }
        createDebug.selectColor = selectColor;

	/**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/
        function createDebug(namespace) {
          let prevTime;
          let enableOverride = null;
          let namespacesCache;
          let enabledCache;

          function debug(...args) {
			// Disabled?
            if (!debug.enabled) {
              return;
            }

            const self = debug;

			// Set `diff` timestamp
            const curr = Number(new Date());
            const ms = curr - (prevTime || curr);
            self.diff = ms;
            self.prev = prevTime;
            self.curr = curr;
            prevTime = curr;

            args[0] = createDebug.coerce(args[0]);

            if (typeof args[0] !== 'string') {
				// Anything else let's inspect with %O
              args.unshift('%O');
            }

			// Apply any `formatters` transformations
            let index = 0;
            args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
				// If we encounter an escaped % then don't increase the array index
              if (match === '%%') {
                return '%';
              }
              index++;
              const formatter = createDebug.formatters[format];
              if (typeof formatter === 'function') {
                const val = args[index];
                match = formatter.call(self, val);

					// Now we need to remove `args[index]` since it's inlined in the `format`
                args.splice(index, 1);
                index--;
              }
              return match;
            });

			// Apply env-specific formatting (colors, etc.)
            createDebug.formatArgs.call(self, args);

            const logFn = self.log || createDebug.log;
            logFn.apply(self, args);
          }

          debug.namespace = namespace;
          debug.useColors = createDebug.useColors();
          debug.color = createDebug.selectColor(namespace);
          debug.extend = extend;
          debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

          Object.defineProperty(debug, 'enabled', {
            enumerable: true,
            configurable: false,
            get: () => {
              if (enableOverride !== null) {
                return enableOverride;
              }
              if (namespacesCache !== createDebug.namespaces) {
                namespacesCache = createDebug.namespaces;
                enabledCache = createDebug.enabled(namespace);
              }

              return enabledCache;
            },
            set: v => {
              enableOverride = v;
            }
          });

		// Env-specific initialization logic for debug instances
          if (typeof createDebug.init === 'function') {
            createDebug.init(debug);
          }

          return debug;
        }

        function extend(namespace, delimiter) {
          const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
          newDebug.log = this.log;
          return newDebug;
        }

	/**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/
        function enable(namespaces) {
          createDebug.save(namespaces);
          createDebug.namespaces = namespaces;

          createDebug.names = [];
          createDebug.skips = [];

          const split = (typeof namespaces === 'string' ? namespaces : '')
            .trim()
            .replace(/\s+/g, ',')
            .split(',')
            .filter(Boolean);

          for (const ns of split) {
            if (ns[0] === '-') {
              createDebug.skips.push(ns.slice(1));
            } else {
              createDebug.names.push(ns);
            }
          }
        }

	/**
	 * Checks if the given string matches a namespace template, honoring
	 * asterisks as wildcards.
	 *
	 * @param {String} search
	 * @param {String} template
	 * @return {Boolean}
	 */
        function matchesTemplate(search, template) {
          let searchIndex = 0;
          let templateIndex = 0;
          let starIndex = -1;
          let matchIndex = 0;

          while (searchIndex < search.length) {
            if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')) {
				// Match character or proceed with wildcard
              if (template[templateIndex] === '*') {
                starIndex = templateIndex;
                matchIndex = searchIndex;
                templateIndex++; // Skip the '*'
              } else {
                searchIndex++;
                templateIndex++;
              }
            } else if (starIndex !== -1) { // eslint-disable-line no-negated-condition
				// Backtrack to the last '*' and try to match more characters
              templateIndex = starIndex + 1;
              matchIndex++;
              searchIndex = matchIndex;
            } else {
              return false; // No match
            }
          }

		// Handle trailing '*' in template
          while (templateIndex < template.length && template[templateIndex] === '*') {
            templateIndex++;
          }

          return templateIndex === template.length;
        }

	/**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/
        function disable() {
          const namespaces = [
            ...createDebug.names,
            ...createDebug.skips.map(namespace => '-' + namespace)
          ].join(',');
          createDebug.enable('');
          return namespaces;
        }

	/**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/
        function enabled(name) {
          for (const skip of createDebug.skips) {
            if (matchesTemplate(name, skip)) {
              return false;
            }
          }

          for (const ns of createDebug.names) {
            if (matchesTemplate(name, ns)) {
              return true;
            }
          }

          return false;
        }

	/**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/
        function coerce(val) {
          if (val instanceof Error) {
            return val.stack || val.message;
          }
          return val;
        }

	/**
	* XXX DO NOT USE. This is a temporary stub function.
	* XXX It WILL be removed in the next major release.
	*/
        function destroy() {
          console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
        }

        createDebug.enable(createDebug.load());

        return createDebug;
      }

      module.exports = setup;


/***/ }),

/***/ "./node_modules/decode-named-character-reference/index.dom.js":
/*!********************************************************************!*\
  !*** ./node_modules/decode-named-character-reference/index.dom.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   decodeNamedCharacterReference: () => (/* binding */ decodeNamedCharacterReference)
/* harmony export */ });
/// <reference lib="dom" />

/* global document */

      const element = document.createElement('i')

/**
 * @param {string} value
 * @returns {string | false}
 */
      function decodeNamedCharacterReference(value) {
        const characterReference = '&' + value + ';'
        element.innerHTML = characterReference
        const character = element.textContent

  // Some named character references do not require the closing semicolon
  // (`&not`, for instance), which leads to situations where parsing the assumed
  // named reference of `&notit;` will result in the string `¬it;`.
  // When we encounter a trailing semicolon after parsing, and the character
  // reference to decode was not a semicolon (`&semi;`), we can assume that the
  // matching was not complete.
        if (
    // @ts-expect-error: TypeScript is wrong that `textContent` on elements can
    // yield `null`.
          character.charCodeAt(character.length - 1) === 59 /* `;` */ &&
    value !== 'semi'
        ) {
          return false
        }

  // If the decoded string is equal to the input, the character reference was
  // not valid.
  // @ts-expect-error: TypeScript is wrong that `textContent` on elements can
  // yield `null`.
        return character === characterReference ? false : character
      }


/***/ }),

/***/ "./node_modules/dequal/dist/index.mjs":
/*!********************************************!*\
  !*** ./node_modules/dequal/dist/index.mjs ***!
  \********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   dequal: () => (/* binding */ dequal)
/* harmony export */ });
      const has = Object.prototype.hasOwnProperty;

      function find(iter, tar, key) {
        for (key of iter.keys()) {
          if (dequal(key, tar)) return key;
        }
      }

      function dequal(foo, bar) {
        let ctor, len, tmp;
        if (foo === bar) return true;

        if (foo && bar && (ctor=foo.constructor) === bar.constructor) {
          if (ctor === Date) return foo.getTime() === bar.getTime();
          if (ctor === RegExp) return foo.toString() === bar.toString();

          if (ctor === Array) {
            if ((len=foo.length) === bar.length) {
              while (len-- && dequal(foo[len], bar[len]));
            }
            return len === -1;
          }

          if (ctor === Set) {
            if (foo.size !== bar.size) {
              return false;
            }
            for (len of foo) {
              tmp = len;
              if (tmp && typeof tmp === 'object') {
                tmp = find(bar, tmp);
                if (!tmp) return false;
              }
              if (!bar.has(tmp)) return false;
            }
            return true;
          }

          if (ctor === Map) {
            if (foo.size !== bar.size) {
              return false;
            }
            for (len of foo) {
              tmp = len[0];
              if (tmp && typeof tmp === 'object') {
                tmp = find(bar, tmp);
                if (!tmp) return false;
              }
              if (!dequal(len[1], bar.get(tmp))) {
                return false;
              }
            }
            return true;
          }

          if (ctor === ArrayBuffer) {
            foo = new Uint8Array(foo);
            bar = new Uint8Array(bar);
          } else if (ctor === DataView) {
            if ((len=foo.byteLength) === bar.byteLength) {
              while (len-- && foo.getInt8(len) === bar.getInt8(len));
            }
            return len === -1;
          }

          if (ArrayBuffer.isView(foo)) {
            if ((len=foo.byteLength) === bar.byteLength) {
              while (len-- && foo[len] === bar[len]);
            }
            return len === -1;
          }

          if (!ctor || typeof foo === 'object') {
            len = 0;
            for (ctor in foo) {
              if (has.call(foo, ctor) && ++len && !has.call(bar, ctor)) return false;
              if (!(ctor in bar) || !dequal(foo[ctor], bar[ctor])) return false;
            }
            return Object.keys(bar).length === len;
          }
        }

        return foo !== foo && bar !== bar;
      }


/***/ }),

/***/ "./node_modules/diff/lib/index.mjs":
/*!*****************************************!*\
  !*** ./node_modules/diff/lib/index.mjs ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Diff: () => (/* binding */ Diff),
/* harmony export */   applyPatch: () => (/* binding */ applyPatch),
/* harmony export */   applyPatches: () => (/* binding */ applyPatches),
/* harmony export */   canonicalize: () => (/* binding */ canonicalize),
/* harmony export */   convertChangesToDMP: () => (/* binding */ convertChangesToDMP),
/* harmony export */   convertChangesToXML: () => (/* binding */ convertChangesToXML),
/* harmony export */   createPatch: () => (/* binding */ createPatch),
/* harmony export */   createTwoFilesPatch: () => (/* binding */ createTwoFilesPatch),
/* harmony export */   diffArrays: () => (/* binding */ diffArrays),
/* harmony export */   diffChars: () => (/* binding */ diffChars),
/* harmony export */   diffCss: () => (/* binding */ diffCss),
/* harmony export */   diffJson: () => (/* binding */ diffJson),
/* harmony export */   diffLines: () => (/* binding */ diffLines),
/* harmony export */   diffSentences: () => (/* binding */ diffSentences),
/* harmony export */   diffTrimmedLines: () => (/* binding */ diffTrimmedLines),
/* harmony export */   diffWords: () => (/* binding */ diffWords),
/* harmony export */   diffWordsWithSpace: () => (/* binding */ diffWordsWithSpace),
/* harmony export */   formatPatch: () => (/* binding */ formatPatch),
/* harmony export */   merge: () => (/* binding */ merge),
/* harmony export */   parsePatch: () => (/* binding */ parsePatch),
/* harmony export */   reversePatch: () => (/* binding */ reversePatch),
/* harmony export */   structuredPatch: () => (/* binding */ structuredPatch)
/* harmony export */ });
      function Diff() {}
      Diff.prototype = {
        diff: function diff(oldString, newString) {
          let _options$timeout;

          let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
          let callback = options.callback;

          if (typeof options === 'function') {
            callback = options;
            options = {};
          }

          this.options = options;
          const self = this;

          function done(value) {
            if (callback) {
              setTimeout(function () {
                callback(undefined, value);
              }, 0);
              return true;
            } else {
              return value;
            }
          } // Allow subclasses to massage the input prior to running


          oldString = this.castInput(oldString);
          newString = this.castInput(newString);
          oldString = this.removeEmpty(this.tokenize(oldString));
          newString = this.removeEmpty(this.tokenize(newString));
          const newLen = newString.length,
            oldLen = oldString.length;
          let editLength = 1;
          let maxEditLength = newLen + oldLen;

          if (options.maxEditLength) {
            maxEditLength = Math.min(maxEditLength, options.maxEditLength);
          }

          const maxExecutionTime = (_options$timeout = options.timeout) !== null && _options$timeout !== void 0 ? _options$timeout : Infinity;
          const abortAfterTimestamp = Date.now() + maxExecutionTime;
          const bestPath = [{
            oldPos: -1,
            lastComponent: undefined
          }]; // Seed editLength = 0, i.e. the content starts with the same values

          let newPos = this.extractCommon(bestPath[0], newString, oldString, 0);

          if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      // Identity per the equality and tokenizer
            return done([{
              value: this.join(newString),
              count: newString.length
            }]);
          } // Once we hit the right edge of the edit graph on some diagonal k, we can
    // definitely reach the end of the edit graph in no more than k edits, so
    // there's no point in considering any moves to diagonal k+1 any more (from
    // which we're guaranteed to need at least k+1 more edits).
    // Similarly, once we've reached the bottom of the edit graph, there's no
    // point considering moves to lower diagonals.
    // We record this fact by setting minDiagonalToConsider and
    // maxDiagonalToConsider to some finite value once we've hit the edge of
    // the edit graph.
    // This optimization is not faithful to the original algorithm presented in
    // Myers's paper, which instead pointlessly extends D-paths off the end of
    // the edit graph - see page 7 of Myers's paper which notes this point
    // explicitly and illustrates it with a diagram. This has major performance
    // implications for some common scenarios. For instance, to compute a diff
    // where the new text simply appends d characters on the end of the
    // original text of length n, the true Myers algorithm will take O(n+d^2)
    // time while this optimization needs only O(n+d) time.


          let minDiagonalToConsider = -Infinity,
            maxDiagonalToConsider = Infinity; // Main worker method. checks all permutations of a given edit length for acceptance.

          function execEditLength() {
            for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
              let basePath = void 0;
              const removePath = bestPath[diagonalPath - 1],
                addPath = bestPath[diagonalPath + 1];

              if (removePath) {
          // No one else is going to attempt to use this value, clear it
                bestPath[diagonalPath - 1] = undefined;
              }

              let canAdd = false;

              if (addPath) {
          // what newPos will be after we do an insertion:
                const addPathNewPos = addPath.oldPos - diagonalPath;
                canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
              }

              const canRemove = removePath && removePath.oldPos + 1 < oldLen;

              if (!canAdd && !canRemove) {
          // If this path is a terminal then prune
                bestPath[diagonalPath] = undefined;
                continue;
              } // Select the diagonal that we want to branch from. We select the prior
        // path whose position in the old string is the farthest from the origin
        // and does not pass the bounds of the diff graph
        // TODO: Remove the `+ 1` here to make behavior match Myers algorithm
        //       and prefer to order removals before insertions.


              if (!canRemove || canAdd && removePath.oldPos + 1 < addPath.oldPos) {
                basePath = self.addToPath(addPath, true, undefined, 0);
              } else {
                basePath = self.addToPath(removePath, undefined, true, 1);
              }

              newPos = self.extractCommon(basePath, newString, oldString, diagonalPath);

              if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          // If we have hit the end of both strings, then we are done
                return done(buildValues(self, basePath.lastComponent, newString, oldString, self.useLongestToken));
              } else {
                bestPath[diagonalPath] = basePath;

                if (basePath.oldPos + 1 >= oldLen) {
                  maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
                }

                if (newPos + 1 >= newLen) {
                  minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
                }
              }
            }

            editLength++;
          } // Performs the length of edit iteration. Is a bit fugly as this has to support the
    // sync and async mode which is never fun. Loops over execEditLength until a value
    // is produced, or until the edit length exceeds options.maxEditLength (if given),
    // in which case it will return undefined.


          if (callback) {
            (function exec() {
              setTimeout(function () {
                if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
                  return callback();
                }

                if (!execEditLength()) {
                  exec();
                }
              }, 0);
            })();
          } else {
            while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
              const ret = execEditLength();

              if (ret) {
                return ret;
              }
            }
          }
        },
        addToPath: function addToPath(path, added, removed, oldPosInc) {
          const last = path.lastComponent;

          if (last && last.added === added && last.removed === removed) {
            return {
              oldPos: path.oldPos + oldPosInc,
              lastComponent: {
                count: last.count + 1,
                added: added,
                removed: removed,
                previousComponent: last.previousComponent
              }
            };
          } else {
            return {
              oldPos: path.oldPos + oldPosInc,
              lastComponent: {
                count: 1,
                added: added,
                removed: removed,
                previousComponent: last
              }
            };
          }
        },
        extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
          let newLen = newString.length,
            oldLen = oldString.length,
            oldPos = basePath.oldPos,
            newPos = oldPos - diagonalPath,
            commonCount = 0;

          while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
            newPos++;
            oldPos++;
            commonCount++;
          }

          if (commonCount) {
            basePath.lastComponent = {
              count: commonCount,
              previousComponent: basePath.lastComponent
            };
          }

          basePath.oldPos = oldPos;
          return newPos;
        },
        equals: function equals(left, right) {
          if (this.options.comparator) {
            return this.options.comparator(left, right);
          } else {
            return left === right || this.options.ignoreCase && left.toLowerCase() === right.toLowerCase();
          }
        },
        removeEmpty: function removeEmpty(array) {
          const ret = [];

          for (let i = 0; i < array.length; i++) {
            if (array[i]) {
              ret.push(array[i]);
            }
          }

          return ret;
        },
        castInput: function castInput(value) {
          return value;
        },
        tokenize: function tokenize(value) {
          return value.split('');
        },
        join: function join(chars) {
          return chars.join('');
        }
      };

      function buildValues(diff, lastComponent, newString, oldString, useLongestToken) {
  // First we convert our linked list of components in reverse order to an
  // array in the right order:
        const components = [];
        let nextComponent;

        while (lastComponent) {
          components.push(lastComponent);
          nextComponent = lastComponent.previousComponent;
          delete lastComponent.previousComponent;
          lastComponent = nextComponent;
        }

        components.reverse();
        let componentPos = 0,
          componentLen = components.length,
          newPos = 0,
          oldPos = 0;

        for (; componentPos < componentLen; componentPos++) {
          const component = components[componentPos];

          if (!component.removed) {
            if (!component.added && useLongestToken) {
              let value = newString.slice(newPos, newPos + component.count);
              value = value.map(function (value, i) {
                const oldValue = oldString[oldPos + i];
                return oldValue.length > value.length ? oldValue : value;
              });
              component.value = diff.join(value);
            } else {
              component.value = diff.join(newString.slice(newPos, newPos + component.count));
            }

            newPos += component.count; // Common case

            if (!component.added) {
              oldPos += component.count;
            }
          } else {
            component.value = diff.join(oldString.slice(oldPos, oldPos + component.count));
            oldPos += component.count; // Reverse add and remove so removes are output first to match common convention
      // The diffing algorithm is tied to add then remove output and this is the simplest
      // route to get the desired output with minimal overhead.

            if (componentPos && components[componentPos - 1].added) {
              const tmp = components[componentPos - 1];
              components[componentPos - 1] = components[componentPos];
              components[componentPos] = tmp;
            }
          }
        } // Special case handle for when one terminal is ignored (i.e. whitespace).
  // For this case we merge the terminal into the prior string and drop the change.
  // This is only available for string mode.


        const finalComponent = components[componentLen - 1];

        if (componentLen > 1 && typeof finalComponent.value === 'string' && (finalComponent.added || finalComponent.removed) && diff.equals('', finalComponent.value)) {
          components[componentLen - 2].value += finalComponent.value;
          components.pop();
        }

        return components;
      }

      const characterDiff = new Diff();
      function diffChars(oldStr, newStr, options) {
        return characterDiff.diff(oldStr, newStr, options);
      }

      function generateOptions(options, defaults) {
        if (typeof options === 'function') {
          defaults.callback = options;
        } else if (options) {
          for (const name in options) {
      /* istanbul ignore else */
            if (options.hasOwnProperty(name)) {
              defaults[name] = options[name];
            }
          }
        }

        return defaults;
      }

//
// Ranges and exceptions:
// Latin-1 Supplement, 0080–00FF
//  - U+00D7  × Multiplication sign
//  - U+00F7  ÷ Division sign
// Latin Extended-A, 0100–017F
// Latin Extended-B, 0180–024F
// IPA Extensions, 0250–02AF
// Spacing Modifier Letters, 02B0–02FF
//  - U+02C7  ˇ &#711;  Caron
//  - U+02D8  ˘ &#728;  Breve
//  - U+02D9  ˙ &#729;  Dot Above
//  - U+02DA  ˚ &#730;  Ring Above
//  - U+02DB  ˛ &#731;  Ogonek
//  - U+02DC  ˜ &#732;  Small Tilde
//  - U+02DD  ˝ &#733;  Double Acute Accent
// Latin Extended Additional, 1E00–1EFF

      const extendedWordChars = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/;
      const reWhitespace = /\S/;
      const wordDiff = new Diff();

      wordDiff.equals = function (left, right) {
        if (this.options.ignoreCase) {
          left = left.toLowerCase();
          right = right.toLowerCase();
        }

        return left === right || this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right);
      };

      wordDiff.tokenize = function (value) {
  // All whitespace symbols except newline group into one token, each newline - in separate token
        const tokens = value.split(/([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/); // Join the boundary splits that we do not consider to be boundaries. This is primarily the extended Latin character set.

        for (let i = 0; i < tokens.length - 1; i++) {
    // If we have an empty string in the next field and we have only word chars before and after, merge
          if (!tokens[i + 1] && tokens[i + 2] && extendedWordChars.test(tokens[i]) && extendedWordChars.test(tokens[i + 2])) {
            tokens[i] += tokens[i + 2];
            tokens.splice(i + 1, 2);
            i--;
          }
        }

        return tokens;
      };

      function diffWords(oldStr, newStr, options) {
        options = generateOptions(options, {
          ignoreWhitespace: true
        });
        return wordDiff.diff(oldStr, newStr, options);
      }
      function diffWordsWithSpace(oldStr, newStr, options) {
        return wordDiff.diff(oldStr, newStr, options);
      }

      const lineDiff = new Diff();

      lineDiff.tokenize = function (value) {
        if (this.options.stripTrailingCr) {
    // remove one \r before \n to match GNU diff's --strip-trailing-cr behavior
          value = value.replace(/\r\n/g, '\n');
        }

        const retLines = [],
          linesAndNewlines = value.split(/(\n|\r\n)/); // Ignore the final empty token that occurs if the string ends with a new line

        if (!linesAndNewlines[linesAndNewlines.length - 1]) {
          linesAndNewlines.pop();
        } // Merge the content and line separators into single tokens


        for (let i = 0; i < linesAndNewlines.length; i++) {
          let line = linesAndNewlines[i];

          if (i % 2 && !this.options.newlineIsToken) {
            retLines[retLines.length - 1] += line;
          } else {
            if (this.options.ignoreWhitespace) {
              line = line.trim();
            }

            retLines.push(line);
          }
        }

        return retLines;
      };

      function diffLines(oldStr, newStr, callback) {
        return lineDiff.diff(oldStr, newStr, callback);
      }
      function diffTrimmedLines(oldStr, newStr, callback) {
        const options = generateOptions(callback, {
          ignoreWhitespace: true
        });
        return lineDiff.diff(oldStr, newStr, options);
      }

      const sentenceDiff = new Diff();

      sentenceDiff.tokenize = function (value) {
        return value.split(/(\S.+?[.!?])(?=\s+|$)/);
      };

      function diffSentences(oldStr, newStr, callback) {
        return sentenceDiff.diff(oldStr, newStr, callback);
      }

      const cssDiff = new Diff();

      cssDiff.tokenize = function (value) {
        return value.split(/([{}:;,]|\s+)/);
      };

      function diffCss(oldStr, newStr, callback) {
        return cssDiff.diff(oldStr, newStr, callback);
      }

      function _typeof(obj) {
        "@babel/helpers - typeof";

        if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
          _typeof = function (obj) {
            return typeof obj;
          };
        } else {
          _typeof = function (obj) {
            return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
          };
        }

        return _typeof(obj);
      }

      function _defineProperty(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }

        return obj;
      }

      function ownKeys(object, enumerableOnly) {
        const keys = Object.keys(object);

        if (Object.getOwnPropertySymbols) {
          let symbols = Object.getOwnPropertySymbols(object);
          if (enumerableOnly) symbols = symbols.filter(function (sym) {
            return Object.getOwnPropertyDescriptor(object, sym).enumerable;
          });
          keys.push.apply(keys, symbols);
        }

        return keys;
      }

      function _objectSpread2(target) {
        for (let i = 1; i < arguments.length; i++) {
          var source = arguments[i] != null ? arguments[i] : {};

          if (i % 2) {
            ownKeys(Object(source), true).forEach(function (key) {
              _defineProperty(target, key, source[key]);
            });
          } else if (Object.getOwnPropertyDescriptors) {
            Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
          } else {
            ownKeys(Object(source)).forEach(function (key) {
              Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
            });
          }
        }

        return target;
      }

      function _toConsumableArray(arr) {
        return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
      }

      function _arrayWithoutHoles(arr) {
        if (Array.isArray(arr)) return _arrayLikeToArray(arr);
      }

      function _iterableToArray(iter) {
        if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
      }

      function _unsupportedIterableToArray(o, minLen) {
        if (!o) return;
        if (typeof o === "string") return _arrayLikeToArray(o, minLen);
        let n = Object.prototype.toString.call(o).slice(8, -1);
        if (n === "Object" && o.constructor) n = o.constructor.name;
        if (n === "Map" || n === "Set") return Array.from(o);
        if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
      }

      function _arrayLikeToArray(arr, len) {
        if (len == null || len > arr.length) len = arr.length;

        for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

        return arr2;
      }

      function _nonIterableSpread() {
        throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
      }

      const objectPrototypeToString = Object.prototype.toString;
      const jsonDiff = new Diff(); // Discriminate between two lines of pretty-printed, serialized JSON where one of them has a
// dangling comma and the other doesn't. Turns out including the dangling comma yields the nicest output:

      jsonDiff.useLongestToken = true;
      jsonDiff.tokenize = lineDiff.tokenize;

      jsonDiff.castInput = function (value) {
        const _this$options = this.options,
          undefinedReplacement = _this$options.undefinedReplacement,
          _this$options$stringi = _this$options.stringifyReplacer,
          stringifyReplacer = _this$options$stringi === void 0 ? function (k, v) {
            return typeof v === 'undefined' ? undefinedReplacement : v;
          } : _this$options$stringi;
        return typeof value === 'string' ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), stringifyReplacer, '  ');
      };

      jsonDiff.equals = function (left, right) {
        return Diff.prototype.equals.call(jsonDiff, left.replace(/,([\r\n])/g, '$1'), right.replace(/,([\r\n])/g, '$1'));
      };

      function diffJson(oldObj, newObj, options) {
        return jsonDiff.diff(oldObj, newObj, options);
      } // This function handles the presence of circular references by bailing out when encountering an
// object that is already on the "stack" of items being processed. Accepts an optional replacer

      function canonicalize(obj, stack, replacementStack, replacer, key) {
        stack = stack || [];
        replacementStack = replacementStack || [];

        if (replacer) {
          obj = replacer(key, obj);
        }

        let i;

        for (i = 0; i < stack.length; i += 1) {
          if (stack[i] === obj) {
            return replacementStack[i];
          }
        }

        let canonicalizedObj;

        if ('[object Array]' === objectPrototypeToString.call(obj)) {
          stack.push(obj);
          canonicalizedObj = new Array(obj.length);
          replacementStack.push(canonicalizedObj);

          for (i = 0; i < obj.length; i += 1) {
            canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, key);
          }

          stack.pop();
          replacementStack.pop();
          return canonicalizedObj;
        }

        if (obj && obj.toJSON) {
          obj = obj.toJSON();
        }

        if (_typeof(obj) === 'object' && obj !== null) {
          stack.push(obj);
          canonicalizedObj = {};
          replacementStack.push(canonicalizedObj);

          let sortedKeys = [],
            _key;

          for (_key in obj) {
      /* istanbul ignore else */
            if (obj.hasOwnProperty(_key)) {
              sortedKeys.push(_key);
            }
          }

          sortedKeys.sort();

          for (i = 0; i < sortedKeys.length; i += 1) {
            _key = sortedKeys[i];
            canonicalizedObj[_key] = canonicalize(obj[_key], stack, replacementStack, replacer, _key);
          }

          stack.pop();
          replacementStack.pop();
        } else {
          canonicalizedObj = obj;
        }

        return canonicalizedObj;
      }

      const arrayDiff = new Diff();

      arrayDiff.tokenize = function (value) {
        return value.slice();
      };

      arrayDiff.join = arrayDiff.removeEmpty = function (value) {
        return value;
      };

      function diffArrays(oldArr, newArr, callback) {
        return arrayDiff.diff(oldArr, newArr, callback);
      }

      function parsePatch(uniDiff) {
        const options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        let diffstr = uniDiff.split(/\r\n|[\n\v\f\r\x85]/),
          delimiters = uniDiff.match(/\r\n|[\n\v\f\r\x85]/g) || [],
          list = [],
          i = 0;

        function parseIndex() {
          const index = {};
          list.push(index); // Parse diff metadata

          while (i < diffstr.length) {
            const line = diffstr[i]; // File header found, end parsing diff metadata

            if (/^(\-\-\-|\+\+\+|@@)\s/.test(line)) {
              break;
            } // Diff index


            const header = /^(?:Index:|diff(?: -r \w+)+)\s+(.+?)\s*$/.exec(line);

            if (header) {
              index.index = header[1];
            }

            i++;
          } // Parse file headers if they are defined. Unified diff requires them, but
    // there's no technical issues to have an isolated hunk without file header


          parseFileHeader(index);
          parseFileHeader(index); // Parse hunks

          index.hunks = [];

          while (i < diffstr.length) {
            const _line = diffstr[i];

            if (/^(Index:|diff|\-\-\-|\+\+\+)\s/.test(_line)) {
              break;
            } else if (/^@@/.test(_line)) {
              index.hunks.push(parseHunk());
            } else if (_line && options.strict) {
        // Ignore unexpected content unless in strict mode
              throw new Error('Unknown line ' + (i + 1) + ' ' + JSON.stringify(_line));
            } else {
              i++;
            }
          }
        } // Parses the --- and +++ headers, if none are found, no lines
  // are consumed.


        function parseFileHeader(index) {
          const fileHeader = /^(---|\+\+\+)\s+(.*)$/.exec(diffstr[i]);

          if (fileHeader) {
            const keyPrefix = fileHeader[1] === '---' ? 'old' : 'new';
            const data = fileHeader[2].split('\t', 2);
            let fileName = data[0].replace(/\\\\/g, '\\');

            if (/^".*"$/.test(fileName)) {
              fileName = fileName.substr(1, fileName.length - 2);
            }

            index[keyPrefix + 'FileName'] = fileName;
            index[keyPrefix + 'Header'] = (data[1] || '').trim();
            i++;
          }
        } // Parses a hunk
  // This assumes that we are at the start of a hunk.


        function parseHunk() {
          const chunkHeaderIndex = i,
            chunkHeaderLine = diffstr[i++],
            chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
          const hunk = {
            oldStart: +chunkHeader[1],
            oldLines: typeof chunkHeader[2] === 'undefined' ? 1 : +chunkHeader[2],
            newStart: +chunkHeader[3],
            newLines: typeof chunkHeader[4] === 'undefined' ? 1 : +chunkHeader[4],
            lines: [],
            linedelimiters: []
          }; // Unified Diff Format quirk: If the chunk size is 0,
    // the first number is one lower than one would expect.
    // https://www.artima.com/weblogs/viewpost.jsp?thread=164293

          if (hunk.oldLines === 0) {
            hunk.oldStart += 1;
          }

          if (hunk.newLines === 0) {
            hunk.newStart += 1;
          }

          let addCount = 0,
            removeCount = 0;

          for (; i < diffstr.length; i++) {
      // Lines starting with '---' could be mistaken for the "remove line" operation
      // But they could be the header for the next file. Therefore prune such cases out.
            if (diffstr[i].indexOf('--- ') === 0 && i + 2 < diffstr.length && diffstr[i + 1].indexOf('+++ ') === 0 && diffstr[i + 2].indexOf('@@') === 0) {
              break;
            }

            const operation = diffstr[i].length == 0 && i != diffstr.length - 1 ? ' ' : diffstr[i][0];

            if (operation === '+' || operation === '-' || operation === ' ' || operation === '\\') {
              hunk.lines.push(diffstr[i]);
              hunk.linedelimiters.push(delimiters[i] || '\n');

              if (operation === '+') {
                addCount++;
              } else if (operation === '-') {
                removeCount++;
              } else if (operation === ' ') {
                addCount++;
                removeCount++;
              }
            } else {
              break;
            }
          } // Handle the empty block count case


          if (!addCount && hunk.newLines === 1) {
            hunk.newLines = 0;
          }

          if (!removeCount && hunk.oldLines === 1) {
            hunk.oldLines = 0;
          } // Perform optional sanity checking


          if (options.strict) {
            if (addCount !== hunk.newLines) {
              throw new Error('Added line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
            }

            if (removeCount !== hunk.oldLines) {
              throw new Error('Removed line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
            }
          }

          return hunk;
        }

        while (i < diffstr.length) {
          parseIndex();
        }

        return list;
      }

// Iterator that traverses in the range of [min, max], stepping
// by distance from a given start position. I.e. for [0, 4], with
// start of 2, this will iterate 2, 3, 1, 4, 0.
      function distanceIterator (start, minLine, maxLine) {
        let wantForward = true,
          backwardExhausted = false,
          forwardExhausted = false,
          localOffset = 1;
        return function iterator() {
          if (wantForward && !forwardExhausted) {
            if (backwardExhausted) {
              localOffset++;
            } else {
              wantForward = false;
            } // Check if trying to fit beyond text length, and if not, check it fits
      // after offset location (or desired location on first iteration)


            if (start + localOffset <= maxLine) {
              return localOffset;
            }

            forwardExhausted = true;
          }

          if (!backwardExhausted) {
            if (!forwardExhausted) {
              wantForward = true;
            } // Check if trying to fit before text beginning, and if not, check it fits
      // before offset location


            if (minLine <= start - localOffset) {
              return -localOffset++;
            }

            backwardExhausted = true;
            return iterator();
          } // We tried to fit hunk before text beginning and beyond text length, then
    // hunk can't fit on the text. Return undefined

        };
      }

      function applyPatch(source, uniDiff) {
        const options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

        if (typeof uniDiff === 'string') {
          uniDiff = parsePatch(uniDiff);
        }

        if (Array.isArray(uniDiff)) {
          if (uniDiff.length > 1) {
            throw new Error('applyPatch only works with a single input.');
          }

          uniDiff = uniDiff[0];
        } // Apply the diff to the input


        let lines = source.split(/\r\n|[\n\v\f\r\x85]/),
          delimiters = source.match(/\r\n|[\n\v\f\r\x85]/g) || [],
          hunks = uniDiff.hunks,
          compareLine = options.compareLine || function (lineNumber, line, operation, patchContent) {
            return line === patchContent;
          },
          errorCount = 0,
          fuzzFactor = options.fuzzFactor || 0,
          minLine = 0,
          offset = 0,
          removeEOFNL,
          addEOFNL;
  /**
   * Checks if the hunk exactly fits on the provided location
   */


        function hunkFits(hunk, toPos) {
          for (let j = 0; j < hunk.lines.length; j++) {
            const line = hunk.lines[j],
              operation = line.length > 0 ? line[0] : ' ',
              content = line.length > 0 ? line.substr(1) : line;

            if (operation === ' ' || operation === '-') {
        // Context sanity check
              if (!compareLine(toPos + 1, lines[toPos], operation, content)) {
                errorCount++;

                if (errorCount > fuzzFactor) {
                  return false;
                }
              }

              toPos++;
            }
          }

          return true;
        } // Search best fit offsets for each hunk based on the previous ones


        for (let i = 0; i < hunks.length; i++) {
          let hunk = hunks[i],
            maxLine = lines.length - hunk.oldLines,
            localOffset = 0,
            toPos = offset + hunk.oldStart - 1;
          const iterator = distanceIterator(toPos, minLine, maxLine);

          for (; localOffset !== undefined; localOffset = iterator()) {
            if (hunkFits(hunk, toPos + localOffset)) {
              hunk.offset = offset += localOffset;
              break;
            }
          }

          if (localOffset === undefined) {
            return false;
          } // Set lower text limit to end of the current hunk, so next ones don't try
    // to fit over already patched text


          minLine = hunk.offset + hunk.oldStart + hunk.oldLines;
        } // Apply patch hunks


        let diffOffset = 0;

        for (let _i = 0; _i < hunks.length; _i++) {
          let _hunk = hunks[_i],
            _toPos = _hunk.oldStart + _hunk.offset + diffOffset - 1;

          diffOffset += _hunk.newLines - _hunk.oldLines;

          for (let j = 0; j < _hunk.lines.length; j++) {
            const line = _hunk.lines[j],
              operation = line.length > 0 ? line[0] : ' ',
              content = line.length > 0 ? line.substr(1) : line,
              delimiter = _hunk.linedelimiters && _hunk.linedelimiters[j] || '\n';

            if (operation === ' ') {
              _toPos++;
            } else if (operation === '-') {
              lines.splice(_toPos, 1);
              delimiters.splice(_toPos, 1);
        /* istanbul ignore else */
            } else if (operation === '+') {
              lines.splice(_toPos, 0, content);
              delimiters.splice(_toPos, 0, delimiter);
              _toPos++;
            } else if (operation === '\\') {
              const previousOperation = _hunk.lines[j - 1] ? _hunk.lines[j - 1][0] : null;

              if (previousOperation === '+') {
                removeEOFNL = true;
              } else if (previousOperation === '-') {
                addEOFNL = true;
              }
            }
          }
        } // Handle EOFNL insertion/removal


        if (removeEOFNL) {
          while (!lines[lines.length - 1]) {
            lines.pop();
            delimiters.pop();
          }
        } else if (addEOFNL) {
          lines.push('');
          delimiters.push('\n');
        }

        for (let _k = 0; _k < lines.length - 1; _k++) {
          lines[_k] = lines[_k] + delimiters[_k];
        }

        return lines.join('');
      } // Wrapper that supports multiple file patches via callbacks.

      function applyPatches(uniDiff, options) {
        if (typeof uniDiff === 'string') {
          uniDiff = parsePatch(uniDiff);
        }

        let currentIndex = 0;

        function processIndex() {
          const index = uniDiff[currentIndex++];

          if (!index) {
            return options.complete();
          }

          options.loadFile(index, function (err, data) {
            if (err) {
              return options.complete(err);
            }

            const updatedContent = applyPatch(data, index, options);
            options.patched(index, updatedContent, function (err) {
              if (err) {
                return options.complete(err);
              }

              processIndex();
            });
          });
        }

        processIndex();
      }

      function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
        if (!options) {
          options = {};
        }

        if (typeof options.context === 'undefined') {
          options.context = 4;
        }

        const diff = diffLines(oldStr, newStr, options);

        if (!diff) {
          return;
        }

        diff.push({
          value: '',
          lines: []
        }); // Append an empty value to make cleanup easier

        function contextLines(lines) {
          return lines.map(function (entry) {
            return ' ' + entry;
          });
        }

        const hunks = [];
        let oldRangeStart = 0,
          newRangeStart = 0,
          curRange = [],
          oldLine = 1,
          newLine = 1;

        const _loop = function _loop(i) {
          const current = diff[i],
            lines = current.lines || current.value.replace(/\n$/, '').split('\n');
          current.lines = lines;

          if (current.added || current.removed) {
            let _curRange;

      // If we have previous context, start with that
            if (!oldRangeStart) {
              const prev = diff[i - 1];
              oldRangeStart = oldLine;
              newRangeStart = newLine;

              if (prev) {
                curRange = options.context > 0 ? contextLines(prev.lines.slice(-options.context)) : [];
                oldRangeStart -= curRange.length;
                newRangeStart -= curRange.length;
              }
            } // Output our changes


            (_curRange = curRange).push.apply(_curRange, _toConsumableArray(lines.map(function (entry) {
              return (current.added ? '+' : '-') + entry;
            }))); // Track the updated file position


            if (current.added) {
              newLine += lines.length;
            } else {
              oldLine += lines.length;
            }
          } else {
      // Identical context lines. Track line changes
            if (oldRangeStart) {
        // Close out any changes that have been output (or join overlapping)
              if (lines.length <= options.context * 2 && i < diff.length - 2) {
                let _curRange2;

          // Overlapping
                (_curRange2 = curRange).push.apply(_curRange2, _toConsumableArray(contextLines(lines)));
              } else {
                let _curRange3;

          // end the range and output
                const contextSize = Math.min(lines.length, options.context);

                (_curRange3 = curRange).push.apply(_curRange3, _toConsumableArray(contextLines(lines.slice(0, contextSize))));

                const hunk = {
                  oldStart: oldRangeStart,
                  oldLines: oldLine - oldRangeStart + contextSize,
                  newStart: newRangeStart,
                  newLines: newLine - newRangeStart + contextSize,
                  lines: curRange
                };

                if (i >= diff.length - 2 && lines.length <= options.context) {
            // EOF is inside this hunk
                  const oldEOFNewline = /\n$/.test(oldStr);
                  const newEOFNewline = /\n$/.test(newStr);
                  const noNlBeforeAdds = lines.length == 0 && curRange.length > hunk.oldLines;

                  if (!oldEOFNewline && noNlBeforeAdds && oldStr.length > 0) {
              // special case: old has no eol and no trailing context; no-nl can end up before adds
              // however, if the old file is empty, do not output the no-nl line
                    curRange.splice(hunk.oldLines, 0, '\\ No newline at end of file');
                  }

                  if (!oldEOFNewline && !noNlBeforeAdds || !newEOFNewline) {
                    curRange.push('\\ No newline at end of file');
                  }
                }

                hunks.push(hunk);
                oldRangeStart = 0;
                newRangeStart = 0;
                curRange = [];
              }
            }

            oldLine += lines.length;
            newLine += lines.length;
          }
        };

        for (let i = 0; i < diff.length; i++) {
          _loop(i);
        }

        return {
          oldFileName: oldFileName,
          newFileName: newFileName,
          oldHeader: oldHeader,
          newHeader: newHeader,
          hunks: hunks
        };
      }
      function formatPatch(diff) {
        if (Array.isArray(diff)) {
          return diff.map(formatPatch).join('\n');
        }

        const ret = [];

        if (diff.oldFileName == diff.newFileName) {
          ret.push('Index: ' + diff.oldFileName);
        }

        ret.push('===================================================================');
        ret.push('--- ' + diff.oldFileName + (typeof diff.oldHeader === 'undefined' ? '' : '\t' + diff.oldHeader));
        ret.push('+++ ' + diff.newFileName + (typeof diff.newHeader === 'undefined' ? '' : '\t' + diff.newHeader));

        for (let i = 0; i < diff.hunks.length; i++) {
          const hunk = diff.hunks[i]; // Unified Diff Format quirk: If the chunk size is 0,
    // the first number is one lower than one would expect.
    // https://www.artima.com/weblogs/viewpost.jsp?thread=164293

          if (hunk.oldLines === 0) {
            hunk.oldStart -= 1;
          }

          if (hunk.newLines === 0) {
            hunk.newStart -= 1;
          }

          ret.push('@@ -' + hunk.oldStart + ',' + hunk.oldLines + ' +' + hunk.newStart + ',' + hunk.newLines + ' @@');
          ret.push.apply(ret, hunk.lines);
        }

        return ret.join('\n') + '\n';
      }
      function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
        return formatPatch(structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options));
      }
      function createPatch(fileName, oldStr, newStr, oldHeader, newHeader, options) {
        return createTwoFilesPatch(fileName, fileName, oldStr, newStr, oldHeader, newHeader, options);
      }

      function arrayEqual(a, b) {
        if (a.length !== b.length) {
          return false;
        }

        return arrayStartsWith(a, b);
      }
      function arrayStartsWith(array, start) {
        if (start.length > array.length) {
          return false;
        }

        for (let i = 0; i < start.length; i++) {
          if (start[i] !== array[i]) {
            return false;
          }
        }

        return true;
      }

      function calcLineCount(hunk) {
        const _calcOldNewLineCount = calcOldNewLineCount(hunk.lines),
          oldLines = _calcOldNewLineCount.oldLines,
          newLines = _calcOldNewLineCount.newLines;

        if (oldLines !== undefined) {
          hunk.oldLines = oldLines;
        } else {
          delete hunk.oldLines;
        }

        if (newLines !== undefined) {
          hunk.newLines = newLines;
        } else {
          delete hunk.newLines;
        }
      }
      function merge(mine, theirs, base) {
        mine = loadPatch(mine, base);
        theirs = loadPatch(theirs, base);
        const ret = {}; // For index we just let it pass through as it doesn't have any necessary meaning.
  // Leaving sanity checks on this to the API consumer that may know more about the
  // meaning in their own context.

        if (mine.index || theirs.index) {
          ret.index = mine.index || theirs.index;
        }

        if (mine.newFileName || theirs.newFileName) {
          if (!fileNameChanged(mine)) {
      // No header or no change in ours, use theirs (and ours if theirs does not exist)
            ret.oldFileName = theirs.oldFileName || mine.oldFileName;
            ret.newFileName = theirs.newFileName || mine.newFileName;
            ret.oldHeader = theirs.oldHeader || mine.oldHeader;
            ret.newHeader = theirs.newHeader || mine.newHeader;
          } else if (!fileNameChanged(theirs)) {
      // No header or no change in theirs, use ours
            ret.oldFileName = mine.oldFileName;
            ret.newFileName = mine.newFileName;
            ret.oldHeader = mine.oldHeader;
            ret.newHeader = mine.newHeader;
          } else {
      // Both changed... figure it out
            ret.oldFileName = selectField(ret, mine.oldFileName, theirs.oldFileName);
            ret.newFileName = selectField(ret, mine.newFileName, theirs.newFileName);
            ret.oldHeader = selectField(ret, mine.oldHeader, theirs.oldHeader);
            ret.newHeader = selectField(ret, mine.newHeader, theirs.newHeader);
          }
        }

        ret.hunks = [];
        let mineIndex = 0,
          theirsIndex = 0,
          mineOffset = 0,
          theirsOffset = 0;

        while (mineIndex < mine.hunks.length || theirsIndex < theirs.hunks.length) {
          const mineCurrent = mine.hunks[mineIndex] || {
              oldStart: Infinity
            },
            theirsCurrent = theirs.hunks[theirsIndex] || {
              oldStart: Infinity
            };

          if (hunkBefore(mineCurrent, theirsCurrent)) {
      // This patch does not overlap with any of the others, yay.
            ret.hunks.push(cloneHunk(mineCurrent, mineOffset));
            mineIndex++;
            theirsOffset += mineCurrent.newLines - mineCurrent.oldLines;
          } else if (hunkBefore(theirsCurrent, mineCurrent)) {
      // This patch does not overlap with any of the others, yay.
            ret.hunks.push(cloneHunk(theirsCurrent, theirsOffset));
            theirsIndex++;
            mineOffset += theirsCurrent.newLines - theirsCurrent.oldLines;
          } else {
      // Overlap, merge as best we can
            const mergedHunk = {
              oldStart: Math.min(mineCurrent.oldStart, theirsCurrent.oldStart),
              oldLines: 0,
              newStart: Math.min(mineCurrent.newStart + mineOffset, theirsCurrent.oldStart + theirsOffset),
              newLines: 0,
              lines: []
            };
            mergeLines(mergedHunk, mineCurrent.oldStart, mineCurrent.lines, theirsCurrent.oldStart, theirsCurrent.lines);
            theirsIndex++;
            mineIndex++;
            ret.hunks.push(mergedHunk);
          }
        }

        return ret;
      }

      function loadPatch(param, base) {
        if (typeof param === 'string') {
          if (/^@@/m.test(param) || /^Index:/m.test(param)) {
            return parsePatch(param)[0];
          }

          if (!base) {
            throw new Error('Must provide a base reference or pass in a patch');
          }

          return structuredPatch(undefined, undefined, base, param);
        }

        return param;
      }

      function fileNameChanged(patch) {
        return patch.newFileName && patch.newFileName !== patch.oldFileName;
      }

      function selectField(index, mine, theirs) {
        if (mine === theirs) {
          return mine;
        } else {
          index.conflict = true;
          return {
            mine: mine,
            theirs: theirs
          };
        }
      }

      function hunkBefore(test, check) {
        return test.oldStart < check.oldStart && test.oldStart + test.oldLines < check.oldStart;
      }

      function cloneHunk(hunk, offset) {
        return {
          oldStart: hunk.oldStart,
          oldLines: hunk.oldLines,
          newStart: hunk.newStart + offset,
          newLines: hunk.newLines,
          lines: hunk.lines
        };
      }

      function mergeLines(hunk, mineOffset, mineLines, theirOffset, theirLines) {
  // This will generally result in a conflicted hunk, but there are cases where the context
  // is the only overlap where we can successfully merge the content here.
        const mine = {
            offset: mineOffset,
            lines: mineLines,
            index: 0
          },
          their = {
            offset: theirOffset,
            lines: theirLines,
            index: 0
          }; // Handle any leading content

        insertLeading(hunk, mine, their);
        insertLeading(hunk, their, mine); // Now in the overlap content. Scan through and select the best changes from each.

        while (mine.index < mine.lines.length && their.index < their.lines.length) {
          const mineCurrent = mine.lines[mine.index],
            theirCurrent = their.lines[their.index];

          if ((mineCurrent[0] === '-' || mineCurrent[0] === '+') && (theirCurrent[0] === '-' || theirCurrent[0] === '+')) {
      // Both modified ...
            mutualChange(hunk, mine, their);
          } else if (mineCurrent[0] === '+' && theirCurrent[0] === ' ') {
            var _hunk$lines;

      // Mine inserted
            (_hunk$lines = hunk.lines).push.apply(_hunk$lines, _toConsumableArray(collectChange(mine)));
          } else if (theirCurrent[0] === '+' && mineCurrent[0] === ' ') {
            var _hunk$lines2;

      // Theirs inserted
            (_hunk$lines2 = hunk.lines).push.apply(_hunk$lines2, _toConsumableArray(collectChange(their)));
          } else if (mineCurrent[0] === '-' && theirCurrent[0] === ' ') {
      // Mine removed or edited
            removal(hunk, mine, their);
          } else if (theirCurrent[0] === '-' && mineCurrent[0] === ' ') {
      // Their removed or edited
            removal(hunk, their, mine, true);
          } else if (mineCurrent === theirCurrent) {
      // Context identity
            hunk.lines.push(mineCurrent);
            mine.index++;
            their.index++;
          } else {
      // Context mismatch
            conflict(hunk, collectChange(mine), collectChange(their));
          }
        } // Now push anything that may be remaining


        insertTrailing(hunk, mine);
        insertTrailing(hunk, their);
        calcLineCount(hunk);
      }

      function mutualChange(hunk, mine, their) {
        const myChanges = collectChange(mine),
          theirChanges = collectChange(their);

        if (allRemoves(myChanges) && allRemoves(theirChanges)) {
    // Special case for remove changes that are supersets of one another
          if (arrayStartsWith(myChanges, theirChanges) && skipRemoveSuperset(their, myChanges, myChanges.length - theirChanges.length)) {
            let _hunk$lines3;

            (_hunk$lines3 = hunk.lines).push.apply(_hunk$lines3, _toConsumableArray(myChanges));

            return;
          } else if (arrayStartsWith(theirChanges, myChanges) && skipRemoveSuperset(mine, theirChanges, theirChanges.length - myChanges.length)) {
            let _hunk$lines4;

            (_hunk$lines4 = hunk.lines).push.apply(_hunk$lines4, _toConsumableArray(theirChanges));

            return;
          }
        } else if (arrayEqual(myChanges, theirChanges)) {
          let _hunk$lines5;

          (_hunk$lines5 = hunk.lines).push.apply(_hunk$lines5, _toConsumableArray(myChanges));

          return;
        }

        conflict(hunk, myChanges, theirChanges);
      }

      function removal(hunk, mine, their, swap) {
        const myChanges = collectChange(mine),
          theirChanges = collectContext(their, myChanges);

        if (theirChanges.merged) {
          let _hunk$lines6;

          (_hunk$lines6 = hunk.lines).push.apply(_hunk$lines6, _toConsumableArray(theirChanges.merged));
        } else {
          conflict(hunk, swap ? theirChanges : myChanges, swap ? myChanges : theirChanges);
        }
      }

      function conflict(hunk, mine, their) {
        hunk.conflict = true;
        hunk.lines.push({
          conflict: true,
          mine: mine,
          theirs: their
        });
      }

      function insertLeading(hunk, insert, their) {
        while (insert.offset < their.offset && insert.index < insert.lines.length) {
          const line = insert.lines[insert.index++];
          hunk.lines.push(line);
          insert.offset++;
        }
      }

      function insertTrailing(hunk, insert) {
        while (insert.index < insert.lines.length) {
          const line = insert.lines[insert.index++];
          hunk.lines.push(line);
        }
      }

      function collectChange(state) {
        let ret = [],
          operation = state.lines[state.index][0];

        while (state.index < state.lines.length) {
          const line = state.lines[state.index]; // Group additions that are immediately after subtractions and treat them as one "atomic" modify change.

          if (operation === '-' && line[0] === '+') {
            operation = '+';
          }

          if (operation === line[0]) {
            ret.push(line);
            state.index++;
          } else {
            break;
          }
        }

        return ret;
      }

      function collectContext(state, matchChanges) {
        let changes = [],
          merged = [],
          matchIndex = 0,
          contextChanges = false,
          conflicted = false;

        while (matchIndex < matchChanges.length && state.index < state.lines.length) {
          let change = state.lines[state.index],
            match = matchChanges[matchIndex]; // Once we've hit our add, then we are done

          if (match[0] === '+') {
            break;
          }

          contextChanges = contextChanges || change[0] !== ' ';
          merged.push(match);
          matchIndex++; // Consume any additions in the other block as a conflict to attempt
    // to pull in the remaining context after this

          if (change[0] === '+') {
            conflicted = true;

            while (change[0] === '+') {
              changes.push(change);
              change = state.lines[++state.index];
            }
          }

          if (match.substr(1) === change.substr(1)) {
            changes.push(change);
            state.index++;
          } else {
            conflicted = true;
          }
        }

        if ((matchChanges[matchIndex] || '')[0] === '+' && contextChanges) {
          conflicted = true;
        }

        if (conflicted) {
          return changes;
        }

        while (matchIndex < matchChanges.length) {
          merged.push(matchChanges[matchIndex++]);
        }

        return {
          merged: merged,
          changes: changes
        };
      }

      function allRemoves(changes) {
        return changes.reduce(function (prev, change) {
          return prev && change[0] === '-';
        }, true);
      }

      function skipRemoveSuperset(state, removeChanges, delta) {
        for (let i = 0; i < delta; i++) {
          const changeContent = removeChanges[removeChanges.length - delta + i].substr(1);

          if (state.lines[state.index + i] !== ' ' + changeContent) {
            return false;
          }
        }

        state.index += delta;
        return true;
      }

      function calcOldNewLineCount(lines) {
        let oldLines = 0;
        let newLines = 0;
        lines.forEach(function (line) {
          if (typeof line !== 'string') {
            const myCount = calcOldNewLineCount(line.mine);
            const theirCount = calcOldNewLineCount(line.theirs);

            if (oldLines !== undefined) {
              if (myCount.oldLines === theirCount.oldLines) {
                oldLines += myCount.oldLines;
              } else {
                oldLines = undefined;
              }
            }

            if (newLines !== undefined) {
              if (myCount.newLines === theirCount.newLines) {
                newLines += myCount.newLines;
              } else {
                newLines = undefined;
              }
            }
          } else {
            if (newLines !== undefined && (line[0] === '+' || line[0] === ' ')) {
              newLines++;
            }

            if (oldLines !== undefined && (line[0] === '-' || line[0] === ' ')) {
              oldLines++;
            }
          }
        });
        return {
          oldLines: oldLines,
          newLines: newLines
        };
      }

      function reversePatch(structuredPatch) {
        if (Array.isArray(structuredPatch)) {
          return structuredPatch.map(reversePatch).reverse();
        }

        return _objectSpread2(_objectSpread2({}, structuredPatch), {}, {
          oldFileName: structuredPatch.newFileName,
          oldHeader: structuredPatch.newHeader,
          newFileName: structuredPatch.oldFileName,
          newHeader: structuredPatch.oldHeader,
          hunks: structuredPatch.hunks.map(function (hunk) {
            return {
              oldLines: hunk.newLines,
              oldStart: hunk.newStart,
              newLines: hunk.oldLines,
              newStart: hunk.oldStart,
              linedelimiters: hunk.linedelimiters,
              lines: hunk.lines.map(function (l) {
                if (l.startsWith('-')) {
                  return "+".concat(l.slice(1));
                }

                if (l.startsWith('+')) {
                  return "-".concat(l.slice(1));
                }

                return l;
              })
            };
          })
        });
      }

// See: http://code.google.com/p/google-diff-match-patch/wiki/API
      function convertChangesToDMP(changes) {
        let ret = [],
          change,
          operation;

        for (let i = 0; i < changes.length; i++) {
          change = changes[i];

          if (change.added) {
            operation = 1;
          } else if (change.removed) {
            operation = -1;
          } else {
            operation = 0;
          }

          ret.push([operation, change.value]);
        }

        return ret;
      }

      function convertChangesToXML(changes) {
        const ret = [];

        for (let i = 0; i < changes.length; i++) {
          const change = changes[i];

          if (change.added) {
            ret.push('<ins>');
          } else if (change.removed) {
            ret.push('<del>');
          }

          ret.push(escapeHTML(change.value));

          if (change.added) {
            ret.push('</ins>');
          } else if (change.removed) {
            ret.push('</del>');
          }
        }

        return ret.join('');
      }

      function escapeHTML(s) {
        let n = s;
        n = n.replace(/&/g, '&amp;');
        n = n.replace(/</g, '&lt;');
        n = n.replace(/>/g, '&gt;');
        n = n.replace(/"/g, '&quot;');
        return n;
      }




/***/ }),

/***/ "./node_modules/extend/index.js":
/*!**************************************!*\
  !*** ./node_modules/extend/index.js ***!
  \**************************************/
/***/ ((module) => {

      "use strict";


      const hasOwn = Object.prototype.hasOwnProperty;
      const toStr = Object.prototype.toString;
      const defineProperty = Object.defineProperty;
      const gOPD = Object.getOwnPropertyDescriptor;

      const isArray = function isArray(arr) {
        if (typeof Array.isArray === 'function') {
          return Array.isArray(arr);
        }

        return toStr.call(arr) === '[object Array]';
      };

      const isPlainObject = function isPlainObject(obj) {
        if (!obj || toStr.call(obj) !== '[object Object]') {
          return false;
        }

        const hasOwnConstructor = hasOwn.call(obj, 'constructor');
        const hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
        if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
          return false;
        }

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
        let key;
        for (key in obj) { /**/ }

        return typeof key === 'undefined' || hasOwn.call(obj, key);
      };

// If name is '__proto__', and Object.defineProperty is available, define __proto__ as an own property on target
      const setProperty = function setProperty(target, options) {
        if (defineProperty && options.name === '__proto__') {
          defineProperty(target, options.name, {
            enumerable: true,
            configurable: true,
            value: options.newValue,
            writable: true
          });
        } else {
          target[options.name] = options.newValue;
        }
      };

// Return undefined instead of __proto__ if '__proto__' is not an own property
      const getProperty = function getProperty(obj, name) {
        if (name === '__proto__') {
          if (!hasOwn.call(obj, name)) {
            return void 0;
          } else if (gOPD) {
			// In early versions of node, obj['__proto__'] is buggy when obj has
			// __proto__ as an own property. Object.getOwnPropertyDescriptor() works.
            return gOPD(obj, name).value;
          }
        }

        return obj[name];
      };

      module.exports = function extend() {
        let options, name, src, copy, copyIsArray, clone;
        let target = arguments[0];
        let i = 1;
        const length = arguments.length;
        let deep = false;

	// Handle a deep copy situation
        if (typeof target === 'boolean') {
          deep = target;
          target = arguments[1] || {};
		// skip the boolean and the target
          i = 2;
        }
        if (target == null || (typeof target !== 'object' && typeof target !== 'function')) {
          target = {};
        }

        for (; i < length; ++i) {
          options = arguments[i];
		// Only deal with non-null/undefined values
          if (options != null) {
			// Extend the base object
            for (name in options) {
              src = getProperty(target, name);
              copy = getProperty(options, name);

				// Prevent never-ending loop
              if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
                if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
                  if (copyIsArray) {
                    copyIsArray = false;
                    clone = src && isArray(src) ? src : [];
                  } else {
                    clone = src && isPlainObject(src) ? src : {};
                  }

						// Never move original objects, clone them
                  setProperty(target, { name: name, newValue: extend(deep, clone, copy) });

					// Don't bring in undefined values
                } else if (typeof copy !== 'undefined') {
                  setProperty(target, { name: name, newValue: copy });
                }
              }
            }
          }
        }

	// Return the modified object
        return target;
      };


/***/ }),

/***/ "./node_modules/hast-util-whitespace/index.js":
/*!****************************************************!*\
  !*** ./node_modules/hast-util-whitespace/index.js ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   whitespace: () => (/* binding */ whitespace)
/* harmony export */ });
/**
 * Check if the given value is *inter-element whitespace*.
 *
 * @param {unknown} thing
 *   Thing to check (typically `Node` or `string`).
 * @returns {boolean}
 *   Whether the `value` is inter-element whitespace (`boolean`): consisting of
 *   zero or more of space, tab (`\t`), line feed (`\n`), carriage return
 *   (`\r`), or form feed (`\f`).
 *   If a node is passed it must be a `Text` node, whose `value` field is
 *   checked.
 */
      function whitespace(thing) {
  /** @type {string} */
        const value =
    // @ts-expect-error looks like a node.
    thing && typeof thing === 'object' && thing.type === 'text'
      ? // @ts-expect-error looks like a text.
      thing.value || ''
      : thing

  // HTML whitespace expression.
  // See <https://infra.spec.whatwg.org/#ascii-whitespace>.
        return typeof value === 'string' && value.replace(/[ \t\n\f\r]/g, '') === ''
      }


/***/ }),

/***/ "./node_modules/inline-style-parser/index.js":
/*!***************************************************!*\
  !*** ./node_modules/inline-style-parser/index.js ***!
  \***************************************************/
/***/ ((module) => {

// http://www.w3.org/TR/CSS21/grammar.html
// https://github.com/visionmedia/css-parse/pull/49#issuecomment-30088027
      const COMMENT_REGEX = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g;

      const NEWLINE_REGEX = /\n/g;
      const WHITESPACE_REGEX = /^\s*/;

// declaration
      const PROPERTY_REGEX = /^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/;
      const COLON_REGEX = /^:\s*/;
      const VALUE_REGEX = /^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/;
      const SEMICOLON_REGEX = /^[;\s]*/;

// https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/Trim#Polyfill
      const TRIM_REGEX = /^\s+|\s+$/g;

// strings
      const NEWLINE = '\n';
      const FORWARD_SLASH = '/';
      const ASTERISK = '*';
      const EMPTY_STRING = '';

// types
      const TYPE_COMMENT = 'comment';
      const TYPE_DECLARATION = 'declaration';

/**
 * @param {String} style
 * @param {Object} [options]
 * @return {Object[]}
 * @throws {TypeError}
 * @throws {Error}
 */
      module.exports = function(style, options) {
        if (typeof style !== 'string') {
          throw new TypeError('First argument must be a string');
        }

        if (!style) return [];

        options = options || {};

  /**
   * Positional.
   */
        let lineno = 1;
        let column = 1;

  /**
   * Update lineno and column based on `str`.
   *
   * @param {String} str
   */
        function updatePosition(str) {
          const lines = str.match(NEWLINE_REGEX);
          if (lines) lineno += lines.length;
          const i = str.lastIndexOf(NEWLINE);
          column = ~i ? str.length - i : column + str.length;
        }

  /**
   * Mark position and patch `node.position`.
   *
   * @return {Function}
   */
        function position() {
          const start = { line: lineno, column: column };
          return function(node) {
            node.position = new Position(start);
            whitespace();
            return node;
          };
        }

  /**
   * Store position information for a node.
   *
   * @constructor
   * @property {Object} start
   * @property {Object} end
   * @property {undefined|String} source
   */
        function Position(start) {
          this.start = start;
          this.end = { line: lineno, column: column };
          this.source = options.source;
        }

  /**
   * Non-enumerable source string.
   */
        Position.prototype.content = style;

        const errorsList = [];

  /**
   * Error `msg`.
   *
   * @param {String} msg
   * @throws {Error}
   */
        function error(msg) {
          const err = new Error(
            options.source + ':' + lineno + ':' + column + ': ' + msg
          );
          err.reason = msg;
          err.filename = options.source;
          err.line = lineno;
          err.column = column;
          err.source = style;

          if (options.silent) {
            errorsList.push(err);
          } else {
            throw err;
          }
        }

  /**
   * Match `re` and return captures.
   *
   * @param {RegExp} re
   * @return {undefined|Array}
   */
        function match(re) {
          const m = re.exec(style);
          if (!m) return;
          const str = m[0];
          updatePosition(str);
          style = style.slice(str.length);
          return m;
        }

  /**
   * Parse whitespace.
   */
        function whitespace() {
          match(WHITESPACE_REGEX);
        }

  /**
   * Parse comments.
   *
   * @param {Object[]} [rules]
   * @return {Object[]}
   */
        function comments(rules) {
          let c;
          rules = rules || [];
          while ((c = comment())) {
            if (c !== false) {
              rules.push(c);
            }
          }
          return rules;
        }

  /**
   * Parse comment.
   *
   * @return {Object}
   * @throws {Error}
   */
        function comment() {
          const pos = position();
          if (FORWARD_SLASH != style.charAt(0) || ASTERISK != style.charAt(1)) return;

          let i = 2;
          while (
            EMPTY_STRING != style.charAt(i) &&
      (ASTERISK != style.charAt(i) || FORWARD_SLASH != style.charAt(i + 1))
          ) {
            ++i;
          }
          i += 2;

          if (EMPTY_STRING === style.charAt(i - 1)) {
            return error('End of comment missing');
          }

          const str = style.slice(2, i - 2);
          column += 2;
          updatePosition(str);
          style = style.slice(i);
          column += 2;

          return pos({
            type: TYPE_COMMENT,
            comment: str
          });
        }

  /**
   * Parse declaration.
   *
   * @return {Object}
   * @throws {Error}
   */
        function declaration() {
          const pos = position();

    // prop
          const prop = match(PROPERTY_REGEX);
          if (!prop) return;
          comment();

    // :
          if (!match(COLON_REGEX)) return error("property missing ':'");

    // val
          const val = match(VALUE_REGEX);

          const ret = pos({
            type: TYPE_DECLARATION,
            property: trim(prop[0].replace(COMMENT_REGEX, EMPTY_STRING)),
            value: val
              ? trim(val[0].replace(COMMENT_REGEX, EMPTY_STRING))
              : EMPTY_STRING
          });

    // ;
          match(SEMICOLON_REGEX);

          return ret;
        }

  /**
   * Parse declarations.
   *
   * @return {Object[]}
   */
        function declarations() {
          const decls = [];

          comments(decls);

    // declarations
          let decl;
          while ((decl = declaration())) {
            if (decl !== false) {
              decls.push(decl);
              comments(decls);
            }
          }

          return decls;
        }

        whitespace();
        return declarations();
      };

/**
 * Trim `str`.
 *
 * @param {String} str
 * @return {String}
 */
      function trim(str) {
        return str ? str.replace(TRIM_REGEX, EMPTY_STRING) : EMPTY_STRING;
      }


/***/ }),

/***/ "./node_modules/is-buffer/index.js":
/*!*****************************************!*\
  !*** ./node_modules/is-buffer/index.js ***!
  \*****************************************/
/***/ ((module) => {

/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

      module.exports = function isBuffer (obj) {
        return obj != null && obj.constructor != null &&
    typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
      }


/***/ }),

/***/ "./node_modules/is-plain-obj/index.js":
/*!********************************************!*\
  !*** ./node_modules/is-plain-obj/index.js ***!
  \********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ isPlainObject)
/* harmony export */ });
      function isPlainObject(value) {
        if (typeof value !== 'object' || value === null) {
          return false;
        }

        const prototype = Object.getPrototypeOf(value);
        return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
      }


/***/ }),

/***/ "./node_modules/kleur/index.mjs":
/*!**************************************!*\
  !*** ./node_modules/kleur/index.mjs ***!
  \**************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });


      let FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM, isTTY=true;
      if (typeof process !== 'undefined') {
        ({ FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env || {});
        isTTY = process.stdout && process.stdout.isTTY;
      }

      const $ = {
        enabled: !NODE_DISABLE_COLORS && NO_COLOR == null && TERM !== 'dumb' && (
          FORCE_COLOR != null && FORCE_COLOR !== '0' || isTTY
        ),

	// modifiers
        reset: init(0, 0),
        bold: init(1, 22),
        dim: init(2, 22),
        italic: init(3, 23),
        underline: init(4, 24),
        inverse: init(7, 27),
        hidden: init(8, 28),
        strikethrough: init(9, 29),

	// colors
        black: init(30, 39),
        red: init(31, 39),
        green: init(32, 39),
        yellow: init(33, 39),
        blue: init(34, 39),
        magenta: init(35, 39),
        cyan: init(36, 39),
        white: init(37, 39),
        gray: init(90, 39),
        grey: init(90, 39),

	// background colors
        bgBlack: init(40, 49),
        bgRed: init(41, 49),
        bgGreen: init(42, 49),
        bgYellow: init(43, 49),
        bgBlue: init(44, 49),
        bgMagenta: init(45, 49),
        bgCyan: init(46, 49),
        bgWhite: init(47, 49)
      };

      function run(arr, str) {
        let i=0, tmp, beg='', end='';
        for (; i < arr.length; i++) {
          tmp = arr[i];
          beg += tmp.open;
          end += tmp.close;
          if (!!~str.indexOf(tmp.close)) {
            str = str.replace(tmp.rgx, tmp.close + tmp.open);
          }
        }
        return beg + str + end;
      }

      function chain(has, keys) {
        const ctx = { has, keys };

        ctx.reset = $.reset.bind(ctx);
        ctx.bold = $.bold.bind(ctx);
        ctx.dim = $.dim.bind(ctx);
        ctx.italic = $.italic.bind(ctx);
        ctx.underline = $.underline.bind(ctx);
        ctx.inverse = $.inverse.bind(ctx);
        ctx.hidden = $.hidden.bind(ctx);
        ctx.strikethrough = $.strikethrough.bind(ctx);

        ctx.black = $.black.bind(ctx);
        ctx.red = $.red.bind(ctx);
        ctx.green = $.green.bind(ctx);
        ctx.yellow = $.yellow.bind(ctx);
        ctx.blue = $.blue.bind(ctx);
        ctx.magenta = $.magenta.bind(ctx);
        ctx.cyan = $.cyan.bind(ctx);
        ctx.white = $.white.bind(ctx);
        ctx.gray = $.gray.bind(ctx);
        ctx.grey = $.grey.bind(ctx);

        ctx.bgBlack = $.bgBlack.bind(ctx);
        ctx.bgRed = $.bgRed.bind(ctx);
        ctx.bgGreen = $.bgGreen.bind(ctx);
        ctx.bgYellow = $.bgYellow.bind(ctx);
        ctx.bgBlue = $.bgBlue.bind(ctx);
        ctx.bgMagenta = $.bgMagenta.bind(ctx);
        ctx.bgCyan = $.bgCyan.bind(ctx);
        ctx.bgWhite = $.bgWhite.bind(ctx);

        return ctx;
      }

      function init(open, close) {
        const blk = {
          open: `\x1b[${open}m`,
          close: `\x1b[${close}m`,
          rgx: new RegExp(`\\x1b\\[${close}m`, 'g')
        };
        return function (txt) {
          if (this !== void 0 && this.has !== void 0) {
            !!~this.has.indexOf(open) || (this.has.push(open),this.keys.push(blk));
            return txt === void 0 ? this : $.enabled ? run(this.keys, txt+'') : txt+'';
          }
          return txt === void 0 ? chain([open], [blk]) : $.enabled ? run([blk], txt+'') : txt+'';
        };
      }

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ($);


/***/ }),

/***/ "./node_modules/mdast-util-definitions/lib/index.js":
/*!**********************************************************!*\
  !*** ./node_modules/mdast-util-definitions/lib/index.js ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   definitions: () => (/* binding */ definitions)
/* harmony export */ });
/* harmony import */ const unist_util_visit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-util-visit */ "./node_modules/unist-util-visit/lib/index.js");
/**
 * @typedef {import('mdast').Root} Root
 * @typedef {import('mdast').Content} Content
 * @typedef {import('mdast').Definition} Definition
 */

/**
 * @typedef {Root | Content} Node
 *
 * @callback GetDefinition
 *   Get a definition by identifier.
 * @param {string | null | undefined} [identifier]
 *   Identifier of definition.
 * @returns {Definition | null}
 *   Definition corresponding to `identifier` or `null`.
 */



      const own = {}.hasOwnProperty

/**
 * Find definitions in `tree`.
 *
 * Uses CommonMark precedence, which means that earlier definitions are
 * preferred over duplicate later definitions.
 *
 * @param {Node} tree
 *   Tree to check.
 * @returns {GetDefinition}
 *   Getter.
 */
      function definitions(tree) {
  /** @type {Record<string, Definition>} */
        const cache = Object.create(null)

        if (!tree || !tree.type) {
          throw new Error('mdast-util-definitions expected node')
        }

        (0,unist_util_visit__WEBPACK_IMPORTED_MODULE_0__.visit)(tree, 'definition', (definition) => {
          const id = clean(definition.identifier)
          if (id && !own.call(cache, id)) {
            cache[id] = definition
          }
        })

        return definition

  /** @type {GetDefinition} */
        function definition(identifier) {
          const id = clean(identifier)
    // To do: next major: return `undefined` when not found.
          return id && own.call(cache, id) ? cache[id] : null
        }
      }

/**
 * @param {string | null | undefined} [value]
 * @returns {string}
 */
      function clean(value) {
        return String(value || '').toUpperCase()
      }


/***/ }),

/***/ "./node_modules/mdast-util-from-markdown/dev/lib/index.js":
/*!****************************************************************!*\
  !*** ./node_modules/mdast-util-from-markdown/dev/lib/index.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromMarkdown: () => (/* binding */ fromMarkdown)
/* harmony export */ });
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/* harmony import */ const mdast_util_to_string__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! mdast-util-to-string */ "./node_modules/mdast-util-to-string/lib/index.js");
/* harmony import */ const micromark_lib_parse_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark/lib/parse.js */ "./node_modules/micromark/dev/lib/parse.js");
/* harmony import */ const micromark_lib_preprocess_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark/lib/preprocess.js */ "./node_modules/micromark/dev/lib/preprocess.js");
/* harmony import */ const micromark_lib_postprocess_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark/lib/postprocess.js */ "./node_modules/micromark/dev/lib/postprocess.js");
/* harmony import */ const micromark_util_decode_numeric_character_reference__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-util-decode-numeric-character-reference */ "./node_modules/micromark-util-decode-numeric-character-reference/dev/index.js");
/* harmony import */ const micromark_util_decode_string__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! micromark-util-decode-string */ "./node_modules/micromark-util-decode-string/dev/index.js");
/* harmony import */ const micromark_util_normalize_identifier__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! micromark-util-normalize-identifier */ "./node_modules/micromark-util-normalize-identifier/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const decode_named_character_reference__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! decode-named-character-reference */ "./node_modules/decode-named-character-reference/index.dom.js");
/* harmony import */ const unist_util_stringify_position__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! unist-util-stringify-position */ "./node_modules/unist-util-stringify-position/lib/index.js");
/**
 * @typedef {import('micromark-util-types').Encoding} Encoding
 * @typedef {import('micromark-util-types').Event} Event
 * @typedef {import('micromark-util-types').ParseOptions} ParseOptions
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Value} Value
 *
 * @typedef {import('unist').Parent} UnistParent
 * @typedef {import('unist').Point} Point
 *
 * @typedef {import('mdast').PhrasingContent} PhrasingContent
 * @typedef {import('mdast').StaticPhrasingContent} StaticPhrasingContent
 * @typedef {import('mdast').Content} Content
 * @typedef {import('mdast').Break} Break
 * @typedef {import('mdast').Blockquote} Blockquote
 * @typedef {import('mdast').Code} Code
 * @typedef {import('mdast').Definition} Definition
 * @typedef {import('mdast').Emphasis} Emphasis
 * @typedef {import('mdast').Heading} Heading
 * @typedef {import('mdast').HTML} HTML
 * @typedef {import('mdast').Image} Image
 * @typedef {import('mdast').ImageReference} ImageReference
 * @typedef {import('mdast').InlineCode} InlineCode
 * @typedef {import('mdast').Link} Link
 * @typedef {import('mdast').LinkReference} LinkReference
 * @typedef {import('mdast').List} List
 * @typedef {import('mdast').ListItem} ListItem
 * @typedef {import('mdast').Paragraph} Paragraph
 * @typedef {import('mdast').Root} Root
 * @typedef {import('mdast').Strong} Strong
 * @typedef {import('mdast').Text} Text
 * @typedef {import('mdast').ThematicBreak} ThematicBreak
 * @typedef {import('mdast').ReferenceType} ReferenceType
 * @typedef {import('../index.js').CompileData} CompileData
 */

/**
 * @typedef {Root | Content} Node
 * @typedef {Extract<Node, UnistParent>} Parent
 *
 * @typedef {Omit<UnistParent, 'type' | 'children'> & {type: 'fragment', children: Array<PhrasingContent>}} Fragment
 */

/**
 * @callback Transform
 *   Extra transform, to change the AST afterwards.
 * @param {Root} tree
 *   Tree to transform.
 * @returns {Root | undefined | null | void}
 *   New tree or nothing (in which case the current tree is used).
 *
 * @callback Handle
 *   Handle a token.
 * @param {CompileContext} this
 *   Context.
 * @param {Token} token
 *   Current token.
 * @returns {void}
 *   Nothing.
 *
 * @typedef {Record<string, Handle>} Handles
 *   Token types mapping to handles
 *
 * @callback OnEnterError
 *   Handle the case where the `right` token is open, but it is closed (by the
 *   `left` token) or because we reached the end of the document.
 * @param {Omit<CompileContext, 'sliceSerialize'>} this
 *   Context.
 * @param {Token | undefined} left
 *   Left token.
 * @param {Token} right
 *   Right token.
 * @returns {void}
 *   Nothing.
 *
 * @callback OnExitError
 *   Handle the case where the `right` token is open but it is closed by
 *   exiting the `left` token.
 * @param {Omit<CompileContext, 'sliceSerialize'>} this
 *   Context.
 * @param {Token} left
 *   Left token.
 * @param {Token} right
 *   Right token.
 * @returns {void}
 *   Nothing.
 *
 * @typedef {[Token, OnEnterError | undefined]} TokenTuple
 *   Open token on the stack, with an optional error handler for when
 *   that token isn’t closed properly.
 */

/**
 * @typedef Config
 *   Configuration.
 *
 *   We have our defaults, but extensions will add more.
 * @property {Array<string>} canContainEols
 *   Token types where line endings are used.
 * @property {Handles} enter
 *   Opening handles.
 * @property {Handles} exit
 *   Closing handles.
 * @property {Array<Transform>} transforms
 *   Tree transforms.
 *
 * @typedef {Partial<Config>} Extension
 *   Change how markdown tokens from micromark are turned into mdast.
 *
 * @typedef CompileContext
 *   mdast compiler context.
 * @property {Array<Node | Fragment>} stack
 *   Stack of nodes.
 * @property {Array<TokenTuple>} tokenStack
 *   Stack of tokens.
 * @property {<Key extends keyof CompileData>(key: Key) => CompileData[Key]} getData
 *   Get data from the key/value store.
 * @property {<Key extends keyof CompileData>(key: Key, value?: CompileData[Key]) => void} setData
 *   Set data into the key/value store.
 * @property {(this: CompileContext) => void} buffer
 *   Capture some of the output data.
 * @property {(this: CompileContext) => string} resume
 *   Stop capturing and access the output data.
 * @property {<Kind extends Node>(this: CompileContext, node: Kind, token: Token, onError?: OnEnterError) => Kind} enter
 *   Enter a token.
 * @property {(this: CompileContext, token: Token, onError?: OnExitError) => Node} exit
 *   Exit a token.
 * @property {TokenizeContext['sliceSerialize']} sliceSerialize
 *   Get the string value of a token.
 * @property {Config} config
 *   Configuration.
 *
 * @typedef FromMarkdownOptions
 *   Configuration for how to build mdast.
 * @property {Array<Extension | Array<Extension>> | null | undefined} [mdastExtensions]
 *   Extensions for this utility to change how tokens are turned into a tree.
 *
 * @typedef {ParseOptions & FromMarkdownOptions} Options
 *   Configuration.
 */

// To do: micromark: create a registry of tokens?
// To do: next major: don’t return given `Node` from `enter`.
// To do: next major: remove setter/getter.















      const own = {}.hasOwnProperty

/**
 * @param value
 *   Markdown to parse.
 * @param encoding
 *   Character encoding for when `value` is `Buffer`.
 * @param options
 *   Configuration.
 * @returns
 *   mdast tree.
 */
      const fromMarkdown =
  /**
   * @type {(
   *   ((value: Value, encoding: Encoding, options?: Options | null | undefined) => Root) &
   *   ((value: Value, options?: Options | null | undefined) => Root)
   * )}
   */
  (
    /**
     * @param {Value} value
     * @param {Encoding | Options | null | undefined} [encoding]
     * @param {Options | null | undefined} [options]
     * @returns {Root}
     */
    function (value, encoding, options) {
      if (typeof encoding !== 'string') {
        options = encoding
        encoding = undefined
      }

      return compiler(options)(
        (0,micromark_lib_postprocess_js__WEBPACK_IMPORTED_MODULE_4__.postprocess)(
          (0,micromark_lib_parse_js__WEBPACK_IMPORTED_MODULE_2__.parse)(options).document().write((0,micromark_lib_preprocess_js__WEBPACK_IMPORTED_MODULE_3__.preprocess)()(value, encoding, true))
        )
      )
    }
  )

/**
 * Note this compiler only understand complete buffering, not streaming.
 *
 * @param {Options | null | undefined} [options]
 */
      function compiler(options) {
  /** @type {Config} */
        const config = {
          transforms: [],
          canContainEols: ['emphasis', 'fragment', 'heading', 'paragraph', 'strong'],
          enter: {
            autolink: opener(link),
            autolinkProtocol: onenterdata,
            autolinkEmail: onenterdata,
            atxHeading: opener(heading),
            blockQuote: opener(blockQuote),
            characterEscape: onenterdata,
            characterReference: onenterdata,
            codeFenced: opener(codeFlow),
            codeFencedFenceInfo: buffer,
            codeFencedFenceMeta: buffer,
            codeIndented: opener(codeFlow, buffer),
            codeText: opener(codeText, buffer),
            codeTextData: onenterdata,
            data: onenterdata,
            codeFlowValue: onenterdata,
            definition: opener(definition),
            definitionDestinationString: buffer,
            definitionLabelString: buffer,
            definitionTitleString: buffer,
            emphasis: opener(emphasis),
            hardBreakEscape: opener(hardBreak),
            hardBreakTrailing: opener(hardBreak),
            htmlFlow: opener(html, buffer),
            htmlFlowData: onenterdata,
            htmlText: opener(html, buffer),
            htmlTextData: onenterdata,
            image: opener(image),
            label: buffer,
            link: opener(link),
            listItem: opener(listItem),
            listItemValue: onenterlistitemvalue,
            listOrdered: opener(list, onenterlistordered),
            listUnordered: opener(list),
            paragraph: opener(paragraph),
            reference: onenterreference,
            referenceString: buffer,
            resourceDestinationString: buffer,
            resourceTitleString: buffer,
            setextHeading: opener(heading),
            strong: opener(strong),
            thematicBreak: opener(thematicBreak)
          },
          exit: {
            atxHeading: closer(),
            atxHeadingSequence: onexitatxheadingsequence,
            autolink: closer(),
            autolinkEmail: onexitautolinkemail,
            autolinkProtocol: onexitautolinkprotocol,
            blockQuote: closer(),
            characterEscapeValue: onexitdata,
            characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
            characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
            characterReferenceValue: onexitcharacterreferencevalue,
            codeFenced: closer(onexitcodefenced),
            codeFencedFence: onexitcodefencedfence,
            codeFencedFenceInfo: onexitcodefencedfenceinfo,
            codeFencedFenceMeta: onexitcodefencedfencemeta,
            codeFlowValue: onexitdata,
            codeIndented: closer(onexitcodeindented),
            codeText: closer(onexitcodetext),
            codeTextData: onexitdata,
            data: onexitdata,
            definition: closer(),
            definitionDestinationString: onexitdefinitiondestinationstring,
            definitionLabelString: onexitdefinitionlabelstring,
            definitionTitleString: onexitdefinitiontitlestring,
            emphasis: closer(),
            hardBreakEscape: closer(onexithardbreak),
            hardBreakTrailing: closer(onexithardbreak),
            htmlFlow: closer(onexithtmlflow),
            htmlFlowData: onexitdata,
            htmlText: closer(onexithtmltext),
            htmlTextData: onexitdata,
            image: closer(onexitimage),
            label: onexitlabel,
            labelText: onexitlabeltext,
            lineEnding: onexitlineending,
            link: closer(onexitlink),
            listItem: closer(),
            listOrdered: closer(),
            listUnordered: closer(),
            paragraph: closer(),
            referenceString: onexitreferencestring,
            resourceDestinationString: onexitresourcedestinationstring,
            resourceTitleString: onexitresourcetitlestring,
            resource: onexitresource,
            setextHeading: closer(onexitsetextheading),
            setextHeadingLineSequence: onexitsetextheadinglinesequence,
            setextHeadingText: onexitsetextheadingtext,
            strong: closer(),
            thematicBreak: closer()
          }
        }

        configure(config, (options || {}).mdastExtensions || [])

  /** @type {CompileData} */
        const data = {}

        return compile

  /**
   * Turn micromark events into an mdast tree.
   *
   * @param {Array<Event>} events
   *   Events.
   * @returns {Root}
   *   mdast tree.
   */
        function compile(events) {
    /** @type {Root} */
          let tree = {type: 'root', children: []}
    /** @type {Omit<CompileContext, 'sliceSerialize'>} */
          const context = {
            stack: [tree],
            tokenStack: [],
            config,
            enter,
            exit,
            buffer,
            resume,
            setData,
            getData
          }
    /** @type {Array<number>} */
          const listStack = []
          let index = -1

          while (++index < events.length) {
      // We preprocess lists to add `listItem` tokens, and to infer whether
      // items the list itself are spread out.
            if (
              events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listOrdered ||
        events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listUnordered
            ) {
              if (events[index][0] === 'enter') {
                listStack.push(index)
              } else {
                const tail = listStack.pop()
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(typeof tail === 'number', 'expected list ot be open')
                index = prepareList(events, tail, index)
              }
            }
          }

          index = -1

          while (++index < events.length) {
            const handler = config[events[index][0]]

            if (own.call(handler, events[index][1].type)) {
              handler[events[index][1].type].call(
                Object.assign(
                  {sliceSerialize: events[index][2].sliceSerialize},
                  context
                ),
                events[index][1]
              )
            }
          }

    // Handle tokens still being open.
          if (context.tokenStack.length > 0) {
            const tail = context.tokenStack[context.tokenStack.length - 1]
            const handler = tail[1] || defaultOnError
            handler.call(context, undefined, tail[0])
          }

    // Figure out `root` position.
          tree.position = {
            start: point(
              events.length > 0 ? events[0][1].start : {line: 1, column: 1, offset: 0}
            ),
            end: point(
              events.length > 0
                ? events[events.length - 2][1].end
                : {line: 1, column: 1, offset: 0}
            )
          }

    // Call transforms.
          index = -1
          while (++index < config.transforms.length) {
            tree = config.transforms[index](tree) || tree
          }

          return tree
        }

  /**
   * @param {Array<Event>} events
   * @param {number} start
   * @param {number} length
   * @returns {number}
   */
        function prepareList(events, start, length) {
          let index = start - 1
          let containerBalance = -1
          let listSpread = false
    /** @type {Token | undefined} */
          let listItem
    /** @type {number | undefined} */
          let lineIndex
    /** @type {number | undefined} */
          let firstBlankLineIndex
    /** @type {boolean | undefined} */
          let atMarker

          while (++index <= length) {
            const event = events[index]

            if (
              event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listUnordered ||
        event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listOrdered ||
        event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.blockQuote
            ) {
              if (event[0] === 'enter') {
                containerBalance++
              } else {
                containerBalance--
              }

              atMarker = undefined
            } else if (event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.lineEndingBlank) {
              if (event[0] === 'enter') {
                if (
                  listItem &&
            !atMarker &&
            !containerBalance &&
            !firstBlankLineIndex
                ) {
                  firstBlankLineIndex = index
                }

                atMarker = undefined
              }
            } else if (
              event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.linePrefix ||
        event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listItemValue ||
        event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listItemMarker ||
        event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listItemPrefix ||
        event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listItemPrefixWhitespace
            ) {
        // Empty.
            } else {
              atMarker = undefined
            }

            if (
              (!containerBalance &&
          event[0] === 'enter' &&
          event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listItemPrefix) ||
        (containerBalance === -1 &&
          event[0] === 'exit' &&
          (event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listUnordered ||
            event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listOrdered))
            ) {
              if (listItem) {
                let tailIndex = index
                lineIndex = undefined

                while (tailIndex--) {
                  const tailEvent = events[tailIndex]

                  if (
                    tailEvent[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.lineEnding ||
              tailEvent[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.lineEndingBlank
                  ) {
                    if (tailEvent[0] === 'exit') continue

                    if (lineIndex) {
                      events[lineIndex][1].type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.lineEndingBlank
                      listSpread = true
                    }

                    tailEvent[1].type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.lineEnding
                    lineIndex = tailIndex
                  } else if (
                    tailEvent[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.linePrefix ||
              tailEvent[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.blockQuotePrefix ||
              tailEvent[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.blockQuotePrefixWhitespace ||
              tailEvent[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.blockQuoteMarker ||
              tailEvent[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listItemIndent
                  ) {
              // Empty
                  } else {
                    break
                  }
                }

                if (
                  firstBlankLineIndex &&
            (!lineIndex || firstBlankLineIndex < lineIndex)
                ) {
                  listItem._spread = true
                }

          // Fix position.
                listItem.end = Object.assign(
                  {},
                  lineIndex ? events[lineIndex][1].start : event[1].end
                )

                events.splice(lineIndex || index, 0, ['exit', listItem, event[2]])
                index++
                length++
              }

        // Create a new list item.
              if (event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.listItemPrefix) {
                listItem = {
                  type: 'listItem',
                  _spread: false,
                  start: Object.assign({}, event[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
                  end: undefined
                }
          // @ts-expect-error: `listItem` is most definitely defined, TS...
                events.splice(index, 0, ['enter', listItem, event[2]])
                index++
                length++
                firstBlankLineIndex = undefined
                atMarker = true
              }
            }
          }

          events[start][1]._spread = listSpread
          return length
        }

  /**
   * Set data.
   *
   * @template {keyof CompileData} Key
   *   Field type.
   * @param {Key} key
   *   Key of field.
   * @param {CompileData[Key]} [value]
   *   New value.
   * @returns {void}
   *   Nothing.
   */
        function setData(key, value) {
          data[key] = value
        }

  /**
   * Get data.
   *
   * @template {keyof CompileData} Key
   *   Field type.
   * @param {Key} key
   *   Key of field.
   * @returns {CompileData[Key]}
   *   Value.
   */
        function getData(key) {
          return data[key]
        }

  /**
   * Create an opener handle.
   *
   * @param {(token: Token) => Node} create
   *   Create a node.
   * @param {Handle} [and]
   *   Optional function to also run.
   * @returns {Handle}
   *   Handle.
   */
        function opener(create, and) {
          return open

    /**
     * @this {CompileContext}
     * @param {Token} token
     * @returns {void}
     */
          function open(token) {
            enter.call(this, create(token), token)
            if (and) and.call(this, token)
          }
        }

  /**
   * @this {CompileContext}
   * @returns {void}
   */
        function buffer() {
          this.stack.push({type: 'fragment', children: []})
        }

  /**
   * @template {Node} Kind
   *   Node type.
   * @this {CompileContext}
   *   Context.
   * @param {Kind} node
   *   Node to enter.
   * @param {Token} token
   *   Corresponding token.
   * @param {OnEnterError | undefined} [errorHandler]
   *   Handle the case where this token is open, but it is closed by something else.
   * @returns {Kind}
   *   The given node.
   */
        function enter(node, token, errorHandler) {
          const parent = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(parent, 'expected `parent`')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)('children' in parent, 'expected `parent`')
    // @ts-expect-error: Assume `Node` can exist as a child of `parent`.
          parent.children.push(node)
          this.stack.push(node)
          this.tokenStack.push([token, errorHandler])
    // @ts-expect-error: `end` will be patched later.
          node.position = {start: point(token.start)}
          return node
        }

  /**
   * Create a closer handle.
   *
   * @param {Handle} [and]
   *   Optional function to also run.
   * @returns {Handle}
   *   Handle.
   */
        function closer(and) {
          return close

    /**
     * @this {CompileContext}
     * @param {Token} token
     * @returns {void}
     */
          function close(token) {
            if (and) and.call(this, token)
            exit.call(this, token)
          }
        }

  /**
   * @this {CompileContext}
   *   Context.
   * @param {Token} token
   *   Corresponding token.
   * @param {OnExitError | undefined} [onExitError]
   *   Handle the case where another token is open.
   * @returns {Node}
   *   The closed node.
   */
        function exit(token, onExitError) {
          const node = this.stack.pop()
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected `node`')
          const open = this.tokenStack.pop()

          if (!open) {
            throw new Error(
              'Cannot close `' +
          token.type +
          '` (' +
          (0,unist_util_stringify_position__WEBPACK_IMPORTED_MODULE_12__.stringifyPosition)({start: token.start, end: token.end}) +
          '): it’s not open'
            )
          } else if (open[0].type !== token.type) {
            if (onExitError) {
              onExitError.call(this, token, open[0])
            } else {
              const handler = open[1] || defaultOnError
              handler.call(this, token, open[0])
            }
          }

          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type !== 'fragment', 'unexpected fragment `exit`ed')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.position, 'expected `position` to be defined')
          node.position.end = point(token.end)
          return node
        }

  /**
   * @this {CompileContext}
   * @returns {string}
   */
        function resume() {
          return (0,mdast_util_to_string__WEBPACK_IMPORTED_MODULE_1__.toString)(this.stack.pop())
        }

  //
  // Handlers.
  //

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onenterlistordered() {
          setData('expectingFirstListItemValue', true)
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onenterlistitemvalue(token) {
          if (getData('expectingFirstListItemValue')) {
            const ancestor = this.stack[this.stack.length - 2]
      ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(ancestor, 'expected nodes on stack')
            ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(ancestor.type === 'list', 'expected list on stack')
            ancestor.start = Number.parseInt(
              this.sliceSerialize(token),
              micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_9__.constants.numericBaseDecimal
            )
            setData('expectingFirstListItemValue')
          }
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitcodefencedfenceinfo() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'code', 'expected code on stack')
          node.lang = data
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitcodefencedfencemeta() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'code', 'expected code on stack')
          node.meta = data
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitcodefencedfence() {
    // Exit if this is the closing fence.
          if (getData('flowCodeInside')) return
          this.buffer()
          setData('flowCodeInside', true)
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitcodefenced() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'code', 'expected code on stack')

          node.value = data.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, '')
          setData('flowCodeInside')
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitcodeindented() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'code', 'expected code on stack')

          node.value = data.replace(/(\r?\n|\r)$/g, '')
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitdefinitionlabelstring(token) {
          const label = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'definition', 'expected definition on stack')

          node.label = label
          node.identifier = (0,micromark_util_normalize_identifier__WEBPACK_IMPORTED_MODULE_7__.normalizeIdentifier)(
            this.sliceSerialize(token)
          ).toLowerCase()
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitdefinitiontitlestring() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'definition', 'expected definition on stack')

          node.title = data
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitdefinitiondestinationstring() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'definition', 'expected definition on stack')

          node.url = data
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitatxheadingsequence(token) {
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'heading', 'expected heading on stack')

          if (!node.depth) {
            const depth = this.sliceSerialize(token).length

      ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(
              depth === 1 ||
          depth === 2 ||
          depth === 3 ||
          depth === 4 ||
          depth === 5 ||
          depth === 6,
              'expected `depth` between `1` and `6`'
            )

            node.depth = depth
          }
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitsetextheadingtext() {
          setData('setextHeadingSlurpLineEnding', true)
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitsetextheadinglinesequence(token) {
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'heading', 'expected heading on stack')

          node.depth =
      this.sliceSerialize(token).charCodeAt(0) === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.equalsTo ? 1 : 2
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitsetextheading() {
          setData('setextHeadingSlurpLineEnding')
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onenterdata(token) {
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)('children' in node, 'expected parent on stack')

          let tail = node.children[node.children.length - 1]

          if (!tail || tail.type !== 'text') {
      // Add a new text node.
            tail = text()
      // @ts-expect-error: we’ll add `end` later.
            tail.position = {start: point(token.start)}
      // @ts-expect-error: Assume `parent` accepts `text`.
            node.children.push(tail)
          }

          this.stack.push(tail)
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitdata(token) {
          const tail = this.stack.pop()
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(tail, 'expected a `node` to be on the stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)('value' in tail, 'expected a `literal` to be on the stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(tail.position, 'expected `node` to have an open position')
          tail.value += this.sliceSerialize(token)
          tail.position.end = point(token.end)
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitlineending(token) {
          const context = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(context, 'expected `node`')

    // If we’re at a hard break, include the line ending in there.
          if (getData('atHardBreak')) {
            (0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)('children' in context, 'expected `parent`')
            const tail = context.children[context.children.length - 1]
      ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(tail.position, 'expected tail to have a starting position')
            tail.position.end = point(token.end)
            setData('atHardBreak')
            return
          }

          if (
            !getData('setextHeadingSlurpLineEnding') &&
      config.canContainEols.includes(context.type)
          ) {
            onenterdata.call(this, token)
            onexitdata.call(this, token)
          }
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexithardbreak() {
          setData('atHardBreak', true)
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexithtmlflow() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'html', 'expected html on stack')

          node.value = data
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexithtmltext() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'html', 'expected html on stack')

          node.value = data
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitcodetext() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'inlineCode', 'expected inline code on stack')

          node.value = data
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitlink() {
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'link', 'expected link on stack')

    // Note: there are also `identifier` and `label` fields on this link node!
    // These are used / cleaned here.

    // To do: clean.
          if (getData('inReference')) {
      /** @type {ReferenceType} */
            const referenceType = getData('referenceType') || 'shortcut'

            node.type += 'Reference'
      // @ts-expect-error: mutate.
            node.referenceType = referenceType
      // @ts-expect-error: mutate.
            delete node.url
            delete node.title
          } else {
      // @ts-expect-error: mutate.
            delete node.identifier
      // @ts-expect-error: mutate.
            delete node.label
          }

          setData('referenceType')
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitimage() {
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'image', 'expected image on stack')

    // Note: there are also `identifier` and `label` fields on this link node!
    // These are used / cleaned here.

    // To do: clean.
          if (getData('inReference')) {
      /** @type {ReferenceType} */
            const referenceType = getData('referenceType') || 'shortcut'

            node.type += 'Reference'
      // @ts-expect-error: mutate.
            node.referenceType = referenceType
      // @ts-expect-error: mutate.
            delete node.url
            delete node.title
          } else {
      // @ts-expect-error: mutate.
            delete node.identifier
      // @ts-expect-error: mutate.
            delete node.label
          }

          setData('referenceType')
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitlabeltext(token) {
          const string = this.sliceSerialize(token)
          const ancestor = this.stack[this.stack.length - 2]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(ancestor, 'expected ancestor on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(
            ancestor.type === 'image' || ancestor.type === 'link',
            'expected image or link on stack'
          )

    // @ts-expect-error: stash this on the node, as it might become a reference
    // later.
          ancestor.label = (0,micromark_util_decode_string__WEBPACK_IMPORTED_MODULE_6__.decodeString)(string)
    // @ts-expect-error: same as above.
          ancestor.identifier = (0,micromark_util_normalize_identifier__WEBPACK_IMPORTED_MODULE_7__.normalizeIdentifier)(string).toLowerCase()
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitlabel() {
          const fragment = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(fragment, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(fragment.type === 'fragment', 'expected fragment on stack')
          const value = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(
            node.type === 'image' || node.type === 'link',
            'expected image or link on stack'
          )

    // Assume a reference.
          setData('inReference', true)

          if (node.type === 'link') {
      /** @type {Array<StaticPhrasingContent>} */
      // @ts-expect-error: Assume static phrasing content.
            const children = fragment.children

            node.children = children
          } else {
            node.alt = value
          }
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitresourcedestinationstring() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(
            node.type === 'image' || node.type === 'link',
            'expected image or link on stack'
          )
          node.url = data
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitresourcetitlestring() {
          const data = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(
            node.type === 'image' || node.type === 'link',
            'expected image or link on stack'
          )
          node.title = data
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitresource() {
          setData('inReference')
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onenterreference() {
          setData('referenceType', 'collapsed')
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitreferencestring(token) {
          const label = this.resume()
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(
            node.type === 'image' || node.type === 'link',
            'expected image reference or link reference on stack'
          )

    // @ts-expect-error: stash this on the node, as it might become a reference
    // later.
          node.label = label
    // @ts-expect-error: same as above.
          node.identifier = (0,micromark_util_normalize_identifier__WEBPACK_IMPORTED_MODULE_7__.normalizeIdentifier)(
            this.sliceSerialize(token)
          ).toLowerCase()
          setData('referenceType', 'full')
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

        function onexitcharacterreferencemarker(token) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(
            token.type === 'characterReferenceMarkerNumeric' ||
        token.type === 'characterReferenceMarkerHexadecimal'
          )
          setData('characterReferenceType', token.type)
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitcharacterreferencevalue(token) {
          const data = this.sliceSerialize(token)
          const type = getData('characterReferenceType')
    /** @type {string} */
          let value

          if (type) {
            value = (0,micromark_util_decode_numeric_character_reference__WEBPACK_IMPORTED_MODULE_5__.decodeNumericCharacterReference)(
              data,
              type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.characterReferenceMarkerNumeric
                ? micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_9__.constants.numericBaseDecimal
                : micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_9__.constants.numericBaseHexadecimal
            )
            setData('characterReferenceType')
          } else {
            const result = (0,decode_named_character_reference__WEBPACK_IMPORTED_MODULE_11__.decodeNamedCharacterReference)(data)
      ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(result !== false, 'expected reference to decode')
            value = result
          }

          const tail = this.stack.pop()
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(tail, 'expected `node`')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(tail.position, 'expected `node.position`')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)('value' in tail, 'expected `node.value`')
          tail.value += value
          tail.position.end = point(token.end)
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitautolinkprotocol(token) {
          onexitdata.call(this, token)
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'link', 'expected link on stack')

          node.url = this.sliceSerialize(token)
        }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
        function onexitautolinkemail(token) {
          onexitdata.call(this, token)
          const node = this.stack[this.stack.length - 1]
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node, 'expected node on stack')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_0__.ok)(node.type === 'link', 'expected link on stack')

          node.url = 'mailto:' + this.sliceSerialize(token)
        }

  //
  // Creaters.
  //

  /** @returns {Blockquote} */
        function blockQuote() {
          return {type: 'blockquote', children: []}
        }

  /** @returns {Code} */
        function codeFlow() {
          return {type: 'code', lang: null, meta: null, value: ''}
        }

  /** @returns {InlineCode} */
        function codeText() {
          return {type: 'inlineCode', value: ''}
        }

  /** @returns {Definition} */
        function definition() {
          return {
            type: 'definition',
            identifier: '',
            label: null,
            title: null,
            url: ''
          }
        }

  /** @returns {Emphasis} */
        function emphasis() {
          return {type: 'emphasis', children: []}
        }

  /** @returns {Heading} */
        function heading() {
    // @ts-expect-error `depth` will be set later.
          return {type: 'heading', depth: undefined, children: []}
        }

  /** @returns {Break} */
        function hardBreak() {
          return {type: 'break'}
        }

  /** @returns {HTML} */
        function html() {
          return {type: 'html', value: ''}
        }

  /** @returns {Image} */
        function image() {
          return {type: 'image', title: null, url: '', alt: null}
        }

  /** @returns {Link} */
        function link() {
          return {type: 'link', title: null, url: '', children: []}
        }

  /**
   * @param {Token} token
   * @returns {List}
   */
        function list(token) {
          return {
            type: 'list',
            ordered: token.type === 'listOrdered',
            start: null,
            spread: token._spread,
            children: []
          }
        }

  /**
   * @param {Token} token
   * @returns {ListItem}
   */
        function listItem(token) {
          return {
            type: 'listItem',
            spread: token._spread,
            checked: null,
            children: []
          }
        }

  /** @returns {Paragraph} */
        function paragraph() {
          return {type: 'paragraph', children: []}
        }

  /** @returns {Strong} */
        function strong() {
          return {type: 'strong', children: []}
        }

  /** @returns {Text} */
        function text() {
          return {type: 'text', value: ''}
        }

  /** @returns {ThematicBreak} */
        function thematicBreak() {
          return {type: 'thematicBreak'}
        }
      }

/**
 * Copy a point-like value.
 *
 * @param {Point} d
 *   Point-like value.
 * @returns {Point}
 *   unist point.
 */
      function point(d) {
        return {line: d.line, column: d.column, offset: d.offset}
      }

/**
 * @param {Config} combined
 * @param {Array<Extension | Array<Extension>>} extensions
 * @returns {void}
 */
      function configure(combined, extensions) {
        let index = -1

        while (++index < extensions.length) {
          const value = extensions[index]

          if (Array.isArray(value)) {
            configure(combined, value)
          } else {
            extension(combined, value)
          }
        }
      }

/**
 * @param {Config} combined
 * @param {Extension} extension
 * @returns {void}
 */
      function extension(combined, extension) {
  /** @type {keyof Extension} */
        let key

        for (key in extension) {
          if (own.call(extension, key)) {
            if (key === 'canContainEols') {
              const right = extension[key]
              if (right) {
                combined[key].push(...right)
              }
            } else if (key === 'transforms') {
              const right = extension[key]
              if (right) {
                combined[key].push(...right)
              }
            } else if (key === 'enter' || key === 'exit') {
              const right = extension[key]
              if (right) {
                Object.assign(combined[key], right)
              }
            }
          }
        }
      }

/** @type {OnEnterError} */
      function defaultOnError(left, right) {
        if (left) {
          throw new Error(
            'Cannot close `' +
        left.type +
        '` (' +
        (0,unist_util_stringify_position__WEBPACK_IMPORTED_MODULE_12__.stringifyPosition)({start: left.start, end: left.end}) +
        '): a different token (`' +
        right.type +
        '`, ' +
        (0,unist_util_stringify_position__WEBPACK_IMPORTED_MODULE_12__.stringifyPosition)({start: right.start, end: right.end}) +
        ') is open'
          )
        } else {
          throw new Error(
            'Cannot close document, a token (`' +
        right.type +
        '`, ' +
        (0,unist_util_stringify_position__WEBPACK_IMPORTED_MODULE_12__.stringifyPosition)({start: right.start, end: right.end}) +
        ') is still open'
          )
        }
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/footer.js":
/*!*******************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/footer.js ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   footer: () => (/* binding */ footer)
/* harmony export */ });
/* harmony import */ const _handlers_thematic_break_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./handlers/thematic-break.js */ "./node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js");
/* harmony import */ const _handlers_list_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./handlers/list.js */ "./node_modules/mdast-util-to-hast/lib/handlers/list.js");
/* harmony import */ const _wrap_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./wrap.js */ "./node_modules/mdast-util-to-hast/lib/wrap.js");
/**
 * @typedef {import('mdast').BlockContent} BlockContent
 * @typedef {import('mdast').FootnoteDefinition} FootnoteDefinition
 * @typedef {import('mdast').Link} Link
 * @typedef {import('mdast').ListItem} ListItem
 * @typedef {import('mdast').Paragraph} Paragraph
 * @typedef {import('./index.js').H} H
 */





/**
 * @param {H} h
 */
      function footer(h) {
        const footnoteById = h.footnoteById
        const footnoteOrder = h.footnoteOrder
        let index = -1
  /** @type {Array.<ListItem>} */
        const listItems = []

        while (++index < footnoteOrder.length) {
          const def = footnoteById[footnoteOrder[index].toUpperCase()]

          if (!def) {
            continue
          }

          const marker = String(index + 1)
          const content = [...def.children]
    /** @type {Link} */
          const backReference = {
            type: 'link',
            url: '#fnref' + marker,
            data: {hProperties: {className: ['footnote-back'], role: 'doc-backlink'}},
            children: [{type: 'text', value: '↩'}]
          }
          const tail = content[content.length - 1]

          if (tail && tail.type === 'paragraph') {
            tail.children.push(backReference)
          } else {
      // @ts-expect-error Indeed, link directly added in block content.
      // Which we do because that way at least the handlers will be called
      // for the other HTML we’re generating (as markdown).
            content.push(backReference)
          }

          listItems.push({
            type: 'listItem',
            data: {hProperties: {id: 'fn' + marker, role: 'doc-endnote'}},
            children: content,
            position: def.position
          })
        }

        if (listItems.length === 0) {
          return null
        }

        return h(
          null,
          'section',
          {className: ['footnotes'], role: 'doc-endnotes'},
          (0,_wrap_js__WEBPACK_IMPORTED_MODULE_2__.wrap)(
            [
              (0,_handlers_thematic_break_js__WEBPACK_IMPORTED_MODULE_0__.thematicBreak)(h),
              (0,_handlers_list_js__WEBPACK_IMPORTED_MODULE_1__.list)(h, {type: 'list', ordered: true, children: listItems})
            ],
            true
          )
        )
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/blockquote.js":
/*!********************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/blockquote.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   blockquote: () => (/* binding */ blockquote)
/* harmony export */ });
/* harmony import */ const _wrap_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../wrap.js */ "./node_modules/mdast-util-to-hast/lib/wrap.js");
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').Blockquote} Blockquote
 * @typedef {import('../index.js').Handler} Handler
 */




/**
 * @type {Handler}
 * @param {Blockquote} node
 */
      function blockquote(h, node) {
        return h(node, 'blockquote', (0,_wrap_js__WEBPACK_IMPORTED_MODULE_0__.wrap)((0,_traverse_js__WEBPACK_IMPORTED_MODULE_1__.all)(h, node), true))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/break.js":
/*!***************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/break.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   hardBreak: () => (/* binding */ hardBreak)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/**
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').Text} Text
 * @typedef {import('mdast').Break} Break
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Break} node
 * @returns {Array<Element|Text>}
 */
      function hardBreak(h, node) {
        return [h(node, 'br'), (0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', '\n')]
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/code.js":
/*!**************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/code.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   code: () => (/* binding */ code)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/**
 * @typedef {import('mdast').Code} Code
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').Properties} Properties
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Code} node
 */
      function code(h, node) {
        const value = node.value ? node.value + '\n' : ''
  // To do: next major, use `node.lang` w/o regex, the splitting’s been going
  // on for years in remark now.
        const lang = node.lang && node.lang.match(/^[^ \t]+(?=[ \t]|$)/)
  /** @type {Properties} */
        const props = {}

        if (lang) {
          props.className = ['language-' + lang]
        }

        const code = h(node, 'code', props, [(0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', value)])

        if (node.meta) {
          code.data = {meta: node.meta}
        }

        return h(node.position, 'pre', [code])
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/delete.js":
/*!****************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/delete.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   strikethrough: () => (/* binding */ strikethrough)
/* harmony export */ });
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').Delete} Delete
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Delete} node
 */
      function strikethrough(h, node) {
        return h(node, 'del', (0,_traverse_js__WEBPACK_IMPORTED_MODULE_0__.all)(h, node))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/emphasis.js":
/*!******************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/emphasis.js ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   emphasis: () => (/* binding */ emphasis)
/* harmony export */ });
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').Emphasis} Emphasis
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Emphasis} node
 */
      function emphasis(h, node) {
        return h(node, 'em', (0,_traverse_js__WEBPACK_IMPORTED_MODULE_0__.all)(h, node))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js":
/*!****************************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   footnoteReference: () => (/* binding */ footnoteReference)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/**
 * @typedef {import('mdast').FootnoteReference} FootnoteReference
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {FootnoteReference} node
 */
      function footnoteReference(h, node) {
        const footnoteOrder = h.footnoteOrder
        const identifier = String(node.identifier)
        const index = footnoteOrder.indexOf(identifier)
        const marker = String(
          index === -1 ? footnoteOrder.push(identifier) : index + 1
        )

        return h(
          node,
          'a',
          {
            href: '#fn' + marker,
            className: ['footnote-ref'],
            id: 'fnref' + marker,
            role: 'doc-noteref'
          },
          [h(node.position, 'sup', [(0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', marker)])]
        )
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/footnote.js":
/*!******************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/footnote.js ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   footnote: () => (/* binding */ footnote)
/* harmony export */ });
/* harmony import */ const _footnote_reference_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./footnote-reference.js */ "./node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js");
/**
 * @typedef {import('mdast').Footnote} Footnote
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Footnote} node
 */
      function footnote(h, node) {
        const footnoteById = h.footnoteById
        const footnoteOrder = h.footnoteOrder
        let no = 1

        while (no in footnoteById) no++

        const identifier = String(no)

  // No need to check if `identifier` exists in `footnoteOrder`, it’s guaranteed
  // to not exist because we just generated it.
        footnoteOrder.push(identifier)

        footnoteById[identifier] = {
          type: 'footnoteDefinition',
          identifier,
          children: [{type: 'paragraph', children: node.children}],
          position: node.position
        }

        return (0,_footnote_reference_js__WEBPACK_IMPORTED_MODULE_0__.footnoteReference)(h, {
          type: 'footnoteReference',
          identifier,
          position: node.position
        })
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/heading.js":
/*!*****************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/heading.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   heading: () => (/* binding */ heading)
/* harmony export */ });
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').Heading} Heading
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Heading} node
 */
      function heading(h, node) {
        return h(node, 'h' + node.depth, (0,_traverse_js__WEBPACK_IMPORTED_MODULE_0__.all)(h, node))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/html.js":
/*!**************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/html.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   html: () => (/* binding */ html)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/**
 * @typedef {import('mdast').HTML} HTML
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * Return either a `raw` node in dangerous mode, otherwise nothing.
 *
 * @type {Handler}
 * @param {HTML} node
 */
      function html(h, node) {
        return h.dangerous ? h.augment(node, (0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('raw', node.value)) : null
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/image-reference.js":
/*!*************************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/image-reference.js ***!
  \*************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   imageReference: () => (/* binding */ imageReference)
/* harmony export */ });
/* harmony import */ const mdurl_encode_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mdurl/encode.js */ "./node_modules/mdurl/encode.js");
/* harmony import */ const _revert_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../revert.js */ "./node_modules/mdast-util-to-hast/lib/revert.js");
/**
 * @typedef {import('mdast').ImageReference} ImageReference
 * @typedef {import('hast').Properties} Properties
 * @typedef {import('../index.js').Handler} Handler
 */




/**
 * @type {Handler}
 * @param {ImageReference} node
 */
      function imageReference(h, node) {
        const def = h.definition(node.identifier)

        if (!def) {
          return (0,_revert_js__WEBPACK_IMPORTED_MODULE_1__.revert)(h, node)
        }

  /** @type {Properties} */
        const props = {src: mdurl_encode_js__WEBPACK_IMPORTED_MODULE_0__(def.url || ''), alt: node.alt}

        if (def.title !== null && def.title !== undefined) {
          props.title = def.title
        }

        return h(node, 'img', props)
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/image.js":
/*!***************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/image.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   image: () => (/* binding */ image)
/* harmony export */ });
/* harmony import */ const mdurl_encode_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mdurl/encode.js */ "./node_modules/mdurl/encode.js");
/**
 * @typedef {import('mdast').Image} Image
 * @typedef {import('hast').Properties} Properties
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Image} node
 */
      function image(h, node) {
  /** @type {Properties} */
        const props = {src: mdurl_encode_js__WEBPACK_IMPORTED_MODULE_0__(node.url), alt: node.alt}

        if (node.title !== null && node.title !== undefined) {
          props.title = node.title
        }

        return h(node, 'img', props)
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/index.js":
/*!***************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/index.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handlers: () => (/* binding */ handlers)
/* harmony export */ });
/* harmony import */ const _blockquote_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./blockquote.js */ "./node_modules/mdast-util-to-hast/lib/handlers/blockquote.js");
/* harmony import */ const _break_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./break.js */ "./node_modules/mdast-util-to-hast/lib/handlers/break.js");
/* harmony import */ const _code_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./code.js */ "./node_modules/mdast-util-to-hast/lib/handlers/code.js");
/* harmony import */ const _delete_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./delete.js */ "./node_modules/mdast-util-to-hast/lib/handlers/delete.js");
/* harmony import */ const _emphasis_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./emphasis.js */ "./node_modules/mdast-util-to-hast/lib/handlers/emphasis.js");
/* harmony import */ const _footnote_reference_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./footnote-reference.js */ "./node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js");
/* harmony import */ const _footnote_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./footnote.js */ "./node_modules/mdast-util-to-hast/lib/handlers/footnote.js");
/* harmony import */ const _heading_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./heading.js */ "./node_modules/mdast-util-to-hast/lib/handlers/heading.js");
/* harmony import */ const _html_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./html.js */ "./node_modules/mdast-util-to-hast/lib/handlers/html.js");
/* harmony import */ const _image_reference_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./image-reference.js */ "./node_modules/mdast-util-to-hast/lib/handlers/image-reference.js");
/* harmony import */ const _image_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./image.js */ "./node_modules/mdast-util-to-hast/lib/handlers/image.js");
/* harmony import */ const _inline_code_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./inline-code.js */ "./node_modules/mdast-util-to-hast/lib/handlers/inline-code.js");
/* harmony import */ const _link_reference_js__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./link-reference.js */ "./node_modules/mdast-util-to-hast/lib/handlers/link-reference.js");
/* harmony import */ const _link_js__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./link.js */ "./node_modules/mdast-util-to-hast/lib/handlers/link.js");
/* harmony import */ const _list_item_js__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./list-item.js */ "./node_modules/mdast-util-to-hast/lib/handlers/list-item.js");
/* harmony import */ const _list_js__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./list.js */ "./node_modules/mdast-util-to-hast/lib/handlers/list.js");
/* harmony import */ const _paragraph_js__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./paragraph.js */ "./node_modules/mdast-util-to-hast/lib/handlers/paragraph.js");
/* harmony import */ const _root_js__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./root.js */ "./node_modules/mdast-util-to-hast/lib/handlers/root.js");
/* harmony import */ const _strong_js__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./strong.js */ "./node_modules/mdast-util-to-hast/lib/handlers/strong.js");
/* harmony import */ const _table_js__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./table.js */ "./node_modules/mdast-util-to-hast/lib/handlers/table.js");
/* harmony import */ const _text_js__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./text.js */ "./node_modules/mdast-util-to-hast/lib/handlers/text.js");
/* harmony import */ const _thematic_break_js__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./thematic-break.js */ "./node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js");























      const handlers = {
        blockquote: _blockquote_js__WEBPACK_IMPORTED_MODULE_0__.blockquote,
        break: _break_js__WEBPACK_IMPORTED_MODULE_1__.hardBreak,
        code: _code_js__WEBPACK_IMPORTED_MODULE_2__.code,
        delete: _delete_js__WEBPACK_IMPORTED_MODULE_3__.strikethrough,
        emphasis: _emphasis_js__WEBPACK_IMPORTED_MODULE_4__.emphasis,
        footnoteReference: _footnote_reference_js__WEBPACK_IMPORTED_MODULE_5__.footnoteReference,
        footnote: _footnote_js__WEBPACK_IMPORTED_MODULE_6__.footnote,
        heading: _heading_js__WEBPACK_IMPORTED_MODULE_7__.heading,
        html: _html_js__WEBPACK_IMPORTED_MODULE_8__.html,
        imageReference: _image_reference_js__WEBPACK_IMPORTED_MODULE_9__.imageReference,
        image: _image_js__WEBPACK_IMPORTED_MODULE_10__.image,
        inlineCode: _inline_code_js__WEBPACK_IMPORTED_MODULE_11__.inlineCode,
        linkReference: _link_reference_js__WEBPACK_IMPORTED_MODULE_12__.linkReference,
        link: _link_js__WEBPACK_IMPORTED_MODULE_13__.link,
        listItem: _list_item_js__WEBPACK_IMPORTED_MODULE_14__.listItem,
        list: _list_js__WEBPACK_IMPORTED_MODULE_15__.list,
        paragraph: _paragraph_js__WEBPACK_IMPORTED_MODULE_16__.paragraph,
        root: _root_js__WEBPACK_IMPORTED_MODULE_17__.root,
        strong: _strong_js__WEBPACK_IMPORTED_MODULE_18__.strong,
        table: _table_js__WEBPACK_IMPORTED_MODULE_19__.table,
        text: _text_js__WEBPACK_IMPORTED_MODULE_20__.text,
        thematicBreak: _thematic_break_js__WEBPACK_IMPORTED_MODULE_21__.thematicBreak,
        toml: ignore,
        yaml: ignore,
        definition: ignore,
        footnoteDefinition: ignore
      }

// Return nothing for nodes that are ignored.
      function ignore() {
        return null
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/inline-code.js":
/*!*********************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/inline-code.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   inlineCode: () => (/* binding */ inlineCode)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/**
 * @typedef {import('mdast').InlineCode} InlineCode
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {InlineCode} node
 */
      function inlineCode(h, node) {
        return h(node, 'code', [(0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', node.value.replace(/\r?\n|\r/g, ' '))])
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/link-reference.js":
/*!************************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/link-reference.js ***!
  \************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   linkReference: () => (/* binding */ linkReference)
/* harmony export */ });
/* harmony import */ const mdurl_encode_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mdurl/encode.js */ "./node_modules/mdurl/encode.js");
/* harmony import */ const _revert_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../revert.js */ "./node_modules/mdast-util-to-hast/lib/revert.js");
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').LinkReference} LinkReference
 * @typedef {import('hast').Properties} Properties
 * @typedef {import('../index.js').Handler} Handler
 */





/**
 * @type {Handler}
 * @param {LinkReference} node
 */
      function linkReference(h, node) {
        const def = h.definition(node.identifier)

        if (!def) {
          return (0,_revert_js__WEBPACK_IMPORTED_MODULE_1__.revert)(h, node)
        }

  /** @type {Properties} */
        const props = {href: mdurl_encode_js__WEBPACK_IMPORTED_MODULE_0__(def.url || '')}

        if (def.title !== null && def.title !== undefined) {
          props.title = def.title
        }

        return h(node, 'a', props, (0,_traverse_js__WEBPACK_IMPORTED_MODULE_2__.all)(h, node))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/link.js":
/*!**************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/link.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   link: () => (/* binding */ link)
/* harmony export */ });
/* harmony import */ const mdurl_encode_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mdurl/encode.js */ "./node_modules/mdurl/encode.js");
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').Link} Link
 * @typedef {import('hast').Properties} Properties
 * @typedef {import('../index.js').Handler} Handler
 */




/**
 * @type {Handler}
 * @param {Link} node
 */
      function link(h, node) {
  /** @type {Properties} */
        const props = {href: mdurl_encode_js__WEBPACK_IMPORTED_MODULE_0__(node.url)}

        if (node.title !== null && node.title !== undefined) {
          props.title = node.title
        }

        return h(node, 'a', props, (0,_traverse_js__WEBPACK_IMPORTED_MODULE_1__.all)(h, node))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/list-item.js":
/*!*******************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/list-item.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   listItem: () => (/* binding */ listItem)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').ListItem} ListItem
 * @typedef {import('mdast').List} List
 * @typedef {import('hast').Properties} Properties
 * @typedef {import('hast').Element} Element
 * @typedef {import('../index.js').Handler} Handler
 * @typedef {import('../index.js').Content} Content
 */




/**
 * @type {Handler}
 * @param {ListItem} node
 * @param {List} parent
 */
      function listItem(h, node, parent) {
        const result = (0,_traverse_js__WEBPACK_IMPORTED_MODULE_1__.all)(h, node)
        const loose = parent ? listLoose(parent) : listItemLoose(node)
  /** @type {Properties} */
        const props = {}
  /** @type {Array.<Content>} */
        const wrapped = []

        if (typeof node.checked === 'boolean') {
    /** @type {Element} */
          let paragraph

          if (
            result[0] &&
      result[0].type === 'element' &&
      result[0].tagName === 'p'
          ) {
            paragraph = result[0]
          } else {
            paragraph = h(null, 'p', [])
            result.unshift(paragraph)
          }

          if (paragraph.children.length > 0) {
            paragraph.children.unshift((0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', ' '))
          }

          paragraph.children.unshift(
            h(null, 'input', {
              type: 'checkbox',
              checked: node.checked,
              disabled: true
            })
          )

    // According to github-markdown-css, this class hides bullet.
    // See: <https://github.com/sindresorhus/github-markdown-css>.
          props.className = ['task-list-item']
        }

        let index = -1

        while (++index < result.length) {
          const child = result[index]

    // Add eols before nodes, except if this is a loose, first paragraph.
          if (
            loose ||
      index !== 0 ||
      child.type !== 'element' ||
      child.tagName !== 'p'
          ) {
            wrapped.push((0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', '\n'))
          }

          if (child.type === 'element' && child.tagName === 'p' && !loose) {
            wrapped.push(...child.children)
          } else {
            wrapped.push(child)
          }
        }

        const tail = result[result.length - 1]

  // Add a final eol.
        if (tail && (loose || !('tagName' in tail) || tail.tagName !== 'p')) {
          wrapped.push((0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', '\n'))
        }

        return h(node, 'li', props, wrapped)
      }

/**
 * @param {List} node
 * @return {Boolean}
 */
      function listLoose(node) {
        let loose = node.spread
        const children = node.children
        let index = -1

        while (!loose && ++index < children.length) {
          loose = listItemLoose(children[index])
        }

        return Boolean(loose)
      }

/**
 * @param {ListItem} node
 * @return {Boolean}
 */
      function listItemLoose(node) {
        const spread = node.spread

        return spread === undefined || spread === null
          ? node.children.length > 1
          : spread
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/list.js":
/*!**************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/list.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   list: () => (/* binding */ list)
/* harmony export */ });
/* harmony import */ const _wrap_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../wrap.js */ "./node_modules/mdast-util-to-hast/lib/wrap.js");
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').List} List
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').Properties} Properties
 * @typedef {import('../index.js').Handler} Handler
 */




/**
 * @type {Handler}
 * @param {List} node
 * @returns {Element}
 */
      function list(h, node) {
  /** @type {Properties} */
        const props = {}
        const name = node.ordered ? 'ol' : 'ul'
        const items = (0,_traverse_js__WEBPACK_IMPORTED_MODULE_1__.all)(h, node)
        let index = -1

        if (typeof node.start === 'number' && node.start !== 1) {
          props.start = node.start
        }

  // Like GitHub, add a class for custom styling.
        while (++index < items.length) {
          const item = items[index]

          if (
            item.type === 'element' &&
      item.tagName === 'li' &&
      item.properties &&
      Array.isArray(item.properties.className) &&
      item.properties.className.includes('task-list-item')
          ) {
            props.className = ['contains-task-list']
            break
          }
        }

        return h(node, name, props, (0,_wrap_js__WEBPACK_IMPORTED_MODULE_0__.wrap)(items, true))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/paragraph.js":
/*!*******************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/paragraph.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   paragraph: () => (/* binding */ paragraph)
/* harmony export */ });
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').Paragraph} Paragraph
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Paragraph} node
 */
      function paragraph(h, node) {
        return h(node, 'p', (0,_traverse_js__WEBPACK_IMPORTED_MODULE_0__.all)(h, node))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/root.js":
/*!**************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/root.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   root: () => (/* binding */ root)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/* harmony import */ const _wrap_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../wrap.js */ "./node_modules/mdast-util-to-hast/lib/wrap.js");
/**
 * @typedef {import('mdast').Root} Root
 * @typedef {import('../index.js').Handler} Handler
 */





/**
 * @type {Handler}
 * @param {Root} node
 */
      function root(h, node) {
  // @ts-expect-error `root`s are also fine.
        return h.augment(node, (0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('root', (0,_wrap_js__WEBPACK_IMPORTED_MODULE_2__.wrap)((0,_traverse_js__WEBPACK_IMPORTED_MODULE_1__.all)(h, node))))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/strong.js":
/*!****************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/strong.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   strong: () => (/* binding */ strong)
/* harmony export */ });
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').Strong} Strong
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Strong} node
 */
      function strong(h, node) {
        return h(node, 'strong', (0,_traverse_js__WEBPACK_IMPORTED_MODULE_0__.all)(h, node))
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/table.js":
/*!***************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/table.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   table: () => (/* binding */ table)
/* harmony export */ });
/* harmony import */ const unist_util_position__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-util-position */ "./node_modules/unist-util-position/lib/index.js");
/* harmony import */ const _wrap_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../wrap.js */ "./node_modules/mdast-util-to-hast/lib/wrap.js");
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').Table} Table
 * @typedef {import('mdast').TableCell} TableCell
 * @typedef {import('hast').Element} Element
 * @typedef {import('../index.js').Handler} Handler
 * @typedef {import('../index.js').Content} Content
 */





/**
 * @type {Handler}
 * @param {Table} node
 */
      function table(h, node) {
        const rows = node.children
        let index = -1
        const align = node.align || []
  /** @type {Array.<Element>} */
        const result = []

        while (++index < rows.length) {
          const row = rows[index].children
          const name = index === 0 ? 'th' : 'td'
          let pos = node.align ? align.length : row.length
    /** @type {Array.<Content>} */
          const out = []

          while (pos--) {
            const cell = row[pos]
            out[pos] = h(cell, name, {align: align[pos]}, cell ? (0,_traverse_js__WEBPACK_IMPORTED_MODULE_2__.all)(h, cell) : [])
          }

          result[index] = h(rows[index], 'tr', (0,_wrap_js__WEBPACK_IMPORTED_MODULE_1__.wrap)(out, true))
        }

        return h(
          node,
          'table',
          (0,_wrap_js__WEBPACK_IMPORTED_MODULE_1__.wrap)(
            [h(result[0].position, 'thead', (0,_wrap_js__WEBPACK_IMPORTED_MODULE_1__.wrap)([result[0]], true))].concat(
              result[1]
                ? h(
                  {
                    start: (0,unist_util_position__WEBPACK_IMPORTED_MODULE_0__.pointStart)(result[1]),
                    end: (0,unist_util_position__WEBPACK_IMPORTED_MODULE_0__.pointEnd)(result[result.length - 1])
                  },
                  'tbody',
                  (0,_wrap_js__WEBPACK_IMPORTED_MODULE_1__.wrap)(result.slice(1), true)
                )
                : []
            ),
            true
          )
        )
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/text.js":
/*!**************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/text.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   text: () => (/* binding */ text)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/**
 * @typedef {import('mdast').Text} Text
 * @typedef {import('../index.js').Handler} Handler
 */



/**
 * @type {Handler}
 * @param {Text} node
 */
      function text(h, node) {
        return h.augment(
          node,
          (0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', String(node.value).replace(/[ \t]*(\r?\n|\r)[ \t]*/g, '$1'))
        )
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js":
/*!************************************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js ***!
  \************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   thematicBreak: () => (/* binding */ thematicBreak)
/* harmony export */ });
/**
 * @typedef {import('mdast').ThematicBreak} ThematicBreak
 * @typedef {import('hast').Element} Element
 * @typedef {import('../index.js').Handler} Handler
 */

/**
 * @type {Handler}
 * @param {ThematicBreak} [node]
 * @returns {Element}
 */
      function thematicBreak(h, node) {
        return h(node, 'hr')
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/index.js":
/*!******************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/index.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   toHast: () => (/* binding */ toHast)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/* harmony import */ const unist_util_visit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! unist-util-visit */ "./node_modules/unist-util-visit/lib/index.js");
/* harmony import */ const unist_util_position__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! unist-util-position */ "./node_modules/unist-util-position/lib/index.js");
/* harmony import */ const unist_util_generated__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! unist-util-generated */ "./node_modules/unist-util-generated/lib/index.js");
/* harmony import */ const mdast_util_definitions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! mdast-util-definitions */ "./node_modules/mdast-util-definitions/lib/index.js");
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/* harmony import */ const _footer_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./footer.js */ "./node_modules/mdast-util-to-hast/lib/footer.js");
/* harmony import */ const _handlers_index_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./handlers/index.js */ "./node_modules/mdast-util-to-hast/lib/handlers/index.js");
/**
 * @typedef {import('mdast').Root|import('mdast').Parent['children'][number]} MdastNode
 * @typedef {import('hast').Root|import('hast').Parent['children'][number]} HastNode
 * @typedef {import('mdast').Parent} Parent
 * @typedef {import('mdast').Definition} Definition
 * @typedef {import('mdast').FootnoteDefinition} FootnoteDefinition
 * @typedef {import('hast').Properties} Properties
 * @typedef {import('hast').Text} Text
 * @typedef {import('hast').Comment} Comment
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').Root} Root
 * @typedef {import('hast').ElementContent} Content
 * @typedef {import('unist-util-position').PositionLike} PositionLike
 *
 * @typedef EmbeddedHastFields
 * @property {string} [hName] Defines the tag name of an element
 * @property {Properties} [hProperties] Defines the properties of an element
 * @property {Array.<Content>} [hChildren] Defines the (hast) children of an element
 *
 * @typedef {Object.<string, unknown> & EmbeddedHastFields} Data unist data with embedded hast fields
 *
 * @typedef {MdastNode & {data?: Data}} NodeWithData unist node with embedded hast data
 *
 * @callback Handler
 * @param {H} h Handle context
 * @param {any} node mdast node to handle
 * @param {Parent|null} parent Parent of `node`
 * @returns {Content|Array.<Content>|null|undefined} hast node
 *
 * @callback HFunctionProps
 * @param {MdastNode|PositionLike|null|undefined} node mdast node or unist position
 * @param {string} tagName HTML tag name
 * @param {Properties} props Properties
 * @param {Array.<Content>?} [children] hast content
 * @returns {Element}
 *
 * @callback HFunctionNoProps
 * @param {MdastNode|PositionLike|null|undefined} node mdast node or unist position
 * @param {string} tagName HTML tag name
 * @param {Array.<Content>?} [children] hast content
 * @returns {Element}
 *
 * @typedef HFields
 * @property {boolean} dangerous Whether HTML is allowed
 * @property {(identifier: string) => Definition|null} definition Definition cache
 * @property {Object.<string, FootnoteDefinition>} footnoteById Footnote cache
 * @property {Array.<string>} footnoteOrder Order in which footnotes occur
 * @property {Handlers} handlers Applied handlers
 * @property {Handler} unknownHandler Handler for any none not in `passThrough` or otherwise handled
 * @property {(left: NodeWithData|PositionLike|null|undefined, right: Content) => Content} augment Like `h` but lower-level and usable on non-elements.
 * @property {Array.<string>} passThrough List of node types to pass through untouched (except for their children).
 *
 * @typedef Options
 * @property {boolean} [allowDangerousHtml=false] Whether to allow `html` nodes and inject them as `raw` HTML
 * @property {Handlers} [handlers] Object mapping mdast nodes to functions handling them
 * @property {Array.<string>} [passThrough] List of custom mdast node types to pass through (keep) in hast
 * @property {Handler} [unknownHandler] Handler for all unknown nodes.
 *
 * @typedef {Record.<string, Handler>} Handlers Map of node types to handlers
 * @typedef {HFunctionProps & HFunctionNoProps & HFields} H Handle context
 */










      const own = {}.hasOwnProperty

/**
 * Factory to transform.
 * @param {MdastNode} tree mdast node
 * @param {Options} [options] Configuration
 * @returns {H} `h` function
 */
      function factory(tree, options) {
        const settings = options || {}
        const dangerous = settings.allowDangerousHtml || false
  /** @type {Object.<string, FootnoteDefinition>} */
        const footnoteById = {}

        h.dangerous = dangerous
        h.definition = (0,mdast_util_definitions__WEBPACK_IMPORTED_MODULE_4__.definitions)(tree)
        h.footnoteById = footnoteById
  /** @type {Array.<string>} */
        h.footnoteOrder = []
        h.augment = augment
        h.handlers = {..._handlers_index_js__WEBPACK_IMPORTED_MODULE_7__.handlers, ...settings.handlers}
        h.unknownHandler = settings.unknownHandler
        h.passThrough = settings.passThrough

        ;(0,unist_util_visit__WEBPACK_IMPORTED_MODULE_1__.visit)(tree, 'footnoteDefinition', (definition) => {
          const id = String(definition.identifier).toUpperCase()

    // Mimick CM behavior of link definitions.
    // See: <https://github.com/syntax-tree/mdast-util-definitions/blob/8290999/index.js#L26>.
          if (!own.call(footnoteById, id)) {
            footnoteById[id] = definition
          }
        })

  // @ts-expect-error Hush, it’s fine!
        return h

  /**
   * Finalise the created `right`, a hast node, from `left`, an mdast node.
   * @param {(NodeWithData|PositionLike)?} left
   * @param {Content} right
   * @returns {Content}
   */
        function augment(left, right) {
    // Handle `data.hName`, `data.hProperties, `data.hChildren`.
          if (left && 'data' in left && left.data) {
      /** @type {Data} */
            const data = left.data

            if (data.hName) {
              if (right.type !== 'element') {
                right = {
                  type: 'element',
                  tagName: '',
                  properties: {},
                  children: []
                }
              }

              right.tagName = data.hName
            }

            if (right.type === 'element' && data.hProperties) {
              right.properties = {...right.properties, ...data.hProperties}
            }

            if ('children' in right && right.children && data.hChildren) {
              right.children = data.hChildren
            }
          }

          if (left) {
            const ctx = 'type' in left ? left : {position: left}

            if (!(0,unist_util_generated__WEBPACK_IMPORTED_MODULE_3__.generated)(ctx)) {
              right.position = {start: (0,unist_util_position__WEBPACK_IMPORTED_MODULE_2__.pointStart)(ctx), end: (0,unist_util_position__WEBPACK_IMPORTED_MODULE_2__.pointEnd)(ctx)}
            }
          }

          return right
        }

  /**
   * Create an element for `node`.
   *
   * @type {HFunctionProps}
   */
        function h(node, tagName, props, children) {
          if (Array.isArray(props)) {
            children = props
            props = {}
          }

    // @ts-expect-error augmenting an element yields an element.
          return augment(node, {
            type: 'element',
            tagName,
            properties: props || {},
            children: children || []
          })
        }
      }

/**
 * Transform `tree` (an mdast node) to a hast node.
 *
 * @param {MdastNode} tree mdast node
 * @param {Options} [options] Configuration
 * @returns {HastNode|null|undefined} hast node
 */
      function toHast(tree, options) {
        const h = factory(tree, options)
        const node = (0,_traverse_js__WEBPACK_IMPORTED_MODULE_5__.one)(h, tree, null)
        const foot = (0,_footer_js__WEBPACK_IMPORTED_MODULE_6__.footer)(h)

        if (foot) {
    // @ts-expect-error If there’s a footer, there were definitions, meaning block
    // content.
    // So assume `node` is a parent node.
          node.children.push((0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', '\n'), foot)
        }

        return Array.isArray(node) ? {type: 'root', children: node} : node
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/revert.js":
/*!*******************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/revert.js ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   revert: () => (/* binding */ revert)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/* harmony import */ const _traverse_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./traverse.js */ "./node_modules/mdast-util-to-hast/lib/traverse.js");
/**
 * @typedef {import('mdast').LinkReference} LinkReference
 * @typedef {import('mdast').ImageReference} ImageReference
 * @typedef {import('./index.js').Handler} Handler
 * @typedef {import('./index.js').Content} Content
 */




/**
 * Return the content of a reference without definition as plain text.
 *
 * @type {Handler}
 * @param {ImageReference|LinkReference} node
 * @returns {Content|Array.<Content>}
 */
      function revert(h, node) {
        const subtype = node.referenceType
        let suffix = ']'

        if (subtype === 'collapsed') {
          suffix += '[]'
        } else if (subtype === 'full') {
          suffix += '[' + (node.label || node.identifier) + ']'
        }

        if (node.type === 'imageReference') {
          return (0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', '![' + node.alt + suffix)
        }

        const contents = (0,_traverse_js__WEBPACK_IMPORTED_MODULE_1__.all)(h, node)
        const head = contents[0]

        if (head && head.type === 'text') {
          head.value = '[' + head.value
        } else {
          contents.unshift((0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', '['))
        }

        const tail = contents[contents.length - 1]

        if (tail && tail.type === 'text') {
          tail.value += suffix
        } else {
          contents.push((0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', suffix))
        }

        return contents
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/traverse.js":
/*!*********************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/traverse.js ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   all: () => (/* binding */ all),
/* harmony export */   one: () => (/* binding */ one)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/**
 * @typedef {import('mdast').Root|import('mdast').Parent['children'][number]} MdastNode
 * @typedef {import('./index.js').H} H
 * @typedef {import('./index.js').Handler} Handler
 * @typedef {import('./index.js').Content} Content
 */



      const own = {}.hasOwnProperty

/**
 * Transform an unknown node.
 * @type {Handler}
 * @param {MdastNode} node
 */
      function unknown(h, node) {
        const data = node.data || {}

        if (
          'value' in node &&
    !(
      own.call(data, 'hName') ||
      own.call(data, 'hProperties') ||
      own.call(data, 'hChildren')
    )
        ) {
          return h.augment(node, (0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', node.value))
        }

        return h(node, 'div', all(h, node))
      }

/**
 * @type {Handler}
 * @param {MdastNode} node
 */
      function one(h, node, parent) {
        const type = node && node.type
  /** @type {Handler} */
        let fn

  // Fail on non-nodes.
        if (!type) {
          throw new Error('Expected node, got `' + node + '`')
        }

        if (own.call(h.handlers, type)) {
          fn = h.handlers[type]
        } else if (h.passThrough && h.passThrough.includes(type)) {
          fn = returnNode
        } else {
          fn = h.unknownHandler
        }

        return (typeof fn === 'function' ? fn : unknown)(h, node, parent)
      }

/**
 * @type {Handler}
 * @param {MdastNode} node
 */
      function returnNode(h, node) {
  // @ts-expect-error: Pass through custom node.
        return 'children' in node ? {...node, children: all(h, node)} : node
      }

/**
 * @param {H} h
 * @param {MdastNode} parent
 */
      function all(h, parent) {
  /** @type {Array.<Content>} */
        const values = []

        if ('children' in parent) {
          const nodes = parent.children
          let index = -1

          while (++index < nodes.length) {
            const result = one(h, nodes[index], parent)

            if (result) {
              if (index && nodes[index - 1].type === 'break') {
                if (!Array.isArray(result) && result.type === 'text') {
                  result.value = result.value.replace(/^\s+/, '')
                }

                if (!Array.isArray(result) && result.type === 'element') {
                  const head = result.children[0]

                  if (head && head.type === 'text') {
                    head.value = head.value.replace(/^\s+/, '')
                  }
                }
              }

              if (Array.isArray(result)) {
                values.push(...result)
              } else {
                values.push(result)
              }
            }
          }
        }

        return values
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-hast/lib/wrap.js":
/*!*****************************************************!*\
  !*** ./node_modules/mdast-util-to-hast/lib/wrap.js ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   wrap: () => (/* binding */ wrap)
/* harmony export */ });
/* harmony import */ const unist_builder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-builder */ "./node_modules/unist-builder/lib/index.js");
/**
 * @typedef {import('./index.js').Content} Content
 */



/**
 * Wrap `nodes` with line feeds between each entry.
 * Optionally adds line feeds at the start and end.
 *
 * @param {Array.<Content>} nodes
 * @param {boolean} [loose=false]
 * @returns {Array.<Content>}
 */
      function wrap(nodes, loose) {
  /** @type {Array.<Content>} */
        const result = []
        let index = -1

        if (loose) {
          result.push((0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', '\n'))
        }

        while (++index < nodes.length) {
          if (index) result.push((0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', '\n'))
          result.push(nodes[index])
        }

        if (loose && nodes.length > 0) {
          result.push((0,unist_builder__WEBPACK_IMPORTED_MODULE_0__.u)('text', '\n'))
        }

        return result
      }


/***/ }),

/***/ "./node_modules/mdast-util-to-string/lib/index.js":
/*!********************************************************!*\
  !*** ./node_modules/mdast-util-to-string/lib/index.js ***!
  \********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   toString: () => (/* binding */ toString)
/* harmony export */ });
/**
 * @typedef {import('mdast').Root|import('mdast').Content} Node
 *
 * @typedef Options
 *   Configuration (optional).
 * @property {boolean | null | undefined} [includeImageAlt=true]
 *   Whether to use `alt` for `image`s.
 * @property {boolean | null | undefined} [includeHtml=true]
 *   Whether to use `value` of HTML.
 */

/** @type {Options} */
      const emptyOptions = {}

/**
 * Get the text content of a node or list of nodes.
 *
 * Prefers the node’s plain-text fields, otherwise serializes its children,
 * and if the given value is an array, serialize the nodes in it.
 *
 * @param {unknown} value
 *   Thing to serialize, typically `Node`.
 * @param {Options | null | undefined} [options]
 *   Configuration (optional).
 * @returns {string}
 *   Serialized `value`.
 */
      function toString(value, options) {
        const settings = options || emptyOptions
        const includeImageAlt =
    typeof settings.includeImageAlt === 'boolean'
      ? settings.includeImageAlt
      : true
        const includeHtml =
    typeof settings.includeHtml === 'boolean' ? settings.includeHtml : true

        return one(value, includeImageAlt, includeHtml)
      }

/**
 * One node or several nodes.
 *
 * @param {unknown} value
 *   Thing to serialize.
 * @param {boolean} includeImageAlt
 *   Include image `alt`s.
 * @param {boolean} includeHtml
 *   Include HTML.
 * @returns {string}
 *   Serialized node.
 */
      function one(value, includeImageAlt, includeHtml) {
        if (node(value)) {
          if ('value' in value) {
            return value.type === 'html' && !includeHtml ? '' : value.value
          }

          if (includeImageAlt && 'alt' in value && value.alt) {
            return value.alt
          }

          if ('children' in value) {
            return all(value.children, includeImageAlt, includeHtml)
          }
        }

        if (Array.isArray(value)) {
          return all(value, includeImageAlt, includeHtml)
        }

        return ''
      }

/**
 * Serialize a list of nodes.
 *
 * @param {Array<unknown>} values
 *   Thing to serialize.
 * @param {boolean} includeImageAlt
 *   Include image `alt`s.
 * @param {boolean} includeHtml
 *   Include HTML.
 * @returns {string}
 *   Serialized nodes.
 */
      function all(values, includeImageAlt, includeHtml) {
  /** @type {Array<string>} */
        const result = []
        let index = -1

        while (++index < values.length) {
          result[index] = one(values[index], includeImageAlt, includeHtml)
        }

        return result.join('')
      }

/**
 * Check if `value` looks like a node.
 *
 * @param {unknown} value
 *   Thing.
 * @returns {value is Node}
 *   Whether `value` is a node.
 */
      function node(value) {
        return Boolean(value && typeof value === 'object')
      }


/***/ }),

/***/ "./node_modules/mdurl/encode.js":
/*!**************************************!*\
  !*** ./node_modules/mdurl/encode.js ***!
  \**************************************/
/***/ ((module) => {

      "use strict";




      const encodeCache = {};


// Create a lookup array where anything but characters in `chars` string
// and alphanumeric chars is percent-encoded.
//
      function getEncodeCache(exclude) {
        let i, ch, cache = encodeCache[exclude];
        if (cache) { return cache; }

        cache = encodeCache[exclude] = [];

        for (i = 0; i < 128; i++) {
          ch = String.fromCharCode(i);

          if (/^[0-9a-z]$/i.test(ch)) {
      // always allow unencoded alphanumeric characters
            cache.push(ch);
          } else {
            cache.push('%' + ('0' + i.toString(16).toUpperCase()).slice(-2));
          }
        }

        for (i = 0; i < exclude.length; i++) {
          cache[exclude.charCodeAt(i)] = exclude[i];
        }

        return cache;
      }


// Encode unsafe characters with percent-encoding, skipping already
// encoded sequences.
//
//  - string       - string to encode
//  - exclude      - list of characters to ignore (in addition to a-zA-Z0-9)
//  - keepEscaped  - don't encode '%' in a correct escape sequence (default: true)
//
      function encode(string, exclude, keepEscaped) {
        let i, l, code, nextCode, cache,
          result = '';

        if (typeof exclude !== 'string') {
    // encode(string, keepEscaped)
          keepEscaped  = exclude;
          exclude = encode.defaultChars;
        }

        if (typeof keepEscaped === 'undefined') {
          keepEscaped = true;
        }

        cache = getEncodeCache(exclude);

        for (i = 0, l = string.length; i < l; i++) {
          code = string.charCodeAt(i);

          if (keepEscaped && code === 0x25 /* % */ && i + 2 < l) {
            if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
              result += string.slice(i, i + 3);
              i += 2;
              continue;
            }
          }

          if (code < 128) {
            result += cache[code];
            continue;
          }

          if (code >= 0xD800 && code <= 0xDFFF) {
            if (code >= 0xD800 && code <= 0xDBFF && i + 1 < l) {
              nextCode = string.charCodeAt(i + 1);
              if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
                result += encodeURIComponent(string[i] + string[i + 1]);
                i++;
                continue;
              }
            }
            result += '%EF%BF%BD';
            continue;
          }

          result += encodeURIComponent(string[i]);
        }

        return result;
      }

      encode.defaultChars   = ";/?:@&=+$,-_.!~*'()#";
      encode.componentChars = "-_.!~*'()";


      module.exports = encode;


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/attention.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/attention.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   attention: () => (/* binding */ attention)
/* harmony export */ });
/* harmony import */ const micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-chunked */ "./node_modules/micromark-util-chunked/dev/index.js");
/* harmony import */ const micromark_util_classify_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-classify-character */ "./node_modules/micromark-util-classify-character/dev/index.js");
/* harmony import */ const micromark_util_resolve_all__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-resolve-all */ "./node_modules/micromark-util-resolve-all/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').Event} Event
 * @typedef {import('micromark-util-types').Point} Point
 * @typedef {import('micromark-util-types').Resolver} Resolver
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */









/** @type {Construct} */
      const attention = {
        name: 'attention',
        tokenize: tokenizeAttention,
        resolveAll: resolveAllAttention
      }

/**
 * Take all events and resolve attention to emphasis or strong.
 *
 * @type {Resolver}
 */
      function resolveAllAttention(events, context) {
        let index = -1
  /** @type {number} */
        let open
  /** @type {Token} */
        let group
  /** @type {Token} */
        let text
  /** @type {Token} */
        let openingSequence
  /** @type {Token} */
        let closingSequence
  /** @type {number} */
        let use
  /** @type {Array<Event>} */
        let nextEvents
  /** @type {number} */
        let offset

  // Walk through all events.
  //
  // Note: performance of this is fine on an mb of normal markdown, but it’s
  // a bottleneck for malicious stuff.
        while (++index < events.length) {
    // Find a token that can close.
          if (
            events[index][0] === 'enter' &&
      events[index][1].type === 'attentionSequence' &&
      events[index][1]._close
          ) {
            open = index

      // Now walk back to find an opener.
            while (open--) {
        // Find a token that can open the closer.
              if (
                events[open][0] === 'exit' &&
          events[open][1].type === 'attentionSequence' &&
          events[open][1]._open &&
          // If the markers are the same:
          context.sliceSerialize(events[open][1]).charCodeAt(0) ===
            context.sliceSerialize(events[index][1]).charCodeAt(0)
              ) {
          // If the opening can close or the closing can open,
          // and the close size *is not* a multiple of three,
          // but the sum of the opening and closing size *is* multiple of three,
          // then don’t match.
                if (
                  (events[open][1]._close || events[index][1]._open) &&
            (events[index][1].end.offset - events[index][1].start.offset) % 3 &&
            !(
              (events[open][1].end.offset -
                events[open][1].start.offset +
                events[index][1].end.offset -
                events[index][1].start.offset) %
              3
            )
                ) {
                  continue
                }

          // Number of markers to use from the sequence.
                use =
            events[open][1].end.offset - events[open][1].start.offset > 1 &&
            events[index][1].end.offset - events[index][1].start.offset > 1
              ? 2
              : 1

                const start = Object.assign({}, events[open][1].end)
                const end = Object.assign({}, events[index][1].start)
                movePoint(start, -use)
                movePoint(end, use)

                openingSequence = {
                  type: use > 1 ? micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.strongSequence : micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.emphasisSequence,
                  start,
                  end: Object.assign({}, events[open][1].end)
                }
                closingSequence = {
                  type: use > 1 ? micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.strongSequence : micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.emphasisSequence,
                  start: Object.assign({}, events[index][1].start),
                  end
                }
                text = {
                  type: use > 1 ? micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.strongText : micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.emphasisText,
                  start: Object.assign({}, events[open][1].end),
                  end: Object.assign({}, events[index][1].start)
                }
                group = {
                  type: use > 1 ? micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.strong : micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.emphasis,
                  start: Object.assign({}, openingSequence.start),
                  end: Object.assign({}, closingSequence.end)
                }

                events[open][1].end = Object.assign({}, openingSequence.start)
                events[index][1].start = Object.assign({}, closingSequence.end)

                nextEvents = []

          // If there are more markers in the opening, add them before.
                if (events[open][1].end.offset - events[open][1].start.offset) {
                  nextEvents = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__.push)(nextEvents, [
                    ['enter', events[open][1], context],
                    ['exit', events[open][1], context]
                  ])
                }

          // Opening.
                nextEvents = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__.push)(nextEvents, [
                  ['enter', group, context],
                  ['enter', openingSequence, context],
                  ['exit', openingSequence, context],
                  ['enter', text, context]
                ])

          // Always populated by defaults.
                ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
                  context.parser.constructs.insideSpan.null,
                  'expected `insideSpan` to be populated'
                )

          // Between.
                nextEvents = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__.push)(
                  nextEvents,
                  (0,micromark_util_resolve_all__WEBPACK_IMPORTED_MODULE_2__.resolveAll)(
                    context.parser.constructs.insideSpan.null,
                    events.slice(open + 1, index),
                    context
                  )
                )

          // Closing.
                nextEvents = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__.push)(nextEvents, [
                  ['exit', text, context],
                  ['enter', closingSequence, context],
                  ['exit', closingSequence, context],
                  ['exit', group, context]
                ])

          // If there are more markers in the closing, add them after.
                if (events[index][1].end.offset - events[index][1].start.offset) {
                  offset = 2
                  nextEvents = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__.push)(nextEvents, [
                    ['enter', events[index][1], context],
                    ['exit', events[index][1], context]
                  ])
                } else {
                  offset = 0
                }

                (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__.splice)(events, open - 1, index - open + 3, nextEvents)

                index = open + nextEvents.length - offset - 2
                break
              }
            }
          }
        }

  // Remove remaining sequences.
        index = -1

        while (++index < events.length) {
          if (events[index][1].type === 'attentionSequence') {
            events[index][1].type = 'data'
          }
        }

        return events
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeAttention(effects, ok) {
        const attentionMarkers = this.parser.constructs.attentionMarkers.null
        const previous = this.previous
        const before = (0,micromark_util_classify_character__WEBPACK_IMPORTED_MODULE_1__.classifyCharacter)(previous)

  /** @type {NonNullable<Code>} */
        let marker

        return start

  /**
   * Before a sequence.
   *
   * ```markdown
   * > | **
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.asterisk || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.underscore,
            'expected asterisk or underscore'
          )
          marker = code
          effects.enter('attentionSequence')
          return inside(code)
        }

  /**
   * In a sequence.
   *
   * ```markdown
   * > | **
   *     ^^
   * ```
   *
   * @type {State}
   */
        function inside(code) {
          if (code === marker) {
            effects.consume(code)
            return inside
          }

          const token = effects.exit('attentionSequence')

    // To do: next major: move this to resolver, just like `markdown-rs`.
          const after = (0,micromark_util_classify_character__WEBPACK_IMPORTED_MODULE_1__.classifyCharacter)(code)

    // Always populated by defaults.
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(attentionMarkers, 'expected `attentionMarkers` to be populated')

          const open =
      !after ||
      (after === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__.constants.characterGroupPunctuation && before) ||
      attentionMarkers.includes(code)
          const close =
      !before ||
      (before === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__.constants.characterGroupPunctuation && after) ||
      attentionMarkers.includes(previous)

          token._open = Boolean(
            marker === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.asterisk ? open : open && (before || !close)
          )
          token._close = Boolean(
            marker === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.asterisk ? close : close && (after || !open)
          )
          return ok(code)
        }
      }

/**
 * Move a point a bit.
 *
 * Note: `move` only works inside lines! It’s not possible to move past other
 * chunks (replacement characters, tabs, or line endings).
 *
 * @param {Point} point
 * @param {number} offset
 * @returns {void}
 */
      function movePoint(point, offset) {
        point.column += offset
        point.offset += offset
        point._bufferIndex += offset
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/autolink.js":
/*!********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/autolink.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   autolink: () => (/* binding */ autolink)
/* harmony export */ });
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */







/** @type {Construct} */
      const autolink = {name: 'autolink', tokenize: tokenizeAutolink}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeAutolink(effects, ok, nok) {
        let size = 0

        return start

  /**
   * Start of an autolink.
   *
   * ```markdown
   * > | a<https://example.com>b
   *      ^
   * > | a<user@example.com>b
   *      ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_4__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.lessThan, 'expected `<`')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolink)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkMarker)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkMarker)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkProtocol)
          return open
        }

  /**
   * After `<`, at protocol or atext.
   *
   * ```markdown
   * > | a<https://example.com>b
   *       ^
   * > | a<user@example.com>b
   *       ^
   * ```
   *
   * @type {State}
   */
        function open(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlpha)(code)) {
            effects.consume(code)
            return schemeOrEmailAtext
          }

          return emailAtext(code)
        }

  /**
   * At second byte of protocol or atext.
   *
   * ```markdown
   * > | a<https://example.com>b
   *        ^
   * > | a<user@example.com>b
   *        ^
   * ```
   *
   * @type {State}
   */
        function schemeOrEmailAtext(code) {
    // ASCII alphanumeric and `+`, `-`, and `.`.
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.plusSign ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.dash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.dot ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlphanumeric)(code)
          ) {
      // Count the previous alphabetical from `open` too.
            size = 1
            return schemeInsideOrEmailAtext(code)
          }

          return emailAtext(code)
        }

  /**
   * In ambiguous protocol or atext.
   *
   * ```markdown
   * > | a<https://example.com>b
   *        ^
   * > | a<user@example.com>b
   *        ^
   * ```
   *
   * @type {State}
   */
        function schemeInsideOrEmailAtext(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.colon) {
            effects.consume(code)
            size = 0
            return urlInside
          }

    // ASCII alphanumeric and `+`, `-`, and `.`.
          if (
            (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.plusSign ||
        code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.dash ||
        code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.dot ||
        (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlphanumeric)(code)) &&
      size++ < micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__.constants.autolinkSchemeSizeMax
          ) {
            effects.consume(code)
            return schemeInsideOrEmailAtext
          }

          size = 0
          return emailAtext(code)
        }

  /**
   * After protocol, in URL.
   *
   * ```markdown
   * > | a<https://example.com>b
   *             ^
   * ```
   *
   * @type {State}
   */
        function urlInside(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.greaterThan) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkProtocol)
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkMarker)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkMarker)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolink)
            return ok
          }

    // ASCII control, space, or `<`.
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.space ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.lessThan ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiControl)(code)
          ) {
            return nok(code)
          }

          effects.consume(code)
          return urlInside
        }

  /**
   * In email atext.
   *
   * ```markdown
   * > | a<user.name@example.com>b
   *              ^
   * ```
   *
   * @type {State}
   */
        function emailAtext(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.atSign) {
            effects.consume(code)
            return emailAtSignOrDot
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAtext)(code)) {
            effects.consume(code)
            return emailAtext
          }

          return nok(code)
        }

  /**
   * In label, after at-sign or dot.
   *
   * ```markdown
   * > | a<user.name@example.com>b
   *                 ^       ^
   * ```
   *
   * @type {State}
   */
        function emailAtSignOrDot(code) {
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlphanumeric)(code) ? emailLabel(code) : nok(code)
        }

  /**
   * In label, where `.` and `>` are allowed.
   *
   * ```markdown
   * > | a<user.name@example.com>b
   *                   ^
   * ```
   *
   * @type {State}
   */
        function emailLabel(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.dot) {
            effects.consume(code)
            size = 0
            return emailAtSignOrDot
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.greaterThan) {
      // Exit, then change the token type.
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkProtocol).type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkEmail
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkMarker)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolinkMarker)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.autolink)
            return ok
          }

          return emailValue(code)
        }

  /**
   * In label, where `.` and `>` are *not* allowed.
   *
   * Though, this is also used in `emailLabel` to parse other values.
   *
   * ```markdown
   * > | a<user.name@ex-ample.com>b
   *                    ^
   * ```
   *
   * @type {State}
   */
        function emailValue(code) {
    // ASCII alphanumeric or `-`.
          if (
            (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.dash || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlphanumeric)(code)) &&
      size++ < micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__.constants.autolinkDomainSizeMax
          ) {
            const next = code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.dash ? emailValue : emailLabel
            effects.consume(code)
            return next
          }

          return nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/blank-line.js":
/*!**********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/blank-line.js ***!
  \**********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   blankLine: () => (/* binding */ blankLine)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */






/** @type {Construct} */
      const blankLine = {tokenize: tokenizeBlankLine, partial: true}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeBlankLine(effects, ok, nok) {
        return start

  /**
   * Start of blank line.
   *
   * > 👉 **Note**: `␠` represents a space character.
   *
   * ```markdown
   * > | ␠␠␊
   *     ^
   * > | ␊
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)
            ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, after, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.linePrefix)(code)
            : after(code)
        }

  /**
   * At eof/eol, after optional whitespace.
   *
   * > 👉 **Note**: `␠` represents a space character.
   *
   * ```markdown
   * > | ␠␠␊
   *       ^
   * > | ␊
   *     ^
   * ```
   *
   * @type {State}
   */
        function after(code) {
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code) ? ok(code) : nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/block-quote.js":
/*!***********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/block-quote.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   blockQuote: () => (/* binding */ blockQuote)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').Exiter} Exiter
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */








/** @type {Construct} */
      const blockQuote = {
        name: 'blockQuote',
        tokenize: tokenizeBlockQuoteStart,
        continuation: {tokenize: tokenizeBlockQuoteContinuation},
        exit
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeBlockQuoteStart(effects, ok, nok) {
        const self = this

        return start

  /**
   * Start of block quote.
   *
   * ```markdown
   * > | > a
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan) {
            const state = self.containerState

      ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(state, 'expected `containerState` to be defined in container')

            if (!state.open) {
              effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.blockQuote, {_container: true})
              state.open = true
            }

            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.blockQuotePrefix)
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.blockQuoteMarker)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.blockQuoteMarker)
            return after
          }

          return nok(code)
        }

  /**
   * After `>`, before optional whitespace.
   *
   * ```markdown
   * > | > a
   *      ^
   * ```
   *
   * @type {State}
   */
        function after(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.blockQuotePrefixWhitespace)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.blockQuotePrefixWhitespace)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.blockQuotePrefix)
            return ok
          }

          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.blockQuotePrefix)
          return ok(code)
        }
      }

/**
 * Start of block quote continuation.
 *
 * ```markdown
 *   | > a
 * > | > b
 *     ^
 * ```
 *
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeBlockQuoteContinuation(effects, ok, nok) {
        const self = this

        return contStart

  /**
   * Start of block quote continuation.
   *
   * Also used to parse the first block quote opening.
   *
   * ```markdown
   *   | > a
   * > | > b
   *     ^
   * ```
   *
   * @type {State}
   */
        function contStart(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
      // Always populated by defaults.
            (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(
              self.parser.constructs.disable.null,
              'expected `disable.null` to be populated'
            )

            return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
              effects,
              contBefore,
              micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix,
              self.parser.constructs.disable.null.includes('codeIndented')
                ? undefined
                : micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.tabSize
            )(code)
          }

          return contBefore(code)
        }

  /**
   * At `>`, after optional whitespace.
   *
   * Also used to parse the first block quote opening.
   *
   * ```markdown
   *   | > a
   * > | > b
   *     ^
   * ```
   *
   * @type {State}
   */
        function contBefore(code) {
          return effects.attempt(blockQuote, ok, nok)(code)
        }
      }

/** @type {Exiter} */
      function exit(effects) {
        effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.blockQuote)
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/character-escape.js":
/*!****************************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/character-escape.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   characterEscape: () => (/* binding */ characterEscape)
/* harmony export */ });
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */






/** @type {Construct} */
      const characterEscape = {
        name: 'characterEscape',
        tokenize: tokenizeCharacterEscape
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeCharacterEscape(effects, ok, nok) {
        return start

  /**
   * Start of character escape.
   *
   * ```markdown
   * > | a\*b
   *      ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.backslash, 'expected `\\`')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.characterEscape)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.escapeMarker)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.escapeMarker)
          return inside
        }

  /**
   * After `\`, at punctuation.
   *
   * ```markdown
   * > | a\*b
   *       ^
   * ```
   *
   * @type {State}
   */
        function inside(code) {
    // ASCII punctuation.
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiPunctuation)(code)) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.characterEscapeValue)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.characterEscapeValue)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.characterEscape)
            return ok
          }

          return nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/character-reference.js":
/*!*******************************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/character-reference.js ***!
  \*******************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   characterReference: () => (/* binding */ characterReference)
/* harmony export */ });
/* harmony import */ const decode_named_character_reference__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! decode-named-character-reference */ "./node_modules/decode-named-character-reference/index.dom.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */








/** @type {Construct} */
      const characterReference = {
        name: 'characterReference',
        tokenize: tokenizeCharacterReference
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeCharacterReference(effects, ok, nok) {
        const self = this
        let size = 0
  /** @type {number} */
        let max
  /** @type {(code: Code) => boolean} */
        let test

        return start

  /**
   * Start of character reference.
   *
   * ```markdown
   * > | a&amp;b
   *      ^
   * > | a&#123;b
   *      ^
   * > | a&#x9;b
   *      ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.ampersand, 'expected `&`')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReference)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceMarker)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceMarker)
          return open
        }

  /**
   * After `&`, at `#` for numeric references or alphanumeric for named
   * references.
   *
   * ```markdown
   * > | a&amp;b
   *       ^
   * > | a&#123;b
   *       ^
   * > | a&#x9;b
   *       ^
   * ```
   *
   * @type {State}
   */
        function open(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.numberSign) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceMarkerNumeric)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceMarkerNumeric)
            return numeric
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceValue)
          max = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.characterReferenceNamedSizeMax
          test = micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiAlphanumeric
          return value(code)
        }

  /**
   * After `#`, at `x` for hexadecimals or digit for decimals.
   *
   * ```markdown
   * > | a&#123;b
   *        ^
   * > | a&#x9;b
   *        ^
   * ```
   *
   * @type {State}
   */
        function numeric(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.uppercaseX || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.lowercaseX) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceMarkerHexadecimal)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceMarkerHexadecimal)
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceValue)
            max = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.characterReferenceHexadecimalSizeMax
            test = micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiHexDigit
            return value
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceValue)
          max = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.characterReferenceDecimalSizeMax
          test = micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiDigit
          return value(code)
        }

  /**
   * After markers (`&#x`, `&#`, or `&`), in value, before `;`.
   *
   * The character reference kind defines what and how many characters are
   * allowed.
   *
   * ```markdown
   * > | a&amp;b
   *       ^^^
   * > | a&#123;b
   *        ^^^
   * > | a&#x9;b
   *         ^
   * ```
   *
   * @type {State}
   */
        function value(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.semicolon && size) {
            const token = effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceValue)

            if (
              test === micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiAlphanumeric &&
        !(0,decode_named_character_reference__WEBPACK_IMPORTED_MODULE_0__.decodeNamedCharacterReference)(self.sliceSerialize(token))
            ) {
              return nok(code)
            }

      // To do: `markdown-rs` uses a different name:
      // `CharacterReferenceMarkerSemi`.
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceMarker)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReferenceMarker)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.characterReference)
            return ok
          }

          if (test(code) && size++ < max) {
            effects.consume(code)
            return value
          }

          return nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/code-fenced.js":
/*!***********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/code-fenced.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   codeFenced: () => (/* binding */ codeFenced)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */








/** @type {Construct} */
      const nonLazyContinuation = {
        tokenize: tokenizeNonLazyContinuation,
        partial: true
      }

/** @type {Construct} */
      const codeFenced = {
        name: 'codeFenced',
        tokenize: tokenizeCodeFenced,
        concrete: true
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeCodeFenced(effects, ok, nok) {
        const self = this
  /** @type {Construct} */
        const closeStart = {tokenize: tokenizeCloseStart, partial: true}
        let initialPrefix = 0
        let sizeOpen = 0
  /** @type {NonNullable<Code>} */
        let marker

        return start

  /**
   * Start of code.
   *
   * ```markdown
   * > | ~~~js
   *     ^
   *   | alert(1)
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function start(code) {
    // To do: parse whitespace like `markdown-rs`.
          return beforeSequenceOpen(code)
        }

  /**
   * In opening fence, after prefix, at sequence.
   *
   * ```markdown
   * > | ~~~js
   *     ^
   *   | alert(1)
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function beforeSequenceOpen(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.graveAccent || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.tilde,
            'expected `` ` `` or `~`'
          )

          const tail = self.events[self.events.length - 1]
          initialPrefix =
      tail && tail[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix
        ? tail[2].sliceSerialize(tail[1], true).length
        : 0

          marker = code
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFenced)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFence)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFenceSequence)
          return sequenceOpen(code)
        }

  /**
   * In opening fence sequence.
   *
   * ```markdown
   * > | ~~~js
   *      ^
   *   | alert(1)
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function sequenceOpen(code) {
          if (code === marker) {
            sizeOpen++
            effects.consume(code)
            return sequenceOpen
          }

          if (sizeOpen < micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.codeFencedSequenceSizeMin) {
            return nok(code)
          }

          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFenceSequence)
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)
            ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, infoBefore, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.whitespace)(code)
            : infoBefore(code)
        }

  /**
   * In opening fence, after the sequence (and optional whitespace), before info.
   *
   * ```markdown
   * > | ~~~js
   *        ^
   *   | alert(1)
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function infoBefore(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFence)
            return self.interrupt
              ? ok(code)
              : effects.check(nonLazyContinuation, atNonLazyBreak, after)(code)
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFenceInfo)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkString, {contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.contentTypeString})
          return info(code)
        }

  /**
   * In info.
   *
   * ```markdown
   * > | ~~~js
   *        ^
   *   | alert(1)
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function info(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkString)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFenceInfo)
            return infoBefore(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkString)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFenceInfo)
            return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, metaBefore, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.whitespace)(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.graveAccent && code === marker) {
            return nok(code)
          }

          effects.consume(code)
          return info
        }

  /**
   * In opening fence, after info and whitespace, before meta.
   *
   * ```markdown
   * > | ~~~js eval
   *           ^
   *   | alert(1)
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function metaBefore(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            return infoBefore(code)
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFenceMeta)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkString, {contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.contentTypeString})
          return meta(code)
        }

  /**
   * In meta.
   *
   * ```markdown
   * > | ~~~js eval
   *           ^
   *   | alert(1)
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function meta(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkString)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFenceMeta)
            return infoBefore(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.graveAccent && code === marker) {
            return nok(code)
          }

          effects.consume(code)
          return meta
        }

  /**
   * At eol/eof in code, before a non-lazy closing fence or content.
   *
   * ```markdown
   * > | ~~~js
   *          ^
   * > | alert(1)
   *             ^
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function atNonLazyBreak(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code), 'expected eol')
          return effects.attempt(closeStart, after, contentBefore)(code)
        }

  /**
   * Before code content, not a closing fence, at eol.
   *
   * ```markdown
   *   | ~~~js
   * > | alert(1)
   *             ^
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function contentBefore(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code), 'expected eol')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          return contentStart
        }

  /**
   * Before code content, not a closing fence.
   *
   * ```markdown
   *   | ~~~js
   * > | alert(1)
   *     ^
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function contentStart(code) {
          return initialPrefix > 0 && (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)
            ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
              effects,
              beforeContentChunk,
              micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix,
              initialPrefix + 1
            )(code)
            : beforeContentChunk(code)
        }

  /**
   * Before code content, after optional prefix.
   *
   * ```markdown
   *   | ~~~js
   * > | alert(1)
   *     ^
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function beforeContentChunk(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            return effects.check(nonLazyContinuation, atNonLazyBreak, after)(code)
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFlowValue)
          return contentChunk(code)
        }

  /**
   * In code content.
   *
   * ```markdown
   *   | ~~~js
   * > | alert(1)
   *     ^^^^^^^^
   *   | ~~~
   * ```
   *
   * @type {State}
   */
        function contentChunk(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFlowValue)
            return beforeContentChunk(code)
          }

          effects.consume(code)
          return contentChunk
        }

  /**
   * After code.
   *
   * ```markdown
   *   | ~~~js
   *   | alert(1)
   * > | ~~~
   *        ^
   * ```
   *
   * @type {State}
   */
        function after(code) {
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFenced)
          return ok(code)
        }

  /**
   * @this {TokenizeContext}
   * @type {Tokenizer}
   */
        function tokenizeCloseStart(effects, ok, nok) {
          let size = 0

          return startBefore

    /**
     *
     *
     * @type {State}
     */
          function startBefore(code) {
            (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code), 'expected eol')
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
            return start
          }

    /**
     * Before closing fence, at optional whitespace.
     *
     * ```markdown
     *   | ~~~js
     *   | alert(1)
     * > | ~~~
     *     ^
     * ```
     *
     * @type {State}
     */
          function start(code) {
      // Always populated by defaults.
            (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(
              self.parser.constructs.disable.null,
              'expected `disable.null` to be populated'
            )

      // To do: `enter` here or in next state?
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFence)
            return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)
              ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
                effects,
                beforeSequenceClose,
                micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix,
                self.parser.constructs.disable.null.includes('codeIndented')
                  ? undefined
                  : micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.tabSize
              )(code)
              : beforeSequenceClose(code)
          }

    /**
     * In closing fence, after optional whitespace, at sequence.
     *
     * ```markdown
     *   | ~~~js
     *   | alert(1)
     * > | ~~~
     *     ^
     * ```
     *
     * @type {State}
     */
          function beforeSequenceClose(code) {
            if (code === marker) {
              effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFenceSequence)
              return sequenceClose(code)
            }

            return nok(code)
          }

    /**
     * In closing fence sequence.
     *
     * ```markdown
     *   | ~~~js
     *   | alert(1)
     * > | ~~~
     *     ^
     * ```
     *
     * @type {State}
     */
          function sequenceClose(code) {
            if (code === marker) {
              size++
              effects.consume(code)
              return sequenceClose
            }

            if (size >= sizeOpen) {
              effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFenceSequence)
              return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)
                ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, sequenceCloseAfter, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.whitespace)(code)
                : sequenceCloseAfter(code)
            }

            return nok(code)
          }

    /**
     * After closing fence sequence, after optional whitespace.
     *
     * ```markdown
     *   | ~~~js
     *   | alert(1)
     * > | ~~~
     *        ^
     * ```
     *
     * @type {State}
     */
          function sequenceCloseAfter(code) {
            if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
              effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFencedFence)
              return ok(code)
            }

            return nok(code)
          }
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeNonLazyContinuation(effects, ok, nok) {
        const self = this

        return start

  /**
   *
   *
   * @type {State}
   */
        function start(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof) {
            return nok(code)
          }

          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code), 'expected eol')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          return lineStart
        }

  /**
   *
   *
   * @type {State}
   */
        function lineStart(code) {
          return self.parser.lazy[self.now().line] ? nok(code) : ok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/code-indented.js":
/*!*************************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/code-indented.js ***!
  \*************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   codeIndented: () => (/* binding */ codeIndented)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */








/** @type {Construct} */
      const codeIndented = {
        name: 'codeIndented',
        tokenize: tokenizeCodeIndented
      }

/** @type {Construct} */
      const furtherStart = {tokenize: tokenizeFurtherStart, partial: true}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeCodeIndented(effects, ok, nok) {
        const self = this
        return start

  /**
   * Start of code (indented).
   *
   * > **Parsing note**: it is not needed to check if this first line is a
   * > filled line (that it has a non-whitespace character), because blank lines
   * > are parsed already, so we never run into that.
   *
   * ```markdown
   * > |     aaa
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
    // To do: manually check if interrupting like `markdown-rs`.
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code))
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeIndented)
    // To do: use an improved `space_or_tab` function like `markdown-rs`,
    // so that we can drop the next state.
          return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
            effects,
            afterPrefix,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix,
            micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.tabSize + 1
          )(code)
        }

  /**
   * At start, after 1 or 4 spaces.
   *
   * ```markdown
   * > |     aaa
   *         ^
   * ```
   *
   * @type {State}
   */
        function afterPrefix(code) {
          const tail = self.events[self.events.length - 1]
          return tail &&
      tail[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix &&
      tail[2].sliceSerialize(tail[1], true).length >= micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.tabSize
            ? atBreak(code)
            : nok(code)
        }

  /**
   * At a break.
   *
   * ```markdown
   * > |     aaa
   *         ^  ^
   * ```
   *
   * @type {State}
   */
        function atBreak(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof) {
            return after(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            return effects.attempt(furtherStart, atBreak, after)(code)
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFlowValue)
          return inside(code)
        }

  /**
   * In code content.
   *
   * ```markdown
   * > |     aaa
   *         ^^^^
   * ```
   *
   * @type {State}
   */
        function inside(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeFlowValue)
            return atBreak(code)
          }

          effects.consume(code)
          return inside
        }

  /** @type {State} */
        function after(code) {
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.codeIndented)
    // To do: allow interrupting like `markdown-rs`.
    // Feel free to interrupt.
    // tokenizer.interrupt = false
          return ok(code)
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeFurtherStart(effects, ok, nok) {
        const self = this

        return furtherStart

  /**
   * At eol, trying to parse another indent.
   *
   * ```markdown
   * > |     aaa
   *            ^
   *   |     bbb
   * ```
   *
   * @type {State}
   */
        function furtherStart(code) {
    // To do: improve `lazy` / `pierce` handling.
    // If this is a lazy line, it can’t be code.
          if (self.parser.lazy[self.now().line]) {
            return nok(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
            return furtherStart
          }

    // To do: the code here in `micromark-js` is a bit different from
    // `markdown-rs` because there it can attempt spaces.
    // We can’t yet.
    //
    // To do: use an improved `space_or_tab` function like `markdown-rs`,
    // so that we can drop the next state.
          return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
            effects,
            afterPrefix,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix,
            micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.tabSize + 1
          )(code)
        }

  /**
   * At start, after 1 or 4 spaces.
   *
   * ```markdown
   * > |     aaa
   *         ^
   * ```
   *
   * @type {State}
   */
        function afterPrefix(code) {
          const tail = self.events[self.events.length - 1]
          return tail &&
      tail[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix &&
      tail[2].sliceSerialize(tail[1], true).length >= micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.tabSize
            ? ok(code)
            : (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)
              ? furtherStart(code)
              : nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/code-text.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/code-text.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   codeText: () => (/* binding */ codeText)
/* harmony export */ });
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').Previous} Previous
 * @typedef {import('micromark-util-types').Resolver} Resolver
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */






/** @type {Construct} */
      const codeText = {
        name: 'codeText',
        tokenize: tokenizeCodeText,
        resolve: resolveCodeText,
        previous
      }

// To do: next major: don’t resolve, like `markdown-rs`.
/** @type {Resolver} */
      function resolveCodeText(events) {
        let tailExitIndex = events.length - 4
        let headEnterIndex = 3
  /** @type {number} */
        let index
  /** @type {number | undefined} */
        let enter

  // If we start and end with an EOL or a space.
        if (
          (events[headEnterIndex][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding ||
      events[headEnterIndex][1].type === 'space') &&
    (events[tailExitIndex][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding ||
      events[tailExitIndex][1].type === 'space')
        ) {
          index = headEnterIndex

    // And we have data.
          while (++index < tailExitIndex) {
            if (events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextData) {
        // Then we have padding.
              events[headEnterIndex][1].type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextPadding
              events[tailExitIndex][1].type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextPadding
              headEnterIndex += 2
              tailExitIndex -= 2
              break
            }
          }
        }

  // Merge adjacent spaces and data.
        index = headEnterIndex - 1
        tailExitIndex++

        while (++index <= tailExitIndex) {
          if (enter === undefined) {
            if (
              index !== tailExitIndex &&
        events[index][1].type !== micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding
            ) {
              enter = index
            }
          } else if (
            index === tailExitIndex ||
      events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding
          ) {
            events[enter][1].type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextData

            if (index !== enter + 2) {
              events[enter][1].end = events[index - 1][1].end
              events.splice(enter + 2, index - enter - 2)
              tailExitIndex -= index - enter - 2
              index = enter + 2
            }

            enter = undefined
          }
        }

        return events
      }

/**
 * @this {TokenizeContext}
 * @type {Previous}
 */
      function previous(code) {
  // If there is a previous code, there will always be a tail.
        return (
          code !== micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.graveAccent ||
    this.events[this.events.length - 1][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.characterEscape
        )
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeCodeText(effects, ok, nok) {
        const self = this
        let sizeOpen = 0
  /** @type {number} */
        let size
  /** @type {Token} */
        let token

        return start

  /**
   * Start of code (text).
   *
   * ```markdown
   * > | `a`
   *     ^
   * > | \`a`
   *      ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.graveAccent, 'expected `` ` ``')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(previous.call(self, self.previous), 'expected correct previous')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeText)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextSequence)
          return sequenceOpen(code)
        }

  /**
   * In opening sequence.
   *
   * ```markdown
   * > | `a`
   *     ^
   * ```
   *
   * @type {State}
   */
        function sequenceOpen(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.graveAccent) {
            effects.consume(code)
            sizeOpen++
            return sequenceOpen
          }

          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextSequence)
          return between(code)
        }

  /**
   * Between something and something else.
   *
   * ```markdown
   * > | `a`
   *      ^^
   * ```
   *
   * @type {State}
   */
        function between(code) {
    // EOF.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof) {
            return nok(code)
          }

    // To do: next major: don’t do spaces in resolve, but when compiling,
    // like `markdown-rs`.
    // Tabs don’t work, and virtual spaces don’t make sense.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.space) {
            effects.enter('space')
            effects.consume(code)
            effects.exit('space')
            return between
          }

    // Closing fence? Could also be data.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.graveAccent) {
            token = effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextSequence)
            size = 0
            return sequenceClose(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding)
            return between
          }

    // Data.
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextData)
          return data(code)
        }

  /**
   * In data.
   *
   * ```markdown
   * > | `a`
   *      ^
   * ```
   *
   * @type {State}
   */
        function data(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.space ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.graveAccent ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)
          ) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextData)
            return between(code)
          }

          effects.consume(code)
          return data
        }

  /**
   * In closing sequence.
   *
   * ```markdown
   * > | `a`
   *       ^
   * ```
   *
   * @type {State}
   */
        function sequenceClose(code) {
    // More.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.graveAccent) {
            effects.consume(code)
            size++
            return sequenceClose
          }

    // Done!
          if (size === sizeOpen) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextSequence)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeText)
            return ok(code)
          }

    // More or less accents: mark as data.
          token.type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.codeTextData
          return data(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/content.js":
/*!*******************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/content.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   content: () => (/* binding */ content)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_subtokenize__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-subtokenize */ "./node_modules/micromark-util-subtokenize/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').Resolver} Resolver
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */









/**
 * No name because it must not be turned off.
 * @type {Construct}
 */
      const content = {tokenize: tokenizeContent, resolve: resolveContent}

/** @type {Construct} */
      const continuationConstruct = {tokenize: tokenizeContinuation, partial: true}

/**
 * Content is transparent: it’s parsed right now. That way, definitions are also
 * parsed right now: before text in paragraphs (specifically, media) are parsed.
 *
 * @type {Resolver}
 */
      function resolveContent(events) {
        (0,micromark_util_subtokenize__WEBPACK_IMPORTED_MODULE_2__.subtokenize)(events)
        return events
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeContent(effects, ok) {
  /** @type {Token | undefined} */
        let previous

        return chunkStart

  /**
   * Before a content chunk.
   *
   * ```markdown
   * > | abc
   *     ^
   * ```
   *
   * @type {State}
   */
        function chunkStart(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            code !== micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.eof && !(0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code),
            'expected no eof or eol'
          )

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.content)
          previous = effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkContent, {
            contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__.constants.contentTypeContent
          })
          return chunkInside(code)
        }

  /**
   * In a content chunk.
   *
   * ```markdown
   * > | abc
   *     ^^^
   * ```
   *
   * @type {State}
   */
        function chunkInside(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.eof) {
            return contentEnd(code)
          }

    // To do: in `markdown-rs`, each line is parsed on its own, and everything
    // is stitched together resolving.
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            return effects.check(
              continuationConstruct,
              contentContinue,
              contentEnd
            )(code)
          }

    // Data.
          effects.consume(code)
          return chunkInside
        }

  /**
   *
   *
   * @type {State}
   */
        function contentEnd(code) {
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkContent)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.content)
          return ok(code)
        }

  /**
   *
   *
   * @type {State}
   */
        function contentContinue(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code), 'expected eol')
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkContent)
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(previous, 'expected previous token')
          previous.next = effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkContent, {
            contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__.constants.contentTypeContent,
            previous
          })
          previous = previous.next
          return chunkInside
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeContinuation(effects, ok, nok) {
        const self = this

        return startLookahead

  /**
   *
   *
   * @type {State}
   */
        function startLookahead(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code), 'expected a line ending')
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkContent)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.lineEnding)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.lineEnding)
          return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, prefixed, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.linePrefix)
        }

  /**
   *
   *
   * @type {State}
   */
        function prefixed(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            return nok(code)
          }

    // Always populated by defaults.
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            self.parser.constructs.disable.null,
            'expected `disable.null` to be populated'
          )

          const tail = self.events[self.events.length - 1]

          if (
            !self.parser.constructs.disable.null.includes('codeIndented') &&
      tail &&
      tail[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.linePrefix &&
      tail[2].sliceSerialize(tail[1], true).length >= micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__.constants.tabSize
          ) {
            return ok(code)
          }

          return effects.interrupt(self.parser.constructs.flow, nok, ok)(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/definition.js":
/*!**********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/definition.js ***!
  \**********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   definition: () => (/* binding */ definition)
/* harmony export */ });
/* harmony import */ const micromark_factory_destination__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-destination */ "./node_modules/micromark-factory-destination/dev/index.js");
/* harmony import */ const micromark_factory_label__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-factory-label */ "./node_modules/micromark-factory-label/dev/index.js");
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_factory_title__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-factory-title */ "./node_modules/micromark-factory-title/dev/index.js");
/* harmony import */ const micromark_factory_whitespace__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-factory-whitespace */ "./node_modules/micromark-factory-whitespace/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_normalize_identifier__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! micromark-util-normalize-identifier */ "./node_modules/micromark-util-normalize-identifier/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */












/** @type {Construct} */
      const definition = {name: 'definition', tokenize: tokenizeDefinition}

/** @type {Construct} */
      const titleBefore = {tokenize: tokenizeTitleBefore, partial: true}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeDefinition(effects, ok, nok) {
        const self = this
  /** @type {string} */
        let identifier

        return start

  /**
   * At start of a definition.
   *
   * ```markdown
   * > | [a]: b "c"
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
    // Do not interrupt paragraphs (but do follow definitions).
    // To do: do `interrupt` the way `markdown-rs` does.
    // To do: parse whitespace the way `markdown-rs` does.
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definition)
          return before(code)
        }

  /**
   * After optional whitespace, at `[`.
   *
   * ```markdown
   * > | [a]: b "c"
   *     ^
   * ```
   *
   * @type {State}
   */
        function before(code) {
    // To do: parse whitespace the way `markdown-rs` does.
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_9__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_7__.codes.leftSquareBracket, 'expected `[`')
          return micromark_factory_label__WEBPACK_IMPORTED_MODULE_1__.factoryLabel.call(
            self,
            effects,
            labelAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
            nok,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionLabel,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionLabelMarker,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionLabelString
          )(code)
        }

  /**
   * After label.
   *
   * ```markdown
   * > | [a]: b "c"
   *        ^
   * ```
   *
   * @type {State}
   */
        function labelAfter(code) {
          identifier = (0,micromark_util_normalize_identifier__WEBPACK_IMPORTED_MODULE_6__.normalizeIdentifier)(
            self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1)
          )

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_7__.codes.colon) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionMarker)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionMarker)
            return markerAfter
          }

          return nok(code)
        }

  /**
   * After marker.
   *
   * ```markdown
   * > | [a]: b "c"
   *         ^
   * ```
   *
   * @type {State}
   */
        function markerAfter(code) {
    // Note: whitespace is optional.
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_5__.markdownLineEndingOrSpace)(code)
            ? (0,micromark_factory_whitespace__WEBPACK_IMPORTED_MODULE_4__.factoryWhitespace)(effects, destinationBefore)(code)
            : destinationBefore(code)
        }

  /**
   * Before destination.
   *
   * ```markdown
   * > | [a]: b "c"
   *          ^
   * ```
   *
   * @type {State}
   */
        function destinationBefore(code) {
          return (0,micromark_factory_destination__WEBPACK_IMPORTED_MODULE_0__.factoryDestination)(
            effects,
            destinationAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
            nok,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionDestination,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionDestinationLiteral,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionDestinationLiteralMarker,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionDestinationRaw,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionDestinationString
          )(code)
        }

  /**
   * After destination.
   *
   * ```markdown
   * > | [a]: b "c"
   *           ^
   * ```
   *
   * @type {State}
   */
        function destinationAfter(code) {
          return effects.attempt(titleBefore, after, after)(code)
        }

  /**
   * After definition.
   *
   * ```markdown
   * > | [a]: b
   *           ^
   * > | [a]: b "c"
   *               ^
   * ```
   *
   * @type {State}
   */
        function after(code) {
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_5__.markdownSpace)(code)
            ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_2__.factorySpace)(effects, afterWhitespace, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.whitespace)(code)
            : afterWhitespace(code)
        }

  /**
   * After definition, after optional whitespace.
   *
   * ```markdown
   * > | [a]: b
   *           ^
   * > | [a]: b "c"
   *               ^
   * ```
   *
   * @type {State}
   */
        function afterWhitespace(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_7__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_5__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definition)

      // Note: we don’t care about uniqueness.
      // It’s likely that that doesn’t happen very frequently.
      // It is more likely that it wastes precious time.
            self.parser.defined.push(identifier)

      // To do: `markdown-rs` interrupt.
      // // You’d be interrupting.
      // tokenizer.interrupt = true
            return ok(code)
          }

          return nok(code)
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeTitleBefore(effects, ok, nok) {
        return titleBefore

  /**
   * After destination, at whitespace.
   *
   * ```markdown
   * > | [a]: b
   *           ^
   * > | [a]: b "c"
   *           ^
   * ```
   *
   * @type {State}
   */
        function titleBefore(code) {
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_5__.markdownLineEndingOrSpace)(code)
            ? (0,micromark_factory_whitespace__WEBPACK_IMPORTED_MODULE_4__.factoryWhitespace)(effects, beforeMarker)(code)
            : nok(code)
        }

  /**
   * At title.
   *
   * ```markdown
   *   | [a]: b
   * > | "c"
   *     ^
   * ```
   *
   * @type {State}
   */
        function beforeMarker(code) {
          return (0,micromark_factory_title__WEBPACK_IMPORTED_MODULE_3__.factoryTitle)(
            effects,
            titleAfter,
            nok,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionTitle,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionTitleMarker,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.definitionTitleString
          )(code)
        }

  /**
   * After title.
   *
   * ```markdown
   * > | [a]: b "c"
   *               ^
   * ```
   *
   * @type {State}
   */
        function titleAfter(code) {
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_5__.markdownSpace)(code)
            ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_2__.factorySpace)(
              effects,
              titleAfterOptionalWhitespace,
              micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_8__.types.whitespace
            )(code)
            : titleAfterOptionalWhitespace(code)
        }

  /**
   * After title, after optional whitespace.
   *
   * ```markdown
   * > | [a]: b "c"
   *               ^
   * ```
   *
   * @type {State}
   */
        function titleAfterOptionalWhitespace(code) {
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_7__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_5__.markdownLineEnding)(code) ? ok(code) : nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/hard-break-escape.js":
/*!*****************************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/hard-break-escape.js ***!
  \*****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   hardBreakEscape: () => (/* binding */ hardBreakEscape)
/* harmony export */ });
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */






/** @type {Construct} */
      const hardBreakEscape = {
        name: 'hardBreakEscape',
        tokenize: tokenizeHardBreakEscape
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeHardBreakEscape(effects, ok, nok) {
        return start

  /**
   * Start of a hard break (escape).
   *
   * ```markdown
   * > | a\
   *      ^
   *   | b
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.backslash, 'expected `\\`')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.hardBreakEscape)
          effects.consume(code)
          return after
        }

  /**
   * After `\`, at eol.
   *
   * ```markdown
   * > | a\
   *       ^
   *   | b
   * ```
   *
   *  @type {State}
   */
        function after(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.hardBreakEscape)
            return ok(code)
          }

          return nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/heading-atx.js":
/*!***********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/heading-atx.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   headingAtx: () => (/* binding */ headingAtx)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_chunked__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-chunked */ "./node_modules/micromark-util-chunked/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').Resolver} Resolver
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */









/** @type {Construct} */
      const headingAtx = {
        name: 'headingAtx',
        tokenize: tokenizeHeadingAtx,
        resolve: resolveHeadingAtx
      }

/** @type {Resolver} */
      function resolveHeadingAtx(events, context) {
        let contentEnd = events.length - 2
        let contentStart = 3
  /** @type {Token} */
        let content
  /** @type {Token} */
        let text

  // Prefix whitespace, part of the opening.
        if (events[contentStart][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.whitespace) {
          contentStart += 2
        }

  // Suffix whitespace, part of the closing.
        if (
          contentEnd - 2 > contentStart &&
    events[contentEnd][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.whitespace
        ) {
          contentEnd -= 2
        }

        if (
          events[contentEnd][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeadingSequence &&
    (contentStart === contentEnd - 1 ||
      (contentEnd - 4 > contentStart &&
        events[contentEnd - 2][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.whitespace))
        ) {
          contentEnd -= contentStart + 1 === contentEnd ? 2 : 4
        }

        if (contentEnd > contentStart) {
          content = {
            type: micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeadingText,
            start: events[contentStart][1].start,
            end: events[contentEnd][1].end
          }
          text = {
            type: micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkText,
            start: events[contentStart][1].start,
            end: events[contentEnd][1].end,
            contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__.constants.contentTypeText
          }

          ;(0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_2__.splice)(events, contentStart, contentEnd - contentStart + 1, [
            ['enter', content, context],
            ['enter', text, context],
            ['exit', text, context],
            ['exit', content, context]
          ])
        }

        return events
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeHeadingAtx(effects, ok, nok) {
        let size = 0

        return start

  /**
   * Start of a heading (atx).
   *
   * ```markdown
   * > | ## aa
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
    // To do: parse indent like `markdown-rs`.
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeading)
          return before(code)
        }

  /**
   * After optional whitespace, at `#`.
   *
   * ```markdown
   * > | ## aa
   *     ^
   * ```
   *
   * @type {State}
   */
        function before(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.numberSign, 'expected `#`')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeadingSequence)
          return sequenceOpen(code)
        }

  /**
   * In opening sequence.
   *
   * ```markdown
   * > | ## aa
   *     ^
   * ```
   *
   * @type {State}
   */
        function sequenceOpen(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.numberSign &&
      size++ < micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__.constants.atxHeadingOpeningFenceSizeMax
          ) {
            effects.consume(code)
            return sequenceOpen
          }

    // Always at least one `#`.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEndingOrSpace)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeadingSequence)
            return atBreak(code)
          }

          return nok(code)
        }

  /**
   * After something, before something else.
   *
   * ```markdown
   * > | ## aa
   *       ^
   * ```
   *
   * @type {State}
   */
        function atBreak(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.numberSign) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeadingSequence)
            return sequenceFurther(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeading)
      // To do: interrupt like `markdown-rs`.
      // // Feel free to interrupt.
      // tokenizer.interrupt = false
            return ok(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, atBreak, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.whitespace)(code)
          }

    // To do: generate `data` tokens, add the `text` token later.
    // Needs edit map, see: `markdown.rs`.
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeadingText)
          return data(code)
        }

  /**
   * In further sequence (after whitespace).
   *
   * Could be normal “visible” hashes in the heading or a final sequence.
   *
   * ```markdown
   * > | ## aa ##
   *           ^
   * ```
   *
   * @type {State}
   */
        function sequenceFurther(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.numberSign) {
            effects.consume(code)
            return sequenceFurther
          }

          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeadingSequence)
          return atBreak(code)
        }

  /**
   * In text.
   *
   * ```markdown
   * > | ## aa
   *        ^
   * ```
   *
   * @type {State}
   */
        function data(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.numberSign ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEndingOrSpace)(code)
          ) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.atxHeadingText)
            return atBreak(code)
          }

          effects.consume(code)
          return data
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/html-flow.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/html-flow.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   htmlFlow: () => (/* binding */ htmlFlow)
/* harmony export */ });
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_html_tag_name__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-html-tag-name */ "./node_modules/micromark-util-html-tag-name/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/* harmony import */ const _blank_line_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./blank-line.js */ "./node_modules/micromark-core-commonmark/dev/lib/blank-line.js");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').Resolver} Resolver
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */









/** @type {Construct} */
      const htmlFlow = {
        name: 'htmlFlow',
        tokenize: tokenizeHtmlFlow,
        resolveTo: resolveToHtmlFlow,
        concrete: true
      }

/** @type {Construct} */
      const blankLineBefore = {tokenize: tokenizeBlankLineBefore, partial: true}
      const nonLazyContinuationStart = {
        tokenize: tokenizeNonLazyContinuationStart,
        partial: true
      }

/** @type {Resolver} */
      function resolveToHtmlFlow(events) {
        let index = events.length

        while (index--) {
          if (
            events[index][0] === 'enter' &&
      events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlFlow
          ) {
            break
          }
        }

        if (index > 1 && events[index - 2][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix) {
    // Add the prefix start to the HTML token.
          events[index][1].start = events[index - 2][1].start
    // Add the prefix start to the HTML line token.
          events[index + 1][1].start = events[index - 2][1].start
    // Remove the line prefix.
          events.splice(index - 2, 2)
        }

        return events
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeHtmlFlow(effects, ok, nok) {
        const self = this
  /** @type {number} */
        let marker
  /** @type {boolean} */
        let closingTag
  /** @type {string} */
        let buffer
  /** @type {number} */
        let index
  /** @type {Code} */
        let markerB

        return start

  /**
   * Start of HTML (flow).
   *
   * ```markdown
   * > | <x />
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
    // To do: parse indent like `markdown-rs`.
          return before(code)
        }

  /**
   * At `<`, after optional whitespace.
   *
   * ```markdown
   * > | <x />
   *     ^
   * ```
   *
   * @type {State}
   */
        function before(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.lessThan, 'expected `<`')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlFlow)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlFlowData)
          effects.consume(code)
          return open
        }

  /**
   * After `<`, at tag name or other stuff.
   *
   * ```markdown
   * > | <x />
   *      ^
   * > | <!doctype>
   *      ^
   * > | <!--xxx-->
   *      ^
   * ```
   *
   * @type {State}
   */
        function open(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.exclamationMark) {
            effects.consume(code)
            return declarationOpen
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash) {
            effects.consume(code)
            closingTag = true
            return tagCloseStart
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.questionMark) {
            effects.consume(code)
            marker = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlInstruction
      // To do:
      // tokenizer.concrete = true
      // To do: use `markdown-rs` style interrupt.
      // While we’re in an instruction instead of a declaration, we’re on a `?`
      // right now, so we do need to search for `>`, similar to declarations.
            return self.interrupt ? ok : continuationDeclarationInside
          }

    // ASCII alphabetical.
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlpha)(code)) {
            effects.consume(code)
      // @ts-expect-error: not null.
            buffer = String.fromCharCode(code)
            return tagName
          }

          return nok(code)
        }

  /**
   * After `<!`, at declaration, comment, or CDATA.
   *
   * ```markdown
   * > | <!doctype>
   *       ^
   * > | <!--xxx-->
   *       ^
   * > | <![CDATA[>&<]]>
   *       ^
   * ```
   *
   * @type {State}
   */
        function declarationOpen(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash) {
            effects.consume(code)
            marker = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlComment
            return commentOpenInside
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.leftSquareBracket) {
            effects.consume(code)
            marker = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlCdata
            index = 0
            return cdataOpenInside
          }

    // ASCII alphabetical.
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlpha)(code)) {
            effects.consume(code)
            marker = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlDeclaration
      // // Do not form containers.
      // tokenizer.concrete = true
            return self.interrupt ? ok : continuationDeclarationInside
          }

          return nok(code)
        }

  /**
   * After `<!-`, inside a comment, at another `-`.
   *
   * ```markdown
   * > | <!--xxx-->
   *        ^
   * ```
   *
   * @type {State}
   */
        function commentOpenInside(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash) {
            effects.consume(code)
      // // Do not form containers.
      // tokenizer.concrete = true
            return self.interrupt ? ok : continuationDeclarationInside
          }

          return nok(code)
        }

  /**
   * After `<![`, inside CDATA, expecting `CDATA[`.
   *
   * ```markdown
   * > | <![CDATA[>&<]]>
   *        ^^^^^^
   * ```
   *
   * @type {State}
   */
        function cdataOpenInside(code) {
          const value = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.cdataOpeningString

          if (code === value.charCodeAt(index++)) {
            effects.consume(code)

            if (index === value.length) {
        // // Do not form containers.
        // tokenizer.concrete = true
              return self.interrupt ? ok : continuation
            }

            return cdataOpenInside
          }

          return nok(code)
        }

  /**
   * After `</`, in closing tag, at tag name.
   *
   * ```markdown
   * > | </x>
   *       ^
   * ```
   *
   * @type {State}
   */
        function tagCloseStart(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlpha)(code)) {
            effects.consume(code)
      // @ts-expect-error: not null.
            buffer = String.fromCharCode(code)
            return tagName
          }

          return nok(code)
        }

  /**
   * In tag name.
   *
   * ```markdown
   * > | <ab>
   *      ^^
   * > | </ab>
   *       ^^
   * ```
   *
   * @type {State}
   */
        function tagName(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEndingOrSpace)(code)
          ) {
            const slash = code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash
            const name = buffer.toLowerCase()

            if (!slash && !closingTag && micromark_util_html_tag_name__WEBPACK_IMPORTED_MODULE_1__.htmlRawNames.includes(name)) {
              marker = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlRaw
        // // Do not form containers.
        // tokenizer.concrete = true
              return self.interrupt ? ok(code) : continuation(code)
            }

            if (micromark_util_html_tag_name__WEBPACK_IMPORTED_MODULE_1__.htmlBlockNames.includes(buffer.toLowerCase())) {
              marker = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlBasic

              if (slash) {
                effects.consume(code)
                return basicSelfClosing
              }

        // // Do not form containers.
        // tokenizer.concrete = true
              return self.interrupt ? ok(code) : continuation(code)
            }

            marker = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlComplete
      // Do not support complete HTML when interrupting.
            return self.interrupt && !self.parser.lazy[self.now().line]
              ? nok(code)
              : closingTag
                ? completeClosingTagAfter(code)
                : completeAttributeNameBefore(code)
          }

    // ASCII alphanumerical and `-`.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlphanumeric)(code)) {
            effects.consume(code)
            buffer += String.fromCharCode(code)
            return tagName
          }

          return nok(code)
        }

  /**
   * After closing slash of a basic tag name.
   *
   * ```markdown
   * > | <div/>
   *          ^
   * ```
   *
   * @type {State}
   */
        function basicSelfClosing(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan) {
            effects.consume(code)
      // // Do not form containers.
      // tokenizer.concrete = true
            return self.interrupt ? ok : continuation
          }

          return nok(code)
        }

  /**
   * After closing slash of a complete tag name.
   *
   * ```markdown
   * > | <x/>
   *        ^
   * ```
   *
   * @type {State}
   */
        function completeClosingTagAfter(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownSpace)(code)) {
            effects.consume(code)
            return completeClosingTagAfter
          }

          return completeEnd(code)
        }

  /**
   * At an attribute name.
   *
   * At first, this state is used after a complete tag name, after whitespace,
   * where it expects optional attributes or the end of the tag.
   * It is also reused after attributes, when expecting more optional
   * attributes.
   *
   * ```markdown
   * > | <a />
   *        ^
   * > | <a :b>
   *        ^
   * > | <a _b>
   *        ^
   * > | <a b>
   *        ^
   * > | <a >
   *        ^
   * ```
   *
   * @type {State}
   */
        function completeAttributeNameBefore(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash) {
            effects.consume(code)
            return completeEnd
          }

    // ASCII alphanumerical and `:` and `_`.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.colon || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.underscore || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlpha)(code)) {
            effects.consume(code)
            return completeAttributeName
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownSpace)(code)) {
            effects.consume(code)
            return completeAttributeNameBefore
          }

          return completeEnd(code)
        }

  /**
   * In attribute name.
   *
   * ```markdown
   * > | <a :b>
   *         ^
   * > | <a _b>
   *         ^
   * > | <a b>
   *         ^
   * ```
   *
   * @type {State}
   */
        function completeAttributeName(code) {
    // ASCII alphanumerical and `-`, `.`, `:`, and `_`.
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dot ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.colon ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.underscore ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlphanumeric)(code)
          ) {
            effects.consume(code)
            return completeAttributeName
          }

          return completeAttributeNameAfter(code)
        }

  /**
   * After attribute name, at an optional initializer, the end of the tag, or
   * whitespace.
   *
   * ```markdown
   * > | <a b>
   *         ^
   * > | <a b=c>
   *         ^
   * ```
   *
   * @type {State}
   */
        function completeAttributeNameAfter(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.equalsTo) {
            effects.consume(code)
            return completeAttributeValueBefore
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownSpace)(code)) {
            effects.consume(code)
            return completeAttributeNameAfter
          }

          return completeAttributeNameBefore(code)
        }

  /**
   * Before unquoted, double quoted, or single quoted attribute value, allowing
   * whitespace.
   *
   * ```markdown
   * > | <a b=c>
   *          ^
   * > | <a b="c">
   *          ^
   * ```
   *
   * @type {State}
   */
        function completeAttributeValueBefore(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.lessThan ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.equalsTo ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.graveAccent
          ) {
            return nok(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.quotationMark || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.apostrophe) {
            effects.consume(code)
            markerB = code
            return completeAttributeValueQuoted
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownSpace)(code)) {
            effects.consume(code)
            return completeAttributeValueBefore
          }

          return completeAttributeValueUnquoted(code)
        }

  /**
   * In double or single quoted attribute value.
   *
   * ```markdown
   * > | <a b="c">
   *           ^
   * > | <a b='c'>
   *           ^
   * ```
   *
   * @type {State}
   */
        function completeAttributeValueQuoted(code) {
          if (code === markerB) {
            effects.consume(code)
            markerB = null
            return completeAttributeValueQuotedAfter
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)) {
            return nok(code)
          }

          effects.consume(code)
          return completeAttributeValueQuoted
        }

  /**
   * In unquoted attribute value.
   *
   * ```markdown
   * > | <a b=c>
   *          ^
   * ```
   *
   * @type {State}
   */
        function completeAttributeValueUnquoted(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.quotationMark ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.apostrophe ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.lessThan ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.equalsTo ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.graveAccent ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEndingOrSpace)(code)
          ) {
            return completeAttributeNameAfter(code)
          }

          effects.consume(code)
          return completeAttributeValueUnquoted
        }

  /**
   * After double or single quoted attribute value, before whitespace or the
   * end of the tag.
   *
   * ```markdown
   * > | <a b="c">
   *            ^
   * ```
   *
   * @type {State}
   */
        function completeAttributeValueQuotedAfter(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownSpace)(code)
          ) {
            return completeAttributeNameBefore(code)
          }

          return nok(code)
        }

  /**
   * In certain circumstances of a complete tag where only an `>` is allowed.
   *
   * ```markdown
   * > | <a b="c">
   *             ^
   * ```
   *
   * @type {State}
   */
        function completeEnd(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan) {
            effects.consume(code)
            return completeAfter
          }

          return nok(code)
        }

  /**
   * After `>` in a complete tag.
   *
   * ```markdown
   * > | <x>
   *        ^
   * ```
   *
   * @type {State}
   */
        function completeAfter(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)) {
      // // Do not form containers.
      // tokenizer.concrete = true
            return continuation(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownSpace)(code)) {
            effects.consume(code)
            return completeAfter
          }

          return nok(code)
        }

  /**
   * In continuation of any HTML kind.
   *
   * ```markdown
   * > | <!--xxx-->
   *          ^
   * ```
   *
   * @type {State}
   */
        function continuation(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash && marker === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlComment) {
            effects.consume(code)
            return continuationCommentInside
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.lessThan && marker === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlRaw) {
            effects.consume(code)
            return continuationRawTagOpen
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan && marker === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlDeclaration) {
            effects.consume(code)
            return continuationClose
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.questionMark && marker === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlInstruction) {
            effects.consume(code)
            return continuationDeclarationInside
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.rightSquareBracket && marker === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlCdata) {
            effects.consume(code)
            return continuationCdataInside
          }

          if (
            (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code) &&
      (marker === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlBasic || marker === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlComplete)
          ) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlFlowData)
            return effects.check(
              blankLineBefore,
              continuationAfter,
              continuationStart
            )(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlFlowData)
            return continuationStart(code)
          }

          effects.consume(code)
          return continuation
        }

  /**
   * In continuation, at eol.
   *
   * ```markdown
   * > | <x>
   *        ^
   *   | asd
   * ```
   *
   * @type {State}
   */
        function continuationStart(code) {
          return effects.check(
            nonLazyContinuationStart,
            continuationStartNonLazy,
            continuationAfter
          )(code)
        }

  /**
   * In continuation, at eol, before non-lazy content.
   *
   * ```markdown
   * > | <x>
   *        ^
   *   | asd
   * ```
   *
   * @type {State}
   */
        function continuationStartNonLazy(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code))
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          return continuationBefore
        }

  /**
   * In continuation, before non-lazy content.
   *
   * ```markdown
   *   | <x>
   * > | asd
   *     ^
   * ```
   *
   * @type {State}
   */
        function continuationBefore(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)) {
            return continuationStart(code)
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlFlowData)
          return continuation(code)
        }

  /**
   * In comment continuation, after one `-`, expecting another.
   *
   * ```markdown
   * > | <!--xxx-->
   *             ^
   * ```
   *
   * @type {State}
   */
        function continuationCommentInside(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash) {
            effects.consume(code)
            return continuationDeclarationInside
          }

          return continuation(code)
        }

  /**
   * In raw continuation, after `<`, at `/`.
   *
   * ```markdown
   * > | <script>console.log(1)</script>
   *                            ^
   * ```
   *
   * @type {State}
   */
        function continuationRawTagOpen(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash) {
            effects.consume(code)
            buffer = ''
            return continuationRawEndTag
          }

          return continuation(code)
        }

  /**
   * In raw continuation, after `</`, in a raw tag name.
   *
   * ```markdown
   * > | <script>console.log(1)</script>
   *                             ^^^^^^
   * ```
   *
   * @type {State}
   */
        function continuationRawEndTag(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan) {
            const name = buffer.toLowerCase()

            if (micromark_util_html_tag_name__WEBPACK_IMPORTED_MODULE_1__.htmlRawNames.includes(name)) {
              effects.consume(code)
              return continuationClose
            }

            return continuation(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiAlpha)(code) && buffer.length < micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlRawSizeMax) {
            effects.consume(code)
      // @ts-expect-error: not null.
            buffer += String.fromCharCode(code)
            return continuationRawEndTag
          }

          return continuation(code)
        }

  /**
   * In cdata continuation, after `]`, expecting `]>`.
   *
   * ```markdown
   * > | <![CDATA[>&<]]>
   *                  ^
   * ```
   *
   * @type {State}
   */
        function continuationCdataInside(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.rightSquareBracket) {
            effects.consume(code)
            return continuationDeclarationInside
          }

          return continuation(code)
        }

  /**
   * In declaration or instruction continuation, at `>`.
   *
   * ```markdown
   * > | <!-->
   *         ^
   * > | <?>
   *       ^
   * > | <!q>
   *        ^
   * > | <!--ab-->
   *             ^
   * > | <![CDATA[>&<]]>
   *                   ^
   * ```
   *
   * @type {State}
   */
        function continuationDeclarationInside(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan) {
            effects.consume(code)
            return continuationClose
          }

    // More dashes.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash && marker === micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.htmlComment) {
            effects.consume(code)
            return continuationDeclarationInside
          }

          return continuation(code)
        }

  /**
   * In closed continuation: everything we get until the eol/eof is part of it.
   *
   * ```markdown
   * > | <!doctype>
   *               ^
   * ```
   *
   * @type {State}
   */
        function continuationClose(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlFlowData)
            return continuationAfter(code)
          }

          effects.consume(code)
          return continuationClose
        }

  /**
   * Done.
   *
   * ```markdown
   * > | <!doctype>
   *               ^
   * ```
   *
   * @type {State}
   */
        function continuationAfter(code) {
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlFlow)
    // // Feel free to interrupt.
    // tokenizer.interrupt = false
    // // No longer concrete.
    // tokenizer.concrete = false
          return ok(code)
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeNonLazyContinuationStart(effects, ok, nok) {
        const self = this

        return start

  /**
   * At eol, before continuation.
   *
   * ```markdown
   * > | * ```js
   *            ^
   *   | b
   * ```
   *
   * @type {State}
   */
        function start(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
            return after
          }

          return nok(code)
        }

  /**
   * A continuation.
   *
   * ```markdown
   *   | * ```js
   * > | b
   *     ^
   * ```
   *
   * @type {State}
   */
        function after(code) {
          return self.parser.lazy[self.now().line] ? nok(code) : ok(code)
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeBlankLineBefore(effects, ok, nok) {
        return start

  /**
   * Before eol, expecting blank line.
   *
   * ```markdown
   * > | <div>
   *          ^
   *   |
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code), 'expected a line ending')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          return effects.attempt(_blank_line_js__WEBPACK_IMPORTED_MODULE_6__.blankLine, ok, nok)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/html-text.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/html-text.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   htmlText: () => (/* binding */ htmlText)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */








/** @type {Construct} */
      const htmlText = {name: 'htmlText', tokenize: tokenizeHtmlText}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeHtmlText(effects, ok, nok) {
        const self = this
  /** @type {NonNullable<Code> | undefined} */
        let marker
  /** @type {number} */
        let index
  /** @type {State} */
        let returnState

        return start

  /**
   * Start of HTML (text).
   *
   * ```markdown
   * > | a <b> c
   *       ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.lessThan, 'expected `<`')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlText)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlTextData)
          effects.consume(code)
          return open
        }

  /**
   * After `<`, at tag name or other stuff.
   *
   * ```markdown
   * > | a <b> c
   *        ^
   * > | a <!doctype> c
   *        ^
   * > | a <!--b--> c
   *        ^
   * ```
   *
   * @type {State}
   */
        function open(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.exclamationMark) {
            effects.consume(code)
            return declarationOpen
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash) {
            effects.consume(code)
            return tagCloseStart
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.questionMark) {
            effects.consume(code)
            return instruction
          }

    // ASCII alphabetical.
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiAlpha)(code)) {
            effects.consume(code)
            return tagOpen
          }

          return nok(code)
        }

  /**
   * After `<!`, at declaration, comment, or CDATA.
   *
   * ```markdown
   * > | a <!doctype> c
   *         ^
   * > | a <!--b--> c
   *         ^
   * > | a <![CDATA[>&<]]> c
   *         ^
   * ```
   *
   * @type {State}
   */
        function declarationOpen(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash) {
            effects.consume(code)
            return commentOpenInside
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.leftSquareBracket) {
            effects.consume(code)
            index = 0
            return cdataOpenInside
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiAlpha)(code)) {
            effects.consume(code)
            return declaration
          }

          return nok(code)
        }

  /**
   * In a comment, after `<!-`, at another `-`.
   *
   * ```markdown
   * > | a <!--b--> c
   *          ^
   * ```
   *
   * @type {State}
   */
        function commentOpenInside(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash) {
            effects.consume(code)
            return commentEnd
          }

          return nok(code)
        }

  /**
   * In comment.
   *
   * ```markdown
   * > | a <!--b--> c
   *           ^
   * ```
   *
   * @type {State}
   */
        function comment(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof) {
            return nok(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash) {
            effects.consume(code)
            return commentClose
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            returnState = comment
            return lineEndingBefore(code)
          }

          effects.consume(code)
          return comment
        }

  /**
   * In comment, after `-`.
   *
   * ```markdown
   * > | a <!--b--> c
   *             ^
   * ```
   *
   * @type {State}
   */
        function commentClose(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash) {
            effects.consume(code)
            return commentEnd
          }

          return comment(code)
        }

  /**
   * In comment, after `--`.
   *
   * ```markdown
   * > | a <!--b--> c
   *              ^
   * ```
   *
   * @type {State}
   */
        function commentEnd(code) {
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan
            ? end(code)
            : code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash
              ? commentClose(code)
              : comment(code)
        }

  /**
   * After `<![`, in CDATA, expecting `CDATA[`.
   *
   * ```markdown
   * > | a <![CDATA[>&<]]> b
   *          ^^^^^^
   * ```
   *
   * @type {State}
   */
        function cdataOpenInside(code) {
          const value = micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.cdataOpeningString

          if (code === value.charCodeAt(index++)) {
            effects.consume(code)
            return index === value.length ? cdata : cdataOpenInside
          }

          return nok(code)
        }

  /**
   * In CDATA.
   *
   * ```markdown
   * > | a <![CDATA[>&<]]> b
   *                ^^^
   * ```
   *
   * @type {State}
   */
        function cdata(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof) {
            return nok(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.rightSquareBracket) {
            effects.consume(code)
            return cdataClose
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            returnState = cdata
            return lineEndingBefore(code)
          }

          effects.consume(code)
          return cdata
        }

  /**
   * In CDATA, after `]`, at another `]`.
   *
   * ```markdown
   * > | a <![CDATA[>&<]]> b
   *                    ^
   * ```
   *
   * @type {State}
   */
        function cdataClose(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.rightSquareBracket) {
            effects.consume(code)
            return cdataEnd
          }

          return cdata(code)
        }

  /**
   * In CDATA, after `]]`, at `>`.
   *
   * ```markdown
   * > | a <![CDATA[>&<]]> b
   *                     ^
   * ```
   *
   * @type {State}
   */
        function cdataEnd(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan) {
            return end(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.rightSquareBracket) {
            effects.consume(code)
            return cdataEnd
          }

          return cdata(code)
        }

  /**
   * In declaration.
   *
   * ```markdown
   * > | a <!b> c
   *          ^
   * ```
   *
   * @type {State}
   */
        function declaration(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan) {
            return end(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            returnState = declaration
            return lineEndingBefore(code)
          }

          effects.consume(code)
          return declaration
        }

  /**
   * In instruction.
   *
   * ```markdown
   * > | a <?b?> c
   *         ^
   * ```
   *
   * @type {State}
   */
        function instruction(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof) {
            return nok(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.questionMark) {
            effects.consume(code)
            return instructionClose
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            returnState = instruction
            return lineEndingBefore(code)
          }

          effects.consume(code)
          return instruction
        }

  /**
   * In instruction, after `?`, at `>`.
   *
   * ```markdown
   * > | a <?b?> c
   *           ^
   * ```
   *
   * @type {State}
   */
        function instructionClose(code) {
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan ? end(code) : instruction(code)
        }

  /**
   * After `</`, in closing tag, at tag name.
   *
   * ```markdown
   * > | a </b> c
   *         ^
   * ```
   *
   * @type {State}
   */
        function tagCloseStart(code) {
    // ASCII alphabetical.
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiAlpha)(code)) {
            effects.consume(code)
            return tagClose
          }

          return nok(code)
        }

  /**
   * After `</x`, in a tag name.
   *
   * ```markdown
   * > | a </b> c
   *          ^
   * ```
   *
   * @type {State}
   */
        function tagClose(code) {
    // ASCII alphanumerical and `-`.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiAlphanumeric)(code)) {
            effects.consume(code)
            return tagClose
          }

          return tagCloseBetween(code)
        }

  /**
   * In closing tag, after tag name.
   *
   * ```markdown
   * > | a </b> c
   *          ^
   * ```
   *
   * @type {State}
   */
        function tagCloseBetween(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            returnState = tagCloseBetween
            return lineEndingBefore(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            effects.consume(code)
            return tagCloseBetween
          }

          return end(code)
        }

  /**
   * After `<x`, in opening tag name.
   *
   * ```markdown
   * > | a <b> c
   *         ^
   * ```
   *
   * @type {State}
   */
        function tagOpen(code) {
    // ASCII alphanumerical and `-`.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiAlphanumeric)(code)) {
            effects.consume(code)
            return tagOpen
          }

          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEndingOrSpace)(code)
          ) {
            return tagOpenBetween(code)
          }

          return nok(code)
        }

  /**
   * In opening tag, after tag name.
   *
   * ```markdown
   * > | a <b> c
   *         ^
   * ```
   *
   * @type {State}
   */
        function tagOpenBetween(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash) {
            effects.consume(code)
            return end
          }

    // ASCII alphabetical and `:` and `_`.
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.colon || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.underscore || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiAlpha)(code)) {
            effects.consume(code)
            return tagOpenAttributeName
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            returnState = tagOpenBetween
            return lineEndingBefore(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            effects.consume(code)
            return tagOpenBetween
          }

          return end(code)
        }

  /**
   * In attribute name.
   *
   * ```markdown
   * > | a <b c> d
   *          ^
   * ```
   *
   * @type {State}
   */
        function tagOpenAttributeName(code) {
    // ASCII alphabetical and `-`, `.`, `:`, and `_`.
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dot ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.colon ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.underscore ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiAlphanumeric)(code)
          ) {
            effects.consume(code)
            return tagOpenAttributeName
          }

          return tagOpenAttributeNameAfter(code)
        }

  /**
   * After attribute name, before initializer, the end of the tag, or
   * whitespace.
   *
   * ```markdown
   * > | a <b c> d
   *           ^
   * ```
   *
   * @type {State}
   */
        function tagOpenAttributeNameAfter(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.equalsTo) {
            effects.consume(code)
            return tagOpenAttributeValueBefore
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            returnState = tagOpenAttributeNameAfter
            return lineEndingBefore(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            effects.consume(code)
            return tagOpenAttributeNameAfter
          }

          return tagOpenBetween(code)
        }

  /**
   * Before unquoted, double quoted, or single quoted attribute value, allowing
   * whitespace.
   *
   * ```markdown
   * > | a <b c=d> e
   *            ^
   * ```
   *
   * @type {State}
   */
        function tagOpenAttributeValueBefore(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.lessThan ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.equalsTo ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.graveAccent
          ) {
            return nok(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.quotationMark || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.apostrophe) {
            effects.consume(code)
            marker = code
            return tagOpenAttributeValueQuoted
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            returnState = tagOpenAttributeValueBefore
            return lineEndingBefore(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            effects.consume(code)
            return tagOpenAttributeValueBefore
          }

          effects.consume(code)
          return tagOpenAttributeValueUnquoted
        }

  /**
   * In double or single quoted attribute value.
   *
   * ```markdown
   * > | a <b c="d"> e
   *             ^
   * ```
   *
   * @type {State}
   */
        function tagOpenAttributeValueQuoted(code) {
          if (code === marker) {
            effects.consume(code)
            marker = undefined
            return tagOpenAttributeValueQuotedAfter
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof) {
            return nok(code)
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            returnState = tagOpenAttributeValueQuoted
            return lineEndingBefore(code)
          }

          effects.consume(code)
          return tagOpenAttributeValueQuoted
        }

  /**
   * In unquoted attribute value.
   *
   * ```markdown
   * > | a <b c=d> e
   *            ^
   * ```
   *
   * @type {State}
   */
        function tagOpenAttributeValueUnquoted(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.quotationMark ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.apostrophe ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.lessThan ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.equalsTo ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.graveAccent
          ) {
            return nok(code)
          }

          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEndingOrSpace)(code)
          ) {
            return tagOpenBetween(code)
          }

          effects.consume(code)
          return tagOpenAttributeValueUnquoted
        }

  /**
   * After double or single quoted attribute value, before whitespace or the end
   * of the tag.
   *
   * ```markdown
   * > | a <b c="d"> e
   *               ^
   * ```
   *
   * @type {State}
   */
        function tagOpenAttributeValueQuotedAfter(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.slash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEndingOrSpace)(code)
          ) {
            return tagOpenBetween(code)
          }

          return nok(code)
        }

  /**
   * In certain circumstances of a tag where only an `>` is allowed.
   *
   * ```markdown
   * > | a <b c="d"> e
   *               ^
   * ```
   *
   * @type {State}
   */
        function end(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.greaterThan) {
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlTextData)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlText)
            return ok
          }

          return nok(code)
        }

  /**
   * At eol.
   *
   * > 👉 **Note**: we can’t have blank lines in text, so no need to worry about
   * > empty tokens.
   *
   * ```markdown
   * > | a <!--a
   *            ^
   *   | b-->
   * ```
   *
   * @type {State}
   */
        function lineEndingBefore(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(returnState, 'expected return state')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code), 'expected eol')
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlTextData)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          return lineEndingAfter
        }

  /**
   * After eol, at optional whitespace.
   *
   * > 👉 **Note**: we can’t have blank lines in text, so no need to worry about
   * > empty tokens.
   *
   * ```markdown
   *   | a <!--a
   * > | b-->
   *     ^
   * ```
   *
   * @type {State}
   */
        function lineEndingAfter(code) {
    // Always populated by defaults.
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(
            self.parser.constructs.disable.null,
            'expected `disable.null` to be populated'
          )
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)
            ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
              effects,
              lineEndingAfterPrefix,
              micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix,
              self.parser.constructs.disable.null.includes('codeIndented')
                ? undefined
                : micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.tabSize
            )(code)
            : lineEndingAfterPrefix(code)
        }

  /**
   * After eol, after optional whitespace.
   *
   * > 👉 **Note**: we can’t have blank lines in text, so no need to worry about
   * > empty tokens.
   *
   * ```markdown
   *   | a <!--a
   * > | b-->
   *     ^
   * ```
   *
   * @type {State}
   */
        function lineEndingAfterPrefix(code) {
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.htmlTextData)
          return returnState(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/label-end.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/label-end.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   labelEnd: () => (/* binding */ labelEnd)
/* harmony export */ });
/* harmony import */ const micromark_factory_destination__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-destination */ "./node_modules/micromark-factory-destination/dev/index.js");
/* harmony import */ const micromark_factory_label__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-factory-label */ "./node_modules/micromark-factory-label/dev/index.js");
/* harmony import */ const micromark_factory_title__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-factory-title */ "./node_modules/micromark-factory-title/dev/index.js");
/* harmony import */ const micromark_factory_whitespace__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-factory-whitespace */ "./node_modules/micromark-factory-whitespace/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_chunked__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-util-chunked */ "./node_modules/micromark-util-chunked/dev/index.js");
/* harmony import */ const micromark_util_normalize_identifier__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! micromark-util-normalize-identifier */ "./node_modules/micromark-util-normalize-identifier/dev/index.js");
/* harmony import */ const micromark_util_resolve_all__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! micromark-util-resolve-all */ "./node_modules/micromark-util-resolve-all/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').Event} Event
 * @typedef {import('micromark-util-types').Resolver} Resolver
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */














/** @type {Construct} */
      const labelEnd = {
        name: 'labelEnd',
        tokenize: tokenizeLabelEnd,
        resolveTo: resolveToLabelEnd,
        resolveAll: resolveAllLabelEnd
      }

/** @type {Construct} */
      const resourceConstruct = {tokenize: tokenizeResource}
/** @type {Construct} */
      const referenceFullConstruct = {tokenize: tokenizeReferenceFull}
/** @type {Construct} */
      const referenceCollapsedConstruct = {tokenize: tokenizeReferenceCollapsed}

/** @type {Resolver} */
      function resolveAllLabelEnd(events) {
        let index = -1

        while (++index < events.length) {
          const token = events[index][1]

          if (
            token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelImage ||
      token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelLink ||
      token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelEnd
          ) {
      // Remove the marker.
            events.splice(index + 1, token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelImage ? 4 : 2)
            token.type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.data
            index++
          }
        }

        return events
      }

/** @type {Resolver} */
      function resolveToLabelEnd(events, context) {
        let index = events.length
        let offset = 0
  /** @type {Token} */
        let token
  /** @type {number | undefined} */
        let open
  /** @type {number | undefined} */
        let close
  /** @type {Array<Event>} */
        let media

  // Find an opening.
        while (index--) {
          token = events[index][1]

          if (open) {
      // If we see another link, or inactive link label, we’ve been here before.
            if (
              token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.link ||
        (token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelLink && token._inactive)
            ) {
              break
            }

      // Mark other link openings as inactive, as we can’t have links in
      // links.
            if (events[index][0] === 'enter' && token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelLink) {
              token._inactive = true
            }
          } else if (close) {
            if (
              events[index][0] === 'enter' &&
        (token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelImage || token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelLink) &&
        !token._balanced
            ) {
              open = index

              if (token.type !== micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelLink) {
                offset = 2
                break
              }
            }
          } else if (token.type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelEnd) {
            close = index
          }
        }

        (0,uvu_assert__WEBPACK_IMPORTED_MODULE_11__.ok)(open !== undefined, '`open` is supposed to be found')
        ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_11__.ok)(close !== undefined, '`close` is supposed to be found')

        const group = {
          type: events[open][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelLink ? micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.link : micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.image,
          start: Object.assign({}, events[open][1].start),
          end: Object.assign({}, events[events.length - 1][1].end)
        }

        const label = {
          type: micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.label,
          start: Object.assign({}, events[open][1].start),
          end: Object.assign({}, events[close][1].end)
        }

        const text = {
          type: micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelText,
          start: Object.assign({}, events[open + offset + 2][1].end),
          end: Object.assign({}, events[close - 2][1].start)
        }

        media = [
          ['enter', group, context],
          ['enter', label, context]
        ]

  // Opening marker.
        media = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_5__.push)(media, events.slice(open + 1, open + offset + 3))

  // Text open.
        media = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_5__.push)(media, [['enter', text, context]])

  // Always populated by defaults.
        ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_11__.ok)(
          context.parser.constructs.insideSpan.null,
          'expected `insideSpan.null` to be populated'
        )
  // Between.
        media = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_5__.push)(
          media,
          (0,micromark_util_resolve_all__WEBPACK_IMPORTED_MODULE_7__.resolveAll)(
            context.parser.constructs.insideSpan.null,
            events.slice(open + offset + 4, close - 3),
            context
          )
        )

  // Text close, marker close, label close.
        media = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_5__.push)(media, [
          ['exit', text, context],
          events[close - 2],
          events[close - 1],
          ['exit', label, context]
        ])

  // Reference, resource, or so.
        media = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_5__.push)(media, events.slice(close + 1))

  // Media close.
        media = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_5__.push)(media, [['exit', group, context]])

        ;(0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_5__.splice)(events, open, events.length, media)

        return events
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeLabelEnd(effects, ok, nok) {
        const self = this
        let index = self.events.length
  /** @type {Token} */
        let labelStart
  /** @type {boolean} */
        let defined

  // Find an opening.
        while (index--) {
          if (
            (self.events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelImage ||
        self.events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelLink) &&
      !self.events[index][1]._balanced
          ) {
            labelStart = self.events[index][1]
            break
          }
        }

        return start

  /**
   * Start of label end.
   *
   * ```markdown
   * > | [a](b) c
   *       ^
   * > | [a][b] c
   *       ^
   * > | [a][] b
   *       ^
   * > | [a] b
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_11__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.rightSquareBracket, 'expected `]`')

    // If there is not an okay opening.
          if (!labelStart) {
            return nok(code)
          }

    // If the corresponding label (link) start is marked as inactive,
    // it means we’d be wrapping a link, like this:
    //
    // ```markdown
    // > | a [b [c](d) e](f) g.
    //                  ^
    // ```
    //
    // We can’t have that, so it’s just balanced brackets.
          if (labelStart._inactive) {
            return labelEndNok(code)
          }

          defined = self.parser.defined.includes(
            (0,micromark_util_normalize_identifier__WEBPACK_IMPORTED_MODULE_6__.normalizeIdentifier)(
              self.sliceSerialize({start: labelStart.end, end: self.now()})
            )
          )
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelEnd)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelMarker)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelMarker)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.labelEnd)
          return after
        }

  /**
   * After `]`.
   *
   * ```markdown
   * > | [a](b) c
   *       ^
   * > | [a][b] c
   *       ^
   * > | [a][] b
   *       ^
   * > | [a] b
   *       ^
   * ```
   *
   * @type {State}
   */
        function after(code) {
    // Note: `markdown-rs` also parses GFM footnotes here, which for us is in
    // an extension.

    // Resource (`[asd](fgh)`)?
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.leftParenthesis) {
            return effects.attempt(
              resourceConstruct,
              labelEndOk,
              defined ? labelEndOk : labelEndNok
            )(code)
          }

    // Full (`[asd][fgh]`) or collapsed (`[asd][]`) reference?
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.leftSquareBracket) {
            return effects.attempt(
              referenceFullConstruct,
              labelEndOk,
              defined ? referenceNotFull : labelEndNok
            )(code)
          }

    // Shortcut (`[asd]`) reference?
          return defined ? labelEndOk(code) : labelEndNok(code)
        }

  /**
   * After `]`, at `[`, but not at a full reference.
   *
   * > 👉 **Note**: we only get here if the label is defined.
   *
   * ```markdown
   * > | [a][] b
   *        ^
   * > | [a] b
   *        ^
   * ```
   *
   * @type {State}
   */
        function referenceNotFull(code) {
          return effects.attempt(
            referenceCollapsedConstruct,
            labelEndOk,
            labelEndNok
          )(code)
        }

  /**
   * Done, we found something.
   *
   * ```markdown
   * > | [a](b) c
   *           ^
   * > | [a][b] c
   *           ^
   * > | [a][] b
   *          ^
   * > | [a] b
   *        ^
   * ```
   *
   * @type {State}
   */
        function labelEndOk(code) {
    // Note: `markdown-rs` does a bunch of stuff here.
          return ok(code)
        }

  /**
   * Done, it’s nothing.
   *
   * There was an okay opening, but we didn’t match anything.
   *
   * ```markdown
   * > | [a](b c
   *        ^
   * > | [a][b c
   *        ^
   * > | [a] b
   *        ^
   * ```
   *
   * @type {State}
   */
        function labelEndNok(code) {
          labelStart._balanced = true
          return nok(code)
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeResource(effects, ok, nok) {
        return resourceStart

  /**
   * At a resource.
   *
   * ```markdown
   * > | [a](b) c
   *        ^
   * ```
   *
   * @type {State}
   */
        function resourceStart(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_11__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.leftParenthesis, 'expected left paren')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resource)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceMarker)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceMarker)
          return resourceBefore
        }

  /**
   * In resource, after `(`, at optional whitespace.
   *
   * ```markdown
   * > | [a](b) c
   *         ^
   * ```
   *
   * @type {State}
   */
        function resourceBefore(code) {
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_4__.markdownLineEndingOrSpace)(code)
            ? (0,micromark_factory_whitespace__WEBPACK_IMPORTED_MODULE_3__.factoryWhitespace)(effects, resourceOpen)(code)
            : resourceOpen(code)
        }

  /**
   * In resource, after optional whitespace, at `)` or a destination.
   *
   * ```markdown
   * > | [a](b) c
   *         ^
   * ```
   *
   * @type {State}
   */
        function resourceOpen(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.rightParenthesis) {
            return resourceEnd(code)
          }

          return (0,micromark_factory_destination__WEBPACK_IMPORTED_MODULE_0__.factoryDestination)(
            effects,
            resourceDestinationAfter,
            resourceDestinationMissing,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceDestination,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceDestinationLiteral,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceDestinationLiteralMarker,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceDestinationRaw,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceDestinationString,
            micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_9__.constants.linkResourceDestinationBalanceMax
          )(code)
        }

  /**
   * In resource, after destination, at optional whitespace.
   *
   * ```markdown
   * > | [a](b) c
   *          ^
   * ```
   *
   * @type {State}
   */
        function resourceDestinationAfter(code) {
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_4__.markdownLineEndingOrSpace)(code)
            ? (0,micromark_factory_whitespace__WEBPACK_IMPORTED_MODULE_3__.factoryWhitespace)(effects, resourceBetween)(code)
            : resourceEnd(code)
        }

  /**
   * At invalid destination.
   *
   * ```markdown
   * > | [a](<<) b
   *         ^
   * ```
   *
   * @type {State}
   */
        function resourceDestinationMissing(code) {
          return nok(code)
        }

  /**
   * In resource, after destination and whitespace, at `(` or title.
   *
   * ```markdown
   * > | [a](b ) c
   *           ^
   * ```
   *
   * @type {State}
   */
        function resourceBetween(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.quotationMark ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.apostrophe ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.leftParenthesis
          ) {
            return (0,micromark_factory_title__WEBPACK_IMPORTED_MODULE_2__.factoryTitle)(
              effects,
              resourceTitleAfter,
              nok,
              micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceTitle,
              micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceTitleMarker,
              micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceTitleString
            )(code)
          }

          return resourceEnd(code)
        }

  /**
   * In resource, after title, at optional whitespace.
   *
   * ```markdown
   * > | [a](b "c") d
   *              ^
   * ```
   *
   * @type {State}
   */
        function resourceTitleAfter(code) {
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_4__.markdownLineEndingOrSpace)(code)
            ? (0,micromark_factory_whitespace__WEBPACK_IMPORTED_MODULE_3__.factoryWhitespace)(effects, resourceEnd)(code)
            : resourceEnd(code)
        }

  /**
   * In resource, at `)`.
   *
   * ```markdown
   * > | [a](b) d
   *          ^
   * ```
   *
   * @type {State}
   */
        function resourceEnd(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.rightParenthesis) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceMarker)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resourceMarker)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.resource)
            return ok
          }

          return nok(code)
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeReferenceFull(effects, ok, nok) {
        const self = this

        return referenceFull

  /**
   * In a reference (full), at the `[`.
   *
   * ```markdown
   * > | [a][b] d
   *        ^
   * ```
   *
   * @type {State}
   */
        function referenceFull(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_11__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.leftSquareBracket, 'expected left bracket')
          return micromark_factory_label__WEBPACK_IMPORTED_MODULE_1__.factoryLabel.call(
            self,
            effects,
            referenceFullAfter,
            referenceFullMissing,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.reference,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.referenceMarker,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.referenceString
          )(code)
        }

  /**
   * In a reference (full), after `]`.
   *
   * ```markdown
   * > | [a][b] d
   *          ^
   * ```
   *
   * @type {State}
   */
        function referenceFullAfter(code) {
          return self.parser.defined.includes(
            (0,micromark_util_normalize_identifier__WEBPACK_IMPORTED_MODULE_6__.normalizeIdentifier)(
              self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1)
            )
          )
            ? ok(code)
            : nok(code)
        }

  /**
   * In reference (full) that was missing.
   *
   * ```markdown
   * > | [a][b d
   *        ^
   * ```
   *
   * @type {State}
   */
        function referenceFullMissing(code) {
          return nok(code)
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeReferenceCollapsed(effects, ok, nok) {
        return referenceCollapsedStart

  /**
   * In reference (collapsed), at `[`.
   *
   * > 👉 **Note**: we only get here if the label is defined.
   *
   * ```markdown
   * > | [a][] d
   *        ^
   * ```
   *
   * @type {State}
   */
        function referenceCollapsedStart(code) {
    // We only attempt a collapsed label if there’s a `[`.
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_11__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.leftSquareBracket, 'expected left bracket')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.reference)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.referenceMarker)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.referenceMarker)
          return referenceCollapsedOpen
        }

  /**
   * In reference (collapsed), at `]`.
   *
   * > 👉 **Note**: we only get here if the label is defined.
   *
   * ```markdown
   * > | [a][] d
   *         ^
   * ```
   *
   *  @type {State}
   */
        function referenceCollapsedOpen(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_8__.codes.rightSquareBracket) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.referenceMarker)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.referenceMarker)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_10__.types.reference)
            return ok
          }

          return nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/label-start-image.js":
/*!*****************************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/label-start-image.js ***!
  \*****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   labelStartImage: () => (/* binding */ labelStartImage)
/* harmony export */ });
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/* harmony import */ const _label_end_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./label-end.js */ "./node_modules/micromark-core-commonmark/dev/lib/label-end.js");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */






/** @type {Construct} */
      const labelStartImage = {
        name: 'labelStartImage',
        tokenize: tokenizeLabelStartImage,
        resolveAll: _label_end_js__WEBPACK_IMPORTED_MODULE_3__.labelEnd.resolveAll
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeLabelStartImage(effects, ok, nok) {
        const self = this

        return start

  /**
   * Start of label (image) start.
   *
   * ```markdown
   * > | a ![b] c
   *       ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_2__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.exclamationMark, 'expected `!`')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelImage)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelImageMarker)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelImageMarker)
          return open
        }

  /**
   * After `!`, at `[`.
   *
   * ```markdown
   * > | a ![b] c
   *        ^
   * ```
   *
   * @type {State}
   */
        function open(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.leftSquareBracket) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelMarker)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelMarker)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelImage)
            return after
          }

          return nok(code)
        }

  /**
   * After `![`.
   *
   * ```markdown
   * > | a ![b] c
   *         ^
   * ```
   *
   * This is needed in because, when GFM footnotes are enabled, images never
   * form when started with a `^`.
   * Instead, links form:
   *
   * ```markdown
   * ![^a](b)
   *
   * ![^a][b]
   *
   * [b]: c
   * ```
   *
   * ```html
   * <p>!<a href=\"b\">^a</a></p>
   * <p>!<a href=\"c\">^a</a></p>
   * ```
   *
   * @type {State}
   */
        function after(code) {
    // To do: use a new field to do this, this is still needed for
    // `micromark-extension-gfm-footnote`, but the `label-start-link`
    // behavior isn’t.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.caret &&
      '_hiddenFootnoteSupport' in self.parser.constructs
            ? nok(code)
            : ok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/label-start-link.js":
/*!****************************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/label-start-link.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   labelStartLink: () => (/* binding */ labelStartLink)
/* harmony export */ });
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/* harmony import */ const _label_end_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./label-end.js */ "./node_modules/micromark-core-commonmark/dev/lib/label-end.js");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */






/** @type {Construct} */
      const labelStartLink = {
        name: 'labelStartLink',
        tokenize: tokenizeLabelStartLink,
        resolveAll: _label_end_js__WEBPACK_IMPORTED_MODULE_3__.labelEnd.resolveAll
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeLabelStartLink(effects, ok, nok) {
        const self = this

        return start

  /**
   * Start of label (link) start.
   *
   * ```markdown
   * > | a [b] c
   *       ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_2__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.leftSquareBracket, 'expected `[`')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelLink)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelMarker)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelMarker)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_1__.types.labelLink)
          return after
        }

  /** @type {State} */
        function after(code) {
    // To do: this isn’t needed in `micromark-extension-gfm-footnote`,
    // remove.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.caret &&
      '_hiddenFootnoteSupport' in self.parser.constructs
            ? nok(code)
            : ok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/line-ending.js":
/*!***********************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/line-ending.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   lineEnding: () => (/* binding */ lineEnding)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */






/** @type {Construct} */
      const lineEnding = {name: 'lineEnding', tokenize: tokenizeLineEnding}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeLineEnding(effects, ok) {
        return start

  /** @type {State} */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code), 'expected eol')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding)
          return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, ok, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.linePrefix)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/list.js":
/*!****************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/list.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   list: () => (/* binding */ list)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/* harmony import */ const _blank_line_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./blank-line.js */ "./node_modules/micromark-core-commonmark/dev/lib/blank-line.js");
/* harmony import */ const _thematic_break_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./thematic-break.js */ "./node_modules/micromark-core-commonmark/dev/lib/thematic-break.js");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').ContainerState} ContainerState
 * @typedef {import('micromark-util-types').Exiter} Exiter
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */










/** @type {Construct} */
      const list = {
        name: 'list',
        tokenize: tokenizeListStart,
        continuation: {tokenize: tokenizeListContinuation},
        exit: tokenizeListEnd
      }

/** @type {Construct} */
      const listItemPrefixWhitespaceConstruct = {
        tokenize: tokenizeListItemPrefixWhitespace,
        partial: true
      }

/** @type {Construct} */
      const indentConstruct = {tokenize: tokenizeIndent, partial: true}

// To do: `markdown-rs` parses list items on their own and later stitches them
// together.

/**
 * @type {Tokenizer}
 * @this {TokenizeContext}
 */
      function tokenizeListStart(effects, ok, nok) {
        const self = this
        const tail = self.events[self.events.length - 1]
        let initialSize =
    tail && tail[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix
      ? tail[2].sliceSerialize(tail[1], true).length
      : 0
        let size = 0

        return start

  /** @type {State} */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
          const kind =
      self.containerState.type ||
      (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.asterisk || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.plusSign || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash
        ? micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listUnordered
        : micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listOrdered)

          if (
            kind === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listUnordered
              ? !self.containerState.marker || code === self.containerState.marker
              : (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiDigit)(code)
          ) {
            if (!self.containerState.type) {
              self.containerState.type = kind
              effects.enter(kind, {_container: true})
            }

            if (kind === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listUnordered) {
              effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemPrefix)
              return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.asterisk || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash
                ? effects.check(_thematic_break_js__WEBPACK_IMPORTED_MODULE_7__.thematicBreak, nok, atMarker)(code)
                : atMarker(code)
            }

            if (!self.interrupt || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.digit1) {
              effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemPrefix)
              effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemValue)
              return inside(code)
            }
          }

          return nok(code)
        }

  /** @type {State} */
        function inside(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.asciiDigit)(code) && ++size < micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.listItemValueSizeMax) {
            effects.consume(code)
            return inside
          }

          if (
            (!self.interrupt || size < 2) &&
      (self.containerState.marker
        ? code === self.containerState.marker
        : code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.rightParenthesis || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dot)
          ) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemValue)
            return atMarker(code)
          }

          return nok(code)
        }

  /**
   * @type {State}
   **/
        function atMarker(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(code !== micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof, 'eof (`null`) is not a marker')
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemMarker)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemMarker)
          self.containerState.marker = self.containerState.marker || code
          return effects.check(
            _blank_line_js__WEBPACK_IMPORTED_MODULE_6__.blankLine,
      // Can’t be empty when interrupting.
            self.interrupt ? nok : onBlank,
            effects.attempt(
              listItemPrefixWhitespaceConstruct,
              endOfPrefix,
              otherPrefix
            )
          )
        }

  /** @type {State} */
        function onBlank(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
          self.containerState.initialBlankLine = true
          initialSize++
          return endOfPrefix(code)
        }

  /** @type {State} */
        function otherPrefix(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemPrefixWhitespace)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemPrefixWhitespace)
            return endOfPrefix
          }

          return nok(code)
        }

  /** @type {State} */
        function endOfPrefix(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
          self.containerState.size =
      initialSize +
      self.sliceSerialize(effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemPrefix), true).length
          return ok(code)
        }
      }

/**
 * @type {Tokenizer}
 * @this {TokenizeContext}
 */
      function tokenizeListContinuation(effects, ok, nok) {
        const self = this

  ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
        self.containerState._closeFlow = undefined

        return effects.check(_blank_line_js__WEBPACK_IMPORTED_MODULE_6__.blankLine, onBlank, notBlank)

  /** @type {State} */
        function onBlank(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(typeof self.containerState.size === 'number', 'expected size')
          self.containerState.furtherBlankLines =
      self.containerState.furtherBlankLines ||
      self.containerState.initialBlankLine

    // We have a blank line.
    // Still, try to consume at most the items size.
          return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
            effects,
            ok,
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemIndent,
            self.containerState.size + 1
          )(code)
        }

  /** @type {State} */
        function notBlank(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
          if (self.containerState.furtherBlankLines || !(0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            self.containerState.furtherBlankLines = undefined
            self.containerState.initialBlankLine = undefined
            return notInCurrentItem(code)
          }

          self.containerState.furtherBlankLines = undefined
          self.containerState.initialBlankLine = undefined
          return effects.attempt(indentConstruct, ok, notInCurrentItem)(code)
        }

  /** @type {State} */
        function notInCurrentItem(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
    // While we do continue, we signal that the flow should be closed.
          self.containerState._closeFlow = true
    // As we’re closing flow, we’re no longer interrupting.
          self.interrupt = undefined
    // Always populated by defaults.
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(
            self.parser.constructs.disable.null,
            'expected `disable.null` to be populated'
          )
          return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
            effects,
            effects.attempt(list, ok, nok),
            micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix,
            self.parser.constructs.disable.null.includes('codeIndented')
              ? undefined
              : micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.tabSize
          )(code)
        }
      }

/**
 * @type {Tokenizer}
 * @this {TokenizeContext}
 */
      function tokenizeIndent(effects, ok, nok) {
        const self = this

  ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
        ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(typeof self.containerState.size === 'number', 'expected size')

        return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
          effects,
          afterPrefix,
          micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemIndent,
          self.containerState.size + 1
        )

  /** @type {State} */
        function afterPrefix(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(self.containerState, 'expected state')
          const tail = self.events[self.events.length - 1]
          return tail &&
      tail[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemIndent &&
      tail[2].sliceSerialize(tail[1], true).length === self.containerState.size
            ? ok(code)
            : nok(code)
        }
      }

/**
 * @type {Exiter}
 * @this {TokenizeContext}
 */
      function tokenizeListEnd(effects) {
        (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(this.containerState, 'expected state')
        ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(typeof this.containerState.type === 'string', 'expected type')
        effects.exit(this.containerState.type)
      }

/**
 * @type {Tokenizer}
 * @this {TokenizeContext}
 */
      function tokenizeListItemPrefixWhitespace(effects, ok, nok) {
        const self = this

  // Always populated by defaults.
  ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(
          self.parser.constructs.disable.null,
          'expected `disable.null` to be populated'
        )

        return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
          effects,
          afterPrefix,
          micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemPrefixWhitespace,
          self.parser.constructs.disable.null.includes('codeIndented')
            ? undefined
            : micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.tabSize + 1
        )

  /** @type {State} */
        function afterPrefix(code) {
          const tail = self.events[self.events.length - 1]

          return !(0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code) &&
      tail &&
      tail[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.listItemPrefixWhitespace
            ? ok(code)
            : nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/setext-underline.js":
/*!****************************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/setext-underline.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   setextUnderline: () => (/* binding */ setextUnderline)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').Resolver} Resolver
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */







/** @type {Construct} */
      const setextUnderline = {
        name: 'setextUnderline',
        tokenize: tokenizeSetextUnderline,
        resolveTo: resolveToSetextUnderline
      }

/** @type {Resolver} */
      function resolveToSetextUnderline(events, context) {
  // To do: resolve like `markdown-rs`.
        let index = events.length
  /** @type {number | undefined} */
        let content
  /** @type {number | undefined} */
        let text
  /** @type {number | undefined} */
        let definition

  // Find the opening of the content.
  // It’ll always exist: we don’t tokenize if it isn’t there.
        while (index--) {
          if (events[index][0] === 'enter') {
            if (events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.content) {
              content = index
              break
            }

            if (events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.paragraph) {
              text = index
            }
          }
    // Exit
          else {
            if (events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.content) {
        // Remove the content end (if needed we’ll add it later)
              events.splice(index, 1)
            }

            if (!definition && events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.definition) {
              definition = index
            }
          }
        }

        (0,uvu_assert__WEBPACK_IMPORTED_MODULE_4__.ok)(text !== undefined, 'expected a `text` index to be found')
        ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_4__.ok)(content !== undefined, 'expected a `text` index to be found')

        const heading = {
          type: micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.setextHeading,
          start: Object.assign({}, events[text][1].start),
          end: Object.assign({}, events[events.length - 1][1].end)
        }

  // Change the paragraph to setext heading text.
        events[text][1].type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.setextHeadingText

  // If we have definitions in the content, we’ll keep on having content,
  // but we need move it.
        if (definition) {
          events.splice(text, 0, ['enter', heading, context])
          events.splice(definition + 1, 0, ['exit', events[content][1], context])
          events[content][1].end = Object.assign({}, events[definition][1].end)
        } else {
          events[content][1] = heading
        }

  // Add the heading exit at the end.
        events.push(['exit', heading, context])

        return events
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeSetextUnderline(effects, ok, nok) {
        const self = this
  /** @type {NonNullable<Code>} */
        let marker

        return start

  /**
   * At start of heading (setext) underline.
   *
   * ```markdown
   *   | aa
   * > | ==
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          let index = self.events.length
    /** @type {boolean | undefined} */
          let paragraph

    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_4__.ok)(
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.equalsTo,
            'expected `=` or `-`'
          )

    // Find an opening.
          while (index--) {
      // Skip enter/exit of line ending, line prefix, and content.
      // We can now either have a definition or a paragraph.
            if (
              self.events[index][1].type !== micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.lineEnding &&
        self.events[index][1].type !== micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.linePrefix &&
        self.events[index][1].type !== micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.content
            ) {
              paragraph = self.events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.paragraph
              break
            }
          }

    // To do: handle lazy/pierce like `markdown-rs`.
    // To do: parse indent like `markdown-rs`.
          if (!self.parser.lazy[self.now().line] && (self.interrupt || paragraph)) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.setextHeadingLine)
            marker = code
            return before(code)
          }

          return nok(code)
        }

  /**
   * After optional whitespace, at `-` or `=`.
   *
   * ```markdown
   *   | aa
   * > | ==
   *     ^
   * ```
   *
   * @type {State}
   */
        function before(code) {
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.setextHeadingLineSequence)
          return inside(code)
        }

  /**
   * In sequence.
   *
   * ```markdown
   *   | aa
   * > | ==
   *     ^
   * ```
   *
   * @type {State}
   */
        function inside(code) {
          if (code === marker) {
            effects.consume(code)
            return inside
          }

          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.setextHeadingLineSequence)

          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)
            ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, after, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.lineSuffix)(code)
            : after(code)
        }

  /**
   * After sequence, after optional whitespace.
   *
   * ```markdown
   *   | aa
   * > | ==
   *       ^
   * ```
   *
   * @type {State}
   */
        function after(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.setextHeadingLine)
            return ok(code)
          }

          return nok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-core-commonmark/dev/lib/thematic-break.js":
/*!**************************************************************************!*\
  !*** ./node_modules/micromark-core-commonmark/dev/lib/thematic-break.js ***!
  \**************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   thematicBreak: () => (/* binding */ thematicBreak)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */








/** @type {Construct} */
      const thematicBreak = {
        name: 'thematicBreak',
        tokenize: tokenizeThematicBreak
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeThematicBreak(effects, ok, nok) {
        let size = 0
  /** @type {NonNullable<Code>} */
        let marker

        return start

  /**
   * Start of thematic break.
   *
   * ```markdown
   * > | ***
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.thematicBreak)
    // To do: parse indent like `markdown-rs`.
          return before(code)
        }

  /**
   * After optional whitespace, at marker.
   *
   * ```markdown
   * > | ***
   *     ^
   * ```
   *
   * @type {State}
   */
        function before(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.asterisk ||
        code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.dash ||
        code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.underscore,
            'expected `*`, `-`, or `_`'
          )
          marker = code
          return atBreak(code)
        }

  /**
   * After something, before something else.
   *
   * ```markdown
   * > | ***
   *     ^
   * ```
   *
   * @type {State}
   */
        function atBreak(code) {
          if (code === marker) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.thematicBreakSequence)
            return sequence(code)
          }

          if (
            size >= micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.thematicBreakMarkerCountMin &&
      (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code))
          ) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.thematicBreak)
            return ok(code)
          }

          return nok(code)
        }

  /**
   * In sequence.
   *
   * ```markdown
   * > | ***
   *     ^
   * ```
   *
   * @type {State}
   */
        function sequence(code) {
          if (code === marker) {
            effects.consume(code)
            size++
            return sequence
          }

          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.thematicBreakSequence)
          return (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)
            ? (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, atBreak, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.whitespace)(code)
            : atBreak(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-factory-destination/dev/index.js":
/*!*****************************************************************!*\
  !*** ./node_modules/micromark-factory-destination/dev/index.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   factoryDestination: () => (/* binding */ factoryDestination)
/* harmony export */ });
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/**
 * @typedef {import('micromark-util-types').Effects} Effects
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenType} TokenType
 */






/**
 * Parse destinations.
 *
 * ###### Examples
 *
 * ```markdown
 * <a>
 * <a\>b>
 * <a b>
 * <a)>
 * a
 * a\)b
 * a(b)c
 * a(b)
 * ```
 *
 * @param {Effects} effects
 *   Context.
 * @param {State} ok
 *   State switched to when successful.
 * @param {State} nok
 *   State switched to when unsuccessful.
 * @param {TokenType} type
 *   Type for whole (`<a>` or `b`).
 * @param {TokenType} literalType
 *   Type when enclosed (`<a>`).
 * @param {TokenType} literalMarkerType
 *   Type for enclosing (`<` and `>`).
 * @param {TokenType} rawType
 *   Type when not enclosed (`b`).
 * @param {TokenType} stringType
 *   Type for the value (`a` or `b`).
 * @param {number | undefined} [max=Infinity]
 *   Depth of nested parens (inclusive).
 * @returns {State}
 *   Start state.
 */
// eslint-disable-next-line max-params
      function factoryDestination(
        effects,
        ok,
        nok,
        type,
        literalType,
        literalMarkerType,
        rawType,
        stringType,
        max
      ) {
        const limit = max || Number.POSITIVE_INFINITY
        let balance = 0

        return start

  /**
   * Start of destination.
   *
   * ```markdown
   * > | <aa>
   *     ^
   * > | aa
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.lessThan) {
            effects.enter(type)
            effects.enter(literalType)
            effects.enter(literalMarkerType)
            effects.consume(code)
            effects.exit(literalMarkerType)
            return enclosedBefore
          }

    // ASCII control, space, closing paren.
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.space ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.rightParenthesis ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiControl)(code)
          ) {
            return nok(code)
          }

          effects.enter(type)
          effects.enter(rawType)
          effects.enter(stringType)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.chunkString, {contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__.constants.contentTypeString})
          return raw(code)
        }

  /**
   * After `<`, at an enclosed destination.
   *
   * ```markdown
   * > | <aa>
   *      ^
   * ```
   *
   * @type {State}
   */
        function enclosedBefore(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.greaterThan) {
            effects.enter(literalMarkerType)
            effects.consume(code)
            effects.exit(literalMarkerType)
            effects.exit(literalType)
            effects.exit(type)
            return ok
          }

          effects.enter(stringType)
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.chunkString, {contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__.constants.contentTypeString})
          return enclosed(code)
        }

  /**
   * In enclosed destination.
   *
   * ```markdown
   * > | <aa>
   *      ^
   * ```
   *
   * @type {State}
   */
        function enclosed(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.greaterThan) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.chunkString)
            effects.exit(stringType)
            return enclosedBefore(code)
          }

          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.lessThan ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)
          ) {
            return nok(code)
          }

          effects.consume(code)
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.backslash ? enclosedEscape : enclosed
        }

  /**
   * After `\`, at a special character.
   *
   * ```markdown
   * > | <a\*a>
   *        ^
   * ```
   *
   * @type {State}
   */
        function enclosedEscape(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.lessThan ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.greaterThan ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.backslash
          ) {
            effects.consume(code)
            return enclosed
          }

          return enclosed(code)
        }

  /**
   * In raw destination.
   *
   * ```markdown
   * > | aa
   *     ^
   * ```
   *
   * @type {State}
   */
        function raw(code) {
          if (
            !balance &&
      (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof ||
        code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.rightParenthesis ||
        (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEndingOrSpace)(code))
          ) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.chunkString)
            effects.exit(stringType)
            effects.exit(rawType)
            effects.exit(type)
            return ok(code)
          }

          if (balance < limit && code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.leftParenthesis) {
            effects.consume(code)
            balance++
            return raw
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.rightParenthesis) {
            effects.consume(code)
            balance--
            return raw
          }

    // ASCII control (but *not* `\0`) and space and `(`.
    // Note: in `markdown-rs`, `\0` exists in codes, in `micromark-js` it
    // doesn’t.
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.space ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.leftParenthesis ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.asciiControl)(code)
          ) {
            return nok(code)
          }

          effects.consume(code)
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.backslash ? rawEscape : raw
        }

  /**
   * After `\`, at special character.
   *
   * ```markdown
   * > | a\*a
   *       ^
   * ```
   *
   * @type {State}
   */
        function rawEscape(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.leftParenthesis ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.rightParenthesis ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.backslash
          ) {
            effects.consume(code)
            return raw
          }

          return raw(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-factory-label/dev/index.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark-factory-label/dev/index.js ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   factoryLabel: () => (/* binding */ factoryLabel)
/* harmony export */ });
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Effects} Effects
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').TokenType} TokenType
 */







/**
 * Parse labels.
 *
 * > 👉 **Note**: labels in markdown are capped at 999 characters in the string.
 *
 * ###### Examples
 *
 * ```markdown
 * [a]
 * [a
 * b]
 * [a\]b]
 * ```
 *
 * @this {TokenizeContext}
 *   Tokenize context.
 * @param {Effects} effects
 *   Context.
 * @param {State} ok
 *   State switched to when successful.
 * @param {State} nok
 *   State switched to when unsuccessful.
 * @param {TokenType} type
 *   Type of the whole label (`[a]`).
 * @param {TokenType} markerType
 *   Type for the markers (`[` and `]`).
 * @param {TokenType} stringType
 *   Type for the identifier (`a`).
 * @returns {State}
 *   Start state.
 */
// eslint-disable-next-line max-params
      function factoryLabel(effects, ok, nok, type, markerType, stringType) {
        const self = this
        let size = 0
  /** @type {boolean} */
        let seen

        return start

  /**
   * Start of label.
   *
   * ```markdown
   * > | [a]
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_4__.ok)(code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.leftSquareBracket, 'expected `[`')
          effects.enter(type)
          effects.enter(markerType)
          effects.consume(code)
          effects.exit(markerType)
          effects.enter(stringType)
          return atBreak
        }

  /**
   * In label, at something, before something else.
   *
   * ```markdown
   * > | [a]
   *      ^
   * ```
   *
   * @type {State}
   */
        function atBreak(code) {
          if (
            size > micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__.constants.linkReferenceSizeMax ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.leftSquareBracket ||
      (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.rightSquareBracket && !seen) ||
      // To do: remove in the future once we’ve switched from
      // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
      // which doesn’t need this.
      // Hidden footnotes hook.
      /* c8 ignore next 3 */
      (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.caret &&
        !size &&
        '_hiddenFootnoteSupport' in self.parser.constructs)
          ) {
            return nok(code)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.rightSquareBracket) {
            effects.exit(stringType)
            effects.enter(markerType)
            effects.consume(code)
            effects.exit(markerType)
            effects.exit(type)
            return ok
          }

    // To do: indent? Link chunks and EOLs together?
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code)) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.lineEnding)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.lineEnding)
            return atBreak
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.chunkString, {contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__.constants.contentTypeString})
          return labelInside(code)
        }

  /**
   * In label, in text.
   *
   * ```markdown
   * > | [a]
   *      ^
   * ```
   *
   * @type {State}
   */
        function labelInside(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.leftSquareBracket ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.rightSquareBracket ||
      (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEnding)(code) ||
      size++ > micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__.constants.linkReferenceSizeMax
          ) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_3__.types.chunkString)
            return atBreak(code)
          }

          effects.consume(code)
          if (!seen) seen = !(0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownSpace)(code)
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.backslash ? labelEscape : labelInside
        }

  /**
   * After `\`, at a special character.
   *
   * ```markdown
   * > | [a\*a]
   *        ^
   * ```
   *
   * @type {State}
   */
        function labelEscape(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.leftSquareBracket ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.backslash ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.rightSquareBracket
          ) {
            effects.consume(code)
            size++
            return labelInside
          }

          return labelInside(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-factory-space/dev/index.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark-factory-space/dev/index.js ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   factorySpace: () => (/* binding */ factorySpace)
/* harmony export */ });
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/**
 * @typedef {import('micromark-util-types').Effects} Effects
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenType} TokenType
 */



// To do: implement `spaceOrTab`, `spaceOrTabMinMax`, `spaceOrTabWithOptions`.

/**
 * Parse spaces and tabs.
 *
 * There is no `nok` parameter:
 *
 * *   spaces in markdown are often optional, in which case this factory can be
 *     used and `ok` will be switched to whether spaces were found or not
 * *   one line ending or space can be detected with `markdownSpace(code)` right
 *     before using `factorySpace`
 *
 * ###### Examples
 *
 * Where `␉` represents a tab (plus how much it expands) and `␠` represents a
 * single space.
 *
 * ```markdown
 * ␉
 * ␠␠␠␠
 * ␉␠
 * ```
 *
 * @param {Effects} effects
 *   Context.
 * @param {State} ok
 *   State switched to when successful.
 * @param {TokenType} type
 *   Type (`' \t'`).
 * @param {number | undefined} [max=Infinity]
 *   Max (exclusive).
 * @returns
 *   Start state.
 */
      function factorySpace(effects, ok, type, max) {
        const limit = max ? max - 1 : Number.POSITIVE_INFINITY
        let size = 0

        return start

  /** @type {State} */
        function start(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownSpace)(code)) {
            effects.enter(type)
            return prefix(code)
          }

          return ok(code)
        }

  /** @type {State} */
        function prefix(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownSpace)(code) && size++ < limit) {
            effects.consume(code)
            return prefix
          }

          effects.exit(type)
          return ok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-factory-title/dev/index.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark-factory-title/dev/index.js ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   factoryTitle: () => (/* binding */ factoryTitle)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Effects} Effects
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenType} TokenType
 */







/**
 * Parse titles.
 *
 * ###### Examples
 *
 * ```markdown
 * "a"
 * 'b'
 * (c)
 * "a
 * b"
 * 'a
 *     b'
 * (a\)b)
 * ```
 *
 * @param {Effects} effects
 *   Context.
 * @param {State} ok
 *   State switched to when successful.
 * @param {State} nok
 *   State switched to when unsuccessful.
 * @param {TokenType} type
 *   Type of the whole title (`"a"`, `'b'`, `(c)`).
 * @param {TokenType} markerType
 *   Type for the markers (`"`, `'`, `(`, and `)`).
 * @param {TokenType} stringType
 *   Type for the value (`a`).
 * @returns {State}
 *   Start state.
 */
// eslint-disable-next-line max-params
      function factoryTitle(effects, ok, nok, type, markerType, stringType) {
  /** @type {NonNullable<Code>} */
        let marker

        return start

  /**
   * Start of title.
   *
   * ```markdown
   * > | "a"
   *     ^
   * ```
   *
   * @type {State}
   */
        function start(code) {
          if (
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.quotationMark ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.apostrophe ||
      code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.leftParenthesis
          ) {
            effects.enter(type)
            effects.enter(markerType)
            effects.consume(code)
            effects.exit(markerType)
            marker = code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.leftParenthesis ? micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.rightParenthesis : code
            return begin
          }

          return nok(code)
        }

  /**
   * After opening marker.
   *
   * This is also used at the closing marker.
   *
   * ```markdown
   * > | "a"
   *      ^
   * ```
   *
   * @type {State}
   */
        function begin(code) {
          if (code === marker) {
            effects.enter(markerType)
            effects.consume(code)
            effects.exit(markerType)
            effects.exit(type)
            return ok
          }

          effects.enter(stringType)
          return atBreak(code)
        }

  /**
   * At something, before something else.
   *
   * ```markdown
   * > | "a"
   *      ^
   * ```
   *
   * @type {State}
   */
        function atBreak(code) {
          if (code === marker) {
            effects.exit(stringType)
            return begin(marker)
          }

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof) {
            return nok(code)
          }

    // Note: blank lines can’t exist in content.
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
      // To do: use `space_or_tab_eol_with_options`, connect.
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
            return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, atBreak, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix)
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkString, {contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.contentTypeString})
          return inside(code)
        }

  /**
   *
   *
   * @type {State}
   */
        function inside(code) {
          if (code === marker || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkString)
            return atBreak(code)
          }

          effects.consume(code)
          return code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.backslash ? escape : inside
        }

  /**
   * After `\`, at a special character.
   *
   * ```markdown
   * > | "a\*b"
   *      ^
   * ```
   *
   * @type {State}
   */
        function escape(code) {
          if (code === marker || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.backslash) {
            effects.consume(code)
            return inside
          }

          return inside(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-factory-whitespace/dev/index.js":
/*!****************************************************************!*\
  !*** ./node_modules/micromark-factory-whitespace/dev/index.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   factoryWhitespace: () => (/* binding */ factoryWhitespace)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/**
 * @typedef {import('micromark-util-types').Effects} Effects
 * @typedef {import('micromark-util-types').State} State
 */





/**
 * Parse spaces and tabs.
 *
 * There is no `nok` parameter:
 *
 * *   line endings or spaces in markdown are often optional, in which case this
 *     factory can be used and `ok` will be switched to whether spaces were found
 *     or not
 * *   one line ending or space can be detected with
 *     `markdownLineEndingOrSpace(code)` right before using `factoryWhitespace`
 *
 * @param {Effects} effects
 *   Context.
 * @param {State} ok
 *   State switched to when successful.
 * @returns
 *   Start state.
 */
      function factoryWhitespace(effects, ok) {
  /** @type {boolean} */
        let seen

        return start

  /** @type {State} */
        function start(code) {
          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding)
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding)
            seen = true
            return start
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownSpace)(code)) {
            return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
              effects,
              start,
              seen ? micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.linePrefix : micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineSuffix
            )(code)
          }

          return ok(code)
        }
      }


/***/ }),

/***/ "./node_modules/micromark-util-character/dev/index.js":
/*!************************************************************!*\
  !*** ./node_modules/micromark-util-character/dev/index.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   asciiAlpha: () => (/* binding */ asciiAlpha),
/* harmony export */   asciiAlphanumeric: () => (/* binding */ asciiAlphanumeric),
/* harmony export */   asciiAtext: () => (/* binding */ asciiAtext),
/* harmony export */   asciiControl: () => (/* binding */ asciiControl),
/* harmony export */   asciiDigit: () => (/* binding */ asciiDigit),
/* harmony export */   asciiHexDigit: () => (/* binding */ asciiHexDigit),
/* harmony export */   asciiPunctuation: () => (/* binding */ asciiPunctuation),
/* harmony export */   markdownLineEnding: () => (/* binding */ markdownLineEnding),
/* harmony export */   markdownLineEndingOrSpace: () => (/* binding */ markdownLineEndingOrSpace),
/* harmony export */   markdownSpace: () => (/* binding */ markdownSpace),
/* harmony export */   unicodePunctuation: () => (/* binding */ unicodePunctuation),
/* harmony export */   unicodeWhitespace: () => (/* binding */ unicodeWhitespace)
/* harmony export */ });
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const _lib_unicode_punctuation_regex_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./lib/unicode-punctuation-regex.js */ "./node_modules/micromark-util-character/dev/lib/unicode-punctuation-regex.js");
/**
 * @typedef {import('micromark-util-types').Code} Code
 */




/**
 * Check whether the character code represents an ASCII alpha (`a` through `z`,
 * case insensitive).
 *
 * An **ASCII alpha** is an ASCII upper alpha or ASCII lower alpha.
 *
 * An **ASCII upper alpha** is a character in the inclusive range U+0041 (`A`)
 * to U+005A (`Z`).
 *
 * An **ASCII lower alpha** is a character in the inclusive range U+0061 (`a`)
 * to U+007A (`z`).
 *
 * @param code
 *   Code.
 * @returns
 *   Whether it matches.
 */
      const asciiAlpha = regexCheck(/[A-Za-z]/)

/**
 * Check whether the character code represents an ASCII alphanumeric (`a`
 * through `z`, case insensitive, or `0` through `9`).
 *
 * An **ASCII alphanumeric** is an ASCII digit (see `asciiDigit`) or ASCII alpha
 * (see `asciiAlpha`).
 *
 * @param code
 *   Code.
 * @returns
 *   Whether it matches.
 */
      const asciiAlphanumeric = regexCheck(/[\dA-Za-z]/)

/**
 * Check whether the character code represents an ASCII atext.
 *
 * atext is an ASCII alphanumeric (see `asciiAlphanumeric`), or a character in
 * the inclusive ranges U+0023 NUMBER SIGN (`#`) to U+0027 APOSTROPHE (`'`),
 * U+002A ASTERISK (`*`), U+002B PLUS SIGN (`+`), U+002D DASH (`-`), U+002F
 * SLASH (`/`), U+003D EQUALS TO (`=`), U+003F QUESTION MARK (`?`), U+005E
 * CARET (`^`) to U+0060 GRAVE ACCENT (`` ` ``), or U+007B LEFT CURLY BRACE
 * (`{`) to U+007E TILDE (`~`).
 *
 * See:
 * **\[RFC5322]**:
 * [Internet Message Format](https://tools.ietf.org/html/rfc5322).
 * P. Resnick.
 * IETF.
 *
 * @param code
 *   Code.
 * @returns
 *   Whether it matches.
 */
      const asciiAtext = regexCheck(/[#-'*+\--9=?A-Z^-~]/)

/**
 * Check whether a character code is an ASCII control character.
 *
 * An **ASCII control** is a character in the inclusive range U+0000 NULL (NUL)
 * to U+001F (US), or U+007F (DEL).
 *
 * @param {Code} code
 *   Code.
 * @returns {boolean}
 *   Whether it matches.
 */
      function asciiControl(code) {
        return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
          code !== null && (code < micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.space || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.del)
        )
      }

/**
 * Check whether the character code represents an ASCII digit (`0` through `9`).
 *
 * An **ASCII digit** is a character in the inclusive range U+0030 (`0`) to
 * U+0039 (`9`).
 *
 * @param code
 *   Code.
 * @returns
 *   Whether it matches.
 */
      const asciiDigit = regexCheck(/\d/)

/**
 * Check whether the character code represents an ASCII hex digit (`a` through
 * `f`, case insensitive, or `0` through `9`).
 *
 * An **ASCII hex digit** is an ASCII digit (see `asciiDigit`), ASCII upper hex
 * digit, or an ASCII lower hex digit.
 *
 * An **ASCII upper hex digit** is a character in the inclusive range U+0041
 * (`A`) to U+0046 (`F`).
 *
 * An **ASCII lower hex digit** is a character in the inclusive range U+0061
 * (`a`) to U+0066 (`f`).
 *
 * @param code
 *   Code.
 * @returns
 *   Whether it matches.
 */
      const asciiHexDigit = regexCheck(/[\dA-Fa-f]/)

/**
 * Check whether the character code represents ASCII punctuation.
 *
 * An **ASCII punctuation** is a character in the inclusive ranges U+0021
 * EXCLAMATION MARK (`!`) to U+002F SLASH (`/`), U+003A COLON (`:`) to U+0040 AT
 * SIGN (`@`), U+005B LEFT SQUARE BRACKET (`[`) to U+0060 GRAVE ACCENT
 * (`` ` ``), or U+007B LEFT CURLY BRACE (`{`) to U+007E TILDE (`~`).
 *
 * @param code
 *   Code.
 * @returns
 *   Whether it matches.
 */
      const asciiPunctuation = regexCheck(/[!-/:-@[-`{-~]/)

/**
 * Check whether a character code is a markdown line ending.
 *
 * A **markdown line ending** is the virtual characters M-0003 CARRIAGE RETURN
 * LINE FEED (CRLF), M-0004 LINE FEED (LF) and M-0005 CARRIAGE RETURN (CR).
 *
 * In micromark, the actual character U+000A LINE FEED (LF) and U+000D CARRIAGE
 * RETURN (CR) are replaced by these virtual characters depending on whether
 * they occurred together.
 *
 * @param {Code} code
 *   Code.
 * @returns {boolean}
 *   Whether it matches.
 */
      function markdownLineEnding(code) {
        return code !== null && code < micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.horizontalTab
      }

/**
 * Check whether a character code is a markdown line ending (see
 * `markdownLineEnding`) or markdown space (see `markdownSpace`).
 *
 * @param {Code} code
 *   Code.
 * @returns {boolean}
 *   Whether it matches.
 */
      function markdownLineEndingOrSpace(code) {
        return code !== null && (code < micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.nul || code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.space)
      }

/**
 * Check whether a character code is a markdown space.
 *
 * A **markdown space** is the concrete character U+0020 SPACE (SP) and the
 * virtual characters M-0001 VIRTUAL SPACE (VS) and M-0002 HORIZONTAL TAB (HT).
 *
 * In micromark, the actual character U+0009 CHARACTER TABULATION (HT) is
 * replaced by one M-0002 HORIZONTAL TAB (HT) and between 0 and 3 M-0001 VIRTUAL
 * SPACE (VS) characters, depending on the column at which the tab occurred.
 *
 * @param {Code} code
 *   Code.
 * @returns {boolean}
 *   Whether it matches.
 */
      function markdownSpace(code) {
        return (
          code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.horizontalTab ||
    code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.virtualSpace ||
    code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.space
        )
      }

// Size note: removing ASCII from the regex and using `asciiPunctuation` here
// In fact adds to the bundle size.
/**
 * Check whether the character code represents Unicode punctuation.
 *
 * A **Unicode punctuation** is a character in the Unicode `Pc` (Punctuation,
 * Connector), `Pd` (Punctuation, Dash), `Pe` (Punctuation, Close), `Pf`
 * (Punctuation, Final quote), `Pi` (Punctuation, Initial quote), `Po`
 * (Punctuation, Other), or `Ps` (Punctuation, Open) categories, or an ASCII
 * punctuation (see `asciiPunctuation`).
 *
 * See:
 * **\[UNICODE]**:
 * [The Unicode Standard](https://www.unicode.org/versions/).
 * Unicode Consortium.
 *
 * @param code
 *   Code.
 * @returns
 *   Whether it matches.
 */
      const unicodePunctuation = regexCheck(_lib_unicode_punctuation_regex_js__WEBPACK_IMPORTED_MODULE_1__.unicodePunctuationRegex)

/**
 * Check whether the character code represents Unicode whitespace.
 *
 * Note that this does handle micromark specific markdown whitespace characters.
 * See `markdownLineEndingOrSpace` to check that.
 *
 * A **Unicode whitespace** is a character in the Unicode `Zs` (Separator,
 * Space) category, or U+0009 CHARACTER TABULATION (HT), U+000A LINE FEED (LF),
 * U+000C (FF), or U+000D CARRIAGE RETURN (CR) (**\[UNICODE]**).
 *
 * See:
 * **\[UNICODE]**:
 * [The Unicode Standard](https://www.unicode.org/versions/).
 * Unicode Consortium.
 *
 * @param code
 *   Code.
 * @returns
 *   Whether it matches.
 */
      const unicodeWhitespace = regexCheck(/\s/)

/**
 * Create a code check from a regex.
 *
 * @param {RegExp} regex
 * @returns {(code: Code) => boolean}
 */
      function regexCheck(regex) {
        return check

  /**
   * Check whether a code matches the bound regex.
   *
   * @param {Code} code
   *   Character code.
   * @returns {boolean}
   *   Whether the character code matches the bound regex.
   */
        function check(code) {
          return code !== null && regex.test(String.fromCharCode(code))
        }
      }


/***/ }),

/***/ "./node_modules/micromark-util-character/dev/lib/unicode-punctuation-regex.js":
/*!************************************************************************************!*\
  !*** ./node_modules/micromark-util-character/dev/lib/unicode-punctuation-regex.js ***!
  \************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   unicodePunctuationRegex: () => (/* binding */ unicodePunctuationRegex)
/* harmony export */ });
// This module is generated by `script/`.
//
// CommonMark handles attention (emphasis, strong) markers based on what comes
// before or after them.
// One such difference is if those characters are Unicode punctuation.
// This script is generated from the Unicode data.

/**
 * Regular expression that matches a unicode punctuation character.
 */
      const unicodePunctuationRegex =
  /[!-/:-@[-`{-~\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]/


/***/ }),

/***/ "./node_modules/micromark-util-chunked/dev/index.js":
/*!**********************************************************!*\
  !*** ./node_modules/micromark-util-chunked/dev/index.js ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   push: () => (/* binding */ push),
/* harmony export */   splice: () => (/* binding */ splice)
/* harmony export */ });
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");


/**
 * Like `Array#splice`, but smarter for giant arrays.
 *
 * `Array#splice` takes all items to be inserted as individual argument which
 * causes a stack overflow in V8 when trying to insert 100k items for instance.
 *
 * Otherwise, this does not return the removed items, and takes `items` as an
 * array instead of rest parameters.
 *
 * @template {unknown} T
 *   Item type.
 * @param {Array<T>} list
 *   List to operate on.
 * @param {number} start
 *   Index to remove/insert at (can be negative).
 * @param {number} remove
 *   Number of items to remove.
 * @param {Array<T>} items
 *   Items to inject into `list`.
 * @returns {void}
 *   Nothing.
 */
      function splice(list, start, remove, items) {
        const end = list.length
        let chunkStart = 0
  /** @type {Array<unknown>} */
        let parameters

  // Make start between zero and `end` (included).
        if (start < 0) {
          start = -start > end ? 0 : end + start
        } else {
          start = start > end ? end : start
        }

        remove = remove > 0 ? remove : 0

  // No need to chunk the items if there’s only a couple (10k) items.
        if (items.length < micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_0__.constants.v8MaxSafeChunkSize) {
          parameters = Array.from(items)
          parameters.unshift(start, remove)
    // @ts-expect-error Hush, it’s fine.
          list.splice(...parameters)
        } else {
    // Delete `remove` items starting from `start`
          if (remove) list.splice(start, remove)

    // Insert the items in chunks to not cause stack overflows.
          while (chunkStart < items.length) {
            parameters = items.slice(
              chunkStart,
              chunkStart + micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_0__.constants.v8MaxSafeChunkSize
            )
            parameters.unshift(start, 0)
      // @ts-expect-error Hush, it’s fine.
            list.splice(...parameters)

            chunkStart += micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_0__.constants.v8MaxSafeChunkSize
            start += micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_0__.constants.v8MaxSafeChunkSize
          }
        }
      }

/**
 * Append `items` (an array) at the end of `list` (another array).
 * When `list` was empty, returns `items` instead.
 *
 * This prevents a potentially expensive operation when `list` is empty,
 * and adds items in batches to prevent V8 from hanging.
 *
 * @template {unknown} T
 *   Item type.
 * @param {Array<T>} list
 *   List to operate on.
 * @param {Array<T>} items
 *   Items to add to `list`.
 * @returns {Array<T>}
 *   Either `list` or `items`.
 */
      function push(list, items) {
        if (list.length > 0) {
          splice(list, list.length, 0, items)
          return list
        }

        return items
      }


/***/ }),

/***/ "./node_modules/micromark-util-classify-character/dev/index.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark-util-classify-character/dev/index.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   classifyCharacter: () => (/* binding */ classifyCharacter)
/* harmony export */ });
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/**
 * @typedef {import('micromark-util-types').Code} Code
 */





/**
 * Classify whether a code represents whitespace, punctuation, or something
 * else.
 *
 * Used for attention (emphasis, strong), whose sequences can open or close
 * based on the class of surrounding characters.
 *
 * > 👉 **Note**: eof (`null`) is seen as whitespace.
 *
 * @param {Code} code
 *   Code.
 * @returns {typeof constants.characterGroupWhitespace | typeof constants.characterGroupPunctuation | undefined}
 *   Group.
 */
      function classifyCharacter(code) {
        if (
          code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof ||
    (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.markdownLineEndingOrSpace)(code) ||
    (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.unicodeWhitespace)(code)
        ) {
          return micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__.constants.characterGroupWhitespace
        }

        if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_0__.unicodePunctuation)(code)) {
          return micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_2__.constants.characterGroupPunctuation
        }
      }


/***/ }),

/***/ "./node_modules/micromark-util-combine-extensions/index.js":
/*!*****************************************************************!*\
  !*** ./node_modules/micromark-util-combine-extensions/index.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   combineExtensions: () => (/* binding */ combineExtensions),
/* harmony export */   combineHtmlExtensions: () => (/* binding */ combineHtmlExtensions)
/* harmony export */ });
/* harmony import */ const micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-chunked */ "./node_modules/micromark-util-chunked/dev/index.js");
/**
 * @typedef {import('micromark-util-types').Extension} Extension
 * @typedef {import('micromark-util-types').Handles} Handles
 * @typedef {import('micromark-util-types').HtmlExtension} HtmlExtension
 * @typedef {import('micromark-util-types').NormalizedExtension} NormalizedExtension
 */



      const hasOwnProperty = {}.hasOwnProperty

/**
 * Combine multiple syntax extensions into one.
 *
 * @param {Array<Extension>} extensions
 *   List of syntax extensions.
 * @returns {NormalizedExtension}
 *   A single combined extension.
 */
      function combineExtensions(extensions) {
  /** @type {NormalizedExtension} */
        const all = {}
        let index = -1

        while (++index < extensions.length) {
          syntaxExtension(all, extensions[index])
        }

        return all
      }

/**
 * Merge `extension` into `all`.
 *
 * @param {NormalizedExtension} all
 *   Extension to merge into.
 * @param {Extension} extension
 *   Extension to merge.
 * @returns {void}
 */
      function syntaxExtension(all, extension) {
  /** @type {keyof Extension} */
        let hook

        for (hook in extension) {
          const maybe = hasOwnProperty.call(all, hook) ? all[hook] : undefined
    /** @type {Record<string, unknown>} */
          const left = maybe || (all[hook] = {})
    /** @type {Record<string, unknown> | undefined} */
          const right = extension[hook]
    /** @type {string} */
          let code

          if (right) {
            for (code in right) {
              if (!hasOwnProperty.call(left, code)) left[code] = []
              const value = right[code]
              constructs(
          // @ts-expect-error Looks like a list.
                left[code],
                Array.isArray(value) ? value : value ? [value] : []
              )
            }
          }
        }
      }

/**
 * Merge `list` into `existing` (both lists of constructs).
 * Mutates `existing`.
 *
 * @param {Array<unknown>} existing
 * @param {Array<unknown>} list
 * @returns {void}
 */
      function constructs(existing, list) {
        let index = -1
  /** @type {Array<unknown>} */
        const before = []

        while (++index < list.length) {
    // @ts-expect-error Looks like an object.
          (list[index].add === 'after' ? existing : before).push(list[index])
        }

        (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__.splice)(existing, 0, 0, before)
      }

/**
 * Combine multiple HTML extensions into one.
 *
 * @param {Array<HtmlExtension>} htmlExtensions
 *   List of HTML extensions.
 * @returns {HtmlExtension}
 *   A single combined HTML extension.
 */
      function combineHtmlExtensions(htmlExtensions) {
  /** @type {HtmlExtension} */
        const handlers = {}
        let index = -1

        while (++index < htmlExtensions.length) {
          htmlExtension(handlers, htmlExtensions[index])
        }

        return handlers
      }

/**
 * Merge `extension` into `all`.
 *
 * @param {HtmlExtension} all
 *   Extension to merge into.
 * @param {HtmlExtension} extension
 *   Extension to merge.
 * @returns {void}
 */
      function htmlExtension(all, extension) {
  /** @type {keyof HtmlExtension} */
        let hook

        for (hook in extension) {
          const maybe = hasOwnProperty.call(all, hook) ? all[hook] : undefined
          const left = maybe || (all[hook] = {})
          const right = extension[hook]
    /** @type {keyof Handles} */
          let type

          if (right) {
            for (type in right) {
        // @ts-expect-error assume document vs regular handler are managed correctly.
              left[type] = right[type]
            }
          }
        }
      }


/***/ }),

/***/ "./node_modules/micromark-util-decode-numeric-character-reference/dev/index.js":
/*!*************************************************************************************!*\
  !*** ./node_modules/micromark-util-decode-numeric-character-reference/dev/index.js ***!
  \*************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   decodeNumericCharacterReference: () => (/* binding */ decodeNumericCharacterReference)
/* harmony export */ });
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/values.js */ "./node_modules/micromark-util-symbol/values.js");



/**
 * Turn the number (in string form as either hexa- or plain decimal) coming from
 * a numeric character reference into a character.
 *
 * Sort of like `String.fromCharCode(Number.parseInt(value, base))`, but makes
 * non-characters and control characters safe.
 *
 * @param {string} value
 *   Value to decode.
 * @param {number} base
 *   Numeric base.
 * @returns {string}
 *   Character.
 */
      function decodeNumericCharacterReference(value, base) {
        const code = Number.parseInt(value, base)

        if (
    // C0 except for HT, LF, FF, CR, space.
          code < micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.ht ||
    code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.vt ||
    (code > micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.cr && code < micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.space) ||
    // Control character (DEL) of C0, and C1 controls.
    (code > micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.tilde && code < 160) ||
    // Lone high surrogates and low surrogates.
    (code > 55295 && code < 57344) ||
    // Noncharacters.
    (code > 64975 && code < 65008) ||
    /* eslint-disable no-bitwise */
    (code & 65535) === 65535 ||
    (code & 65535) === 65534 ||
    /* eslint-enable no-bitwise */
    // Out of range
    code > 1114111
        ) {
          return micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_1__.values.replacementCharacter
        }

        return String.fromCharCode(code)
      }


/***/ }),

/***/ "./node_modules/micromark-util-decode-string/dev/index.js":
/*!****************************************************************!*\
  !*** ./node_modules/micromark-util-decode-string/dev/index.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   decodeString: () => (/* binding */ decodeString)
/* harmony export */ });
/* harmony import */ const decode_named_character_reference__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! decode-named-character-reference */ "./node_modules/decode-named-character-reference/index.dom.js");
/* harmony import */ const micromark_util_decode_numeric_character_reference__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-decode-numeric-character-reference */ "./node_modules/micromark-util-decode-numeric-character-reference/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");





      const characterEscapeOrReference =
  /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi

/**
 * Decode markdown strings (which occur in places such as fenced code info
 * strings, destinations, labels, and titles).
 *
 * The “string” content type allows character escapes and -references.
 * This decodes those.
 *
 * @param {string} value
 *   Value to decode.
 * @returns {string}
 *   Decoded value.
 */
      function decodeString(value) {
        return value.replace(characterEscapeOrReference, decode)
      }

/**
 * @param {string} $0
 * @param {string} $1
 * @param {string} $2
 * @returns {string}
 */
      function decode($0, $1, $2) {
        if ($1) {
    // Escape.
          return $1
        }

  // Reference.
        const head = $2.charCodeAt(0)

        if (head === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.numberSign) {
          const head = $2.charCodeAt(1)
          const hex = head === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.lowercaseX || head === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.uppercaseX
          return (0,micromark_util_decode_numeric_character_reference__WEBPACK_IMPORTED_MODULE_1__.decodeNumericCharacterReference)(
            $2.slice(hex ? 2 : 1),
            hex ? micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.numericBaseHexadecimal : micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.numericBaseDecimal
          )
        }

        return (0,decode_named_character_reference__WEBPACK_IMPORTED_MODULE_0__.decodeNamedCharacterReference)($2) || $0
      }


/***/ }),

/***/ "./node_modules/micromark-util-html-tag-name/index.js":
/*!************************************************************!*\
  !*** ./node_modules/micromark-util-html-tag-name/index.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   htmlBlockNames: () => (/* binding */ htmlBlockNames),
/* harmony export */   htmlRawNames: () => (/* binding */ htmlRawNames)
/* harmony export */ });
/**
 * List of lowercase HTML “block” tag names.
 *
 * The list, when parsing HTML (flow), results in more relaxed rules (condition
 * 6).
 * Because they are known blocks, the HTML-like syntax doesn’t have to be
 * strictly parsed.
 * For tag names not in this list, a more strict algorithm (condition 7) is used
 * to detect whether the HTML-like syntax is seen as HTML (flow) or not.
 *
 * This is copied from:
 * <https://spec.commonmark.org/0.30/#html-blocks>.
 *
 * > 👉 **Note**: `search` was added in `CommonMark@0.31`.
 */
      const htmlBlockNames = [
        'address',
        'article',
        'aside',
        'base',
        'basefont',
        'blockquote',
        'body',
        'caption',
        'center',
        'col',
        'colgroup',
        'dd',
        'details',
        'dialog',
        'dir',
        'div',
        'dl',
        'dt',
        'fieldset',
        'figcaption',
        'figure',
        'footer',
        'form',
        'frame',
        'frameset',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'head',
        'header',
        'hr',
        'html',
        'iframe',
        'legend',
        'li',
        'link',
        'main',
        'menu',
        'menuitem',
        'nav',
        'noframes',
        'ol',
        'optgroup',
        'option',
        'p',
        'param',
        'search',
        'section',
        'summary',
        'table',
        'tbody',
        'td',
        'tfoot',
        'th',
        'thead',
        'title',
        'tr',
        'track',
        'ul'
      ]

/**
 * List of lowercase HTML “raw” tag names.
 *
 * The list, when parsing HTML (flow), results in HTML that can include lines
 * without exiting, until a closing tag also in this list is found (condition
 * 1).
 *
 * This module is copied from:
 * <https://spec.commonmark.org/0.30/#html-blocks>.
 *
 * > 👉 **Note**: `textarea` was added in `CommonMark@0.30`.
 */
      const htmlRawNames = ['pre', 'script', 'style', 'textarea']


/***/ }),

/***/ "./node_modules/micromark-util-normalize-identifier/dev/index.js":
/*!***********************************************************************!*\
  !*** ./node_modules/micromark-util-normalize-identifier/dev/index.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   normalizeIdentifier: () => (/* binding */ normalizeIdentifier)
/* harmony export */ });
/* harmony import */ const micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-symbol/values.js */ "./node_modules/micromark-util-symbol/values.js");


/**
 * Normalize an identifier (as found in references, definitions).
 *
 * Collapses markdown whitespace, trim, and then lower- and uppercase.
 *
 * Some characters are considered “uppercase”, such as U+03F4 (`ϴ`), but if their
 * lowercase counterpart (U+03B8 (`θ`)) is uppercased will result in a different
 * uppercase character (U+0398 (`Θ`)).
 * So, to get a canonical form, we perform both lower- and uppercase.
 *
 * Using uppercase last makes sure keys will never interact with default
 * prototypal values (such as `constructor`): nothing in the prototype of
 * `Object` is uppercase.
 *
 * @param {string} value
 *   Identifier to normalize.
 * @returns {string}
 *   Normalized identifier.
 */
      function normalizeIdentifier(value) {
        return (
          value
      // Collapse markdown whitespace.
            .replace(/[\t\n\r ]+/g, micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_0__.values.space)
      // Trim.
            .replace(/^ | $/g, '')
      // Some characters are considered “uppercase”, but if their lowercase
      // counterpart is uppercased will result in a different uppercase
      // character.
      // Hence, to get that form, we perform both lower- and uppercase.
      // Upper case makes sure keys will not interact with default prototypal
      // methods: no method is uppercase.
            .toLowerCase()
            .toUpperCase()
        )
      }


/***/ }),

/***/ "./node_modules/micromark-util-resolve-all/index.js":
/*!**********************************************************!*\
  !*** ./node_modules/micromark-util-resolve-all/index.js ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveAll: () => (/* binding */ resolveAll)
/* harmony export */ });
/**
 * @typedef {import('micromark-util-types').Event} Event
 * @typedef {import('micromark-util-types').Resolver} Resolver
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 */

/**
 * Call all `resolveAll`s.
 *
 * @param {Array<{resolveAll?: Resolver | undefined}>} constructs
 *   List of constructs, optionally with `resolveAll`s.
 * @param {Array<Event>} events
 *   List of events.
 * @param {TokenizeContext} context
 *   Context used by `tokenize`.
 * @returns {Array<Event>}
 *   Changed events.
 */
      function resolveAll(constructs, events, context) {
  /** @type {Array<Resolver>} */
        const called = []
        let index = -1

        while (++index < constructs.length) {
          const resolve = constructs[index].resolveAll

          if (resolve && !called.includes(resolve)) {
            events = resolve(events, context)
            called.push(resolve)
          }
        }

        return events
      }


/***/ }),

/***/ "./node_modules/micromark-util-subtokenize/dev/index.js":
/*!**************************************************************!*\
  !*** ./node_modules/micromark-util-subtokenize/dev/index.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   subtokenize: () => (/* binding */ subtokenize)
/* harmony export */ });
/* harmony import */ const micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-chunked */ "./node_modules/micromark-util-chunked/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Chunk} Chunk
 * @typedef {import('micromark-util-types').Event} Event
 * @typedef {import('micromark-util-types').Token} Token
 */






/**
 * Tokenize subcontent.
 *
 * @param {Array<Event>} events
 *   List of events.
 * @returns {boolean}
 *   Whether subtokens were found.
 */
      function subtokenize(events) {
  /** @type {Record<string, number>} */
        const jumps = {}
        let index = -1
  /** @type {Event} */
        let event
  /** @type {number | undefined} */
        let lineIndex
  /** @type {number} */
        let otherIndex
  /** @type {Event} */
        let otherEvent
  /** @type {Array<Event>} */
        let parameters
  /** @type {Array<Event>} */
        let subevents
  /** @type {boolean | undefined} */
        let more

        while (++index < events.length) {
          while (index in jumps) {
            index = jumps[index]
          }

          event = events[index]

    // Add a hook for the GFM tasklist extension, which needs to know if text
    // is in the first content of a list item.
          if (
            index &&
      event[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.chunkFlow &&
      events[index - 1][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.listItemPrefix
          ) {
            (0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(event[1]._tokenizer, 'expected `_tokenizer` on subtokens')
            subevents = event[1]._tokenizer.events
            otherIndex = 0

            if (
              otherIndex < subevents.length &&
        subevents[otherIndex][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEndingBlank
            ) {
              otherIndex += 2
            }

            if (
              otherIndex < subevents.length &&
        subevents[otherIndex][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.content
            ) {
              while (++otherIndex < subevents.length) {
                if (subevents[otherIndex][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.content) {
                  break
                }

                if (subevents[otherIndex][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.chunkText) {
                  subevents[otherIndex][1]._isInFirstContentOfListItem = true
                  otherIndex++
                }
              }
            }
          }

    // Enter.
          if (event[0] === 'enter') {
            if (event[1].contentType) {
              Object.assign(jumps, subcontent(events, index))
              index = jumps[index]
              more = true
            }
          }
    // Exit.
          else if (event[1]._container) {
            otherIndex = index
            lineIndex = undefined

            while (otherIndex--) {
              otherEvent = events[otherIndex]

              if (
                otherEvent[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding ||
          otherEvent[1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEndingBlank
              ) {
                if (otherEvent[0] === 'enter') {
                  if (lineIndex) {
                    events[lineIndex][1].type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEndingBlank
                  }

                  otherEvent[1].type = micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding
                  lineIndex = otherIndex
                }
              } else {
                break
              }
            }

            if (lineIndex) {
        // Fix position.
              event[1].end = Object.assign({}, events[lineIndex][1].start)

        // Switch container exit w/ line endings.
              parameters = events.slice(lineIndex, index)
              parameters.unshift(event)
              ;(0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__.splice)(events, lineIndex, index - lineIndex + 1, parameters)
            }
          }
        }

        return !more
      }

/**
 * Tokenize embedded tokens.
 *
 * @param {Array<Event>} events
 * @param {number} eventIndex
 * @returns {Record<string, number>}
 */
      function subcontent(events, eventIndex) {
        const token = events[eventIndex][1]
        const context = events[eventIndex][2]
        let startPosition = eventIndex - 1
  /** @type {Array<number>} */
        const startPositions = []
  ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(token.contentType, 'expected `contentType` on subtokens')
        const tokenizer =
    token._tokenizer || context.parser[token.contentType](token.start)
        const childEvents = tokenizer.events
  /** @type {Array<[number, number]>} */
        const jumps = []
  /** @type {Record<string, number>} */
        const gaps = {}
  /** @type {Array<Chunk>} */
        let stream
  /** @type {Token | undefined} */
        let previous
        let index = -1
  /** @type {Token | undefined} */
        let current = token
        let adjust = 0
        let start = 0
        const breaks = [start]

  // Loop forward through the linked tokens to pass them in order to the
  // subtokenizer.
        while (current) {
    // Find the position of the event for this token.
          while (events[++startPosition][1] !== current) {
      // Empty.
          }

          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(
            !previous || current.previous === previous,
            'expected previous to match'
          )
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(!previous || previous.next === current, 'expected next to match')

          startPositions.push(startPosition)

          if (!current._tokenizer) {
            stream = context.sliceStream(current)

            if (!current.next) {
              stream.push(micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_1__.codes.eof)
            }

            if (previous) {
              tokenizer.defineSkip(current.start)
            }

            if (current._isInFirstContentOfListItem) {
              tokenizer._gfmTasklistFirstContentOfListItem = true
            }

            tokenizer.write(stream)

            if (current._isInFirstContentOfListItem) {
              tokenizer._gfmTasklistFirstContentOfListItem = undefined
            }
          }

    // Unravel the next token.
          previous = current
          current = current.next
        }

  // Now, loop back through all events (and linked tokens), to figure out which
  // parts belong where.
        current = token

        while (++index < childEvents.length) {
          if (
      // Find a void token that includes a break.
            childEvents[index][0] === 'exit' &&
      childEvents[index - 1][0] === 'enter' &&
      childEvents[index][1].type === childEvents[index - 1][1].type &&
      childEvents[index][1].start.line !== childEvents[index][1].end.line
          ) {
            (0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(current, 'expected a current token')
            start = index + 1
            breaks.push(start)
      // Help GC.
            current._tokenizer = undefined
            current.previous = undefined
            current = current.next
          }
        }

  // Help GC.
        tokenizer.events = []

  // If there’s one more token (which is the cases for lines that end in an
  // EOF), that’s perfect: the last point we found starts it.
  // If there isn’t then make sure any remaining content is added to it.
        if (current) {
    // Help GC.
          current._tokenizer = undefined
          current.previous = undefined
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(!current.next, 'expected no next token')
        } else {
          breaks.pop()
        }

  // Now splice the events from the subtokenizer into the current events,
  // moving back to front so that splice indices aren’t affected.
        index = breaks.length

        while (index--) {
          const slice = childEvents.slice(breaks[index], breaks[index + 1])
          const start = startPositions.pop()
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(start !== undefined, 'expected a start position when splicing')
          jumps.unshift([start, start + slice.length - 1])
          ;(0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_0__.splice)(events, start, 2, slice)
        }

        index = -1

        while (++index < jumps.length) {
          gaps[adjust + jumps[index][0]] = adjust + jumps[index][1]
          adjust += jumps[index][1] - jumps[index][0] - 1
        }

        return gaps
      }


/***/ }),

/***/ "./node_modules/micromark-util-symbol/codes.js":
/*!*****************************************************!*\
  !*** ./node_modules/micromark-util-symbol/codes.js ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   codes: () => (/* binding */ codes)
/* harmony export */ });
/**
 * Character codes.
 *
 * This module is compiled away!
 *
 * micromark works based on character codes.
 * This module contains constants for the ASCII block and the replacement
 * character.
 * A couple of them are handled in a special way, such as the line endings
 * (CR, LF, and CR+LF, commonly known as end-of-line: EOLs), the tab (horizontal
 * tab) and its expansion based on what column it’s at (virtual space),
 * and the end-of-file (eof) character.
 * As values are preprocessed before handling them, the actual characters LF,
 * CR, HT, and NUL (which is present as the replacement character), are
 * guaranteed to not exist.
 *
 * Unicode basic latin block.
 */
      const codes = /** @type {const} */ ({
        carriageReturn: -5,
        lineFeed: -4,
        carriageReturnLineFeed: -3,
        horizontalTab: -2,
        virtualSpace: -1,
        eof: null,
        nul: 0,
        soh: 1,
        stx: 2,
        etx: 3,
        eot: 4,
        enq: 5,
        ack: 6,
        bel: 7,
        bs: 8,
        ht: 9, // `\t`
        lf: 10, // `\n`
        vt: 11, // `\v`
        ff: 12, // `\f`
        cr: 13, // `\r`
        so: 14,
        si: 15,
        dle: 16,
        dc1: 17,
        dc2: 18,
        dc3: 19,
        dc4: 20,
        nak: 21,
        syn: 22,
        etb: 23,
        can: 24,
        em: 25,
        sub: 26,
        esc: 27,
        fs: 28,
        gs: 29,
        rs: 30,
        us: 31,
        space: 32,
        exclamationMark: 33, // `!`
        quotationMark: 34, // `"`
        numberSign: 35, // `#`
        dollarSign: 36, // `$`
        percentSign: 37, // `%`
        ampersand: 38, // `&`
        apostrophe: 39, // `'`
        leftParenthesis: 40, // `(`
        rightParenthesis: 41, // `)`
        asterisk: 42, // `*`
        plusSign: 43, // `+`
        comma: 44, // `,`
        dash: 45, // `-`
        dot: 46, // `.`
        slash: 47, // `/`
        digit0: 48, // `0`
        digit1: 49, // `1`
        digit2: 50, // `2`
        digit3: 51, // `3`
        digit4: 52, // `4`
        digit5: 53, // `5`
        digit6: 54, // `6`
        digit7: 55, // `7`
        digit8: 56, // `8`
        digit9: 57, // `9`
        colon: 58, // `:`
        semicolon: 59, // `;`
        lessThan: 60, // `<`
        equalsTo: 61, // `=`
        greaterThan: 62, // `>`
        questionMark: 63, // `?`
        atSign: 64, // `@`
        uppercaseA: 65, // `A`
        uppercaseB: 66, // `B`
        uppercaseC: 67, // `C`
        uppercaseD: 68, // `D`
        uppercaseE: 69, // `E`
        uppercaseF: 70, // `F`
        uppercaseG: 71, // `G`
        uppercaseH: 72, // `H`
        uppercaseI: 73, // `I`
        uppercaseJ: 74, // `J`
        uppercaseK: 75, // `K`
        uppercaseL: 76, // `L`
        uppercaseM: 77, // `M`
        uppercaseN: 78, // `N`
        uppercaseO: 79, // `O`
        uppercaseP: 80, // `P`
        uppercaseQ: 81, // `Q`
        uppercaseR: 82, // `R`
        uppercaseS: 83, // `S`
        uppercaseT: 84, // `T`
        uppercaseU: 85, // `U`
        uppercaseV: 86, // `V`
        uppercaseW: 87, // `W`
        uppercaseX: 88, // `X`
        uppercaseY: 89, // `Y`
        uppercaseZ: 90, // `Z`
        leftSquareBracket: 91, // `[`
        backslash: 92, // `\`
        rightSquareBracket: 93, // `]`
        caret: 94, // `^`
        underscore: 95, // `_`
        graveAccent: 96, // `` ` ``
        lowercaseA: 97, // `a`
        lowercaseB: 98, // `b`
        lowercaseC: 99, // `c`
        lowercaseD: 100, // `d`
        lowercaseE: 101, // `e`
        lowercaseF: 102, // `f`
        lowercaseG: 103, // `g`
        lowercaseH: 104, // `h`
        lowercaseI: 105, // `i`
        lowercaseJ: 106, // `j`
        lowercaseK: 107, // `k`
        lowercaseL: 108, // `l`
        lowercaseM: 109, // `m`
        lowercaseN: 110, // `n`
        lowercaseO: 111, // `o`
        lowercaseP: 112, // `p`
        lowercaseQ: 113, // `q`
        lowercaseR: 114, // `r`
        lowercaseS: 115, // `s`
        lowercaseT: 116, // `t`
        lowercaseU: 117, // `u`
        lowercaseV: 118, // `v`
        lowercaseW: 119, // `w`
        lowercaseX: 120, // `x`
        lowercaseY: 121, // `y`
        lowercaseZ: 122, // `z`
        leftCurlyBrace: 123, // `{`
        verticalBar: 124, // `|`
        rightCurlyBrace: 125, // `}`
        tilde: 126, // `~`
        del: 127,
  // Unicode Specials block.
        byteOrderMarker: 65279,
  // Unicode Specials block.
        replacementCharacter: 65533 // `�`
      })


/***/ }),

/***/ "./node_modules/micromark-util-symbol/constants.js":
/*!*********************************************************!*\
  !*** ./node_modules/micromark-util-symbol/constants.js ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   constants: () => (/* binding */ constants)
/* harmony export */ });
/**
 * This module is compiled away!
 *
 * Parsing markdown comes with a couple of constants, such as minimum or maximum
 * sizes of certain sequences.
 * Additionally, there are a couple symbols used inside micromark.
 * These are all defined here, but compiled away by scripts.
 */
      const constants = /** @type {const} */ ({
        attentionSideBefore: 1, // Symbol to mark an attention sequence as before content: `*a`
        attentionSideAfter: 2, // Symbol to mark an attention sequence as after content: `a*`
        atxHeadingOpeningFenceSizeMax: 6, // 6 number signs is fine, 7 isn’t.
        autolinkDomainSizeMax: 63, // 63 characters is fine, 64 is too many.
        autolinkSchemeSizeMax: 32, // 32 characters is fine, 33 is too many.
        cdataOpeningString: 'CDATA[', // And preceded by `<![`.
        characterGroupWhitespace: 1, // Symbol used to indicate a character is whitespace
        characterGroupPunctuation: 2, // Symbol used to indicate a character is punctuation
        characterReferenceDecimalSizeMax: 7, // `&#9999999;`.
        characterReferenceHexadecimalSizeMax: 6, // `&#xff9999;`.
        characterReferenceNamedSizeMax: 31, // `&CounterClockwiseContourIntegral;`.
        codeFencedSequenceSizeMin: 3, // At least 3 ticks or tildes are needed.
        contentTypeDocument: 'document',
        contentTypeFlow: 'flow',
        contentTypeContent: 'content',
        contentTypeString: 'string',
        contentTypeText: 'text',
        hardBreakPrefixSizeMin: 2, // At least 2 trailing spaces are needed.
        htmlRaw: 1, // Symbol for `<script>`
        htmlComment: 2, // Symbol for `<!---->`
        htmlInstruction: 3, // Symbol for `<?php?>`
        htmlDeclaration: 4, // Symbol for `<!doctype>`
        htmlCdata: 5, // Symbol for `<![CDATA[]]>`
        htmlBasic: 6, // Symbol for `<div`
        htmlComplete: 7, // Symbol for `<x>`
        htmlRawSizeMax: 8, // Length of `textarea`.
        linkResourceDestinationBalanceMax: 32, // See: <https://spec.commonmark.org/0.30/#link-destination>, <https://github.com/remarkjs/react-markdown/issues/658#issuecomment-984345577>
        linkReferenceSizeMax: 999, // See: <https://spec.commonmark.org/0.30/#link-label>
        listItemValueSizeMax: 10, // See: <https://spec.commonmark.org/0.30/#ordered-list-marker>
        numericBaseDecimal: 10,
        numericBaseHexadecimal: 0x10,
        tabSize: 4, // Tabs have a hard-coded size of 4, per CommonMark.
        thematicBreakMarkerCountMin: 3, // At least 3 asterisks, dashes, or underscores are needed.
        v8MaxSafeChunkSize: 10000 // V8 (and potentially others) have problems injecting giant arrays into other arrays, hence we operate in chunks.
      })


/***/ }),

/***/ "./node_modules/micromark-util-symbol/types.js":
/*!*****************************************************!*\
  !*** ./node_modules/micromark-util-symbol/types.js ***!
  \*****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   types: () => (/* binding */ types)
/* harmony export */ });
/**
 * This module is compiled away!
 *
 * Here is the list of all types of tokens exposed by micromark, with a short
 * explanation of what they include and where they are found.
 * In picking names, generally, the rule is to be as explicit as possible
 * instead of reusing names.
 * For example, there is a `definitionDestination` and a `resourceDestination`,
 * instead of one shared name.
 */

// Note: when changing the next record, you must also change `TokenTypeMap`
// in `micromark-util-types/index.d.ts`.
      const types = /** @type {const} */ ({
  // Generic type for data, such as in a title, a destination, etc.
        data: 'data',

  // Generic type for syntactic whitespace (tabs, virtual spaces, spaces).
  // Such as, between a fenced code fence and an info string.
        whitespace: 'whitespace',

  // Generic type for line endings (line feed, carriage return, carriage return +
  // line feed).
        lineEnding: 'lineEnding',

  // A line ending, but ending a blank line.
        lineEndingBlank: 'lineEndingBlank',

  // Generic type for whitespace (tabs, virtual spaces, spaces) at the start of a
  // line.
        linePrefix: 'linePrefix',

  // Generic type for whitespace (tabs, virtual spaces, spaces) at the end of a
  // line.
        lineSuffix: 'lineSuffix',

  // Whole ATX heading:
  //
  // ```markdown
  // #
  // ## Alpha
  // ### Bravo ###
  // ```
  //
  // Includes `atxHeadingSequence`, `whitespace`, `atxHeadingText`.
        atxHeading: 'atxHeading',

  // Sequence of number signs in an ATX heading (`###`).
        atxHeadingSequence: 'atxHeadingSequence',

  // Content in an ATX heading (`alpha`).
  // Includes text.
        atxHeadingText: 'atxHeadingText',

  // Whole autolink (`<https://example.com>` or `<admin@example.com>`)
  // Includes `autolinkMarker` and `autolinkProtocol` or `autolinkEmail`.
        autolink: 'autolink',

  // Email autolink w/o markers (`admin@example.com`)
        autolinkEmail: 'autolinkEmail',

  // Marker around an `autolinkProtocol` or `autolinkEmail` (`<` or `>`).
        autolinkMarker: 'autolinkMarker',

  // Protocol autolink w/o markers (`https://example.com`)
        autolinkProtocol: 'autolinkProtocol',

  // A whole character escape (`\-`).
  // Includes `escapeMarker` and `characterEscapeValue`.
        characterEscape: 'characterEscape',

  // The escaped character (`-`).
        characterEscapeValue: 'characterEscapeValue',

  // A whole character reference (`&amp;`, `&#8800;`, or `&#x1D306;`).
  // Includes `characterReferenceMarker`, an optional
  // `characterReferenceMarkerNumeric`, in which case an optional
  // `characterReferenceMarkerHexadecimal`, and a `characterReferenceValue`.
        characterReference: 'characterReference',

  // The start or end marker (`&` or `;`).
        characterReferenceMarker: 'characterReferenceMarker',

  // Mark reference as numeric (`#`).
        characterReferenceMarkerNumeric: 'characterReferenceMarkerNumeric',

  // Mark reference as numeric (`x` or `X`).
        characterReferenceMarkerHexadecimal: 'characterReferenceMarkerHexadecimal',

  // Value of character reference w/o markers (`amp`, `8800`, or `1D306`).
        characterReferenceValue: 'characterReferenceValue',

  // Whole fenced code:
  //
  // ````markdown
  // ```js
  // alert(1)
  // ```
  // ````
        codeFenced: 'codeFenced',

  // A fenced code fence, including whitespace, sequence, info, and meta
  // (` ```js `).
        codeFencedFence: 'codeFencedFence',

  // Sequence of grave accent or tilde characters (` ``` `) in a fence.
        codeFencedFenceSequence: 'codeFencedFenceSequence',

  // Info word (`js`) in a fence.
  // Includes string.
        codeFencedFenceInfo: 'codeFencedFenceInfo',

  // Meta words (`highlight="1"`) in a fence.
  // Includes string.
        codeFencedFenceMeta: 'codeFencedFenceMeta',

  // A line of code.
        codeFlowValue: 'codeFlowValue',

  // Whole indented code:
  //
  // ```markdown
  //     alert(1)
  // ```
  //
  // Includes `lineEnding`, `linePrefix`, and `codeFlowValue`.
        codeIndented: 'codeIndented',

  // A text code (``` `alpha` ```).
  // Includes `codeTextSequence`, `codeTextData`, `lineEnding`, and can include
  // `codeTextPadding`.
        codeText: 'codeText',

        codeTextData: 'codeTextData',

  // A space or line ending right after or before a tick.
        codeTextPadding: 'codeTextPadding',

  // A text code fence (` `` `).
        codeTextSequence: 'codeTextSequence',

  // Whole content:
  //
  // ```markdown
  // [a]: b
  // c
  // =
  // d
  // ```
  //
  // Includes `paragraph` and `definition`.
        content: 'content',
  // Whole definition:
  //
  // ```markdown
  // [micromark]: https://github.com/micromark/micromark
  // ```
  //
  // Includes `definitionLabel`, `definitionMarker`, `whitespace`,
  // `definitionDestination`, and optionally `lineEnding` and `definitionTitle`.
        definition: 'definition',

  // Destination of a definition (`https://github.com/micromark/micromark` or
  // `<https://github.com/micromark/micromark>`).
  // Includes `definitionDestinationLiteral` or `definitionDestinationRaw`.
        definitionDestination: 'definitionDestination',

  // Enclosed destination of a definition
  // (`<https://github.com/micromark/micromark>`).
  // Includes `definitionDestinationLiteralMarker` and optionally
  // `definitionDestinationString`.
        definitionDestinationLiteral: 'definitionDestinationLiteral',

  // Markers of an enclosed definition destination (`<` or `>`).
        definitionDestinationLiteralMarker: 'definitionDestinationLiteralMarker',

  // Unenclosed destination of a definition
  // (`https://github.com/micromark/micromark`).
  // Includes `definitionDestinationString`.
        definitionDestinationRaw: 'definitionDestinationRaw',

  // Text in an destination (`https://github.com/micromark/micromark`).
  // Includes string.
        definitionDestinationString: 'definitionDestinationString',

  // Label of a definition (`[micromark]`).
  // Includes `definitionLabelMarker` and `definitionLabelString`.
        definitionLabel: 'definitionLabel',

  // Markers of a definition label (`[` or `]`).
        definitionLabelMarker: 'definitionLabelMarker',

  // Value of a definition label (`micromark`).
  // Includes string.
        definitionLabelString: 'definitionLabelString',

  // Marker between a label and a destination (`:`).
        definitionMarker: 'definitionMarker',

  // Title of a definition (`"x"`, `'y'`, or `(z)`).
  // Includes `definitionTitleMarker` and optionally `definitionTitleString`.
        definitionTitle: 'definitionTitle',

  // Marker around a title of a definition (`"`, `'`, `(`, or `)`).
        definitionTitleMarker: 'definitionTitleMarker',

  // Data without markers in a title (`z`).
  // Includes string.
        definitionTitleString: 'definitionTitleString',

  // Emphasis (`*alpha*`).
  // Includes `emphasisSequence` and `emphasisText`.
        emphasis: 'emphasis',

  // Sequence of emphasis markers (`*` or `_`).
        emphasisSequence: 'emphasisSequence',

  // Emphasis text (`alpha`).
  // Includes text.
        emphasisText: 'emphasisText',

  // The character escape marker (`\`).
        escapeMarker: 'escapeMarker',

  // A hard break created with a backslash (`\\n`).
  // Note: does not include the line ending.
        hardBreakEscape: 'hardBreakEscape',

  // A hard break created with trailing spaces (`  \n`).
  // Does not include the line ending.
        hardBreakTrailing: 'hardBreakTrailing',

  // Flow HTML:
  //
  // ```markdown
  // <div
  // ```
  //
  // Inlcudes `lineEnding`, `htmlFlowData`.
        htmlFlow: 'htmlFlow',

        htmlFlowData: 'htmlFlowData',

  // HTML in text (the tag in `a <i> b`).
  // Includes `lineEnding`, `htmlTextData`.
        htmlText: 'htmlText',

        htmlTextData: 'htmlTextData',

  // Whole image (`![alpha](bravo)`, `![alpha][bravo]`, `![alpha][]`, or
  // `![alpha]`).
  // Includes `label` and an optional `resource` or `reference`.
        image: 'image',

  // Whole link label (`[*alpha*]`).
  // Includes `labelLink` or `labelImage`, `labelText`, and `labelEnd`.
        label: 'label',

  // Text in an label (`*alpha*`).
  // Includes text.
        labelText: 'labelText',

  // Start a link label (`[`).
  // Includes a `labelMarker`.
        labelLink: 'labelLink',

  // Start an image label (`![`).
  // Includes `labelImageMarker` and `labelMarker`.
        labelImage: 'labelImage',

  // Marker of a label (`[` or `]`).
        labelMarker: 'labelMarker',

  // Marker to start an image (`!`).
        labelImageMarker: 'labelImageMarker',

  // End a label (`]`).
  // Includes `labelMarker`.
        labelEnd: 'labelEnd',

  // Whole link (`[alpha](bravo)`, `[alpha][bravo]`, `[alpha][]`, or `[alpha]`).
  // Includes `label` and an optional `resource` or `reference`.
        link: 'link',

  // Whole paragraph:
  //
  // ```markdown
  // alpha
  // bravo.
  // ```
  //
  // Includes text.
        paragraph: 'paragraph',

  // A reference (`[alpha]` or `[]`).
  // Includes `referenceMarker` and an optional `referenceString`.
        reference: 'reference',

  // A reference marker (`[` or `]`).
        referenceMarker: 'referenceMarker',

  // Reference text (`alpha`).
  // Includes string.
        referenceString: 'referenceString',

  // A resource (`(https://example.com "alpha")`).
  // Includes `resourceMarker`, an optional `resourceDestination` with an optional
  // `whitespace` and `resourceTitle`.
        resource: 'resource',

  // A resource destination (`https://example.com`).
  // Includes `resourceDestinationLiteral` or `resourceDestinationRaw`.
        resourceDestination: 'resourceDestination',

  // A literal resource destination (`<https://example.com>`).
  // Includes `resourceDestinationLiteralMarker` and optionally
  // `resourceDestinationString`.
        resourceDestinationLiteral: 'resourceDestinationLiteral',

  // A resource destination marker (`<` or `>`).
        resourceDestinationLiteralMarker: 'resourceDestinationLiteralMarker',

  // A raw resource destination (`https://example.com`).
  // Includes `resourceDestinationString`.
        resourceDestinationRaw: 'resourceDestinationRaw',

  // Resource destination text (`https://example.com`).
  // Includes string.
        resourceDestinationString: 'resourceDestinationString',

  // A resource marker (`(` or `)`).
        resourceMarker: 'resourceMarker',

  // A resource title (`"alpha"`, `'alpha'`, or `(alpha)`).
  // Includes `resourceTitleMarker` and optionally `resourceTitleString`.
        resourceTitle: 'resourceTitle',

  // A resource title marker (`"`, `'`, `(`, or `)`).
        resourceTitleMarker: 'resourceTitleMarker',

  // Resource destination title (`alpha`).
  // Includes string.
        resourceTitleString: 'resourceTitleString',

  // Whole setext heading:
  //
  // ```markdown
  // alpha
  // bravo
  // =====
  // ```
  //
  // Includes `setextHeadingText`, `lineEnding`, `linePrefix`, and
  // `setextHeadingLine`.
        setextHeading: 'setextHeading',

  // Content in a setext heading (`alpha\nbravo`).
  // Includes text.
        setextHeadingText: 'setextHeadingText',

  // Underline in a setext heading, including whitespace suffix (`==`).
  // Includes `setextHeadingLineSequence`.
        setextHeadingLine: 'setextHeadingLine',

  // Sequence of equals or dash characters in underline in a setext heading (`-`).
        setextHeadingLineSequence: 'setextHeadingLineSequence',

  // Strong (`**alpha**`).
  // Includes `strongSequence` and `strongText`.
        strong: 'strong',

  // Sequence of strong markers (`**` or `__`).
        strongSequence: 'strongSequence',

  // Strong text (`alpha`).
  // Includes text.
        strongText: 'strongText',

  // Whole thematic break:
  //
  // ```markdown
  // * * *
  // ```
  //
  // Includes `thematicBreakSequence` and `whitespace`.
        thematicBreak: 'thematicBreak',

  // A sequence of one or more thematic break markers (`***`).
        thematicBreakSequence: 'thematicBreakSequence',

  // Whole block quote:
  //
  // ```markdown
  // > a
  // >
  // > b
  // ```
  //
  // Includes `blockQuotePrefix` and flow.
        blockQuote: 'blockQuote',
  // The `>` or `> ` of a block quote.
        blockQuotePrefix: 'blockQuotePrefix',
  // The `>` of a block quote prefix.
        blockQuoteMarker: 'blockQuoteMarker',
  // The optional ` ` of a block quote prefix.
        blockQuotePrefixWhitespace: 'blockQuotePrefixWhitespace',

  // Whole unordered list:
  //
  // ```markdown
  // - a
  //   b
  // ```
  //
  // Includes `listItemPrefix`, flow, and optionally  `listItemIndent` on further
  // lines.
        listOrdered: 'listOrdered',

  // Whole ordered list:
  //
  // ```markdown
  // 1. a
  //    b
  // ```
  //
  // Includes `listItemPrefix`, flow, and optionally  `listItemIndent` on further
  // lines.
        listUnordered: 'listUnordered',

  // The indent of further list item lines.
        listItemIndent: 'listItemIndent',

  // A marker, as in, `*`, `+`, `-`, `.`, or `)`.
        listItemMarker: 'listItemMarker',

  // The thing that starts a list item, such as `1. `.
  // Includes `listItemValue` if ordered, `listItemMarker`, and
  // `listItemPrefixWhitespace` (unless followed by a line ending).
        listItemPrefix: 'listItemPrefix',

  // The whitespace after a marker.
        listItemPrefixWhitespace: 'listItemPrefixWhitespace',

  // The numerical value of an ordered item.
        listItemValue: 'listItemValue',

  // Internal types used for subtokenizers, compiled away
        chunkDocument: 'chunkDocument',
        chunkContent: 'chunkContent',
        chunkFlow: 'chunkFlow',
        chunkText: 'chunkText',
        chunkString: 'chunkString'
      })


/***/ }),

/***/ "./node_modules/micromark-util-symbol/values.js":
/*!******************************************************!*\
  !*** ./node_modules/micromark-util-symbol/values.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   values: () => (/* binding */ values)
/* harmony export */ });
/**
 * This module is compiled away!
 *
 * While micromark works based on character codes, this module includes the
 * string versions of ’em.
 * The C0 block, except for LF, CR, HT, and w/ the replacement character added,
 * are available here.
 */
      const values = /** @type {const} */ ({
        ht: '\t',
        lf: '\n',
        cr: '\r',
        space: ' ',
        exclamationMark: '!',
        quotationMark: '"',
        numberSign: '#',
        dollarSign: '$',
        percentSign: '%',
        ampersand: '&',
        apostrophe: "'",
        leftParenthesis: '(',
        rightParenthesis: ')',
        asterisk: '*',
        plusSign: '+',
        comma: ',',
        dash: '-',
        dot: '.',
        slash: '/',
        digit0: '0',
        digit1: '1',
        digit2: '2',
        digit3: '3',
        digit4: '4',
        digit5: '5',
        digit6: '6',
        digit7: '7',
        digit8: '8',
        digit9: '9',
        colon: ':',
        semicolon: ';',
        lessThan: '<',
        equalsTo: '=',
        greaterThan: '>',
        questionMark: '?',
        atSign: '@',
        uppercaseA: 'A',
        uppercaseB: 'B',
        uppercaseC: 'C',
        uppercaseD: 'D',
        uppercaseE: 'E',
        uppercaseF: 'F',
        uppercaseG: 'G',
        uppercaseH: 'H',
        uppercaseI: 'I',
        uppercaseJ: 'J',
        uppercaseK: 'K',
        uppercaseL: 'L',
        uppercaseM: 'M',
        uppercaseN: 'N',
        uppercaseO: 'O',
        uppercaseP: 'P',
        uppercaseQ: 'Q',
        uppercaseR: 'R',
        uppercaseS: 'S',
        uppercaseT: 'T',
        uppercaseU: 'U',
        uppercaseV: 'V',
        uppercaseW: 'W',
        uppercaseX: 'X',
        uppercaseY: 'Y',
        uppercaseZ: 'Z',
        leftSquareBracket: '[',
        backslash: '\\',
        rightSquareBracket: ']',
        caret: '^',
        underscore: '_',
        graveAccent: '`',
        lowercaseA: 'a',
        lowercaseB: 'b',
        lowercaseC: 'c',
        lowercaseD: 'd',
        lowercaseE: 'e',
        lowercaseF: 'f',
        lowercaseG: 'g',
        lowercaseH: 'h',
        lowercaseI: 'i',
        lowercaseJ: 'j',
        lowercaseK: 'k',
        lowercaseL: 'l',
        lowercaseM: 'm',
        lowercaseN: 'n',
        lowercaseO: 'o',
        lowercaseP: 'p',
        lowercaseQ: 'q',
        lowercaseR: 'r',
        lowercaseS: 's',
        lowercaseT: 't',
        lowercaseU: 'u',
        lowercaseV: 'v',
        lowercaseW: 'w',
        lowercaseX: 'x',
        lowercaseY: 'y',
        lowercaseZ: 'z',
        leftCurlyBrace: '{',
        verticalBar: '|',
        rightCurlyBrace: '}',
        tilde: '~',
        replacementCharacter: '�'
      })


/***/ }),

/***/ "./node_modules/micromark/dev/lib/constructs.js":
/*!******************************************************!*\
  !*** ./node_modules/micromark/dev/lib/constructs.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   attentionMarkers: () => (/* binding */ attentionMarkers),
/* harmony export */   contentInitial: () => (/* binding */ contentInitial),
/* harmony export */   disable: () => (/* binding */ disable),
/* harmony export */   document: () => (/* binding */ document),
/* harmony export */   flow: () => (/* binding */ flow),
/* harmony export */   flowInitial: () => (/* binding */ flowInitial),
/* harmony export */   insideSpan: () => (/* binding */ insideSpan),
/* harmony export */   string: () => (/* binding */ string),
/* harmony export */   text: () => (/* binding */ text)
/* harmony export */ });
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/attention.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/autolink.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/block-quote.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/character-escape.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/character-reference.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/code-fenced.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/code-indented.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/code-text.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/definition.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/hard-break-escape.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/heading-atx.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/html-flow.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/html-text.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/label-end.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/label-start-image.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/label-start-link.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/line-ending.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/list.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/setext-underline.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/thematic-break.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const _initialize_text_js__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./initialize/text.js */ "./node_modules/micromark/dev/lib/initialize/text.js");
/**
 * @typedef {import('micromark-util-types').Extension} Extension
 */





/** @satisfies {Extension['document']} */
      const document = {
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.asterisk]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.plusSign]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.dash]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit0]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit1]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit2]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit3]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit4]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit5]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit6]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit7]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit8]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.digit9]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_17__.list,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.greaterThan]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_2__.blockQuote
      }

/** @satisfies {Extension['contentInitial']} */
      const contentInitial = {
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.leftSquareBracket]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_8__.definition
      }

/** @satisfies {Extension['flowInitial']} */
      const flowInitial = {
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.horizontalTab]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_6__.codeIndented,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.virtualSpace]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_6__.codeIndented,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.space]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_6__.codeIndented
      }

/** @satisfies {Extension['flow']} */
      const flow = {
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.numberSign]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_10__.headingAtx,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.asterisk]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_19__.thematicBreak,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.dash]: [micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_18__.setextUnderline, micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_19__.thematicBreak],
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.lessThan]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_11__.htmlFlow,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.equalsTo]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_18__.setextUnderline,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.underscore]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_19__.thematicBreak,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.graveAccent]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_5__.codeFenced,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.tilde]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_5__.codeFenced
      }

/** @satisfies {Extension['string']} */
      const string = {
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.ampersand]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_4__.characterReference,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.backslash]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_3__.characterEscape
      }

/** @satisfies {Extension['text']} */
      const text = {
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.carriageReturn]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_16__.lineEnding,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.lineFeed]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_16__.lineEnding,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.carriageReturnLineFeed]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_16__.lineEnding,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.exclamationMark]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_14__.labelStartImage,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.ampersand]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_4__.characterReference,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.asterisk]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_0__.attention,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.lessThan]: [micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_1__.autolink, micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_12__.htmlText],
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.leftSquareBracket]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_15__.labelStartLink,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.backslash]: [micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_9__.hardBreakEscape, micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_3__.characterEscape],
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.rightSquareBracket]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_13__.labelEnd,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.underscore]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_0__.attention,
        [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.graveAccent]: micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_7__.codeText
      }

/** @satisfies {Extension['insideSpan']} */
      const insideSpan = {null: [micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_0__.attention, _initialize_text_js__WEBPACK_IMPORTED_MODULE_21__.resolver]}

/** @satisfies {Extension['attentionMarkers']} */
      const attentionMarkers = {null: [micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.asterisk, micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_20__.codes.underscore]}

/** @satisfies {Extension['disable']} */
      const disable = {null: []}


/***/ }),

/***/ "./node_modules/micromark/dev/lib/create-tokenizer.js":
/*!************************************************************!*\
  !*** ./node_modules/micromark/dev/lib/create-tokenizer.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createTokenizer: () => (/* binding */ createTokenizer)
/* harmony export */ });
/* harmony import */ const debug__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! debug */ "./node_modules/debug/src/browser.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_chunked__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-chunked */ "./node_modules/micromark-util-chunked/dev/index.js");
/* harmony import */ const micromark_util_resolve_all__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-resolve-all */ "./node_modules/micromark-util-resolve-all/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-util-symbol/values.js */ "./node_modules/micromark-util-symbol/values.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Chunk} Chunk
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').ConstructRecord} ConstructRecord
 * @typedef {import('micromark-util-types').Effects} Effects
 * @typedef {import('micromark-util-types').InitialConstruct} InitialConstruct
 * @typedef {import('micromark-util-types').ParseContext} ParseContext
 * @typedef {import('micromark-util-types').Point} Point
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenType} TokenType
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 */

/**
 * @callback Restore
 * @returns {void}
 *
 * @typedef Info
 * @property {Restore} restore
 * @property {number} from
 *
 * @callback ReturnHandle
 *   Handle a successful run.
 * @param {Construct} construct
 * @param {Info} info
 * @returns {void}
 */









      const debug = debug__WEBPACK_IMPORTED_MODULE_0__('micromark')

/**
 * Create a tokenizer.
 * Tokenizers deal with one type of data (e.g., containers, flow, text).
 * The parser is the object dealing with it all.
 * `initialize` works like other constructs, except that only its `tokenize`
 * function is used, in which case it doesn’t receive an `ok` or `nok`.
 * `from` can be given to set the point before the first character, although
 * when further lines are indented, they must be set with `defineSkip`.
 *
 * @param {ParseContext} parser
 * @param {InitialConstruct} initialize
 * @param {Omit<Point, '_bufferIndex' | '_index'> | undefined} [from]
 * @returns {TokenizeContext}
 */
      function createTokenizer(parser, initialize, from) {
  /** @type {Point} */
        let point = Object.assign(
          from ? Object.assign({}, from) : {line: 1, column: 1, offset: 0},
          {_index: 0, _bufferIndex: -1}
        )
  /** @type {Record<string, number>} */
        const columnStart = {}
  /** @type {Array<Construct>} */
        const resolveAllConstructs = []
  /** @type {Array<Chunk>} */
        let chunks = []
  /** @type {Array<Token>} */
        let stack = []
  /** @type {boolean | undefined} */
        let consumed = true

  /**
   * Tools used for tokenizing.
   *
   * @type {Effects}
   */
        const effects = {
          consume,
          enter,
          exit,
          attempt: constructFactory(onsuccessfulconstruct),
          check: constructFactory(onsuccessfulcheck),
          interrupt: constructFactory(onsuccessfulcheck, {interrupt: true})
        }

  /**
   * State and tools for resolving and serializing.
   *
   * @type {TokenizeContext}
   */
        const context = {
          previous: micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.eof,
          code: micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.eof,
          containerState: {},
          events: [],
          parser,
          sliceStream,
          sliceSerialize,
          now,
          defineSkip,
          write
        }

  /**
   * The state function.
   *
   * @type {State | void}
   */
        let state = initialize.tokenize.call(context, effects)

  /**
   * Track which character we expect to be consumed, to catch bugs.
   *
   * @type {Code}
   */
        let expectedCode

        if (initialize.resolveAll) {
          resolveAllConstructs.push(initialize)
        }

        return context

  /** @type {TokenizeContext['write']} */
        function write(slice) {
          chunks = (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_2__.push)(chunks, slice)

          main()

    // Exit if we’re not done, resolve might change stuff.
          if (chunks[chunks.length - 1] !== micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.eof) {
            return []
          }

          addResult(initialize, 0)

    // Otherwise, resolve, and exit.
          context.events = (0,micromark_util_resolve_all__WEBPACK_IMPORTED_MODULE_3__.resolveAll)(resolveAllConstructs, context.events, context)

          return context.events
        }

  //
  // Tools.
  //

  /** @type {TokenizeContext['sliceSerialize']} */
        function sliceSerialize(token, expandTabs) {
          return serializeChunks(sliceStream(token), expandTabs)
        }

  /** @type {TokenizeContext['sliceStream']} */
        function sliceStream(token) {
          return sliceChunks(chunks, token)
        }

  /** @type {TokenizeContext['now']} */
        function now() {
    // This is a hot path, so we clone manually instead of `Object.assign({}, point)`
          const {line, column, offset, _index, _bufferIndex} = point
          return {line, column, offset, _index, _bufferIndex}
        }

  /** @type {TokenizeContext['defineSkip']} */
        function defineSkip(value) {
          columnStart[value.line] = value.column
          accountForPotentialSkip()
          debug('position: define skip: `%j`', point)
        }

  //
  // State management.
  //

  /**
   * Main loop (note that `_index` and `_bufferIndex` in `point` are modified by
   * `consume`).
   * Here is where we walk through the chunks, which either include strings of
   * several characters, or numerical character codes.
   * The reason to do this in a loop instead of a call is so the stack can
   * drain.
   *
   * @returns {void}
   */
        function main() {
    /** @type {number} */
          let chunkIndex

          while (point._index < chunks.length) {
            const chunk = chunks[point._index]

      // If we’re in a buffer chunk, loop through it.
            if (typeof chunk === 'string') {
              chunkIndex = point._index

              if (point._bufferIndex < 0) {
                point._bufferIndex = 0
              }

              while (
                point._index === chunkIndex &&
          point._bufferIndex < chunk.length
              ) {
                go(chunk.charCodeAt(point._bufferIndex))
              }
            } else {
              go(chunk)
            }
          }
        }

  /**
   * Deal with one code.
   *
   * @param {Code} code
   * @returns {void}
   */
        function go(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(consumed === true, 'expected character to be consumed')
          consumed = undefined
          debug('main: passing `%s` to %s', code, state && state.name)
          expectedCode = code
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(typeof state === 'function', 'expected state')
          state = state(code)
        }

  /** @type {Effects['consume']} */
        function consume(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(code === expectedCode, 'expected given code to equal expected code')

          debug('consume: `%s`', code)

          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            consumed === undefined,
            'expected code to not have been consumed: this might be because `return x(code)` instead of `return x` was used'
          )
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            code === null
              ? context.events.length === 0 ||
            context.events[context.events.length - 1][0] === 'exit'
              : context.events[context.events.length - 1][0] === 'enter',
            'expected last token to be open'
          )

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            point.line++
            point.column = 1
            point.offset += code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.carriageReturnLineFeed ? 2 : 1
            accountForPotentialSkip()
            debug('position: after eol: `%j`', point)
          } else if (code !== micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.virtualSpace) {
            point.column++
            point.offset++
          }

    // Not in a string chunk.
          if (point._bufferIndex < 0) {
            point._index++
          } else {
            point._bufferIndex++

      // At end of string chunk.
      // @ts-expect-error Points w/ non-negative `_bufferIndex` reference
      // strings.
            if (point._bufferIndex === chunks[point._index].length) {
              point._bufferIndex = -1
              point._index++
            }
          }

    // Expose the previous character.
          context.previous = code

    // Mark as consumed.
          consumed = true
        }

  /** @type {Effects['enter']} */
        function enter(type, fields) {
    /** @type {Token} */
    // @ts-expect-error Patch instead of assign required fields to help GC.
          const token = fields || {}
          token.type = type
          token.start = now()

          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(typeof type === 'string', 'expected string type')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(type.length > 0, 'expected non-empty string')
          debug('enter: `%s`', type)

          context.events.push(['enter', token, context])

          stack.push(token)

          return token
        }

  /** @type {Effects['exit']} */
        function exit(type) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(typeof type === 'string', 'expected string type')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(type.length > 0, 'expected non-empty string')

          const token = stack.pop()
    ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(token, 'cannot close w/o open tokens')
          token.end = now()

          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(type === token.type, 'expected exit token to match current token')

          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            !(
              token.start._index === token.end._index &&
        token.start._bufferIndex === token.end._bufferIndex
            ),
            'expected non-empty token (`' + type + '`)'
          )

          debug('exit: `%s`', token.type)
          context.events.push(['exit', token, context])

          return token
        }

  /**
   * Use results.
   *
   * @type {ReturnHandle}
   */
        function onsuccessfulconstruct(construct, info) {
          addResult(construct, info.from)
        }

  /**
   * Discard results.
   *
   * @type {ReturnHandle}
   */
        function onsuccessfulcheck(_, info) {
          info.restore()
        }

  /**
   * Factory to attempt/check/interrupt.
   *
   * @param {ReturnHandle} onreturn
   * @param {{interrupt?: boolean | undefined} | undefined} [fields]
   */
        function constructFactory(onreturn, fields) {
          return hook

    /**
     * Handle either an object mapping codes to constructs, a list of
     * constructs, or a single construct.
     *
     * @param {Array<Construct> | Construct | ConstructRecord} constructs
     * @param {State} returnState
     * @param {State | undefined} [bogusState]
     * @returns {State}
     */
          function hook(constructs, returnState, bogusState) {
      /** @type {Array<Construct>} */
            let listOfConstructs
      /** @type {number} */
            let constructIndex
      /** @type {Construct} */
            let currentConstruct
      /** @type {Info} */
            let info

            return Array.isArray(constructs)
              ? /* c8 ignore next 1 */
              handleListOfConstructs(constructs)
              : 'tokenize' in constructs
                ? // @ts-expect-error Looks like a construct.
                handleListOfConstructs([constructs])
                : handleMapOfConstructs(constructs)

      /**
       * Handle a list of construct.
       *
       * @param {ConstructRecord} map
       * @returns {State}
       */
            function handleMapOfConstructs(map) {
              return start

        /** @type {State} */
              function start(code) {
                const def = code !== null && map[code]
                const all = code !== null && map.null
                const list = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
                  ...(Array.isArray(def) ? def : def ? [def] : []),
                  ...(Array.isArray(all) ? all : all ? [all] : [])
                ]

                return handleListOfConstructs(list)(code)
              }
            }

      /**
       * Handle a list of construct.
       *
       * @param {Array<Construct>} list
       * @returns {State}
       */
            function handleListOfConstructs(list) {
              listOfConstructs = list
              constructIndex = 0

              if (list.length === 0) {
                (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(bogusState, 'expected `bogusState` to be given')
                return bogusState
              }

              return handleConstruct(list[constructIndex])
            }

      /**
       * Handle a single construct.
       *
       * @param {Construct} construct
       * @returns {State}
       */
            function handleConstruct(construct) {
              return start

        /** @type {State} */
              function start(code) {
          // To do: not needed to store if there is no bogus state, probably?
          // Currently doesn’t work because `inspect` in document does a check
          // w/o a bogus, which doesn’t make sense. But it does seem to help perf
          // by not storing.
                info = store()
                currentConstruct = construct

                if (!construct.partial) {
                  context.currentConstruct = construct
                }

          // Always populated by defaults.
                (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
                  context.parser.constructs.disable.null,
                  'expected `disable.null` to be populated'
                )

                if (
                  construct.name &&
            context.parser.constructs.disable.null.includes(construct.name)
                ) {
                  return nok(code)
                }

                return construct.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
                  fields ? Object.assign(Object.create(context), fields) : context,
                  effects,
                  ok,
                  nok
                )(code)
              }
            }

      /** @type {State} */
            function ok(code) {
              (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(code === expectedCode, 'expected code')
              consumed = true
              onreturn(currentConstruct, info)
              return returnState
            }

      /** @type {State} */
            function nok(code) {
              (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(code === expectedCode, 'expected code')
              consumed = true
              info.restore()

              if (++constructIndex < listOfConstructs.length) {
                return handleConstruct(listOfConstructs[constructIndex])
              }

              return bogusState
            }
          }
        }

  /**
   * @param {Construct} construct
   * @param {number} from
   * @returns {void}
   */
        function addResult(construct, from) {
          if (construct.resolveAll && !resolveAllConstructs.includes(construct)) {
            resolveAllConstructs.push(construct)
          }

          if (construct.resolve) {
            (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_2__.splice)(
              context.events,
              from,
              context.events.length - from,
              construct.resolve(context.events.slice(from), context)
            )
          }

          if (construct.resolveTo) {
            context.events = construct.resolveTo(context.events, context)
          }

          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            construct.partial ||
        context.events.length === 0 ||
        context.events[context.events.length - 1][0] === 'exit',
            'expected last token to end'
          )
        }

  /**
   * Store state.
   *
   * @returns {Info}
   */
        function store() {
          const startPoint = now()
          const startPrevious = context.previous
          const startCurrentConstruct = context.currentConstruct
          const startEventsIndex = context.events.length
          const startStack = Array.from(stack)

          return {restore, from: startEventsIndex}

    /**
     * Restore state.
     *
     * @returns {void}
     */
          function restore() {
            point = startPoint
            context.previous = startPrevious
            context.currentConstruct = startCurrentConstruct
            context.events.length = startEventsIndex
            stack = startStack
            accountForPotentialSkip()
            debug('position: restore: `%j`', point)
          }
        }

  /**
   * Move the current point a bit forward in the line when it’s on a column
   * skip.
   *
   * @returns {void}
   */
        function accountForPotentialSkip() {
          if (point.line in columnStart && point.column < 2) {
            point.column = columnStart[point.line]
            point.offset += columnStart[point.line] - 1
          }
        }
      }

/**
 * Get the chunks from a slice of chunks in the range of a token.
 *
 * @param {Array<Chunk>} chunks
 * @param {Pick<Token, 'end' | 'start'>} token
 * @returns {Array<Chunk>}
 */
      function sliceChunks(chunks, token) {
        const startIndex = token.start._index
        const startBufferIndex = token.start._bufferIndex
        const endIndex = token.end._index
        const endBufferIndex = token.end._bufferIndex
  /** @type {Array<Chunk>} */
        let view

        if (startIndex === endIndex) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(endBufferIndex > -1, 'expected non-negative end buffer index')
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(startBufferIndex > -1, 'expected non-negative start buffer index')
    // @ts-expect-error `_bufferIndex` is used on string chunks.
          view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)]
        } else {
          view = chunks.slice(startIndex, endIndex)

          if (startBufferIndex > -1) {
            const head = view[0]
            if (typeof head === 'string') {
              view[0] = head.slice(startBufferIndex)
            } else {
              (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(startBufferIndex === 0, 'expected `startBufferIndex` to be `0`')
              view.shift()
            }
          }

          if (endBufferIndex > 0) {
      // @ts-expect-error `_bufferIndex` is used on string chunks.
            view.push(chunks[endIndex].slice(0, endBufferIndex))
          }
        }

        return view
      }

/**
 * Get the string value of a slice of chunks.
 *
 * @param {Array<Chunk>} chunks
 * @param {boolean | undefined} [expandTabs=false]
 * @returns {string}
 */
      function serializeChunks(chunks, expandTabs) {
        let index = -1
  /** @type {Array<string>} */
        const result = []
  /** @type {boolean | undefined} */
        let atTab

        while (++index < chunks.length) {
          const chunk = chunks[index]
    /** @type {string} */
          let value

          if (typeof chunk === 'string') {
            value = chunk
          } else
            switch (chunk) {
              case micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.carriageReturn: {
                value = micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_5__.values.cr

                break
              }

              case micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.lineFeed: {
                value = micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_5__.values.lf

                break
              }

              case micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.carriageReturnLineFeed: {
                value = micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_5__.values.cr + micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_5__.values.lf

                break
              }

              case micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.horizontalTab: {
                value = expandTabs ? micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_5__.values.space : micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_5__.values.ht

                break
              }

              case micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.virtualSpace: {
                if (!expandTabs && atTab) continue
                value = micromark_util_symbol_values_js__WEBPACK_IMPORTED_MODULE_5__.values.space

                break
              }

              default: {
                (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(typeof chunk === 'number', 'expected number')
          // Currently only replacement character.
                value = String.fromCharCode(chunk)
              }
            }

          atTab = chunk === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.horizontalTab
          result.push(value)
        }

        return result.join('')
      }


/***/ }),

/***/ "./node_modules/micromark/dev/lib/initialize/content.js":
/*!**************************************************************!*\
  !*** ./node_modules/micromark/dev/lib/initialize/content.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   content: () => (/* binding */ content)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').InitialConstruct} InitialConstruct
 * @typedef {import('micromark-util-types').Initializer} Initializer
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 */








/** @type {InitialConstruct} */
      const content = {tokenize: initializeContent}

/**
 * @this {TokenizeContext}
 * @type {Initializer}
 */
      function initializeContent(effects) {
        const contentStart = effects.attempt(
          this.parser.constructs.contentInitial,
          afterContentStartConstruct,
          paragraphInitial
        )
  /** @type {Token} */
        let previous

        return contentStart

  /** @type {State} */
        function afterContentStartConstruct(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code),
            'expected eol or eof'
          )

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof) {
            effects.consume(code)
            return
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.lineEnding)
          return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(effects, contentStart, micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.linePrefix)
        }

  /** @type {State} */
        function paragraphInitial(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_5__.ok)(
            code !== micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof && !(0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code),
            'expected anything other than a line ending or EOF'
          )
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.paragraph)
          return lineStart(code)
        }

  /** @type {State} */
        function lineStart(code) {
          const token = effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkText, {
            contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_3__.constants.contentTypeText,
            previous
          })

          if (previous) {
            previous.next = token
          }

          previous = token

          return data(code)
        }

  /** @type {State} */
        function data(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_2__.codes.eof) {
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkText)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.paragraph)
            effects.consume(code)
            return
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.consume(code)
            effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_4__.types.chunkText)
            return lineStart
          }

    // Data.
          effects.consume(code)
          return data
        }
      }


/***/ }),

/***/ "./node_modules/micromark/dev/lib/initialize/document.js":
/*!***************************************************************!*\
  !*** ./node_modules/micromark/dev/lib/initialize/document.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   document: () => (/* binding */ document)
/* harmony export */ });
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_chunked__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-chunked */ "./node_modules/micromark-util-chunked/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').ContainerState} ContainerState
 * @typedef {import('micromark-util-types').InitialConstruct} InitialConstruct
 * @typedef {import('micromark-util-types').Initializer} Initializer
 * @typedef {import('micromark-util-types').Point} Point
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 */

/**
 * @typedef {[Construct, ContainerState]} StackItem
 */









/** @type {InitialConstruct} */
      const document = {tokenize: initializeDocument}

/** @type {Construct} */
      const containerConstruct = {tokenize: tokenizeContainer}

/**
 * @this {TokenizeContext}
 * @type {Initializer}
 */
      function initializeDocument(effects) {
        const self = this
  /** @type {Array<StackItem>} */
        const stack = []
        let continued = 0
  /** @type {TokenizeContext | undefined} */
        let childFlow
  /** @type {Token | undefined} */
        let childToken
  /** @type {number} */
        let lineStartOffset

        return start

  /** @type {State} */
        function start(code) {
    // First we iterate through the open blocks, starting with the root
    // document, and descending through last children down to the last open
    // block.
    // Each block imposes a condition that the line must satisfy if the block is
    // to remain open.
    // For example, a block quote requires a `>` character.
    // A paragraph requires a non-blank line.
    // In this phase we may match all or just some of the open blocks.
    // But we cannot close unmatched blocks yet, because we may have a lazy
    // continuation line.
          if (continued < stack.length) {
            const item = stack[continued]
            self.containerState = item[1]
            ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
              item[0].continuation,
              'expected `continuation` to be defined on container construct'
            )
            return effects.attempt(
              item[0].continuation,
              documentContinue,
              checkNewContainers
            )(code)
          }

    // Done.
          return checkNewContainers(code)
        }

  /** @type {State} */
        function documentContinue(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            self.containerState,
            'expected `containerState` to be defined after continuation'
          )

          continued++

    // Note: this field is called `_closeFlow` but it also closes containers.
    // Perhaps a good idea to rename it but it’s already used in the wild by
    // extensions.
          if (self.containerState._closeFlow) {
            self.containerState._closeFlow = undefined

            if (childFlow) {
              closeFlow()
            }

      // Note: this algorithm for moving events around is similar to the
      // algorithm when dealing with lazy lines in `writeToChild`.
            const indexBeforeExits = self.events.length
            let indexBeforeFlow = indexBeforeExits
      /** @type {Point | undefined} */
            let point

      // Find the flow chunk.
            while (indexBeforeFlow--) {
              if (
                self.events[indexBeforeFlow][0] === 'exit' &&
          self.events[indexBeforeFlow][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkFlow
              ) {
                point = self.events[indexBeforeFlow][1].end
                break
              }
            }

            (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(point, 'could not find previous flow chunk')

            exitContainers(continued)

      // Fix positions.
            let index = indexBeforeExits

            while (index < self.events.length) {
              self.events[index][1].end = Object.assign({}, point)
              index++
            }

      // Inject the exits earlier (they’re still also at the end).
            (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_2__.splice)(
              self.events,
              indexBeforeFlow + 1,
              0,
              self.events.slice(indexBeforeExits)
            )

      // Discard the duplicate exits.
            self.events.length = index

            return checkNewContainers(code)
          }

          return start(code)
        }

  /** @type {State} */
        function checkNewContainers(code) {
    // Next, after consuming the continuation markers for existing blocks, we
    // look for new block starts (e.g. `>` for a block quote).
    // If we encounter a new block start, we close any blocks unmatched in
    // step 1 before creating the new block as a child of the last matched
    // block.
          if (continued === stack.length) {
      // No need to `check` whether there’s a container, of `exitContainers`
      // would be moot.
      // We can instead immediately `attempt` to parse one.
            if (!childFlow) {
              return documentContinued(code)
            }

      // If we have concrete content, such as block HTML or fenced code,
      // we can’t have containers “pierce” into them, so we can immediately
      // start.
            if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) {
              return flowStart(code)
            }

      // If we do have flow, it could still be a blank line,
      // but we’d be interrupting it w/ a new container if there’s a current
      // construct.
      // To do: next major: remove `_gfmTableDynamicInterruptHack` (no longer
      // needed in micromark-extension-gfm-table@1.0.6).
            self.interrupt = Boolean(
              childFlow.currentConstruct && !childFlow._gfmTableDynamicInterruptHack
            )
          }

    // Check if there is a new container.
          self.containerState = {}
          return effects.check(
            containerConstruct,
            thereIsANewContainer,
            thereIsNoNewContainer
          )(code)
        }

  /** @type {State} */
        function thereIsANewContainer(code) {
          if (childFlow) closeFlow()
          exitContainers(continued)
          return documentContinued(code)
        }

  /** @type {State} */
        function thereIsNoNewContainer(code) {
          self.parser.lazy[self.now().line] = continued !== stack.length
          lineStartOffset = self.now().offset
          return flowStart(code)
        }

  /** @type {State} */
        function documentContinued(code) {
    // Try new containers.
          self.containerState = {}
          return effects.attempt(
            containerConstruct,
            containerContinue,
            flowStart
          )(code)
        }

  /** @type {State} */
        function containerContinue(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            self.currentConstruct,
            'expected `currentConstruct` to be defined on tokenizer'
          )
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            self.containerState,
            'expected `containerState` to be defined on tokenizer'
          )
          continued++
          stack.push([self.currentConstruct, self.containerState])
    // Try another.
          return documentContinued(code)
        }

  /** @type {State} */
        function flowStart(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.eof) {
            if (childFlow) closeFlow()
            exitContainers(0)
            effects.consume(code)
            return
          }

          childFlow = childFlow || self.parser.flow(self.now())
          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkFlow, {
            contentType: micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__.constants.contentTypeFlow,
            previous: childToken,
            _tokenizer: childFlow
          })

          return flowContinue(code)
        }

  /** @type {State} */
        function flowContinue(code) {
          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.eof) {
            writeToChild(effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkFlow), true)
            exitContainers(0)
            effects.consume(code)
            return
          }

          if ((0,micromark_util_character__WEBPACK_IMPORTED_MODULE_1__.markdownLineEnding)(code)) {
            effects.consume(code)
            writeToChild(effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkFlow))
      // Get ready for the next line.
            continued = 0
            self.interrupt = undefined
            return start
          }

          effects.consume(code)
          return flowContinue
        }

  /**
   * @param {Token} token
   * @param {boolean | undefined} [eof]
   * @returns {void}
   */
        function writeToChild(token, eof) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(childFlow, 'expected `childFlow` to be defined when continuing')
          const stream = self.sliceStream(token)
          if (eof) stream.push(null)
          token.previous = childToken
          if (childToken) childToken.next = token
          childToken = token
          childFlow.defineSkip(token.start)
          childFlow.write(stream)

    // Alright, so we just added a lazy line:
    //
    // ```markdown
    // > a
    // b.
    //
    // Or:
    //
    // > ~~~c
    // d
    //
    // Or:
    //
    // > | e |
    // f
    // ```
    //
    // The construct in the second example (fenced code) does not accept lazy
    // lines, so it marked itself as done at the end of its first line, and
    // then the content construct parses `d`.
    // Most constructs in markdown match on the first line: if the first line
    // forms a construct, a non-lazy line can’t “unmake” it.
    //
    // The construct in the third example is potentially a GFM table, and
    // those are *weird*.
    // It *could* be a table, from the first line, if the following line
    // matches a condition.
    // In this case, that second line is lazy, which “unmakes” the first line
    // and turns the whole into one content block.
    //
    // We’ve now parsed the non-lazy and the lazy line, and can figure out
    // whether the lazy line started a new flow block.
    // If it did, we exit the current containers between the two flow blocks.
          if (self.parser.lazy[token.start.line]) {
            let index = childFlow.events.length

            while (index--) {
              if (
          // The token starts before the line ending…
                childFlow.events[index][1].start.offset < lineStartOffset &&
          // …and either is not ended yet…
          (!childFlow.events[index][1].end ||
            // …or ends after it.
            childFlow.events[index][1].end.offset > lineStartOffset)
              ) {
          // Exit: there’s still something open, which means it’s a lazy line
          // part of something.
                return
              }
            }

      // Note: this algorithm for moving events around is similar to the
      // algorithm when closing flow in `documentContinue`.
            const indexBeforeExits = self.events.length
            let indexBeforeFlow = indexBeforeExits
      /** @type {boolean | undefined} */
            let seen
      /** @type {Point | undefined} */
            let point

      // Find the previous chunk (the one before the lazy line).
            while (indexBeforeFlow--) {
              if (
                self.events[indexBeforeFlow][0] === 'exit' &&
          self.events[indexBeforeFlow][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.chunkFlow
              ) {
                if (seen) {
                  point = self.events[indexBeforeFlow][1].end
                  break
                }

                seen = true
              }
            }

            (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(point, 'could not find previous flow chunk')

            exitContainers(continued)

      // Fix positions.
            index = indexBeforeExits

            while (index < self.events.length) {
              self.events[index][1].end = Object.assign({}, point)
              index++
            }

      // Inject the exits earlier (they’re still also at the end).
            (0,micromark_util_chunked__WEBPACK_IMPORTED_MODULE_2__.splice)(
              self.events,
              indexBeforeFlow + 1,
              0,
              self.events.slice(indexBeforeExits)
            )

      // Discard the duplicate exits.
            self.events.length = index
          }
        }

  /**
   * @param {number} size
   * @returns {void}
   */
        function exitContainers(size) {
          let index = stack.length

    // Exit open containers.
          while (index-- > size) {
            const entry = stack[index]
            self.containerState = entry[1]
            ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
              entry[0].exit,
              'expected `exit` to be defined on container construct'
            )
            entry[0].exit.call(self, effects)
          }

          stack.length = size
        }

        function closeFlow() {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            self.containerState,
            'expected `containerState` to be defined when closing flow'
          )
          ;(0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(childFlow, 'expected `childFlow` to be defined when closing it')
          childFlow.write([micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_3__.codes.eof])
          childToken = undefined
          childFlow = undefined
          self.containerState._closeFlow = undefined
        }
      }

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
      function tokenizeContainer(effects, ok, nok) {
  // Always populated by defaults.
        (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
          this.parser.constructs.disable.null,
          'expected `disable.null` to be populated'
        )
        return (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_0__.factorySpace)(
          effects,
          effects.attempt(this.parser.constructs.document, ok, nok),
          micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.linePrefix,
          this.parser.constructs.disable.null.includes('codeIndented')
            ? undefined
            : micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_4__.constants.tabSize
        )
      }


/***/ }),

/***/ "./node_modules/micromark/dev/lib/initialize/flow.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark/dev/lib/initialize/flow.js ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   flow: () => (/* binding */ flow)
/* harmony export */ });
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/blank-line.js");
/* harmony import */ const micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-core-commonmark */ "./node_modules/micromark-core-commonmark/dev/lib/content.js");
/* harmony import */ const micromark_factory_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-factory-space */ "./node_modules/micromark-factory-space/dev/index.js");
/* harmony import */ const micromark_util_character__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! micromark-util-character */ "./node_modules/micromark-util-character/dev/index.js");
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').InitialConstruct} InitialConstruct
 * @typedef {import('micromark-util-types').Initializer} Initializer
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 */








/** @type {InitialConstruct} */
      const flow = {tokenize: initializeFlow}

/**
 * @this {TokenizeContext}
 * @type {Initializer}
 */
      function initializeFlow(effects) {
        const self = this
        const initial = effects.attempt(
    // Try to parse a blank line.
          micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_0__.blankLine,
          atBlankEnding,
    // Try to parse initial flow (essentially, only code).
          effects.attempt(
            this.parser.constructs.flowInitial,
            afterConstruct,
            (0,micromark_factory_space__WEBPACK_IMPORTED_MODULE_2__.factorySpace)(
              effects,
              effects.attempt(
                this.parser.constructs.flow,
                afterConstruct,
                effects.attempt(micromark_core_commonmark__WEBPACK_IMPORTED_MODULE_1__.content, afterConstruct)
              ),
              micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.linePrefix
            )
          )
        )

        return initial

  /** @type {State} */
        function atBlankEnding(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_3__.markdownLineEnding)(code),
            'expected eol or eof'
          )

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.eof) {
            effects.consume(code)
            return
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.lineEndingBlank)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.lineEndingBlank)
          self.currentConstruct = undefined
          return initial
        }

  /** @type {State} */
        function afterConstruct(code) {
          (0,uvu_assert__WEBPACK_IMPORTED_MODULE_6__.ok)(
            code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.eof || (0,micromark_util_character__WEBPACK_IMPORTED_MODULE_3__.markdownLineEnding)(code),
            'expected eol or eof'
          )

          if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_4__.codes.eof) {
            effects.consume(code)
            return
          }

          effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.lineEnding)
          effects.consume(code)
          effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_5__.types.lineEnding)
          self.currentConstruct = undefined
          return initial
        }
      }


/***/ }),

/***/ "./node_modules/micromark/dev/lib/initialize/text.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark/dev/lib/initialize/text.js ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolver: () => (/* binding */ resolver),
/* harmony export */   string: () => (/* binding */ string),
/* harmony export */   text: () => (/* binding */ text)
/* harmony export */ });
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/* harmony import */ const micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! micromark-util-symbol/types.js */ "./node_modules/micromark-util-symbol/types.js");
/* harmony import */ const uvu_assert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! uvu/assert */ "./node_modules/uvu/assert/index.mjs");
/**
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').InitialConstruct} InitialConstruct
 * @typedef {import('micromark-util-types').Initializer} Initializer
 * @typedef {import('micromark-util-types').Resolver} Resolver
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 */






      const resolver = {resolveAll: createResolver()}
      const string = initializeFactory('string')
      const text = initializeFactory('text')

/**
 * @param {'string' | 'text'} field
 * @returns {InitialConstruct}
 */
      function initializeFactory(field) {
        return {
          tokenize: initializeText,
          resolveAll: createResolver(
            field === 'text' ? resolveAllLineSuffixes : undefined
          )
        }

  /**
   * @this {TokenizeContext}
   * @type {Initializer}
   */
        function initializeText(effects) {
          const self = this
          const constructs = this.parser.constructs[field]
          const text = effects.attempt(constructs, start, notText)

          return start

    /** @type {State} */
          function start(code) {
            return atBreak(code) ? text(code) : notText(code)
          }

    /** @type {State} */
          function notText(code) {
            if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.eof) {
              effects.consume(code)
              return
            }

            effects.enter(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.data)
            effects.consume(code)
            return data
          }

    /** @type {State} */
          function data(code) {
            if (atBreak(code)) {
              effects.exit(micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.data)
              return text(code)
            }

      // Data.
            effects.consume(code)
            return data
          }

    /**
     * @param {Code} code
     * @returns {boolean}
     */
          function atBreak(code) {
            if (code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.eof) {
              return true
            }

            const list = constructs[code]
            let index = -1

            if (list) {
        // Always populated by defaults.
              (0,uvu_assert__WEBPACK_IMPORTED_MODULE_3__.ok)(Array.isArray(list), 'expected `disable.null` to be populated')

              while (++index < list.length) {
                const item = list[index]
                if (!item.previous || item.previous.call(self, self.previous)) {
                  return true
                }
              }
            }

            return false
          }
        }
      }

/**
 * @param {Resolver | undefined} [extraResolver]
 * @returns {Resolver}
 */
      function createResolver(extraResolver) {
        return resolveAllText

  /** @type {Resolver} */
        function resolveAllText(events, context) {
          let index = -1
    /** @type {number | undefined} */
          let enter

    // A rather boring computation (to merge adjacent `data` events) which
    // improves mm performance by 29%.
          while (++index <= events.length) {
            if (enter === undefined) {
              if (events[index] && events[index][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.data) {
                enter = index
                index++
              }
            } else if (!events[index] || events[index][1].type !== micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.data) {
        // Don’t do anything if there is one data token.
              if (index !== enter + 2) {
                events[enter][1].end = events[index - 1][1].end
                events.splice(enter + 2, index - enter - 2)
                index = enter + 2
              }

              enter = undefined
            }
          }

          return extraResolver ? extraResolver(events, context) : events
        }
      }

/**
 * A rather ugly set of instructions which again looks at chunks in the input
 * stream.
 * The reason to do this here is that it is *much* faster to parse in reverse.
 * And that we can’t hook into `null` to split the line suffix before an EOF.
 * To do: figure out if we can make this into a clean utility, or even in core.
 * As it will be useful for GFMs literal autolink extension (and maybe even
 * tables?)
 *
 * @type {Resolver}
 */
      function resolveAllLineSuffixes(events, context) {
        let eventIndex = 0 // Skip first.

        while (++eventIndex <= events.length) {
          if (
            (eventIndex === events.length ||
        events[eventIndex][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineEnding) &&
      events[eventIndex - 1][1].type === micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.data
          ) {
            const data = events[eventIndex - 1][1]
            const chunks = context.sliceStream(data)
            let index = chunks.length
            let bufferIndex = -1
            let size = 0
      /** @type {boolean | undefined} */
            let tabs

            while (index--) {
              const chunk = chunks[index]

              if (typeof chunk === 'string') {
                bufferIndex = chunk.length

                while (chunk.charCodeAt(bufferIndex - 1) === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.space) {
                  size++
                  bufferIndex--
                }

                if (bufferIndex) break
                bufferIndex = -1
              }
        // Number
              else if (chunk === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.horizontalTab) {
                tabs = true
                size++
              } else if (chunk === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.virtualSpace) {
          // Empty
              } else {
          // Replacement character, exit.
                index++
                break
              }
            }

            if (size) {
              const token = {
                type:
            eventIndex === events.length ||
            tabs ||
            size < micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_1__.constants.hardBreakPrefixSizeMin
              ? micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.lineSuffix
              : micromark_util_symbol_types_js__WEBPACK_IMPORTED_MODULE_2__.types.hardBreakTrailing,
                start: {
                  line: data.end.line,
                  column: data.end.column - size,
                  offset: data.end.offset - size,
                  _index: data.start._index + index,
                  _bufferIndex: index
                    ? bufferIndex
                    : data.start._bufferIndex + bufferIndex
                },
                end: Object.assign({}, data.end)
              }

              data.end = Object.assign({}, token.start)

              if (data.start.offset === data.end.offset) {
                Object.assign(data, token)
              } else {
                events.splice(
                  eventIndex,
                  0,
                  ['enter', token, context],
                  ['exit', token, context]
                )
                eventIndex += 2
              }
            }

            eventIndex++
          }
        }

        return events
      }


/***/ }),

/***/ "./node_modules/micromark/dev/lib/parse.js":
/*!*************************************************!*\
  !*** ./node_modules/micromark/dev/lib/parse.js ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   parse: () => (/* binding */ parse)
/* harmony export */ });
/* harmony import */ const micromark_util_combine_extensions__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-combine-extensions */ "./node_modules/micromark-util-combine-extensions/index.js");
/* harmony import */ const _initialize_content_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./initialize/content.js */ "./node_modules/micromark/dev/lib/initialize/content.js");
/* harmony import */ const _initialize_document_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./initialize/document.js */ "./node_modules/micromark/dev/lib/initialize/document.js");
/* harmony import */ const _initialize_flow_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./initialize/flow.js */ "./node_modules/micromark/dev/lib/initialize/flow.js");
/* harmony import */ const _initialize_text_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./initialize/text.js */ "./node_modules/micromark/dev/lib/initialize/text.js");
/* harmony import */ const _create_tokenizer_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./create-tokenizer.js */ "./node_modules/micromark/dev/lib/create-tokenizer.js");
/* harmony import */ const _constructs_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./constructs.js */ "./node_modules/micromark/dev/lib/constructs.js");
/**
 * @typedef {import('micromark-util-types').Create} Create
 * @typedef {import('micromark-util-types').FullNormalizedExtension} FullNormalizedExtension
 * @typedef {import('micromark-util-types').InitialConstruct} InitialConstruct
 * @typedef {import('micromark-util-types').ParseContext} ParseContext
 * @typedef {import('micromark-util-types').ParseOptions} ParseOptions
 */









/**
 * @param {ParseOptions | null | undefined} [options]
 * @returns {ParseContext}
 */
      function parse(options) {
        const settings = options || {}
        const constructs = /** @type {FullNormalizedExtension} */ (
          (0,micromark_util_combine_extensions__WEBPACK_IMPORTED_MODULE_0__.combineExtensions)([_constructs_js__WEBPACK_IMPORTED_MODULE_6__, ...(settings.extensions || [])])
        )

  /** @type {ParseContext} */
        const parser = {
          defined: [],
          lazy: {},
          constructs,
          content: create(_initialize_content_js__WEBPACK_IMPORTED_MODULE_1__.content),
          document: create(_initialize_document_js__WEBPACK_IMPORTED_MODULE_2__.document),
          flow: create(_initialize_flow_js__WEBPACK_IMPORTED_MODULE_3__.flow),
          string: create(_initialize_text_js__WEBPACK_IMPORTED_MODULE_4__.string),
          text: create(_initialize_text_js__WEBPACK_IMPORTED_MODULE_4__.text)
        }

        return parser

  /**
   * @param {InitialConstruct} initial
   */
        function create(initial) {
          return creator
    /** @type {Create} */
          function creator(from) {
            return (0,_create_tokenizer_js__WEBPACK_IMPORTED_MODULE_5__.createTokenizer)(parser, initial, from)
          }
        }
      }


/***/ }),

/***/ "./node_modules/micromark/dev/lib/postprocess.js":
/*!*******************************************************!*\
  !*** ./node_modules/micromark/dev/lib/postprocess.js ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   postprocess: () => (/* binding */ postprocess)
/* harmony export */ });
/* harmony import */ const micromark_util_subtokenize__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-subtokenize */ "./node_modules/micromark-util-subtokenize/dev/index.js");
/**
 * @typedef {import('micromark-util-types').Event} Event
 */



/**
 * @param {Array<Event>} events
 * @returns {Array<Event>}
 */
      function postprocess(events) {
        while (!(0,micromark_util_subtokenize__WEBPACK_IMPORTED_MODULE_0__.subtokenize)(events)) {
    // Empty
        }

        return events
      }


/***/ }),

/***/ "./node_modules/micromark/dev/lib/preprocess.js":
/*!******************************************************!*\
  !*** ./node_modules/micromark/dev/lib/preprocess.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   preprocess: () => (/* binding */ preprocess)
/* harmony export */ });
/* harmony import */ const micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! micromark-util-symbol/codes.js */ "./node_modules/micromark-util-symbol/codes.js");
/* harmony import */ const micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! micromark-util-symbol/constants.js */ "./node_modules/micromark-util-symbol/constants.js");
/**
 * @typedef {import('micromark-util-types').Chunk} Chunk
 * @typedef {import('micromark-util-types').Code} Code
 * @typedef {import('micromark-util-types').Encoding} Encoding
 * @typedef {import('micromark-util-types').Value} Value
 */

/**
 * @callback Preprocessor
 * @param {Value} value
 * @param {Encoding | null | undefined} [encoding]
 * @param {boolean | null | undefined} [end=false]
 * @returns {Array<Chunk>}
 */




      const search = /[\0\t\n\r]/g

/**
 * @returns {Preprocessor}
 */
      function preprocess() {
        let column = 1
        let buffer = ''
  /** @type {boolean | undefined} */
        let start = true
  /** @type {boolean | undefined} */
        let atCarriageReturn

        return preprocessor

  /** @type {Preprocessor} */
        function preprocessor(value, encoding, end) {
    /** @type {Array<Chunk>} */
          const chunks = []
    /** @type {RegExpMatchArray | null} */
          let match
    /** @type {number} */
          let next
    /** @type {number} */
          let startPosition
    /** @type {number} */
          let endPosition
    /** @type {Code} */
          let code

    // @ts-expect-error `Buffer` does allow an encoding.
          value = buffer + value.toString(encoding)
          startPosition = 0
          buffer = ''

          if (start) {
      // To do: `markdown-rs` actually parses BOMs (byte order mark).
            if (value.charCodeAt(0) === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.byteOrderMarker) {
              startPosition++
            }

            start = undefined
          }

          while (startPosition < value.length) {
            search.lastIndex = startPosition
            match = search.exec(value)
            endPosition =
        match && match.index !== undefined ? match.index : value.length
            code = value.charCodeAt(endPosition)

            if (!match) {
              buffer = value.slice(startPosition)
              break
            }

            if (
              code === micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.lf &&
        startPosition === endPosition &&
        atCarriageReturn
            ) {
              chunks.push(micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.carriageReturnLineFeed)
              atCarriageReturn = undefined
            } else {
              if (atCarriageReturn) {
                chunks.push(micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.carriageReturn)
                atCarriageReturn = undefined
              }

              if (startPosition < endPosition) {
                chunks.push(value.slice(startPosition, endPosition))
                column += endPosition - startPosition
              }

              switch (code) {
                case micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.nul: {
                  chunks.push(micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.replacementCharacter)
                  column++

                  break
                }

                case micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.ht: {
                  next = Math.ceil(column / micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_1__.constants.tabSize) * micromark_util_symbol_constants_js__WEBPACK_IMPORTED_MODULE_1__.constants.tabSize
                  chunks.push(micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.horizontalTab)
                  while (column++ < next) chunks.push(micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.virtualSpace)

                  break
                }

                case micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.lf: {
                  chunks.push(micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.lineFeed)
                  column = 1

                  break
                }

                default: {
                  atCarriageReturn = true
                  column = 1
                }
              }
            }

            startPosition = endPosition + 1
          }

          if (end) {
            if (atCarriageReturn) chunks.push(micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.carriageReturn)
            if (buffer) chunks.push(buffer)
            chunks.push(micromark_util_symbol_codes_js__WEBPACK_IMPORTED_MODULE_0__.codes.eof)
          }

          return chunks
        }
      }


/***/ }),

/***/ "./node_modules/ms/index.js":
/*!**********************************!*\
  !*** ./node_modules/ms/index.js ***!
  \**********************************/
/***/ ((module) => {

/**
 * Helpers.
 */

      const s = 1000;
      const m = s * 60;
      const h = m * 60;
      const d = h * 24;
      const w = d * 7;
      const y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

      module.exports = function (val, options) {
        options = options || {};
        const type = typeof val;
        if (type === 'string' && val.length > 0) {
          return parse(val);
        } else if (type === 'number' && isFinite(val)) {
          return options.long ? fmtLong(val) : fmtShort(val);
        }
        throw new Error(
          'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
        );
      };

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

      function parse(str) {
        str = String(str);
        if (str.length > 100) {
          return;
        }
        const match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
          str
        );
        if (!match) {
          return;
        }
        const n = parseFloat(match[1]);
        const type = (match[2] || 'ms').toLowerCase();
        switch (type) {
          case 'years':
          case 'year':
          case 'yrs':
          case 'yr':
          case 'y':
            return n * y;
          case 'weeks':
          case 'week':
          case 'w':
            return n * w;
          case 'days':
          case 'day':
          case 'd':
            return n * d;
          case 'hours':
          case 'hour':
          case 'hrs':
          case 'hr':
          case 'h':
            return n * h;
          case 'minutes':
          case 'minute':
          case 'mins':
          case 'min':
          case 'm':
            return n * m;
          case 'seconds':
          case 'second':
          case 'secs':
          case 'sec':
          case 's':
            return n * s;
          case 'milliseconds':
          case 'millisecond':
          case 'msecs':
          case 'msec':
          case 'ms':
            return n;
          default:
            return undefined;
        }
      }

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

      function fmtShort(ms) {
        const msAbs = Math.abs(ms);
        if (msAbs >= d) {
          return Math.round(ms / d) + 'd';
        }
        if (msAbs >= h) {
          return Math.round(ms / h) + 'h';
        }
        if (msAbs >= m) {
          return Math.round(ms / m) + 'm';
        }
        if (msAbs >= s) {
          return Math.round(ms / s) + 's';
        }
        return ms + 'ms';
      }

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

      function fmtLong(ms) {
        const msAbs = Math.abs(ms);
        if (msAbs >= d) {
          return plural(ms, msAbs, d, 'day');
        }
        if (msAbs >= h) {
          return plural(ms, msAbs, h, 'hour');
        }
        if (msAbs >= m) {
          return plural(ms, msAbs, m, 'minute');
        }
        if (msAbs >= s) {
          return plural(ms, msAbs, s, 'second');
        }
        return ms + ' ms';
      }

/**
 * Pluralization helper.
 */

      function plural(ms, msAbs, n, name) {
        const isPlural = msAbs >= n * 1.5;
        return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
      }


/***/ }),

/***/ "./node_modules/object-assign/index.js":
/*!*********************************************!*\
  !*** ./node_modules/object-assign/index.js ***!
  \*********************************************/
/***/ ((module) => {

      "use strict";
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/


/* eslint-disable no-unused-vars */
      const getOwnPropertySymbols = Object.getOwnPropertySymbols;
      const hasOwnProperty = Object.prototype.hasOwnProperty;
      const propIsEnumerable = Object.prototype.propertyIsEnumerable;

      function toObject(val) {
        if (val === null || val === undefined) {
          throw new TypeError('Object.assign cannot be called with null or undefined');
        }

        return Object(val);
      }

      function shouldUseNative() {
        try {
          if (!Object.assign) {
            return false;
          }

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
          const test1 = new String('abc');  // eslint-disable-line no-new-wrappers
          test1[5] = 'de';
          if (Object.getOwnPropertyNames(test1)[0] === '5') {
            return false;
          }

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
          const test2 = {};
          for (let i = 0; i < 10; i++) {
            test2['_' + String.fromCharCode(i)] = i;
          }
          const order2 = Object.getOwnPropertyNames(test2).map(function (n) {
            return test2[n];
          });
          if (order2.join('') !== '0123456789') {
            return false;
          }

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
          const test3 = {};
          'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
            test3[letter] = letter;
          });
          if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
            return false;
          }

          return true;
        } catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
          return false;
        }
      }

      module.exports = shouldUseNative() ? Object.assign : function (target, source) {
        let from;
        const to = toObject(target);
        let symbols;

        for (let s = 1; s < arguments.length; s++) {
          from = Object(arguments[s]);

          for (const key in from) {
            if (hasOwnProperty.call(from, key)) {
              to[key] = from[key];
            }
          }

          if (getOwnPropertySymbols) {
            symbols = getOwnPropertySymbols(from);
            for (let i = 0; i < symbols.length; i++) {
              if (propIsEnumerable.call(from, symbols[i])) {
                to[symbols[i]] = from[symbols[i]];
              }
            }
          }
        }

        return to;
      };


/***/ }),

/***/ "./node_modules/prop-types/checkPropTypes.js":
/*!***************************************************!*\
  !*** ./node_modules/prop-types/checkPropTypes.js ***!
  \***************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



      let printWarning = function() {};

      if (true) {
        var ReactPropTypesSecret = __webpack_require__(/*! ./lib/ReactPropTypesSecret */ "./node_modules/prop-types/lib/ReactPropTypesSecret.js");
        var loggedTypeFailures = {};
        var has = __webpack_require__(/*! ./lib/has */ "./node_modules/prop-types/lib/has.js");

        printWarning = function(text) {
          const message = 'Warning: ' + text;
          if (typeof console !== 'undefined') {
            console.error(message);
          }
          try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
            throw new Error(message);
          } catch (x) { /**/ }
        };
      }

/**
 * Assert that the values match with the type specs.
 * Error messages are memorized and will only be shown once.
 *
 * @param {object} typeSpecs Map of name to a ReactPropType
 * @param {object} values Runtime values that need to be type-checked
 * @param {string} location e.g. "prop", "context", "child context"
 * @param {string} componentName Name of the component for error messages.
 * @param {?Function} getStack Returns the component stack.
 * @private
 */
      function checkPropTypes(typeSpecs, values, location, componentName, getStack) {
        if (true) {
          for (const typeSpecName in typeSpecs) {
            if (has(typeSpecs, typeSpecName)) {
              var error;
        // Prop type validation may throw. In case they do, we don't want to
        // fail the render phase where it didn't fail before. So we log it.
        // After these have been cleaned up, we'll let them throw.
              try {
          // This is intentionally an invariant that gets caught. It's the same
          // behavior as without this statement except with a better message.
                if (typeof typeSpecs[typeSpecName] !== 'function') {
                  const err = Error(
                    (componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' +
              'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.' +
              'This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.'
                  );
                  err.name = 'Invariant Violation';
                  throw err;
                }
                error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
              } catch (ex) {
                error = ex;
              }
              if (error && !(error instanceof Error)) {
                printWarning(
                  (componentName || 'React class') + ': type specification of ' +
            location + ' `' + typeSpecName + '` is invalid; the type checker ' +
            'function must return `null` or an `Error` but returned a ' + typeof error + '. ' +
            'You may have forgotten to pass an argument to the type checker ' +
            'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' +
            'shape all require an argument).'
                );
              }
              if (error instanceof Error && !(error.message in loggedTypeFailures)) {
          // Only monitor this failure once because there tends to be a lot of the
          // same error.
                loggedTypeFailures[error.message] = true;

                const stack = getStack ? getStack() : '';

                printWarning(
                  'Failed ' + location + ' type: ' + error.message + (stack != null ? stack : '')
                );
              }
            }
          }
        }
      }

/**
 * Resets warning cache when testing.
 *
 * @private
 */
      checkPropTypes.resetWarningCache = function() {
        if (true) {
          loggedTypeFailures = {};
        }
      }

      module.exports = checkPropTypes;


/***/ }),

/***/ "./node_modules/prop-types/factoryWithTypeCheckers.js":
/*!************************************************************!*\
  !*** ./node_modules/prop-types/factoryWithTypeCheckers.js ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



      const ReactIs = __webpack_require__(/*! react-is */ "./node_modules/react-is/index.js");
      const assign = __webpack_require__(/*! object-assign */ "./node_modules/object-assign/index.js");

      const ReactPropTypesSecret = __webpack_require__(/*! ./lib/ReactPropTypesSecret */ "./node_modules/prop-types/lib/ReactPropTypesSecret.js");
      const has = __webpack_require__(/*! ./lib/has */ "./node_modules/prop-types/lib/has.js");
      const checkPropTypes = __webpack_require__(/*! ./checkPropTypes */ "./node_modules/prop-types/checkPropTypes.js");

      let printWarning = function() {};

      if (true) {
        printWarning = function(text) {
          const message = 'Warning: ' + text;
          if (typeof console !== 'undefined') {
            console.error(message);
          }
          try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
            throw new Error(message);
          } catch (x) {}
        };
      }

      function emptyFunctionThatReturnsNull() {
        return null;
      }

      module.exports = function(isValidElement, throwOnDirectAccess) {
  /* global Symbol */
        const ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
        const FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

  /**
   * Returns the iterator method function contained on the iterable object.
   *
   * Be sure to invoke the function with the iterable as context:
   *
   *     var iteratorFn = getIteratorFn(myIterable);
   *     if (iteratorFn) {
   *       var iterator = iteratorFn.call(myIterable);
   *       ...
   *     }
   *
   * @param {?object} maybeIterable
   * @return {?function}
   */
        function getIteratorFn(maybeIterable) {
          const iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
          if (typeof iteratorFn === 'function') {
            return iteratorFn;
          }
        }

  /**
   * Collection of methods that allow declaration and validation of props that are
   * supplied to React components. Example usage:
   *
   *   var Props = require('ReactPropTypes');
   *   var MyArticle = React.createClass({
   *     propTypes: {
   *       // An optional string prop named "description".
   *       description: Props.string,
   *
   *       // A required enum prop named "category".
   *       category: Props.oneOf(['News','Photos']).isRequired,
   *
   *       // A prop named "dialog" that requires an instance of Dialog.
   *       dialog: Props.instanceOf(Dialog).isRequired
   *     },
   *     render: function() { ... }
   *   });
   *
   * A more formal specification of how these methods are used:
   *
   *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
   *   decl := ReactPropTypes.{type}(.isRequired)?
   *
   * Each and every declaration produces a function with the same signature. This
   * allows the creation of custom validation functions. For example:
   *
   *  var MyLink = React.createClass({
   *    propTypes: {
   *      // An optional string or URI prop named "href".
   *      href: function(props, propName, componentName) {
   *        var propValue = props[propName];
   *        if (propValue != null && typeof propValue !== 'string' &&
   *            !(propValue instanceof URI)) {
   *          return new Error(
   *            'Expected a string or an URI for ' + propName + ' in ' +
   *            componentName
   *          );
   *        }
   *      }
   *    },
   *    render: function() {...}
   *  });
   *
   * @internal
   */

        const ANONYMOUS = '<<anonymous>>';

  // Important!
  // Keep this list in sync with production version in `./factoryWithThrowingShims.js`.
        const ReactPropTypes = {
          array: createPrimitiveTypeChecker('array'),
          bigint: createPrimitiveTypeChecker('bigint'),
          bool: createPrimitiveTypeChecker('boolean'),
          func: createPrimitiveTypeChecker('function'),
          number: createPrimitiveTypeChecker('number'),
          object: createPrimitiveTypeChecker('object'),
          string: createPrimitiveTypeChecker('string'),
          symbol: createPrimitiveTypeChecker('symbol'),

          any: createAnyTypeChecker(),
          arrayOf: createArrayOfTypeChecker,
          element: createElementTypeChecker(),
          elementType: createElementTypeTypeChecker(),
          instanceOf: createInstanceTypeChecker,
          node: createNodeChecker(),
          objectOf: createObjectOfTypeChecker,
          oneOf: createEnumTypeChecker,
          oneOfType: createUnionTypeChecker,
          shape: createShapeTypeChecker,
          exact: createStrictShapeTypeChecker,
        };

  /**
   * inlined Object.is polyfill to avoid requiring consumers ship their own
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
   */
  /*eslint-disable no-self-compare*/
        function is(x, y) {
    // SameValue algorithm
          if (x === y) {
      // Steps 1-5, 7-10
      // Steps 6.b-6.e: +0 != -0
            return x !== 0 || 1 / x === 1 / y;
          } else {
      // Step 6.a: NaN == NaN
            return x !== x && y !== y;
          }
        }
  /*eslint-enable no-self-compare*/

  /**
   * We use an Error-like object for backward compatibility as people may call
   * PropTypes directly and inspect their output. However, we don't use real
   * Errors anymore. We don't inspect their stack anyway, and creating them
   * is prohibitively expensive if they are created too often, such as what
   * happens in oneOfType() for any type before the one that matched.
   */
        function PropTypeError(message, data) {
          this.message = message;
          this.data = data && typeof data === 'object' ? data: {};
          this.stack = '';
        }
  // Make `instanceof Error` still work for returned errors.
        PropTypeError.prototype = Error.prototype;

        function createChainableTypeChecker(validate) {
          if (true) {
            var manualPropTypeCallCache = {};
            var manualPropTypeWarningCount = 0;
          }
          function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
            componentName = componentName || ANONYMOUS;
            propFullName = propFullName || propName;

            if (secret !== ReactPropTypesSecret) {
              if (throwOnDirectAccess) {
          // New behavior only for users of `prop-types` package
                const err = new Error(
                  'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
            'Use `PropTypes.checkPropTypes()` to call them. ' +
            'Read more at http://fb.me/use-check-prop-types'
                );
                err.name = 'Invariant Violation';
                throw err;
              } else if ( true && typeof console !== 'undefined') {
          // Old behavior for people using React.PropTypes
                const cacheKey = componentName + ':' + propName;
                if (
                  !manualPropTypeCallCache[cacheKey] &&
            // Avoid spamming the console because they are often not actionable except for lib authors
            manualPropTypeWarningCount < 3
                ) {
                  printWarning(
                    'You are manually calling a React.PropTypes validation ' +
              'function for the `' + propFullName + '` prop on `' + componentName + '`. This is deprecated ' +
              'and will throw in the standalone `prop-types` package. ' +
              'You may be seeing this warning due to a third-party PropTypes ' +
              'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.'
                  );
                  manualPropTypeCallCache[cacheKey] = true;
                  manualPropTypeWarningCount++;
                }
              }
            }
            if (props[propName] == null) {
              if (isRequired) {
                if (props[propName] === null) {
                  return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));
                }
                return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));
              }
              return null;
            } else {
              return validate(props, propName, componentName, location, propFullName);
            }
          }

          const chainedCheckType = checkType.bind(null, false);
          chainedCheckType.isRequired = checkType.bind(null, true);

          return chainedCheckType;
        }

        function createPrimitiveTypeChecker(expectedType) {
          function validate(props, propName, componentName, location, propFullName, secret) {
            const propValue = props[propName];
            const propType = getPropType(propValue);
            if (propType !== expectedType) {
        // `propValue` being instance of, say, date/regexp, pass the 'object'
        // check, but we can offer a more precise error message here rather than
        // 'of type `object`'.
              const preciseType = getPreciseType(propValue);

              return new PropTypeError(
                'Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'),
                {expectedType: expectedType}
              );
            }
            return null;
          }
          return createChainableTypeChecker(validate);
        }

        function createAnyTypeChecker() {
          return createChainableTypeChecker(emptyFunctionThatReturnsNull);
        }

        function createArrayOfTypeChecker(typeChecker) {
          function validate(props, propName, componentName, location, propFullName) {
            if (typeof typeChecker !== 'function') {
              return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
            }
            const propValue = props[propName];
            if (!Array.isArray(propValue)) {
              const propType = getPropType(propValue);
              return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
            }
            for (let i = 0; i < propValue.length; i++) {
              const error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret);
              if (error instanceof Error) {
                return error;
              }
            }
            return null;
          }
          return createChainableTypeChecker(validate);
        }

        function createElementTypeChecker() {
          function validate(props, propName, componentName, location, propFullName) {
            const propValue = props[propName];
            if (!isValidElement(propValue)) {
              const propType = getPropType(propValue);
              return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));
            }
            return null;
          }
          return createChainableTypeChecker(validate);
        }

        function createElementTypeTypeChecker() {
          function validate(props, propName, componentName, location, propFullName) {
            const propValue = props[propName];
            if (!ReactIs.isValidElementType(propValue)) {
              const propType = getPropType(propValue);
              return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement type.'));
            }
            return null;
          }
          return createChainableTypeChecker(validate);
        }

        function createInstanceTypeChecker(expectedClass) {
          function validate(props, propName, componentName, location, propFullName) {
            if (!(props[propName] instanceof expectedClass)) {
              const expectedClassName = expectedClass.name || ANONYMOUS;
              const actualClassName = getClassName(props[propName]);
              return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
            }
            return null;
          }
          return createChainableTypeChecker(validate);
        }

        function createEnumTypeChecker(expectedValues) {
          if (!Array.isArray(expectedValues)) {
            if (true) {
              if (arguments.length > 1) {
                printWarning(
                  'Invalid arguments supplied to oneOf, expected an array, got ' + arguments.length + ' arguments. ' +
            'A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z]).'
                );
              } else {
                printWarning('Invalid argument supplied to oneOf, expected an array.');
              }
            }
            return emptyFunctionThatReturnsNull;
          }

          function validate(props, propName, componentName, location, propFullName) {
            const propValue = props[propName];
            for (let i = 0; i < expectedValues.length; i++) {
              if (is(propValue, expectedValues[i])) {
                return null;
              }
            }

            const valuesString = JSON.stringify(expectedValues, function replacer(key, value) {
              const type = getPreciseType(value);
              if (type === 'symbol') {
                return String(value);
              }
              return value;
            });
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + String(propValue) + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
          }
          return createChainableTypeChecker(validate);
        }

        function createObjectOfTypeChecker(typeChecker) {
          function validate(props, propName, componentName, location, propFullName) {
            if (typeof typeChecker !== 'function') {
              return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
            }
            const propValue = props[propName];
            const propType = getPropType(propValue);
            if (propType !== 'object') {
              return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
            }
            for (const key in propValue) {
              if (has(propValue, key)) {
                const error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
                if (error instanceof Error) {
                  return error;
                }
              }
            }
            return null;
          }
          return createChainableTypeChecker(validate);
        }

        function createUnionTypeChecker(arrayOfTypeCheckers) {
          if (!Array.isArray(arrayOfTypeCheckers)) {
            true ? printWarning('Invalid argument supplied to oneOfType, expected an instance of array.') : 0;
            return emptyFunctionThatReturnsNull;
          }

          for (let i = 0; i < arrayOfTypeCheckers.length; i++) {
            const checker = arrayOfTypeCheckers[i];
            if (typeof checker !== 'function') {
              printWarning(
                'Invalid argument supplied to oneOfType. Expected an array of check functions, but ' +
          'received ' + getPostfixForTypeWarning(checker) + ' at index ' + i + '.'
              );
              return emptyFunctionThatReturnsNull;
            }
          }

          function validate(props, propName, componentName, location, propFullName) {
            const expectedTypes = [];
            for (let i = 0; i < arrayOfTypeCheckers.length; i++) {
              const checker = arrayOfTypeCheckers[i];
              const checkerResult = checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret);
              if (checkerResult == null) {
                return null;
              }
              if (checkerResult.data && has(checkerResult.data, 'expectedType')) {
                expectedTypes.push(checkerResult.data.expectedType);
              }
            }
            const expectedTypesMessage = (expectedTypes.length > 0) ? ', expected one of type [' + expectedTypes.join(', ') + ']': '';
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`' + expectedTypesMessage + '.'));
          }
          return createChainableTypeChecker(validate);
        }

        function createNodeChecker() {
          function validate(props, propName, componentName, location, propFullName) {
            if (!isNode(props[propName])) {
              return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
            }
            return null;
          }
          return createChainableTypeChecker(validate);
        }

        function invalidValidatorError(componentName, location, propFullName, key, type) {
          return new PropTypeError(
            (componentName || 'React class') + ': ' + location + ' type `' + propFullName + '.' + key + '` is invalid; ' +
      'it must be a function, usually from the `prop-types` package, but received `' + type + '`.'
          );
        }

        function createShapeTypeChecker(shapeTypes) {
          function validate(props, propName, componentName, location, propFullName) {
            const propValue = props[propName];
            const propType = getPropType(propValue);
            if (propType !== 'object') {
              return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
            }
            for (const key in shapeTypes) {
              const checker = shapeTypes[key];
              if (typeof checker !== 'function') {
                return invalidValidatorError(componentName, location, propFullName, key, getPreciseType(checker));
              }
              const error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
              if (error) {
                return error;
              }
            }
            return null;
          }
          return createChainableTypeChecker(validate);
        }

        function createStrictShapeTypeChecker(shapeTypes) {
          function validate(props, propName, componentName, location, propFullName) {
            const propValue = props[propName];
            const propType = getPropType(propValue);
            if (propType !== 'object') {
              return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
            }
      // We need to check all keys in case some are required but missing from props.
            const allKeys = assign({}, props[propName], shapeTypes);
            for (const key in allKeys) {
              const checker = shapeTypes[key];
              if (has(shapeTypes, key) && typeof checker !== 'function') {
                return invalidValidatorError(componentName, location, propFullName, key, getPreciseType(checker));
              }
              if (!checker) {
                return new PropTypeError(
                  'Invalid ' + location + ' `' + propFullName + '` key `' + key + '` supplied to `' + componentName + '`.' +
            '\nBad object: ' + JSON.stringify(props[propName], null, '  ') +
            '\nValid keys: ' + JSON.stringify(Object.keys(shapeTypes), null, '  ')
                );
              }
              const error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
              if (error) {
                return error;
              }
            }
            return null;
          }

          return createChainableTypeChecker(validate);
        }

        function isNode(propValue) {
          switch (typeof propValue) {
            case 'number':
            case 'string':
            case 'undefined':
              return true;
            case 'boolean':
              return !propValue;
            case 'object':
              if (Array.isArray(propValue)) {
                return propValue.every(isNode);
              }
              if (propValue === null || isValidElement(propValue)) {
                return true;
              }

              var iteratorFn = getIteratorFn(propValue);
              if (iteratorFn) {
                const iterator = iteratorFn.call(propValue);
                let step;
                if (iteratorFn !== propValue.entries) {
                  while (!(step = iterator.next()).done) {
                    if (!isNode(step.value)) {
                      return false;
                    }
                  }
                } else {
            // Iterator will provide entry [k,v] tuples rather than values.
                  while (!(step = iterator.next()).done) {
                    const entry = step.value;
                    if (entry) {
                      if (!isNode(entry[1])) {
                        return false;
                      }
                    }
                  }
                }
              } else {
                return false;
              }

              return true;
            default:
              return false;
          }
        }

        function isSymbol(propType, propValue) {
    // Native Symbol.
          if (propType === 'symbol') {
            return true;
          }

    // falsy value can't be a Symbol
          if (!propValue) {
            return false;
          }

    // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'
          if (propValue['@@toStringTag'] === 'Symbol') {
            return true;
          }

    // Fallback for non-spec compliant Symbols which are polyfilled.
          if (typeof Symbol === 'function' && propValue instanceof Symbol) {
            return true;
          }

          return false;
        }

  // Equivalent of `typeof` but with special handling for array and regexp.
        function getPropType(propValue) {
          const propType = typeof propValue;
          if (Array.isArray(propValue)) {
            return 'array';
          }
          if (propValue instanceof RegExp) {
      // Old webkits (at least until Android 4.0) return 'function' rather than
      // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
      // passes PropTypes.object.
            return 'object';
          }
          if (isSymbol(propType, propValue)) {
            return 'symbol';
          }
          return propType;
        }

  // This handles more types than `getPropType`. Only used for error messages.
  // See `createPrimitiveTypeChecker`.
        function getPreciseType(propValue) {
          if (typeof propValue === 'undefined' || propValue === null) {
            return '' + propValue;
          }
          const propType = getPropType(propValue);
          if (propType === 'object') {
            if (propValue instanceof Date) {
              return 'date';
            } else if (propValue instanceof RegExp) {
              return 'regexp';
            }
          }
          return propType;
        }

  // Returns a string that is postfixed to a warning about an invalid type.
  // For example, "undefined" or "of type array"
        function getPostfixForTypeWarning(value) {
          const type = getPreciseType(value);
          switch (type) {
            case 'array':
            case 'object':
              return 'an ' + type;
            case 'boolean':
            case 'date':
            case 'regexp':
              return 'a ' + type;
            default:
              return type;
          }
        }

  // Returns class name of the object, if any.
        function getClassName(propValue) {
          if (!propValue.constructor || !propValue.constructor.name) {
            return ANONYMOUS;
          }
          return propValue.constructor.name;
        }

        ReactPropTypes.checkPropTypes = checkPropTypes;
        ReactPropTypes.resetWarningCache = checkPropTypes.resetWarningCache;
        ReactPropTypes.PropTypes = ReactPropTypes;

        return ReactPropTypes;
      };


/***/ }),

/***/ "./node_modules/prop-types/index.js":
/*!******************************************!*\
  !*** ./node_modules/prop-types/index.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

      if (true) {
        const ReactIs = __webpack_require__(/*! react-is */ "./node_modules/react-is/index.js");

  // By explicitly using `prop-types` you are opting into new development behavior.
  // http://fb.me/prop-types-in-prod
        const throwOnDirectAccess = true;
        module.exports = __webpack_require__(/*! ./factoryWithTypeCheckers */ "./node_modules/prop-types/factoryWithTypeCheckers.js")(ReactIs.isElement, throwOnDirectAccess);
      } else // removed by dead control flow
      {}


/***/ }),

/***/ "./node_modules/prop-types/lib/ReactPropTypesSecret.js":
/*!*************************************************************!*\
  !*** ./node_modules/prop-types/lib/ReactPropTypesSecret.js ***!
  \*************************************************************/
/***/ ((module) => {

      "use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



      const ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

      module.exports = ReactPropTypesSecret;


/***/ }),

/***/ "./node_modules/prop-types/lib/has.js":
/*!********************************************!*\
  !*** ./node_modules/prop-types/lib/has.js ***!
  \********************************************/
/***/ ((module) => {

      module.exports = Function.call.bind(Object.prototype.hasOwnProperty);


/***/ }),

/***/ "./node_modules/property-information/index.js":
/*!****************************************************!*\
  !*** ./node_modules/property-information/index.js ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   find: () => (/* reexport safe */ _lib_find_js__WEBPACK_IMPORTED_MODULE_7__.find),
/* harmony export */   hastToReact: () => (/* reexport safe */ _lib_hast_to_react_js__WEBPACK_IMPORTED_MODULE_8__.hastToReact),
/* harmony export */   html: () => (/* binding */ html),
/* harmony export */   normalize: () => (/* reexport safe */ _lib_normalize_js__WEBPACK_IMPORTED_MODULE_9__.normalize),
/* harmony export */   svg: () => (/* binding */ svg)
/* harmony export */ });
/* harmony import */ const _lib_util_merge_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./lib/util/merge.js */ "./node_modules/property-information/lib/util/merge.js");
/* harmony import */ const _lib_xlink_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./lib/xlink.js */ "./node_modules/property-information/lib/xlink.js");
/* harmony import */ const _lib_xml_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./lib/xml.js */ "./node_modules/property-information/lib/xml.js");
/* harmony import */ const _lib_xmlns_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./lib/xmlns.js */ "./node_modules/property-information/lib/xmlns.js");
/* harmony import */ const _lib_aria_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./lib/aria.js */ "./node_modules/property-information/lib/aria.js");
/* harmony import */ const _lib_html_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./lib/html.js */ "./node_modules/property-information/lib/html.js");
/* harmony import */ const _lib_svg_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./lib/svg.js */ "./node_modules/property-information/lib/svg.js");
/* harmony import */ var _lib_find_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./lib/find.js */ "./node_modules/property-information/lib/find.js");
/* harmony import */ var _lib_hast_to_react_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./lib/hast-to-react.js */ "./node_modules/property-information/lib/hast-to-react.js");
/* harmony import */ var _lib_normalize_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./lib/normalize.js */ "./node_modules/property-information/lib/normalize.js");
/**
 * @typedef {import('./lib/util/info.js').Info} Info
 * @typedef {import('./lib/util/schema.js').Schema} Schema
 */












      const html = (0,_lib_util_merge_js__WEBPACK_IMPORTED_MODULE_0__.merge)([_lib_xml_js__WEBPACK_IMPORTED_MODULE_2__.xml, _lib_xlink_js__WEBPACK_IMPORTED_MODULE_1__.xlink, _lib_xmlns_js__WEBPACK_IMPORTED_MODULE_3__.xmlns, _lib_aria_js__WEBPACK_IMPORTED_MODULE_4__.aria, _lib_html_js__WEBPACK_IMPORTED_MODULE_5__.html], 'html')
      const svg = (0,_lib_util_merge_js__WEBPACK_IMPORTED_MODULE_0__.merge)([_lib_xml_js__WEBPACK_IMPORTED_MODULE_2__.xml, _lib_xlink_js__WEBPACK_IMPORTED_MODULE_1__.xlink, _lib_xmlns_js__WEBPACK_IMPORTED_MODULE_3__.xmlns, _lib_aria_js__WEBPACK_IMPORTED_MODULE_4__.aria, _lib_svg_js__WEBPACK_IMPORTED_MODULE_6__.svg], 'svg')


/***/ }),

/***/ "./node_modules/property-information/lib/aria.js":
/*!*******************************************************!*\
  !*** ./node_modules/property-information/lib/aria.js ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   aria: () => (/* binding */ aria)
/* harmony export */ });
/* harmony import */ const _util_types_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util/types.js */ "./node_modules/property-information/lib/util/types.js");
/* harmony import */ const _util_create_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util/create.js */ "./node_modules/property-information/lib/util/create.js");



      const aria = (0,_util_create_js__WEBPACK_IMPORTED_MODULE_1__.create)({
        transform(_, prop) {
          return prop === 'role' ? prop : 'aria-' + prop.slice(4).toLowerCase()
        },
        properties: {
          ariaActiveDescendant: null,
          ariaAtomic: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaAutoComplete: null,
          ariaBusy: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaChecked: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaColCount: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaColIndex: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaColSpan: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaControls: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          ariaCurrent: null,
          ariaDescribedBy: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          ariaDetails: null,
          ariaDisabled: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaDropEffect: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          ariaErrorMessage: null,
          ariaExpanded: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaFlowTo: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          ariaGrabbed: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaHasPopup: null,
          ariaHidden: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaInvalid: null,
          ariaKeyShortcuts: null,
          ariaLabel: null,
          ariaLabelledBy: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          ariaLevel: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaLive: null,
          ariaModal: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaMultiLine: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaMultiSelectable: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaOrientation: null,
          ariaOwns: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          ariaPlaceholder: null,
          ariaPosInSet: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaPressed: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaReadOnly: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaRelevant: null,
          ariaRequired: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaRoleDescription: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          ariaRowCount: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaRowIndex: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaRowSpan: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaSelected: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          ariaSetSize: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaSort: null,
          ariaValueMax: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaValueMin: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaValueNow: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          ariaValueText: null,
          role: null
        }
      })


/***/ }),

/***/ "./node_modules/property-information/lib/find.js":
/*!*******************************************************!*\
  !*** ./node_modules/property-information/lib/find.js ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   find: () => (/* binding */ find)
/* harmony export */ });
/* harmony import */ const _normalize_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./normalize.js */ "./node_modules/property-information/lib/normalize.js");
/* harmony import */ const _util_defined_info_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util/defined-info.js */ "./node_modules/property-information/lib/util/defined-info.js");
/* harmony import */ const _util_info_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util/info.js */ "./node_modules/property-information/lib/util/info.js");
/**
 * @typedef {import('./util/schema.js').Schema} Schema
 */





      const valid = /^data[-\w.:]+$/i
      const dash = /-[a-z]/g
      const cap = /[A-Z]/g

/**
 * @param {Schema} schema
 * @param {string} value
 * @returns {Info}
 */
      function find(schema, value) {
        const normal = (0,_normalize_js__WEBPACK_IMPORTED_MODULE_0__.normalize)(value)
        let prop = value
        let Type = _util_info_js__WEBPACK_IMPORTED_MODULE_2__.Info

        if (normal in schema.normal) {
          return schema.property[schema.normal[normal]]
        }

        if (normal.length > 4 && normal.slice(0, 4) === 'data' && valid.test(value)) {
    // Attribute or property.
          if (value.charAt(4) === '-') {
      // Turn it into a property.
            const rest = value.slice(5).replace(dash, camelcase)
            prop = 'data' + rest.charAt(0).toUpperCase() + rest.slice(1)
          } else {
      // Turn it into an attribute.
            const rest = value.slice(4)

            if (!dash.test(rest)) {
              let dashes = rest.replace(cap, kebab)

              if (dashes.charAt(0) !== '-') {
                dashes = '-' + dashes
              }

              value = 'data' + dashes
            }
          }

          Type = _util_defined_info_js__WEBPACK_IMPORTED_MODULE_1__.DefinedInfo
        }

        return new Type(prop, value)
      }

/**
 * @param {string} $0
 * @returns {string}
 */
      function kebab($0) {
        return '-' + $0.toLowerCase()
      }

/**
 * @param {string} $0
 * @returns {string}
 */
      function camelcase($0) {
        return $0.charAt(1).toUpperCase()
      }


/***/ }),

/***/ "./node_modules/property-information/lib/hast-to-react.js":
/*!****************************************************************!*\
  !*** ./node_modules/property-information/lib/hast-to-react.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   hastToReact: () => (/* binding */ hastToReact)
/* harmony export */ });
/**
 * `hast` is close to `React`, but differs in a couple of cases.
 *
 * To get a React property from a hast property, check if it is in
 * `hastToReact`, if it is, then use the corresponding value,
 * otherwise, use the hast property.
 *
 * @type {Record<string, string>}
 */
      const hastToReact = {
        classId: 'classID',
        dataType: 'datatype',
        itemId: 'itemID',
        strokeDashArray: 'strokeDasharray',
        strokeDashOffset: 'strokeDashoffset',
        strokeLineCap: 'strokeLinecap',
        strokeLineJoin: 'strokeLinejoin',
        strokeMiterLimit: 'strokeMiterlimit',
        typeOf: 'typeof',
        xLinkActuate: 'xlinkActuate',
        xLinkArcRole: 'xlinkArcrole',
        xLinkHref: 'xlinkHref',
        xLinkRole: 'xlinkRole',
        xLinkShow: 'xlinkShow',
        xLinkTitle: 'xlinkTitle',
        xLinkType: 'xlinkType',
        xmlnsXLink: 'xmlnsXlink'
      }


/***/ }),

/***/ "./node_modules/property-information/lib/html.js":
/*!*******************************************************!*\
  !*** ./node_modules/property-information/lib/html.js ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   html: () => (/* binding */ html)
/* harmony export */ });
/* harmony import */ const _util_types_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util/types.js */ "./node_modules/property-information/lib/util/types.js");
/* harmony import */ const _util_create_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util/create.js */ "./node_modules/property-information/lib/util/create.js");
/* harmony import */ const _util_case_insensitive_transform_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util/case-insensitive-transform.js */ "./node_modules/property-information/lib/util/case-insensitive-transform.js");




      const html = (0,_util_create_js__WEBPACK_IMPORTED_MODULE_1__.create)({
        space: 'html',
        attributes: {
          acceptcharset: 'accept-charset',
          classname: 'class',
          htmlfor: 'for',
          httpequiv: 'http-equiv'
        },
        transform: _util_case_insensitive_transform_js__WEBPACK_IMPORTED_MODULE_2__.caseInsensitiveTransform,
        mustUseProperty: ['checked', 'multiple', 'muted', 'selected'],
        properties: {
    // Standard Properties.
          abbr: null,
          accept: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaSeparated,
          acceptCharset: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          accessKey: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          action: null,
          allow: null,
          allowFullScreen: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          allowPaymentRequest: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          allowUserMedia: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          alt: null,
          as: null,
          async: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          autoCapitalize: null,
          autoComplete: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          autoFocus: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          autoPlay: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          blocking: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          capture: null,
          charSet: null,
          checked: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          cite: null,
          className: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          cols: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          colSpan: null,
          content: null,
          contentEditable: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          controls: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          controlsList: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          coords: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number | _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaSeparated,
          crossOrigin: null,
          data: null,
          dateTime: null,
          decoding: null,
          default: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          defer: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          dir: null,
          dirName: null,
          disabled: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          download: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.overloadedBoolean,
          draggable: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          encType: null,
          enterKeyHint: null,
          fetchPriority: null,
          form: null,
          formAction: null,
          formEncType: null,
          formMethod: null,
          formNoValidate: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          formTarget: null,
          headers: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          height: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          hidden: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          high: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          href: null,
          hrefLang: null,
          htmlFor: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          httpEquiv: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          id: null,
          imageSizes: null,
          imageSrcSet: null,
          inert: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          inputMode: null,
          integrity: null,
          is: null,
          isMap: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          itemId: null,
          itemProp: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          itemRef: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          itemScope: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          itemType: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          kind: null,
          label: null,
          lang: null,
          language: null,
          list: null,
          loading: null,
          loop: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          low: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          manifest: null,
          max: null,
          maxLength: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          media: null,
          method: null,
          min: null,
          minLength: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          multiple: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          muted: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          name: null,
          nonce: null,
          noModule: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          noValidate: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          onAbort: null,
          onAfterPrint: null,
          onAuxClick: null,
          onBeforeMatch: null,
          onBeforePrint: null,
          onBeforeToggle: null,
          onBeforeUnload: null,
          onBlur: null,
          onCancel: null,
          onCanPlay: null,
          onCanPlayThrough: null,
          onChange: null,
          onClick: null,
          onClose: null,
          onContextLost: null,
          onContextMenu: null,
          onContextRestored: null,
          onCopy: null,
          onCueChange: null,
          onCut: null,
          onDblClick: null,
          onDrag: null,
          onDragEnd: null,
          onDragEnter: null,
          onDragExit: null,
          onDragLeave: null,
          onDragOver: null,
          onDragStart: null,
          onDrop: null,
          onDurationChange: null,
          onEmptied: null,
          onEnded: null,
          onError: null,
          onFocus: null,
          onFormData: null,
          onHashChange: null,
          onInput: null,
          onInvalid: null,
          onKeyDown: null,
          onKeyPress: null,
          onKeyUp: null,
          onLanguageChange: null,
          onLoad: null,
          onLoadedData: null,
          onLoadedMetadata: null,
          onLoadEnd: null,
          onLoadStart: null,
          onMessage: null,
          onMessageError: null,
          onMouseDown: null,
          onMouseEnter: null,
          onMouseLeave: null,
          onMouseMove: null,
          onMouseOut: null,
          onMouseOver: null,
          onMouseUp: null,
          onOffline: null,
          onOnline: null,
          onPageHide: null,
          onPageShow: null,
          onPaste: null,
          onPause: null,
          onPlay: null,
          onPlaying: null,
          onPopState: null,
          onProgress: null,
          onRateChange: null,
          onRejectionHandled: null,
          onReset: null,
          onResize: null,
          onScroll: null,
          onScrollEnd: null,
          onSecurityPolicyViolation: null,
          onSeeked: null,
          onSeeking: null,
          onSelect: null,
          onSlotChange: null,
          onStalled: null,
          onStorage: null,
          onSubmit: null,
          onSuspend: null,
          onTimeUpdate: null,
          onToggle: null,
          onUnhandledRejection: null,
          onUnload: null,
          onVolumeChange: null,
          onWaiting: null,
          onWheel: null,
          open: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          optimum: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          pattern: null,
          ping: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          placeholder: null,
          playsInline: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          popover: null,
          popoverTarget: null,
          popoverTargetAction: null,
          poster: null,
          preload: null,
          readOnly: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          referrerPolicy: null,
          rel: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          required: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          reversed: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          rows: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          rowSpan: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          sandbox: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          scope: null,
          scoped: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          seamless: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          selected: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          shadowRootClonable: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          shadowRootDelegatesFocus: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          shadowRootMode: null,
          shape: null,
          size: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          sizes: null,
          slot: null,
          span: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          spellCheck: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          src: null,
          srcDoc: null,
          srcLang: null,
          srcSet: null,
          start: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          step: null,
          style: null,
          tabIndex: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          target: null,
          title: null,
          translate: null,
          type: null,
          typeMustMatch: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          useMap: null,
          value: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish,
          width: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          wrap: null,
          writingSuggestions: null,

    // Legacy.
    // See: https://html.spec.whatwg.org/#other-elements,-attributes-and-apis
          align: null, // Several. Use CSS `text-align` instead,
          aLink: null, // `<body>`. Use CSS `a:active {color}` instead
          archive: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated, // `<object>`. List of URIs to archives
          axis: null, // `<td>` and `<th>`. Use `scope` on `<th>`
          background: null, // `<body>`. Use CSS `background-image` instead
          bgColor: null, // `<body>` and table elements. Use CSS `background-color` instead
          border: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number, // `<table>`. Use CSS `border-width` instead,
          borderColor: null, // `<table>`. Use CSS `border-color` instead,
          bottomMargin: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number, // `<body>`
          cellPadding: null, // `<table>`
          cellSpacing: null, // `<table>`
          char: null, // Several table elements. When `align=char`, sets the character to align on
          charOff: null, // Several table elements. When `char`, offsets the alignment
          classId: null, // `<object>`
          clear: null, // `<br>`. Use CSS `clear` instead
          code: null, // `<object>`
          codeBase: null, // `<object>`
          codeType: null, // `<object>`
          color: null, // `<font>` and `<hr>`. Use CSS instead
          compact: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean, // Lists. Use CSS to reduce space between items instead
          declare: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean, // `<object>`
          event: null, // `<script>`
          face: null, // `<font>`. Use CSS instead
          frame: null, // `<table>`
          frameBorder: null, // `<iframe>`. Use CSS `border` instead
          hSpace: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number, // `<img>` and `<object>`
          leftMargin: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number, // `<body>`
          link: null, // `<body>`. Use CSS `a:link {color: *}` instead
          longDesc: null, // `<frame>`, `<iframe>`, and `<img>`. Use an `<a>`
          lowSrc: null, // `<img>`. Use a `<picture>`
          marginHeight: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number, // `<body>`
          marginWidth: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number, // `<body>`
          noResize: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean, // `<frame>`
          noHref: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean, // `<area>`. Use no href instead of an explicit `nohref`
          noShade: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean, // `<hr>`. Use background-color and height instead of borders
          noWrap: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean, // `<td>` and `<th>`
          object: null, // `<applet>`
          profile: null, // `<head>`
          prompt: null, // `<isindex>`
          rev: null, // `<link>`
          rightMargin: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number, // `<body>`
          rules: null, // `<table>`
          scheme: null, // `<meta>`
          scrolling: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.booleanish, // `<frame>`. Use overflow in the child context
          standby: null, // `<object>`
          summary: null, // `<table>`
          text: null, // `<body>`. Use CSS `color` instead
          topMargin: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number, // `<body>`
          valueType: null, // `<param>`
          version: null, // `<html>`. Use a doctype.
          vAlign: null, // Several. Use CSS `vertical-align` instead
          vLink: null, // `<body>`. Use CSS `a:visited {color}` instead
          vSpace: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number, // `<img>` and `<object>`

    // Non-standard Properties.
          allowTransparency: null,
          autoCorrect: null,
          autoSave: null,
          disablePictureInPicture: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          disableRemotePlayback: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          prefix: null,
          property: null,
          results: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          security: null,
          unselectable: null
        }
      })


/***/ }),

/***/ "./node_modules/property-information/lib/normalize.js":
/*!************************************************************!*\
  !*** ./node_modules/property-information/lib/normalize.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   normalize: () => (/* binding */ normalize)
/* harmony export */ });
/**
 * @param {string} value
 * @returns {string}
 */
      function normalize(value) {
        return value.toLowerCase()
      }


/***/ }),

/***/ "./node_modules/property-information/lib/svg.js":
/*!******************************************************!*\
  !*** ./node_modules/property-information/lib/svg.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   svg: () => (/* binding */ svg)
/* harmony export */ });
/* harmony import */ const _util_types_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util/types.js */ "./node_modules/property-information/lib/util/types.js");
/* harmony import */ const _util_create_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util/create.js */ "./node_modules/property-information/lib/util/create.js");
/* harmony import */ const _util_case_sensitive_transform_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util/case-sensitive-transform.js */ "./node_modules/property-information/lib/util/case-sensitive-transform.js");




      const svg = (0,_util_create_js__WEBPACK_IMPORTED_MODULE_1__.create)({
        space: 'svg',
        attributes: {
          accentHeight: 'accent-height',
          alignmentBaseline: 'alignment-baseline',
          arabicForm: 'arabic-form',
          baselineShift: 'baseline-shift',
          capHeight: 'cap-height',
          className: 'class',
          clipPath: 'clip-path',
          clipRule: 'clip-rule',
          colorInterpolation: 'color-interpolation',
          colorInterpolationFilters: 'color-interpolation-filters',
          colorProfile: 'color-profile',
          colorRendering: 'color-rendering',
          crossOrigin: 'crossorigin',
          dataType: 'datatype',
          dominantBaseline: 'dominant-baseline',
          enableBackground: 'enable-background',
          fillOpacity: 'fill-opacity',
          fillRule: 'fill-rule',
          floodColor: 'flood-color',
          floodOpacity: 'flood-opacity',
          fontFamily: 'font-family',
          fontSize: 'font-size',
          fontSizeAdjust: 'font-size-adjust',
          fontStretch: 'font-stretch',
          fontStyle: 'font-style',
          fontVariant: 'font-variant',
          fontWeight: 'font-weight',
          glyphName: 'glyph-name',
          glyphOrientationHorizontal: 'glyph-orientation-horizontal',
          glyphOrientationVertical: 'glyph-orientation-vertical',
          hrefLang: 'hreflang',
          horizAdvX: 'horiz-adv-x',
          horizOriginX: 'horiz-origin-x',
          horizOriginY: 'horiz-origin-y',
          imageRendering: 'image-rendering',
          letterSpacing: 'letter-spacing',
          lightingColor: 'lighting-color',
          markerEnd: 'marker-end',
          markerMid: 'marker-mid',
          markerStart: 'marker-start',
          navDown: 'nav-down',
          navDownLeft: 'nav-down-left',
          navDownRight: 'nav-down-right',
          navLeft: 'nav-left',
          navNext: 'nav-next',
          navPrev: 'nav-prev',
          navRight: 'nav-right',
          navUp: 'nav-up',
          navUpLeft: 'nav-up-left',
          navUpRight: 'nav-up-right',
          onAbort: 'onabort',
          onActivate: 'onactivate',
          onAfterPrint: 'onafterprint',
          onBeforePrint: 'onbeforeprint',
          onBegin: 'onbegin',
          onCancel: 'oncancel',
          onCanPlay: 'oncanplay',
          onCanPlayThrough: 'oncanplaythrough',
          onChange: 'onchange',
          onClick: 'onclick',
          onClose: 'onclose',
          onCopy: 'oncopy',
          onCueChange: 'oncuechange',
          onCut: 'oncut',
          onDblClick: 'ondblclick',
          onDrag: 'ondrag',
          onDragEnd: 'ondragend',
          onDragEnter: 'ondragenter',
          onDragExit: 'ondragexit',
          onDragLeave: 'ondragleave',
          onDragOver: 'ondragover',
          onDragStart: 'ondragstart',
          onDrop: 'ondrop',
          onDurationChange: 'ondurationchange',
          onEmptied: 'onemptied',
          onEnd: 'onend',
          onEnded: 'onended',
          onError: 'onerror',
          onFocus: 'onfocus',
          onFocusIn: 'onfocusin',
          onFocusOut: 'onfocusout',
          onHashChange: 'onhashchange',
          onInput: 'oninput',
          onInvalid: 'oninvalid',
          onKeyDown: 'onkeydown',
          onKeyPress: 'onkeypress',
          onKeyUp: 'onkeyup',
          onLoad: 'onload',
          onLoadedData: 'onloadeddata',
          onLoadedMetadata: 'onloadedmetadata',
          onLoadStart: 'onloadstart',
          onMessage: 'onmessage',
          onMouseDown: 'onmousedown',
          onMouseEnter: 'onmouseenter',
          onMouseLeave: 'onmouseleave',
          onMouseMove: 'onmousemove',
          onMouseOut: 'onmouseout',
          onMouseOver: 'onmouseover',
          onMouseUp: 'onmouseup',
          onMouseWheel: 'onmousewheel',
          onOffline: 'onoffline',
          onOnline: 'ononline',
          onPageHide: 'onpagehide',
          onPageShow: 'onpageshow',
          onPaste: 'onpaste',
          onPause: 'onpause',
          onPlay: 'onplay',
          onPlaying: 'onplaying',
          onPopState: 'onpopstate',
          onProgress: 'onprogress',
          onRateChange: 'onratechange',
          onRepeat: 'onrepeat',
          onReset: 'onreset',
          onResize: 'onresize',
          onScroll: 'onscroll',
          onSeeked: 'onseeked',
          onSeeking: 'onseeking',
          onSelect: 'onselect',
          onShow: 'onshow',
          onStalled: 'onstalled',
          onStorage: 'onstorage',
          onSubmit: 'onsubmit',
          onSuspend: 'onsuspend',
          onTimeUpdate: 'ontimeupdate',
          onToggle: 'ontoggle',
          onUnload: 'onunload',
          onVolumeChange: 'onvolumechange',
          onWaiting: 'onwaiting',
          onZoom: 'onzoom',
          overlinePosition: 'overline-position',
          overlineThickness: 'overline-thickness',
          paintOrder: 'paint-order',
          panose1: 'panose-1',
          pointerEvents: 'pointer-events',
          referrerPolicy: 'referrerpolicy',
          renderingIntent: 'rendering-intent',
          shapeRendering: 'shape-rendering',
          stopColor: 'stop-color',
          stopOpacity: 'stop-opacity',
          strikethroughPosition: 'strikethrough-position',
          strikethroughThickness: 'strikethrough-thickness',
          strokeDashArray: 'stroke-dasharray',
          strokeDashOffset: 'stroke-dashoffset',
          strokeLineCap: 'stroke-linecap',
          strokeLineJoin: 'stroke-linejoin',
          strokeMiterLimit: 'stroke-miterlimit',
          strokeOpacity: 'stroke-opacity',
          strokeWidth: 'stroke-width',
          tabIndex: 'tabindex',
          textAnchor: 'text-anchor',
          textDecoration: 'text-decoration',
          textRendering: 'text-rendering',
          transformOrigin: 'transform-origin',
          typeOf: 'typeof',
          underlinePosition: 'underline-position',
          underlineThickness: 'underline-thickness',
          unicodeBidi: 'unicode-bidi',
          unicodeRange: 'unicode-range',
          unitsPerEm: 'units-per-em',
          vAlphabetic: 'v-alphabetic',
          vHanging: 'v-hanging',
          vIdeographic: 'v-ideographic',
          vMathematical: 'v-mathematical',
          vectorEffect: 'vector-effect',
          vertAdvY: 'vert-adv-y',
          vertOriginX: 'vert-origin-x',
          vertOriginY: 'vert-origin-y',
          wordSpacing: 'word-spacing',
          writingMode: 'writing-mode',
          xHeight: 'x-height',
    // These were camelcased in Tiny. Now lowercased in SVG 2
          playbackOrder: 'playbackorder',
          timelineBegin: 'timelinebegin'
        },
        transform: _util_case_sensitive_transform_js__WEBPACK_IMPORTED_MODULE_2__.caseSensitiveTransform,
        properties: {
          about: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          accentHeight: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          accumulate: null,
          additive: null,
          alignmentBaseline: null,
          alphabetic: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          amplitude: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          arabicForm: null,
          ascent: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          attributeName: null,
          attributeType: null,
          azimuth: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          bandwidth: null,
          baselineShift: null,
          baseFrequency: null,
          baseProfile: null,
          bbox: null,
          begin: null,
          bias: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          by: null,
          calcMode: null,
          capHeight: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          className: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          clip: null,
          clipPath: null,
          clipPathUnits: null,
          clipRule: null,
          color: null,
          colorInterpolation: null,
          colorInterpolationFilters: null,
          colorProfile: null,
          colorRendering: null,
          content: null,
          contentScriptType: null,
          contentStyleType: null,
          crossOrigin: null,
          cursor: null,
          cx: null,
          cy: null,
          d: null,
          dataType: null,
          defaultAction: null,
          descent: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          diffuseConstant: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          direction: null,
          display: null,
          dur: null,
          divisor: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          dominantBaseline: null,
          download: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.boolean,
          dx: null,
          dy: null,
          edgeMode: null,
          editable: null,
          elevation: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          enableBackground: null,
          end: null,
          event: null,
          exponent: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          externalResourcesRequired: null,
          fill: null,
          fillOpacity: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          fillRule: null,
          filter: null,
          filterRes: null,
          filterUnits: null,
          floodColor: null,
          floodOpacity: null,
          focusable: null,
          focusHighlight: null,
          fontFamily: null,
          fontSize: null,
          fontSizeAdjust: null,
          fontStretch: null,
          fontStyle: null,
          fontVariant: null,
          fontWeight: null,
          format: null,
          fr: null,
          from: null,
          fx: null,
          fy: null,
          g1: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaSeparated,
          g2: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaSeparated,
          glyphName: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaSeparated,
          glyphOrientationHorizontal: null,
          glyphOrientationVertical: null,
          glyphRef: null,
          gradientTransform: null,
          gradientUnits: null,
          handler: null,
          hanging: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          hatchContentUnits: null,
          hatchUnits: null,
          height: null,
          href: null,
          hrefLang: null,
          horizAdvX: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          horizOriginX: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          horizOriginY: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          id: null,
          ideographic: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          imageRendering: null,
          initialVisibility: null,
          in: null,
          in2: null,
          intercept: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          k: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          k1: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          k2: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          k3: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          k4: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          kernelMatrix: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          kernelUnitLength: null,
          keyPoints: null, // SEMI_COLON_SEPARATED
          keySplines: null, // SEMI_COLON_SEPARATED
          keyTimes: null, // SEMI_COLON_SEPARATED
          kerning: null,
          lang: null,
          lengthAdjust: null,
          letterSpacing: null,
          lightingColor: null,
          limitingConeAngle: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          local: null,
          markerEnd: null,
          markerMid: null,
          markerStart: null,
          markerHeight: null,
          markerUnits: null,
          markerWidth: null,
          mask: null,
          maskContentUnits: null,
          maskUnits: null,
          mathematical: null,
          max: null,
          media: null,
          mediaCharacterEncoding: null,
          mediaContentEncodings: null,
          mediaSize: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          mediaTime: null,
          method: null,
          min: null,
          mode: null,
          name: null,
          navDown: null,
          navDownLeft: null,
          navDownRight: null,
          navLeft: null,
          navNext: null,
          navPrev: null,
          navRight: null,
          navUp: null,
          navUpLeft: null,
          navUpRight: null,
          numOctaves: null,
          observer: null,
          offset: null,
          onAbort: null,
          onActivate: null,
          onAfterPrint: null,
          onBeforePrint: null,
          onBegin: null,
          onCancel: null,
          onCanPlay: null,
          onCanPlayThrough: null,
          onChange: null,
          onClick: null,
          onClose: null,
          onCopy: null,
          onCueChange: null,
          onCut: null,
          onDblClick: null,
          onDrag: null,
          onDragEnd: null,
          onDragEnter: null,
          onDragExit: null,
          onDragLeave: null,
          onDragOver: null,
          onDragStart: null,
          onDrop: null,
          onDurationChange: null,
          onEmptied: null,
          onEnd: null,
          onEnded: null,
          onError: null,
          onFocus: null,
          onFocusIn: null,
          onFocusOut: null,
          onHashChange: null,
          onInput: null,
          onInvalid: null,
          onKeyDown: null,
          onKeyPress: null,
          onKeyUp: null,
          onLoad: null,
          onLoadedData: null,
          onLoadedMetadata: null,
          onLoadStart: null,
          onMessage: null,
          onMouseDown: null,
          onMouseEnter: null,
          onMouseLeave: null,
          onMouseMove: null,
          onMouseOut: null,
          onMouseOver: null,
          onMouseUp: null,
          onMouseWheel: null,
          onOffline: null,
          onOnline: null,
          onPageHide: null,
          onPageShow: null,
          onPaste: null,
          onPause: null,
          onPlay: null,
          onPlaying: null,
          onPopState: null,
          onProgress: null,
          onRateChange: null,
          onRepeat: null,
          onReset: null,
          onResize: null,
          onScroll: null,
          onSeeked: null,
          onSeeking: null,
          onSelect: null,
          onShow: null,
          onStalled: null,
          onStorage: null,
          onSubmit: null,
          onSuspend: null,
          onTimeUpdate: null,
          onToggle: null,
          onUnload: null,
          onVolumeChange: null,
          onWaiting: null,
          onZoom: null,
          opacity: null,
          operator: null,
          order: null,
          orient: null,
          orientation: null,
          origin: null,
          overflow: null,
          overlay: null,
          overlinePosition: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          overlineThickness: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          paintOrder: null,
          panose1: null,
          path: null,
          pathLength: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          patternContentUnits: null,
          patternTransform: null,
          patternUnits: null,
          phase: null,
          ping: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.spaceSeparated,
          pitch: null,
          playbackOrder: null,
          pointerEvents: null,
          points: null,
          pointsAtX: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          pointsAtY: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          pointsAtZ: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          preserveAlpha: null,
          preserveAspectRatio: null,
          primitiveUnits: null,
          propagate: null,
          property: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          r: null,
          radius: null,
          referrerPolicy: null,
          refX: null,
          refY: null,
          rel: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          rev: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          renderingIntent: null,
          repeatCount: null,
          repeatDur: null,
          requiredExtensions: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          requiredFeatures: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          requiredFonts: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          requiredFormats: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          resource: null,
          restart: null,
          result: null,
          rotate: null,
          rx: null,
          ry: null,
          scale: null,
          seed: null,
          shapeRendering: null,
          side: null,
          slope: null,
          snapshotTime: null,
          specularConstant: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          specularExponent: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          spreadMethod: null,
          spacing: null,
          startOffset: null,
          stdDeviation: null,
          stemh: null,
          stemv: null,
          stitchTiles: null,
          stopColor: null,
          stopOpacity: null,
          strikethroughPosition: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          strikethroughThickness: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          string: null,
          stroke: null,
          strokeDashArray: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          strokeDashOffset: null,
          strokeLineCap: null,
          strokeLineJoin: null,
          strokeMiterLimit: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          strokeOpacity: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          strokeWidth: null,
          style: null,
          surfaceScale: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          syncBehavior: null,
          syncBehaviorDefault: null,
          syncMaster: null,
          syncTolerance: null,
          syncToleranceDefault: null,
          systemLanguage: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          tabIndex: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          tableValues: null,
          target: null,
          targetX: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          targetY: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          textAnchor: null,
          textDecoration: null,
          textRendering: null,
          textLength: null,
          timelineBegin: null,
          title: null,
          transformBehavior: null,
          type: null,
          typeOf: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.commaOrSpaceSeparated,
          to: null,
          transform: null,
          transformOrigin: null,
          u1: null,
          u2: null,
          underlinePosition: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          underlineThickness: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          unicode: null,
          unicodeBidi: null,
          unicodeRange: null,
          unitsPerEm: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          values: null,
          vAlphabetic: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          vMathematical: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          vectorEffect: null,
          vHanging: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          vIdeographic: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          version: null,
          vertAdvY: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          vertOriginX: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          vertOriginY: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          viewBox: null,
          viewTarget: null,
          visibility: null,
          width: null,
          widths: null,
          wordSpacing: null,
          writingMode: null,
          x: null,
          x1: null,
          x2: null,
          xChannelSelector: null,
          xHeight: _util_types_js__WEBPACK_IMPORTED_MODULE_0__.number,
          y: null,
          y1: null,
          y2: null,
          yChannelSelector: null,
          z: null,
          zoomAndPan: null
        }
      })


/***/ }),

/***/ "./node_modules/property-information/lib/util/case-insensitive-transform.js":
/*!**********************************************************************************!*\
  !*** ./node_modules/property-information/lib/util/case-insensitive-transform.js ***!
  \**********************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   caseInsensitiveTransform: () => (/* binding */ caseInsensitiveTransform)
/* harmony export */ });
/* harmony import */ const _case_sensitive_transform_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./case-sensitive-transform.js */ "./node_modules/property-information/lib/util/case-sensitive-transform.js");


/**
 * @param {Record<string, string>} attributes
 * @param {string} property
 * @returns {string}
 */
      function caseInsensitiveTransform(attributes, property) {
        return (0,_case_sensitive_transform_js__WEBPACK_IMPORTED_MODULE_0__.caseSensitiveTransform)(attributes, property.toLowerCase())
      }


/***/ }),

/***/ "./node_modules/property-information/lib/util/case-sensitive-transform.js":
/*!********************************************************************************!*\
  !*** ./node_modules/property-information/lib/util/case-sensitive-transform.js ***!
  \********************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   caseSensitiveTransform: () => (/* binding */ caseSensitiveTransform)
/* harmony export */ });
/**
 * @param {Record<string, string>} attributes
 * @param {string} attribute
 * @returns {string}
 */
      function caseSensitiveTransform(attributes, attribute) {
        return attribute in attributes ? attributes[attribute] : attribute
      }


/***/ }),

/***/ "./node_modules/property-information/lib/util/create.js":
/*!**************************************************************!*\
  !*** ./node_modules/property-information/lib/util/create.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   create: () => (/* binding */ create)
/* harmony export */ });
/* harmony import */ const _normalize_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../normalize.js */ "./node_modules/property-information/lib/normalize.js");
/* harmony import */ const _schema_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./schema.js */ "./node_modules/property-information/lib/util/schema.js");
/* harmony import */ const _defined_info_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./defined-info.js */ "./node_modules/property-information/lib/util/defined-info.js");
/**
 * @typedef {import('./schema.js').Properties} Properties
 * @typedef {import('./schema.js').Normal} Normal
 *
 * @typedef {Record<string, string>} Attributes
 *
 * @typedef {Object} Definition
 * @property {Record<string, number|null>} properties
 * @property {(attributes: Attributes, property: string) => string} transform
 * @property {string} [space]
 * @property {Attributes} [attributes]
 * @property {Array<string>} [mustUseProperty]
 */





      const own = {}.hasOwnProperty

/**
 * @param {Definition} definition
 * @returns {Schema}
 */
      function create(definition) {
  /** @type {Properties} */
        const property = {}
  /** @type {Normal} */
        const normal = {}
  /** @type {string} */
        let prop

        for (prop in definition.properties) {
          if (own.call(definition.properties, prop)) {
            const value = definition.properties[prop]
            const info = new _defined_info_js__WEBPACK_IMPORTED_MODULE_2__.DefinedInfo(
              prop,
              definition.transform(definition.attributes || {}, prop),
              value,
              definition.space
            )

            if (
              definition.mustUseProperty &&
        definition.mustUseProperty.includes(prop)
            ) {
              info.mustUseProperty = true
            }

            property[prop] = info

            normal[(0,_normalize_js__WEBPACK_IMPORTED_MODULE_0__.normalize)(prop)] = prop
            normal[(0,_normalize_js__WEBPACK_IMPORTED_MODULE_0__.normalize)(info.attribute)] = prop
          }
        }

        return new _schema_js__WEBPACK_IMPORTED_MODULE_1__.Schema(property, normal, definition.space)
      }


/***/ }),

/***/ "./node_modules/property-information/lib/util/defined-info.js":
/*!********************************************************************!*\
  !*** ./node_modules/property-information/lib/util/defined-info.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DefinedInfo: () => (/* binding */ DefinedInfo)
/* harmony export */ });
/* harmony import */ const _info_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./info.js */ "./node_modules/property-information/lib/util/info.js");
/* harmony import */ const _types_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./types.js */ "./node_modules/property-information/lib/util/types.js");



/** @type {Array<keyof types>} */
// @ts-expect-error: hush.
      const checks = Object.keys(_types_js__WEBPACK_IMPORTED_MODULE_1__)

      class DefinedInfo extends _info_js__WEBPACK_IMPORTED_MODULE_0__.Info {
  /**
   * @constructor
   * @param {string} property
   * @param {string} attribute
   * @param {number|null} [mask]
   * @param {string} [space]
   */
        constructor(property, attribute, mask, space) {
          let index = -1

          super(property, attribute)

          mark(this, 'space', space)

          if (typeof mask === 'number') {
            while (++index < checks.length) {
              const check = checks[index]
              mark(this, checks[index], (mask & _types_js__WEBPACK_IMPORTED_MODULE_1__[check]) === _types_js__WEBPACK_IMPORTED_MODULE_1__[check])
            }
          }
        }
      }

      DefinedInfo.prototype.defined = true

/**
 * @param {DefinedInfo} values
 * @param {string} key
 * @param {unknown} value
 */
      function mark(values, key, value) {
        if (value) {
    // @ts-expect-error: assume `value` matches the expected value of `key`.
          values[key] = value
        }
      }


/***/ }),

/***/ "./node_modules/property-information/lib/util/info.js":
/*!************************************************************!*\
  !*** ./node_modules/property-information/lib/util/info.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Info: () => (/* binding */ Info)
/* harmony export */ });
      class Info {
  /**
   * @constructor
   * @param {string} property
   * @param {string} attribute
   */
        constructor(property, attribute) {
    /** @type {string} */
          this.property = property
    /** @type {string} */
          this.attribute = attribute
        }
      }

/** @type {string|null} */
      Info.prototype.space = null
      Info.prototype.boolean = false
      Info.prototype.booleanish = false
      Info.prototype.overloadedBoolean = false
      Info.prototype.number = false
      Info.prototype.commaSeparated = false
      Info.prototype.spaceSeparated = false
      Info.prototype.commaOrSpaceSeparated = false
      Info.prototype.mustUseProperty = false
      Info.prototype.defined = false


/***/ }),

/***/ "./node_modules/property-information/lib/util/merge.js":
/*!*************************************************************!*\
  !*** ./node_modules/property-information/lib/util/merge.js ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   merge: () => (/* binding */ merge)
/* harmony export */ });
/* harmony import */ const _schema_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./schema.js */ "./node_modules/property-information/lib/util/schema.js");
/**
 * @typedef {import('./schema.js').Properties} Properties
 * @typedef {import('./schema.js').Normal} Normal
 */



/**
 * @param {Schema[]} definitions
 * @param {string} [space]
 * @returns {Schema}
 */
      function merge(definitions, space) {
  /** @type {Properties} */
        const property = {}
  /** @type {Normal} */
        const normal = {}
        let index = -1

        while (++index < definitions.length) {
          Object.assign(property, definitions[index].property)
          Object.assign(normal, definitions[index].normal)
        }

        return new _schema_js__WEBPACK_IMPORTED_MODULE_0__.Schema(property, normal, space)
      }


/***/ }),

/***/ "./node_modules/property-information/lib/util/schema.js":
/*!**************************************************************!*\
  !*** ./node_modules/property-information/lib/util/schema.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Schema: () => (/* binding */ Schema)
/* harmony export */ });
/**
 * @typedef {import('./info.js').Info} Info
 * @typedef {Record<string, Info>} Properties
 * @typedef {Record<string, string>} Normal
 */

      class Schema {
  /**
   * @constructor
   * @param {Properties} property
   * @param {Normal} normal
   * @param {string} [space]
   */
        constructor(property, normal, space) {
          this.property = property
          this.normal = normal
          if (space) {
            this.space = space
          }
        }
      }

/** @type {Properties} */
      Schema.prototype.property = {}
/** @type {Normal} */
      Schema.prototype.normal = {}
/** @type {string|null} */
      Schema.prototype.space = null


/***/ }),

/***/ "./node_modules/property-information/lib/util/types.js":
/*!*************************************************************!*\
  !*** ./node_modules/property-information/lib/util/types.js ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   boolean: () => (/* binding */ boolean),
/* harmony export */   booleanish: () => (/* binding */ booleanish),
/* harmony export */   commaOrSpaceSeparated: () => (/* binding */ commaOrSpaceSeparated),
/* harmony export */   commaSeparated: () => (/* binding */ commaSeparated),
/* harmony export */   number: () => (/* binding */ number),
/* harmony export */   overloadedBoolean: () => (/* binding */ overloadedBoolean),
/* harmony export */   spaceSeparated: () => (/* binding */ spaceSeparated)
/* harmony export */ });
      let powers = 0

      const boolean = increment()
      const booleanish = increment()
      const overloadedBoolean = increment()
      const number = increment()
      const spaceSeparated = increment()
      const commaSeparated = increment()
      const commaOrSpaceSeparated = increment()

      function increment() {
        return 2 ** ++powers
      }


/***/ }),

/***/ "./node_modules/property-information/lib/xlink.js":
/*!********************************************************!*\
  !*** ./node_modules/property-information/lib/xlink.js ***!
  \********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   xlink: () => (/* binding */ xlink)
/* harmony export */ });
/* harmony import */ const _util_create_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util/create.js */ "./node_modules/property-information/lib/util/create.js");


      const xlink = (0,_util_create_js__WEBPACK_IMPORTED_MODULE_0__.create)({
        space: 'xlink',
        transform(_, prop) {
          return 'xlink:' + prop.slice(5).toLowerCase()
        },
        properties: {
          xLinkActuate: null,
          xLinkArcRole: null,
          xLinkHref: null,
          xLinkRole: null,
          xLinkShow: null,
          xLinkTitle: null,
          xLinkType: null
        }
      })


/***/ }),

/***/ "./node_modules/property-information/lib/xml.js":
/*!******************************************************!*\
  !*** ./node_modules/property-information/lib/xml.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   xml: () => (/* binding */ xml)
/* harmony export */ });
/* harmony import */ const _util_create_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util/create.js */ "./node_modules/property-information/lib/util/create.js");


      const xml = (0,_util_create_js__WEBPACK_IMPORTED_MODULE_0__.create)({
        space: 'xml',
        transform(_, prop) {
          return 'xml:' + prop.slice(3).toLowerCase()
        },
        properties: {xmlLang: null, xmlBase: null, xmlSpace: null}
      })


/***/ }),

/***/ "./node_modules/property-information/lib/xmlns.js":
/*!********************************************************!*\
  !*** ./node_modules/property-information/lib/xmlns.js ***!
  \********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   xmlns: () => (/* binding */ xmlns)
/* harmony export */ });
/* harmony import */ const _util_create_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util/create.js */ "./node_modules/property-information/lib/util/create.js");
/* harmony import */ const _util_case_insensitive_transform_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util/case-insensitive-transform.js */ "./node_modules/property-information/lib/util/case-insensitive-transform.js");



      const xmlns = (0,_util_create_js__WEBPACK_IMPORTED_MODULE_0__.create)({
        space: 'xmlns',
        attributes: {xmlnsxlink: 'xmlns:xlink'},
        transform: _util_case_insensitive_transform_js__WEBPACK_IMPORTED_MODULE_1__.caseInsensitiveTransform,
        properties: {xmlns: null, xmlnsXLink: null}
      })


/***/ }),

/***/ "./node_modules/react-is/cjs/react-is.development.js":
/*!***********************************************************!*\
  !*** ./node_modules/react-is/cjs/react-is.development.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, exports) => {

      "use strict";
/** @license React v16.13.1
 * react-is.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */





      if (true) {
        (function() {
          'use strict';

// The Symbol used to tag the ReactElement-like types. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
          const hasSymbol = typeof Symbol === 'function' && Symbol.for;
          const REACT_ELEMENT_TYPE = hasSymbol ? Symbol.for('react.element') : 0xeac7;
          const REACT_PORTAL_TYPE = hasSymbol ? Symbol.for('react.portal') : 0xeaca;
          const REACT_FRAGMENT_TYPE = hasSymbol ? Symbol.for('react.fragment') : 0xeacb;
          const REACT_STRICT_MODE_TYPE = hasSymbol ? Symbol.for('react.strict_mode') : 0xeacc;
          const REACT_PROFILER_TYPE = hasSymbol ? Symbol.for('react.profiler') : 0xead2;
          const REACT_PROVIDER_TYPE = hasSymbol ? Symbol.for('react.provider') : 0xeacd;
          const REACT_CONTEXT_TYPE = hasSymbol ? Symbol.for('react.context') : 0xeace; // TODO: We don't use AsyncMode or ConcurrentMode anymore. They were temporary
// (unstable) APIs that have been removed. Can we remove the symbols?

          const REACT_ASYNC_MODE_TYPE = hasSymbol ? Symbol.for('react.async_mode') : 0xeacf;
          const REACT_CONCURRENT_MODE_TYPE = hasSymbol ? Symbol.for('react.concurrent_mode') : 0xeacf;
          const REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol.for('react.forward_ref') : 0xead0;
          const REACT_SUSPENSE_TYPE = hasSymbol ? Symbol.for('react.suspense') : 0xead1;
          const REACT_SUSPENSE_LIST_TYPE = hasSymbol ? Symbol.for('react.suspense_list') : 0xead8;
          const REACT_MEMO_TYPE = hasSymbol ? Symbol.for('react.memo') : 0xead3;
          const REACT_LAZY_TYPE = hasSymbol ? Symbol.for('react.lazy') : 0xead4;
          const REACT_BLOCK_TYPE = hasSymbol ? Symbol.for('react.block') : 0xead9;
          const REACT_FUNDAMENTAL_TYPE = hasSymbol ? Symbol.for('react.fundamental') : 0xead5;
          const REACT_RESPONDER_TYPE = hasSymbol ? Symbol.for('react.responder') : 0xead6;
          const REACT_SCOPE_TYPE = hasSymbol ? Symbol.for('react.scope') : 0xead7;

          function isValidElementType(type) {
            return typeof type === 'string' || typeof type === 'function' || // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.
  type === REACT_FRAGMENT_TYPE || type === REACT_CONCURRENT_MODE_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || typeof type === 'object' && type !== null && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_FUNDAMENTAL_TYPE || type.$$typeof === REACT_RESPONDER_TYPE || type.$$typeof === REACT_SCOPE_TYPE || type.$$typeof === REACT_BLOCK_TYPE);
          }

          function typeOf(object) {
            if (typeof object === 'object' && object !== null) {
              const $$typeof = object.$$typeof;

              switch ($$typeof) {
                case REACT_ELEMENT_TYPE:
                  var type = object.type;

                  switch (type) {
                    case REACT_ASYNC_MODE_TYPE:
                    case REACT_CONCURRENT_MODE_TYPE:
                    case REACT_FRAGMENT_TYPE:
                    case REACT_PROFILER_TYPE:
                    case REACT_STRICT_MODE_TYPE:
                    case REACT_SUSPENSE_TYPE:
                      return type;

                    default:
                      var $$typeofType = type && type.$$typeof;

                      switch ($$typeofType) {
                        case REACT_CONTEXT_TYPE:
                        case REACT_FORWARD_REF_TYPE:
                        case REACT_LAZY_TYPE:
                        case REACT_MEMO_TYPE:
                        case REACT_PROVIDER_TYPE:
                          return $$typeofType;

                        default:
                          return $$typeof;
                      }

                  }

                case REACT_PORTAL_TYPE:
                  return $$typeof;
              }
            }

            return undefined;
          } // AsyncMode is deprecated along with isAsyncMode

          const AsyncMode = REACT_ASYNC_MODE_TYPE;
          const ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;
          const ContextConsumer = REACT_CONTEXT_TYPE;
          const ContextProvider = REACT_PROVIDER_TYPE;
          const Element = REACT_ELEMENT_TYPE;
          const ForwardRef = REACT_FORWARD_REF_TYPE;
          const Fragment = REACT_FRAGMENT_TYPE;
          const Lazy = REACT_LAZY_TYPE;
          const Memo = REACT_MEMO_TYPE;
          const Portal = REACT_PORTAL_TYPE;
          const Profiler = REACT_PROFILER_TYPE;
          const StrictMode = REACT_STRICT_MODE_TYPE;
          const Suspense = REACT_SUSPENSE_TYPE;
          let hasWarnedAboutDeprecatedIsAsyncMode = false; // AsyncMode should be deprecated

          function isAsyncMode(object) {
            {
              if (!hasWarnedAboutDeprecatedIsAsyncMode) {
                hasWarnedAboutDeprecatedIsAsyncMode = true; // Using console['warn'] to evade Babel and ESLint

                console['warn']('The ReactIs.isAsyncMode() alias has been deprecated, ' + 'and will be removed in React 17+. Update your code to use ' + 'ReactIs.isConcurrentMode() instead. It has the exact same API.');
              }
            }

            return isConcurrentMode(object) || typeOf(object) === REACT_ASYNC_MODE_TYPE;
          }
          function isConcurrentMode(object) {
            return typeOf(object) === REACT_CONCURRENT_MODE_TYPE;
          }
          function isContextConsumer(object) {
            return typeOf(object) === REACT_CONTEXT_TYPE;
          }
          function isContextProvider(object) {
            return typeOf(object) === REACT_PROVIDER_TYPE;
          }
          function isElement(object) {
            return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
          }
          function isForwardRef(object) {
            return typeOf(object) === REACT_FORWARD_REF_TYPE;
          }
          function isFragment(object) {
            return typeOf(object) === REACT_FRAGMENT_TYPE;
          }
          function isLazy(object) {
            return typeOf(object) === REACT_LAZY_TYPE;
          }
          function isMemo(object) {
            return typeOf(object) === REACT_MEMO_TYPE;
          }
          function isPortal(object) {
            return typeOf(object) === REACT_PORTAL_TYPE;
          }
          function isProfiler(object) {
            return typeOf(object) === REACT_PROFILER_TYPE;
          }
          function isStrictMode(object) {
            return typeOf(object) === REACT_STRICT_MODE_TYPE;
          }
          function isSuspense(object) {
            return typeOf(object) === REACT_SUSPENSE_TYPE;
          }

          exports.AsyncMode = AsyncMode;
          exports.ConcurrentMode = ConcurrentMode;
          exports.ContextConsumer = ContextConsumer;
          exports.ContextProvider = ContextProvider;
          exports.Element = Element;
          exports.ForwardRef = ForwardRef;
          exports.Fragment = Fragment;
          exports.Lazy = Lazy;
          exports.Memo = Memo;
          exports.Portal = Portal;
          exports.Profiler = Profiler;
          exports.StrictMode = StrictMode;
          exports.Suspense = Suspense;
          exports.isAsyncMode = isAsyncMode;
          exports.isConcurrentMode = isConcurrentMode;
          exports.isContextConsumer = isContextConsumer;
          exports.isContextProvider = isContextProvider;
          exports.isElement = isElement;
          exports.isForwardRef = isForwardRef;
          exports.isFragment = isFragment;
          exports.isLazy = isLazy;
          exports.isMemo = isMemo;
          exports.isPortal = isPortal;
          exports.isProfiler = isProfiler;
          exports.isStrictMode = isStrictMode;
          exports.isSuspense = isSuspense;
          exports.isValidElementType = isValidElementType;
          exports.typeOf = typeOf;
        })();
      }


/***/ }),

/***/ "./node_modules/react-is/index.js":
/*!****************************************!*\
  !*** ./node_modules/react-is/index.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      if (false) // removed by dead control flow
      {} else {
        module.exports = __webpack_require__(/*! ./cjs/react-is.development.js */ "./node_modules/react-is/cjs/react-is.development.js");
      }


/***/ }),

/***/ "./node_modules/react-markdown/index.js":
/*!**********************************************!*\
  !*** ./node_modules/react-markdown/index.js ***!
  \**********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* reexport safe */ _lib_react_markdown_js__WEBPACK_IMPORTED_MODULE_1__.ReactMarkdown),
/* harmony export */   uriTransformer: () => (/* reexport safe */ _lib_uri_transformer_js__WEBPACK_IMPORTED_MODULE_0__.uriTransformer)
/* harmony export */ });
/* harmony import */ var _lib_uri_transformer_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./lib/uri-transformer.js */ "./node_modules/react-markdown/lib/uri-transformer.js");
/* harmony import */ var _lib_react_markdown_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./lib/react-markdown.js */ "./node_modules/react-markdown/lib/react-markdown.js");
/**
 * @typedef {import('./lib/react-markdown.js').ReactMarkdownOptions} Options
 * @typedef {import('./lib/ast-to-react.js').Components} Components
 */






/***/ }),

/***/ "./node_modules/react-markdown/lib/ast-to-react.js":
/*!*********************************************************!*\
  !*** ./node_modules/react-markdown/lib/ast-to-react.js ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   childrenToReact: () => (/* binding */ childrenToReact)
/* harmony export */ });
/* harmony import */ const react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ const react_is__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-is */ "./node_modules/react-markdown/node_modules/react-is/index.js");
/* harmony import */ const hast_util_whitespace__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! hast-util-whitespace */ "./node_modules/hast-util-whitespace/index.js");
/* harmony import */ const property_information__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! property-information */ "./node_modules/property-information/index.js");
/* harmony import */ const property_information__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! property-information */ "./node_modules/property-information/lib/find.js");
/* harmony import */ const property_information__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! property-information */ "./node_modules/property-information/lib/hast-to-react.js");
/* harmony import */ const space_separated_tokens__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! space-separated-tokens */ "./node_modules/space-separated-tokens/index.js");
/* harmony import */ const comma_separated_tokens__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! comma-separated-tokens */ "./node_modules/comma-separated-tokens/index.js");
/* harmony import */ const style_to_object__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! style-to-object */ "./node_modules/style-to-object/index.js");
/**
 * @template T
 * @typedef {import('react').ComponentType<T>} ComponentType<T>
 */

/**
 * @template T
 * @typedef {import('react').ComponentPropsWithoutRef<T>} ComponentPropsWithoutRef<T>
 */

/**
 * @typedef {import('react').ReactNode} ReactNode
 * @typedef {import('unist').Position} Position
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').ElementContent} ElementContent
 * @typedef {import('hast').Root} Root
 * @typedef {import('hast').Text} Text
 * @typedef {import('hast').Comment} Comment
 * @typedef {import('hast').DocType} Doctype
 * @typedef {import('property-information').Info} Info
 * @typedef {import('property-information').Schema} Schema
 * @typedef {import('./complex-types').ReactMarkdownProps} ReactMarkdownProps
 *
 * @typedef Raw
 * @property {'raw'} type
 * @property {string} value
 *
 * @typedef Context
 * @property {Options} options
 * @property {Schema} schema
 * @property {number} listDepth
 *
 * @callback TransformLink
 * @param {string} href
 * @param {Array<ElementContent>} children
 * @param {string?} title
 * @returns {string}
 *
 * @callback TransformImage
 * @param {string} src
 * @param {string} alt
 * @param {string?} title
 * @returns {string}
 *
 * @typedef {import('react').HTMLAttributeAnchorTarget} TransformLinkTargetType
 *
 * @callback TransformLinkTarget
 * @param {string} href
 * @param {Array<ElementContent>} children
 * @param {string?} title
 * @returns {TransformLinkTargetType|undefined}
 *
 * @typedef {keyof JSX.IntrinsicElements} ReactMarkdownNames
 *
 * To do: is `data-sourcepos` typeable?
 *
 * @typedef {ComponentPropsWithoutRef<'code'> & ReactMarkdownProps & {inline?: boolean}} CodeProps
 * @typedef {ComponentPropsWithoutRef<'h1'> & ReactMarkdownProps & {level: number}} HeadingProps
 * @typedef {ComponentPropsWithoutRef<'li'> & ReactMarkdownProps & {checked: boolean|null, index: number, ordered: boolean}} LiProps
 * @typedef {ComponentPropsWithoutRef<'ol'> & ReactMarkdownProps & {depth: number, ordered: true}} OrderedListProps
 * @typedef {ComponentPropsWithoutRef<'table'> & ReactMarkdownProps & {style?: Record<string, unknown>, isHeader: boolean}} TableCellProps
 * @typedef {ComponentPropsWithoutRef<'tr'> & ReactMarkdownProps & {isHeader: boolean}} TableRowProps
 * @typedef {ComponentPropsWithoutRef<'ul'> & ReactMarkdownProps & {depth: number, ordered: false}} UnorderedListProps
 *
 * @typedef {ComponentType<CodeProps>} CodeComponent
 * @typedef {ComponentType<HeadingProps>} HeadingComponent
 * @typedef {ComponentType<LiProps>} LiComponent
 * @typedef {ComponentType<OrderedListProps>} OrderedListComponent
 * @typedef {ComponentType<TableCellProps>} TableCellComponent
 * @typedef {ComponentType<TableRowProps>} TableRowComponent
 * @typedef {ComponentType<UnorderedListProps>} UnorderedListComponent
 *
 * @typedef SpecialComponents
 * @property {CodeComponent|ReactMarkdownNames} code
 * @property {HeadingComponent|ReactMarkdownNames} h1
 * @property {HeadingComponent|ReactMarkdownNames} h2
 * @property {HeadingComponent|ReactMarkdownNames} h3
 * @property {HeadingComponent|ReactMarkdownNames} h4
 * @property {HeadingComponent|ReactMarkdownNames} h5
 * @property {HeadingComponent|ReactMarkdownNames} h6
 * @property {LiComponent|ReactMarkdownNames} li
 * @property {OrderedListComponent|ReactMarkdownNames} ol
 * @property {TableCellComponent|ReactMarkdownNames} td
 * @property {TableCellComponent|ReactMarkdownNames} th
 * @property {TableRowComponent|ReactMarkdownNames} tr
 * @property {UnorderedListComponent|ReactMarkdownNames} ul
 *
 * @typedef {Partial<Omit<import('./complex-types').NormalComponents, keyof SpecialComponents> & SpecialComponents>} Components
 *
 * @typedef Options
 * @property {boolean} [sourcePos=false]
 * @property {boolean} [rawSourcePos=false]
 * @property {boolean} [skipHtml=false]
 * @property {boolean} [includeElementIndex=false]
 * @property {null|false|TransformLink} [transformLinkUri]
 * @property {TransformImage} [transformImageUri]
 * @property {TransformLinkTargetType|TransformLinkTarget} [linkTarget]
 * @property {Components} [components]
 */









      const own = {}.hasOwnProperty

// The table-related elements that must not contain whitespace text according
// to React.
      const tableElements = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr'])

/**
 * @param {Context} context
 * @param {Element|Root} node
 */
      function childrenToReact(context, node) {
  /** @type {Array<ReactNode>} */
        const children = []
        let childIndex = -1
  /** @type {Comment|Doctype|Element|Raw|Text} */
        let child

        while (++childIndex < node.children.length) {
          child = node.children[childIndex]

          if (child.type === 'element') {
            children.push(toReact(context, child, childIndex, node))
          } else if (child.type === 'text') {
      // Currently, a warning is triggered by react for *any* white space in
      // tables.
      // So we drop it.
      // See: <https://github.com/facebook/react/pull/7081>.
      // See: <https://github.com/facebook/react/pull/7515>.
      // See: <https://github.com/remarkjs/remark-react/issues/64>.
      // See: <https://github.com/remarkjs/react-markdown/issues/576>.
            if (
              node.type !== 'element' ||
        !tableElements.has(node.tagName) ||
        !(0,hast_util_whitespace__WEBPACK_IMPORTED_MODULE_2__.whitespace)(child)
            ) {
              children.push(child.value)
            }
          } else if (child.type === 'raw' && !context.options.skipHtml) {
      // Default behavior is to show (encoded) HTML.
            children.push(child.value)
          }
        }

        return children
      }

/**
 * @param {Context} context
 * @param {Element} node
 * @param {number} index
 * @param {Element|Root} parent
 */
      function toReact(context, node, index, parent) {
        const options = context.options
        const parentSchema = context.schema
  /** @type {ReactMarkdownNames} */
  // @ts-expect-error assume a known HTML/SVG element.
        const name = node.tagName
  /** @type {Record<string, unknown>} */
        const properties = {}
        let schema = parentSchema
  /** @type {string} */
        let property

        if (parentSchema.space === 'html' && name === 'svg') {
          schema = property_information__WEBPACK_IMPORTED_MODULE_3__.svg
          context.schema = schema
        }

        if (node.properties) {
          for (property in node.properties) {
            if (own.call(node.properties, property)) {
              addProperty(properties, property, node.properties[property], context)
            }
          }
        }

        if (name === 'ol' || name === 'ul') {
          context.listDepth++
        }

        const children = childrenToReact(context, node)

        if (name === 'ol' || name === 'ul') {
          context.listDepth--
        }

  // Restore parent schema.
        context.schema = parentSchema

  // Nodes created by plugins do not have positional info, in which case we use
  // an object that matches the position interface.
        const position = node.position || {
          start: {line: null, column: null, offset: null},
          end: {line: null, column: null, offset: null}
        }
        const component =
    options.components && own.call(options.components, name)
      ? options.components[name]
      : name
        const basic = typeof component === 'string' || component === react__WEBPACK_IMPORTED_MODULE_0__.Fragment

        if (!react_is__WEBPACK_IMPORTED_MODULE_1__.isValidElementType(component)) {
          throw new TypeError(
            `Component for name \`${name}\` not defined or is not renderable`
          )
        }

        properties.key = [
          name,
          position.start.line,
          position.start.column,
          index
        ].join('-')

        if (name === 'a' && options.linkTarget) {
          properties.target =
      typeof options.linkTarget === 'function'
        ? options.linkTarget(
          String(properties.href || ''),
          node.children,
          typeof properties.title === 'string' ? properties.title : null
        )
        : options.linkTarget
        }

        if (name === 'a' && options.transformLinkUri) {
          properties.href = options.transformLinkUri(
            String(properties.href || ''),
            node.children,
            typeof properties.title === 'string' ? properties.title : null
          )
        }

        if (
          !basic &&
    name === 'code' &&
    parent.type === 'element' &&
    parent.tagName !== 'pre'
        ) {
          properties.inline = true
        }

        if (
          !basic &&
    (name === 'h1' ||
      name === 'h2' ||
      name === 'h3' ||
      name === 'h4' ||
      name === 'h5' ||
      name === 'h6')
        ) {
          properties.level = Number.parseInt(name.charAt(1), 10)
        }

        if (name === 'img' && options.transformImageUri) {
          properties.src = options.transformImageUri(
            String(properties.src || ''),
            String(properties.alt || ''),
            typeof properties.title === 'string' ? properties.title : null
          )
        }

        if (!basic && name === 'li' && parent.type === 'element') {
          const input = getInputElement(node)
          properties.checked =
      input && input.properties ? Boolean(input.properties.checked) : null
          properties.index = getElementsBeforeCount(parent, node)
          properties.ordered = parent.tagName === 'ol'
        }

        if (!basic && (name === 'ol' || name === 'ul')) {
          properties.ordered = name === 'ol'
          properties.depth = context.listDepth
        }

        if (name === 'td' || name === 'th') {
          if (properties.align) {
            if (!properties.style) properties.style = {}
      // @ts-expect-error assume `style` is an object
            properties.style.textAlign = properties.align
            delete properties.align
          }

          if (!basic) {
            properties.isHeader = name === 'th'
          }
        }

        if (!basic && name === 'tr' && parent.type === 'element') {
          properties.isHeader = Boolean(parent.tagName === 'thead')
        }

  // If `sourcePos` is given, pass source information (line/column info from markdown source).
        if (options.sourcePos) {
          properties['data-sourcepos'] = flattenPosition(position)
        }

        if (!basic && options.rawSourcePos) {
          properties.sourcePosition = node.position
        }

  // If `includeElementIndex` is given, pass node index info to components.
        if (!basic && options.includeElementIndex) {
          properties.index = getElementsBeforeCount(parent, node)
          properties.siblingCount = getElementsBeforeCount(parent)
        }

        if (!basic) {
          properties.node = node
        }

  // Ensure no React warnings are emitted for void elements w/ children.
        return children.length > 0
          ? react__WEBPACK_IMPORTED_MODULE_0__.createElement(component, properties, children)
          : react__WEBPACK_IMPORTED_MODULE_0__.createElement(component, properties)
      }

/**
 * @param {Element|Root} node
 * @returns {Element?}
 */
      function getInputElement(node) {
        let index = -1

        while (++index < node.children.length) {
          const child = node.children[index]

          if (child.type === 'element' && child.tagName === 'input') {
            return child
          }
        }

        return null
      }

/**
 * @param {Element|Root} parent
 * @param {Element} [node]
 * @returns {number}
 */
      function getElementsBeforeCount(parent, node) {
        let index = -1
        let count = 0

        while (++index < parent.children.length) {
          if (parent.children[index] === node) break
          if (parent.children[index].type === 'element') count++
        }

        return count
      }

/**
 * @param {Record<string, unknown>} props
 * @param {string} prop
 * @param {unknown} value
 * @param {Context} ctx
 */
      function addProperty(props, prop, value, ctx) {
        const info = (0,property_information__WEBPACK_IMPORTED_MODULE_4__.find)(ctx.schema, prop)
        let result = value

  // Ignore nullish and `NaN` values.
  // eslint-disable-next-line no-self-compare
        if (result === null || result === undefined || result !== result) {
          return
        }

  // Accept `array`.
  // Most props are space-separated.
        if (Array.isArray(result)) {
          result = info.commaSeparated ? (0,comma_separated_tokens__WEBPACK_IMPORTED_MODULE_7__.stringify)(result) : (0,space_separated_tokens__WEBPACK_IMPORTED_MODULE_6__.stringify)(result)
        }

        if (info.property === 'style' && typeof result === 'string') {
          result = parseStyle(result)
        }

        if (info.space && info.property) {
          props[
            own.call(property_information__WEBPACK_IMPORTED_MODULE_5__.hastToReact, info.property)
              ? property_information__WEBPACK_IMPORTED_MODULE_5__.hastToReact[info.property]
              : info.property
          ] = result
        } else if (info.attribute) {
          props[info.attribute] = result
        }
      }

/**
 * @param {string} value
 * @returns {Record<string, string>}
 */
      function parseStyle(value) {
  /** @type {Record<string, string>} */
        const result = {}

        try {
          style_to_object__WEBPACK_IMPORTED_MODULE_8__(value, iterator)
        } catch {
    // Silent.
        }

        return result

  /**
   * @param {string} name
   * @param {string} v
   */
        function iterator(name, v) {
          const k = name.slice(0, 4) === '-ms-' ? `ms-${name.slice(4)}` : name
          result[k.replace(/-([a-z])/g, styleReplacer)] = v
        }
      }

/**
 * @param {unknown} _
 * @param {string} $1
 */
      function styleReplacer(_, $1) {
        return $1.toUpperCase()
      }

/**
 * @param {Position|{start: {line: null, column: null, offset: null}, end: {line: null, column: null, offset: null}}} pos
 * @returns {string}
 */
      function flattenPosition(pos) {
        return [
          pos.start.line,
          ':',
          pos.start.column,
          '-',
          pos.end.line,
          ':',
          pos.end.column
        ]
          .map((d) => String(d))
          .join('')
      }


/***/ }),

/***/ "./node_modules/react-markdown/lib/react-markdown.js":
/*!***********************************************************!*\
  !*** ./node_modules/react-markdown/lib/react-markdown.js ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ReactMarkdown: () => (/* binding */ ReactMarkdown)
/* harmony export */ });
/* harmony import */ const react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ const vfile__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! vfile */ "./node_modules/vfile/lib/index.js");
/* harmony import */ const unified__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! unified */ "./node_modules/unified/lib/index.js");
/* harmony import */ const remark_parse__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! remark-parse */ "./node_modules/remark-parse/lib/index.js");
/* harmony import */ const remark_rehype__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! remark-rehype */ "./node_modules/remark-rehype/index.js");
/* harmony import */ const prop_types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! prop-types */ "./node_modules/prop-types/index.js");
/* harmony import */ const property_information__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! property-information */ "./node_modules/property-information/index.js");
/* harmony import */ const _rehype_filter_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./rehype-filter.js */ "./node_modules/react-markdown/lib/rehype-filter.js");
/* harmony import */ const _uri_transformer_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./uri-transformer.js */ "./node_modules/react-markdown/lib/uri-transformer.js");
/* harmony import */ const _ast_to_react_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./ast-to-react.js */ "./node_modules/react-markdown/lib/ast-to-react.js");
/**
 * @typedef {import('react').ReactNode} ReactNode
 * @typedef {import('react').ReactElement<{}>} ReactElement
 * @typedef {import('unified').PluggableList} PluggableList
 * @typedef {import('hast').Root} Root
 * @typedef {import('./rehype-filter.js').Options} FilterOptions
 * @typedef {import('./ast-to-react.js').Options} TransformOptions
 *
 * @typedef CoreOptions
 * @property {string} children
 *
 * @typedef PluginOptions
 * @property {PluggableList} [plugins=[]] **deprecated**: use `remarkPlugins` instead
 * @property {PluggableList} [remarkPlugins=[]]
 * @property {PluggableList} [rehypePlugins=[]]
 *
 * @typedef LayoutOptions
 * @property {string} [className]
 *
 * @typedef {CoreOptions & PluginOptions & LayoutOptions & FilterOptions & TransformOptions} ReactMarkdownOptions
 *
 * @typedef Deprecation
 * @property {string} id
 * @property {string} [to]
 */












      const own = {}.hasOwnProperty
      const changelog =
  'https://github.com/remarkjs/react-markdown/blob/main/changelog.md'

/** @type {Record<string, Deprecation>} */
      const deprecated = {
        renderers: {to: 'components', id: 'change-renderers-to-components'},
        astPlugins: {id: 'remove-buggy-html-in-markdown-parser'},
        allowDangerousHtml: {id: 'remove-buggy-html-in-markdown-parser'},
        escapeHtml: {id: 'remove-buggy-html-in-markdown-parser'},
        source: {to: 'children', id: 'change-source-to-children'},
        allowNode: {
          to: 'allowElement',
          id: 'replace-allownode-allowedtypes-and-disallowedtypes'
        },
        allowedTypes: {
          to: 'allowedElements',
          id: 'replace-allownode-allowedtypes-and-disallowedtypes'
        },
        disallowedTypes: {
          to: 'disallowedElements',
          id: 'replace-allownode-allowedtypes-and-disallowedtypes'
        },
        includeNodeIndex: {
          to: 'includeElementIndex',
          id: 'change-includenodeindex-to-includeelementindex'
        }
      }

/**
 * React component to render markdown.
 *
 * @param {ReactMarkdownOptions} options
 * @returns {ReactElement}
 */
      function ReactMarkdown(options) {
        for (const key in deprecated) {
          if (own.call(deprecated, key) && own.call(options, key)) {
            const deprecation = deprecated[key]
            console.warn(
              `[react-markdown] Warning: please ${
                deprecation.to ? `use \`${deprecation.to}\` instead of` : 'remove'
              } \`${key}\` (see <${changelog}#${deprecation.id}> for more info)`
            )
            delete deprecated[key]
          }
        }

        const processor = (0,unified__WEBPACK_IMPORTED_MODULE_2__.unified)()
          .use(remark_parse__WEBPACK_IMPORTED_MODULE_3__["default"])
    // TODO: deprecate `plugins` in v8.0.0.
          .use(options.remarkPlugins || options.plugins || [])
          .use(remark_rehype__WEBPACK_IMPORTED_MODULE_4__["default"], {allowDangerousHtml: true})
          .use(options.rehypePlugins || [])
          .use(_rehype_filter_js__WEBPACK_IMPORTED_MODULE_7__["default"], options)

        const file = new vfile__WEBPACK_IMPORTED_MODULE_1__.VFile()

        if (typeof options.children === 'string') {
          file.value = options.children
        } else if (options.children !== undefined && options.children !== null) {
          console.warn(
            `[react-markdown] Warning: please pass a string as \`children\` (not: \`${options.children}\`)`
          )
        }

        const hastNode = processor.runSync(processor.parse(file), file)

        if (hastNode.type !== 'root') {
          throw new TypeError('Expected a `root` node')
        }

  /** @type {ReactElement} */
        let result = react__WEBPACK_IMPORTED_MODULE_0__.createElement(
          react__WEBPACK_IMPORTED_MODULE_0__.Fragment,
          {},
          (0,_ast_to_react_js__WEBPACK_IMPORTED_MODULE_9__.childrenToReact)({options, schema: property_information__WEBPACK_IMPORTED_MODULE_6__.html, listDepth: 0}, hastNode)
        )

        if (options.className) {
          result = react__WEBPACK_IMPORTED_MODULE_0__.createElement('div', {className: options.className}, result)
        }

        return result
      }

      ReactMarkdown.defaultProps = {transformLinkUri: _uri_transformer_js__WEBPACK_IMPORTED_MODULE_8__.uriTransformer}

      ReactMarkdown.propTypes = {
  // Core options:
        children: prop_types__WEBPACK_IMPORTED_MODULE_5__.string,
  // Layout options:
        className: prop_types__WEBPACK_IMPORTED_MODULE_5__.string,
  // Filter options:
        allowElement: prop_types__WEBPACK_IMPORTED_MODULE_5__.func,
        allowedElements: prop_types__WEBPACK_IMPORTED_MODULE_5__.arrayOf(prop_types__WEBPACK_IMPORTED_MODULE_5__.string),
        disallowedElements: prop_types__WEBPACK_IMPORTED_MODULE_5__.arrayOf(prop_types__WEBPACK_IMPORTED_MODULE_5__.string),
        unwrapDisallowed: prop_types__WEBPACK_IMPORTED_MODULE_5__.bool,
  // Plugin options:
        remarkPlugins: prop_types__WEBPACK_IMPORTED_MODULE_5__.arrayOf(
          prop_types__WEBPACK_IMPORTED_MODULE_5__.oneOfType([
            prop_types__WEBPACK_IMPORTED_MODULE_5__.object,
            prop_types__WEBPACK_IMPORTED_MODULE_5__.func,
            prop_types__WEBPACK_IMPORTED_MODULE_5__.arrayOf(prop_types__WEBPACK_IMPORTED_MODULE_5__.oneOfType([prop_types__WEBPACK_IMPORTED_MODULE_5__.object, prop_types__WEBPACK_IMPORTED_MODULE_5__.func]))
          ])
        ),
        rehypePlugins: prop_types__WEBPACK_IMPORTED_MODULE_5__.arrayOf(
          prop_types__WEBPACK_IMPORTED_MODULE_5__.oneOfType([
            prop_types__WEBPACK_IMPORTED_MODULE_5__.object,
            prop_types__WEBPACK_IMPORTED_MODULE_5__.func,
            prop_types__WEBPACK_IMPORTED_MODULE_5__.arrayOf(prop_types__WEBPACK_IMPORTED_MODULE_5__.oneOfType([prop_types__WEBPACK_IMPORTED_MODULE_5__.object, prop_types__WEBPACK_IMPORTED_MODULE_5__.func]))
          ])
        ),
  // Transform options:
        sourcePos: prop_types__WEBPACK_IMPORTED_MODULE_5__.bool,
        rawSourcePos: prop_types__WEBPACK_IMPORTED_MODULE_5__.bool,
        skipHtml: prop_types__WEBPACK_IMPORTED_MODULE_5__.bool,
        includeElementIndex: prop_types__WEBPACK_IMPORTED_MODULE_5__.bool,
        transformLinkUri: prop_types__WEBPACK_IMPORTED_MODULE_5__.oneOfType([prop_types__WEBPACK_IMPORTED_MODULE_5__.func, prop_types__WEBPACK_IMPORTED_MODULE_5__.bool]),
        linkTarget: prop_types__WEBPACK_IMPORTED_MODULE_5__.oneOfType([prop_types__WEBPACK_IMPORTED_MODULE_5__.func, prop_types__WEBPACK_IMPORTED_MODULE_5__.string]),
        transformImageUri: prop_types__WEBPACK_IMPORTED_MODULE_5__.func,
        components: prop_types__WEBPACK_IMPORTED_MODULE_5__.object
      }


/***/ }),

/***/ "./node_modules/react-markdown/lib/rehype-filter.js":
/*!**********************************************************!*\
  !*** ./node_modules/react-markdown/lib/rehype-filter.js ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ rehypeFilter)
/* harmony export */ });
/* harmony import */ const unist_util_visit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-util-visit */ "./node_modules/unist-util-visit/lib/index.js");


/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('hast').Root} Root
 * @typedef {import('hast').Element} Element
 *
 * @callback AllowElement
 * @param {Element} element
 * @param {number} index
 * @param {Element|Root} parent
 * @returns {boolean|undefined}
 *
 * @typedef Options
 * @property {Array<string>} [allowedElements]
 * @property {Array<string>} [disallowedElements=[]]
 * @property {AllowElement} [allowElement]
 * @property {boolean} [unwrapDisallowed=false]
 */

/**
 * @type {import('unified').Plugin<[Options], Root>}
 */
      function rehypeFilter(options) {
        if (options.allowedElements && options.disallowedElements) {
          throw new TypeError(
            'Only one of `allowedElements` and `disallowedElements` should be defined'
          )
        }

        if (
          options.allowedElements ||
    options.disallowedElements ||
    options.allowElement
        ) {
          return (tree) => {
            (0,unist_util_visit__WEBPACK_IMPORTED_MODULE_0__.visit)(tree, 'element', (node, index, parent_) => {
              const parent = /** @type {Element|Root} */ (parent_)
        /** @type {boolean|undefined} */
              let remove

              if (options.allowedElements) {
                remove = !options.allowedElements.includes(node.tagName)
              } else if (options.disallowedElements) {
                remove = options.disallowedElements.includes(node.tagName)
              }

              if (!remove && options.allowElement && typeof index === 'number') {
                remove = !options.allowElement(node, index, parent)
              }

              if (remove && typeof index === 'number') {
                if (options.unwrapDisallowed && node.children) {
                  parent.children.splice(index, 1, ...node.children)
                } else {
                  parent.children.splice(index, 1)
                }

                return index
              }

              return undefined
            })
          }
        }
      }


/***/ }),

/***/ "./node_modules/react-markdown/lib/uri-transformer.js":
/*!************************************************************!*\
  !*** ./node_modules/react-markdown/lib/uri-transformer.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   uriTransformer: () => (/* binding */ uriTransformer)
/* harmony export */ });
      const protocols = ['http', 'https', 'mailto', 'tel']

/**
 * @param {string} uri
 * @returns {string}
 */
      function uriTransformer(uri) {
        const url = (uri || '').trim()
        const first = url.charAt(0)

        if (first === '#' || first === '/') {
          return url
        }

        const colon = url.indexOf(':')
        if (colon === -1) {
          return url
        }

        let index = -1

        while (++index < protocols.length) {
          const protocol = protocols[index]

          if (
            colon === protocol.length &&
      url.slice(0, protocol.length).toLowerCase() === protocol
          ) {
            return url
          }
        }

        index = url.indexOf('?')
        if (index !== -1 && colon > index) {
          return url
        }

        index = url.indexOf('#')
        if (index !== -1 && colon > index) {
          return url
        }

  // eslint-disable-next-line no-script-url
        return 'javascript:void(0)'
      }


/***/ }),

/***/ "./node_modules/react-markdown/node_modules/react-is/cjs/react-is.development.js":
/*!***************************************************************************************!*\
  !*** ./node_modules/react-markdown/node_modules/react-is/cjs/react-is.development.js ***!
  \***************************************************************************************/
/***/ ((__unused_webpack_module, exports) => {

      "use strict";
/** @license React v17.0.2
 * react-is.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



      if (true) {
        (function() {
          'use strict';

// ATTENTION
// When adding new symbols to this file,
// Please consider also adding to 'react-devtools-shared/src/backend/ReactSymbols'
// The Symbol used to tag the ReactElement-like types. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
          let REACT_ELEMENT_TYPE = 0xeac7;
          let REACT_PORTAL_TYPE = 0xeaca;
          let REACT_FRAGMENT_TYPE = 0xeacb;
          let REACT_STRICT_MODE_TYPE = 0xeacc;
          let REACT_PROFILER_TYPE = 0xead2;
          let REACT_PROVIDER_TYPE = 0xeacd;
          let REACT_CONTEXT_TYPE = 0xeace;
          let REACT_FORWARD_REF_TYPE = 0xead0;
          let REACT_SUSPENSE_TYPE = 0xead1;
          let REACT_SUSPENSE_LIST_TYPE = 0xead8;
          let REACT_MEMO_TYPE = 0xead3;
          let REACT_LAZY_TYPE = 0xead4;
          let REACT_BLOCK_TYPE = 0xead9;
          let REACT_SERVER_BLOCK_TYPE = 0xeada;
          let REACT_FUNDAMENTAL_TYPE = 0xead5;
          let REACT_SCOPE_TYPE = 0xead7;
          let REACT_OPAQUE_ID_TYPE = 0xeae0;
          let REACT_DEBUG_TRACING_MODE_TYPE = 0xeae1;
          let REACT_OFFSCREEN_TYPE = 0xeae2;
          let REACT_LEGACY_HIDDEN_TYPE = 0xeae3;

          if (typeof Symbol === 'function' && Symbol.for) {
            const symbolFor = Symbol.for;
            REACT_ELEMENT_TYPE = symbolFor('react.element');
            REACT_PORTAL_TYPE = symbolFor('react.portal');
            REACT_FRAGMENT_TYPE = symbolFor('react.fragment');
            REACT_STRICT_MODE_TYPE = symbolFor('react.strict_mode');
            REACT_PROFILER_TYPE = symbolFor('react.profiler');
            REACT_PROVIDER_TYPE = symbolFor('react.provider');
            REACT_CONTEXT_TYPE = symbolFor('react.context');
            REACT_FORWARD_REF_TYPE = symbolFor('react.forward_ref');
            REACT_SUSPENSE_TYPE = symbolFor('react.suspense');
            REACT_SUSPENSE_LIST_TYPE = symbolFor('react.suspense_list');
            REACT_MEMO_TYPE = symbolFor('react.memo');
            REACT_LAZY_TYPE = symbolFor('react.lazy');
            REACT_BLOCK_TYPE = symbolFor('react.block');
            REACT_SERVER_BLOCK_TYPE = symbolFor('react.server.block');
            REACT_FUNDAMENTAL_TYPE = symbolFor('react.fundamental');
            REACT_SCOPE_TYPE = symbolFor('react.scope');
            REACT_OPAQUE_ID_TYPE = symbolFor('react.opaque.id');
            REACT_DEBUG_TRACING_MODE_TYPE = symbolFor('react.debug_trace_mode');
            REACT_OFFSCREEN_TYPE = symbolFor('react.offscreen');
            REACT_LEGACY_HIDDEN_TYPE = symbolFor('react.legacy_hidden');
          }

// Filter certain DOM attributes (e.g. src, href) if their values are empty strings.

          const enableScopeAPI = false; // Experimental Create Event Handle API.

          function isValidElementType(type) {
            if (typeof type === 'string' || typeof type === 'function') {
              return true;
            } // Note: typeof might be other than 'symbol' or 'number' (e.g. if it's a polyfill).


            if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || type === REACT_DEBUG_TRACING_MODE_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || type === REACT_LEGACY_HIDDEN_TYPE || enableScopeAPI ) {
              return true;
            }

            if (typeof type === 'object' && type !== null) {
              if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_FUNDAMENTAL_TYPE || type.$$typeof === REACT_BLOCK_TYPE || type[0] === REACT_SERVER_BLOCK_TYPE) {
                return true;
              }
            }

            return false;
          }

          function typeOf(object) {
            if (typeof object === 'object' && object !== null) {
              const $$typeof = object.$$typeof;

              switch ($$typeof) {
                case REACT_ELEMENT_TYPE:
                  var type = object.type;

                  switch (type) {
                    case REACT_FRAGMENT_TYPE:
                    case REACT_PROFILER_TYPE:
                    case REACT_STRICT_MODE_TYPE:
                    case REACT_SUSPENSE_TYPE:
                    case REACT_SUSPENSE_LIST_TYPE:
                      return type;

                    default:
                      var $$typeofType = type && type.$$typeof;

                      switch ($$typeofType) {
                        case REACT_CONTEXT_TYPE:
                        case REACT_FORWARD_REF_TYPE:
                        case REACT_LAZY_TYPE:
                        case REACT_MEMO_TYPE:
                        case REACT_PROVIDER_TYPE:
                          return $$typeofType;

                        default:
                          return $$typeof;
                      }

                  }

                case REACT_PORTAL_TYPE:
                  return $$typeof;
              }
            }

            return undefined;
          }
          const ContextConsumer = REACT_CONTEXT_TYPE;
          const ContextProvider = REACT_PROVIDER_TYPE;
          const Element = REACT_ELEMENT_TYPE;
          const ForwardRef = REACT_FORWARD_REF_TYPE;
          const Fragment = REACT_FRAGMENT_TYPE;
          const Lazy = REACT_LAZY_TYPE;
          const Memo = REACT_MEMO_TYPE;
          const Portal = REACT_PORTAL_TYPE;
          const Profiler = REACT_PROFILER_TYPE;
          const StrictMode = REACT_STRICT_MODE_TYPE;
          const Suspense = REACT_SUSPENSE_TYPE;
          let hasWarnedAboutDeprecatedIsAsyncMode = false;
          let hasWarnedAboutDeprecatedIsConcurrentMode = false; // AsyncMode should be deprecated

          function isAsyncMode(object) {
            {
              if (!hasWarnedAboutDeprecatedIsAsyncMode) {
                hasWarnedAboutDeprecatedIsAsyncMode = true; // Using console['warn'] to evade Babel and ESLint

                console['warn']('The ReactIs.isAsyncMode() alias has been deprecated, ' + 'and will be removed in React 18+.');
              }
            }

            return false;
          }
          function isConcurrentMode(object) {
            {
              if (!hasWarnedAboutDeprecatedIsConcurrentMode) {
                hasWarnedAboutDeprecatedIsConcurrentMode = true; // Using console['warn'] to evade Babel and ESLint

                console['warn']('The ReactIs.isConcurrentMode() alias has been deprecated, ' + 'and will be removed in React 18+.');
              }
            }

            return false;
          }
          function isContextConsumer(object) {
            return typeOf(object) === REACT_CONTEXT_TYPE;
          }
          function isContextProvider(object) {
            return typeOf(object) === REACT_PROVIDER_TYPE;
          }
          function isElement(object) {
            return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
          }
          function isForwardRef(object) {
            return typeOf(object) === REACT_FORWARD_REF_TYPE;
          }
          function isFragment(object) {
            return typeOf(object) === REACT_FRAGMENT_TYPE;
          }
          function isLazy(object) {
            return typeOf(object) === REACT_LAZY_TYPE;
          }
          function isMemo(object) {
            return typeOf(object) === REACT_MEMO_TYPE;
          }
          function isPortal(object) {
            return typeOf(object) === REACT_PORTAL_TYPE;
          }
          function isProfiler(object) {
            return typeOf(object) === REACT_PROFILER_TYPE;
          }
          function isStrictMode(object) {
            return typeOf(object) === REACT_STRICT_MODE_TYPE;
          }
          function isSuspense(object) {
            return typeOf(object) === REACT_SUSPENSE_TYPE;
          }

          exports.ContextConsumer = ContextConsumer;
          exports.ContextProvider = ContextProvider;
          exports.Element = Element;
          exports.ForwardRef = ForwardRef;
          exports.Fragment = Fragment;
          exports.Lazy = Lazy;
          exports.Memo = Memo;
          exports.Portal = Portal;
          exports.Profiler = Profiler;
          exports.StrictMode = StrictMode;
          exports.Suspense = Suspense;
          exports.isAsyncMode = isAsyncMode;
          exports.isConcurrentMode = isConcurrentMode;
          exports.isContextConsumer = isContextConsumer;
          exports.isContextProvider = isContextProvider;
          exports.isElement = isElement;
          exports.isForwardRef = isForwardRef;
          exports.isFragment = isFragment;
          exports.isLazy = isLazy;
          exports.isMemo = isMemo;
          exports.isPortal = isPortal;
          exports.isProfiler = isProfiler;
          exports.isStrictMode = isStrictMode;
          exports.isSuspense = isSuspense;
          exports.isValidElementType = isValidElementType;
          exports.typeOf = typeOf;
        })();
      }


/***/ }),

/***/ "./node_modules/react-markdown/node_modules/react-is/index.js":
/*!********************************************************************!*\
  !*** ./node_modules/react-markdown/node_modules/react-is/index.js ***!
  \********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      if (false) // removed by dead control flow
      {} else {
        module.exports = __webpack_require__(/*! ./cjs/react-is.development.js */ "./node_modules/react-markdown/node_modules/react-is/cjs/react-is.development.js");
      }


/***/ }),

/***/ "./node_modules/remark-parse/lib/index.js":
/*!************************************************!*\
  !*** ./node_modules/remark-parse/lib/index.js ***!
  \************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ remarkParse)
/* harmony export */ });
/* harmony import */ const mdast_util_from_markdown__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mdast-util-from-markdown */ "./node_modules/mdast-util-from-markdown/dev/lib/index.js");
/**
 * @typedef {import('mdast').Root} Root
 * @typedef {import('mdast-util-from-markdown').Options} Options
 */



/**
 * @this {import('unified').Processor}
 * @type {import('unified').Plugin<[Options?] | void[], string, Root>}
 */
      function remarkParse(options) {
  /** @type {import('unified').ParserFunction<Root>} */
        const parser = (doc) => {
    // Assume options.
          const settings = /** @type {Options} */ (this.data('settings'))

          return (0,mdast_util_from_markdown__WEBPACK_IMPORTED_MODULE_0__.fromMarkdown)(
            doc,
            Object.assign({}, settings, options, {
        // Note: these options are not in the readme.
        // The goal is for them to be set by plugins on `data` instead of being
        // passed by users.
              extensions: this.data('micromarkExtensions') || [],
              mdastExtensions: this.data('fromMarkdownExtensions') || []
            })
          )
        }

        Object.assign(this, {Parser: parser})
      }


/***/ }),

/***/ "./node_modules/remark-rehype/index.js":
/*!*********************************************!*\
  !*** ./node_modules/remark-rehype/index.js ***!
  \*********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ const mdast_util_to_hast__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mdast-util-to-hast */ "./node_modules/mdast-util-to-hast/lib/index.js");
/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('hast').Root} HastRoot
 * @typedef {import('mdast').Root} MdastRoot
 * @typedef {import('mdast-util-to-hast').Options} Options
 * @typedef {import('unified').Processor<any, any, any, any>} Processor
 *
 * @typedef {import('mdast-util-to-hast')} DoNotTouchAsThisImportIncludesRawInTree
 */



// Note: the `<MdastRoot, HastRoot>` overload doesn’t seem to work :'(

/**
 * Plugin to bridge or mutate to rehype.
 *
 * If a destination is given, runs the destination with the new hast tree
 * (bridge-mode).
 * Without destination, returns the hast tree: further plugins run on that tree
 * (mutate-mode).
 *
 * @param destination
 *   Optional unified processor.
 * @param options
 *   Options passed to `mdast-util-to-hast`.
 */
      const remarkRehype =
  /** @type {(import('unified').Plugin<[Processor, Options?]|[Options]|[], MdastRoot>)} */
  (
    function (destination, options) {
      return destination && 'run' in destination
        ? bridge(destination, options)
        : mutate(destination)
    }
  )

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (remarkRehype);

/**
 * Bridge-mode.
 * Runs the destination with the new hast tree.
 *
 * @type {import('unified').Plugin<[Processor, Options?], MdastRoot>}
 */
      function bridge(destination, options) {
        return (node, file, next) => {
          destination.run((0,mdast_util_to_hast__WEBPACK_IMPORTED_MODULE_0__.toHast)(node, options), file, (error) => {
            next(error)
          })
        }
      }

/**
 * Mutate-mode.
 * Further transformers run on the nlcst tree.
 *
 * @type {import('unified').Plugin<[Options?]|void[], MdastRoot, HastRoot>}
 */
      function mutate(options) {
  // @ts-expect-error: assume a corresponding node is returned for `toHast`.
        return (node) => (0,mdast_util_to_hast__WEBPACK_IMPORTED_MODULE_0__.toHast)(node, options)
      }


/***/ }),

/***/ "./node_modules/space-separated-tokens/index.js":
/*!******************************************************!*\
  !*** ./node_modules/space-separated-tokens/index.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   parse: () => (/* binding */ parse),
/* harmony export */   stringify: () => (/* binding */ stringify)
/* harmony export */ });
/**
 * Parse space-separated tokens to an array of strings.
 *
 * @param {string} value
 *   Space-separated tokens.
 * @returns {Array<string>}
 *   List of tokens.
 */
      function parse(value) {
        const input = String(value || '').trim()
        return input ? input.split(/[ \t\n\r\f]+/g) : []
      }

/**
 * Serialize an array of strings as space separated-tokens.
 *
 * @param {Array<string|number>} values
 *   List of tokens.
 * @returns {string}
 *   Space-separated tokens.
 */
      function stringify(values) {
        return values.join(' ').trim()
      }


/***/ }),

/***/ "./node_modules/style-to-object/index.js":
/*!***********************************************!*\
  !*** ./node_modules/style-to-object/index.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      const parse = __webpack_require__(/*! inline-style-parser */ "./node_modules/inline-style-parser/index.js");

/**
 * Parses inline style to object.
 *
 * @example
 * // returns { 'line-height': '42' }
 * StyleToObject('line-height: 42;');
 *
 * @param  {String}      style      - The inline style.
 * @param  {Function}    [iterator] - The iterator function.
 * @return {null|Object}
 */
      function StyleToObject(style, iterator) {
        let output = null;
        if (!style || typeof style !== 'string') {
          return output;
        }

        let declaration;
        const declarations = parse(style);
        const hasIterator = typeof iterator === 'function';
        let property;
        let value;

        for (let i = 0, len = declarations.length; i < len; i++) {
          declaration = declarations[i];
          property = declaration.property;
          value = declaration.value;

          if (hasIterator) {
            iterator(property, value, declaration);
          } else if (value) {
            output || (output = {});
            output[property] = value;
          }
        }

        return output;
      }

      module.exports = StyleToObject;


/***/ }),

/***/ "./node_modules/trough/lib/index.js":
/*!******************************************!*\
  !*** ./node_modules/trough/lib/index.js ***!
  \******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   trough: () => (/* binding */ trough),
/* harmony export */   wrap: () => (/* binding */ wrap)
/* harmony export */ });
// To do: remove `void`s
// To do: remove `null` from output of our APIs, allow it as user APIs.

/**
 * @typedef {(error?: Error | null | undefined, ...output: Array<any>) => void} Callback
 *   Callback.
 *
 * @typedef {(...input: Array<any>) => any} Middleware
 *   Ware.
 *
 * @typedef Pipeline
 *   Pipeline.
 * @property {Run} run
 *   Run the pipeline.
 * @property {Use} use
 *   Add middleware.
 *
 * @typedef {(...input: Array<any>) => void} Run
 *   Call all middleware.
 *
 *   Calls `done` on completion with either an error or the output of the
 *   last middleware.
 *
 *   > 👉 **Note**: as the length of input defines whether async functions get a
 *   > `next` function,
 *   > it’s recommended to keep `input` at one value normally.

 *
 * @typedef {(fn: Middleware) => Pipeline} Use
 *   Add middleware.
 */

/**
 * Create new middleware.
 *
 * @returns {Pipeline}
 *   Pipeline.
 */
      function trough() {
  /** @type {Array<Middleware>} */
        const fns = []
  /** @type {Pipeline} */
        const pipeline = {run, use}

        return pipeline

  /** @type {Run} */
        function run(...values) {
          let middlewareIndex = -1
    /** @type {Callback} */
          const callback = values.pop()

          if (typeof callback !== 'function') {
            throw new TypeError('Expected function as last argument, not ' + callback)
          }

          next(null, ...values)

    /**
     * Run the next `fn`, or we’re done.
     *
     * @param {Error | null | undefined} error
     * @param {Array<any>} output
     */
          function next(error, ...output) {
            const fn = fns[++middlewareIndex]
            let index = -1

            if (error) {
              callback(error)
              return
            }

      // Copy non-nullish input into values.
            while (++index < values.length) {
              if (output[index] === null || output[index] === undefined) {
                output[index] = values[index]
              }
            }

      // Save the newly created `output` for the next call.
            values = output

      // Next or done.
            if (fn) {
              wrap(fn, next)(...output)
            } else {
              callback(null, ...output)
            }
          }
        }

  /** @type {Use} */
        function use(middelware) {
          if (typeof middelware !== 'function') {
            throw new TypeError(
              'Expected `middelware` to be a function, not ' + middelware
            )
          }

          fns.push(middelware)
          return pipeline
        }
      }

/**
 * Wrap `middleware` into a uniform interface.
 *
 * You can pass all input to the resulting function.
 * `callback` is then called with the output of `middleware`.
 *
 * If `middleware` accepts more arguments than the later given in input,
 * an extra `done` function is passed to it after that input,
 * which must be called by `middleware`.
 *
 * The first value in `input` is the main input value.
 * All other input values are the rest input values.
 * The values given to `callback` are the input values,
 * merged with every non-nullish output value.
 *
 * * if `middleware` throws an error,
 *   returns a promise that is rejected,
 *   or calls the given `done` function with an error,
 *   `callback` is called with that error
 * * if `middleware` returns a value or returns a promise that is resolved,
 *   that value is the main output value
 * * if `middleware` calls `done`,
 *   all non-nullish values except for the first one (the error) overwrite the
 *   output values
 *
 * @param {Middleware} middleware
 *   Function to wrap.
 * @param {Callback} callback
 *   Callback called with the output of `middleware`.
 * @returns {Run}
 *   Wrapped middleware.
 */
      function wrap(middleware, callback) {
  /** @type {boolean} */
        let called

        return wrapped

  /**
   * Call `middleware`.
   * @this {any}
   * @param {Array<any>} parameters
   * @returns {void}
   */
        function wrapped(...parameters) {
          const fnExpectsCallback = middleware.length > parameters.length
    /** @type {any} */
          let result

          if (fnExpectsCallback) {
            parameters.push(done)
          }

          try {
            result = middleware.apply(this, parameters)
          } catch (error) {
            const exception = /** @type {Error} */ (error)

      // Well, this is quite the pickle.
      // `middleware` received a callback and called it synchronously, but that
      // threw an error.
      // The only thing left to do is to throw the thing instead.
            if (fnExpectsCallback && called) {
              throw exception
            }

            return done(exception)
          }

          if (!fnExpectsCallback) {
            if (result && result.then && typeof result.then === 'function') {
              result.then(then, done)
            } else if (result instanceof Error) {
              done(result)
            } else {
              then(result)
            }
          }
        }

  /**
   * Call `callback`, only once.
   *
   * @type {Callback}
   */
        function done(error, ...output) {
          if (!called) {
            called = true
            callback(error, ...output)
          }
        }

  /**
   * Call `done` with one value.
   *
   * @param {any} [value]
   */
        function then(value) {
          done(null, value)
        }
      }


/***/ }),

/***/ "./node_modules/unified/lib/index.js":
/*!*******************************************!*\
  !*** ./node_modules/unified/lib/index.js ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   unified: () => (/* binding */ unified)
/* harmony export */ });
/* harmony import */ const bail__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! bail */ "./node_modules/bail/index.js");
/* harmony import */ const is_buffer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! is-buffer */ "./node_modules/is-buffer/index.js");
/* harmony import */ const extend__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! extend */ "./node_modules/extend/index.js");
/* harmony import */ const is_plain_obj__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! is-plain-obj */ "./node_modules/is-plain-obj/index.js");
/* harmony import */ const trough__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! trough */ "./node_modules/trough/lib/index.js");
/* harmony import */ const vfile__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! vfile */ "./node_modules/vfile/lib/index.js");
/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('vfile').VFileCompatible} VFileCompatible
 * @typedef {import('vfile').VFileValue} VFileValue
 * @typedef {import('..').Processor} Processor
 * @typedef {import('..').Plugin} Plugin
 * @typedef {import('..').Preset} Preset
 * @typedef {import('..').Pluggable} Pluggable
 * @typedef {import('..').PluggableList} PluggableList
 * @typedef {import('..').Transformer} Transformer
 * @typedef {import('..').Parser} Parser
 * @typedef {import('..').Compiler} Compiler
 * @typedef {import('..').RunCallback} RunCallback
 * @typedef {import('..').ProcessCallback} ProcessCallback
 *
 * @typedef Context
 * @property {Node} tree
 * @property {VFile} file
 */








// Expose a frozen processor.
      const unified = base().freeze()

      const own = {}.hasOwnProperty

// Function to create the first processor.
/**
 * @returns {Processor}
 */
      function base() {
        const transformers = (0,trough__WEBPACK_IMPORTED_MODULE_4__.trough)()
  /** @type {Processor['attachers']} */
        const attachers = []
  /** @type {Record<string, unknown>} */
        let namespace = {}
  /** @type {boolean|undefined} */
        let frozen
        let freezeIndex = -1

  // Data management.
  // @ts-expect-error: overloads are handled.
        processor.data = data
        processor.Parser = undefined
        processor.Compiler = undefined

  // Lock.
        processor.freeze = freeze

  // Plugins.
        processor.attachers = attachers
  // @ts-expect-error: overloads are handled.
        processor.use = use

  // API.
        processor.parse = parse
        processor.stringify = stringify
  // @ts-expect-error: overloads are handled.
        processor.run = run
        processor.runSync = runSync
  // @ts-expect-error: overloads are handled.
        processor.process = process
        processor.processSync = processSync

  // Expose.
        return processor

  // Create a new processor based on the processor in the current scope.
  /** @type {Processor} */
        function processor() {
          const destination = base()
          let index = -1

          while (++index < attachers.length) {
            destination.use(...attachers[index])
          }

          destination.data(extend__WEBPACK_IMPORTED_MODULE_2__(true, {}, namespace))

          return destination
        }

  /**
   * @param {string|Record<string, unknown>} [key]
   * @param {unknown} [value]
   * @returns {unknown}
   */
        function data(key, value) {
          if (typeof key === 'string') {
      // Set `key`.
            if (arguments.length === 2) {
              assertUnfrozen('data', frozen)
              namespace[key] = value
              return processor
            }

      // Get `key`.
            return (own.call(namespace, key) && namespace[key]) || null
          }

    // Set space.
          if (key) {
            assertUnfrozen('data', frozen)
            namespace = key
            return processor
          }

    // Get space.
          return namespace
        }

  /** @type {Processor['freeze']} */
        function freeze() {
          if (frozen) {
            return processor
          }

          while (++freezeIndex < attachers.length) {
            const [attacher, ...options] = attachers[freezeIndex]

            if (options[0] === false) {
              continue
            }

            if (options[0] === true) {
              options[0] = undefined
            }

      /** @type {Transformer|void} */
            const transformer = attacher.call(processor, ...options)

            if (typeof transformer === 'function') {
              transformers.use(transformer)
            }
          }

          frozen = true
          freezeIndex = Number.POSITIVE_INFINITY

          return processor
        }

  /**
   * @param {Pluggable|null|undefined} [value]
   * @param {...unknown} options
   * @returns {Processor}
   */
        function use(value, ...options) {
    /** @type {Record<string, unknown>|undefined} */
          let settings

          assertUnfrozen('use', frozen)

          if (value === null || value === undefined) {
      // Empty.
          } else if (typeof value === 'function') {
            addPlugin(value, ...options)
          } else if (typeof value === 'object') {
            if (Array.isArray(value)) {
              addList(value)
            } else {
              addPreset(value)
            }
          } else {
            throw new TypeError('Expected usable value, not `' + value + '`')
          }

          if (settings) {
            namespace.settings = Object.assign(namespace.settings || {}, settings)
          }

          return processor

    /**
     * @param {import('..').Pluggable<unknown[]>} value
     * @returns {void}
     */
          function add(value) {
            if (typeof value === 'function') {
              addPlugin(value)
            } else if (typeof value === 'object') {
              if (Array.isArray(value)) {
                const [plugin, ...options] = value
                addPlugin(plugin, ...options)
              } else {
                addPreset(value)
              }
            } else {
              throw new TypeError('Expected usable value, not `' + value + '`')
            }
          }

    /**
     * @param {Preset} result
     * @returns {void}
     */
          function addPreset(result) {
            addList(result.plugins)

            if (result.settings) {
              settings = Object.assign(settings || {}, result.settings)
            }
          }

    /**
     * @param {PluggableList|null|undefined} [plugins]
     * @returns {void}
     */
          function addList(plugins) {
            let index = -1

            if (plugins === null || plugins === undefined) {
        // Empty.
            } else if (Array.isArray(plugins)) {
              while (++index < plugins.length) {
                const thing = plugins[index]
                add(thing)
              }
            } else {
              throw new TypeError('Expected a list of plugins, not `' + plugins + '`')
            }
          }

    /**
     * @param {Plugin} plugin
     * @param {...unknown} [value]
     * @returns {void}
     */
          function addPlugin(plugin, value) {
            let index = -1
      /** @type {Processor['attachers'][number]|undefined} */
            let entry

            while (++index < attachers.length) {
              if (attachers[index][0] === plugin) {
                entry = attachers[index]
                break
              }
            }

            if (entry) {
              if ((0,is_plain_obj__WEBPACK_IMPORTED_MODULE_3__["default"])(entry[1]) && (0,is_plain_obj__WEBPACK_IMPORTED_MODULE_3__["default"])(value)) {
                value = extend__WEBPACK_IMPORTED_MODULE_2__(true, entry[1], value)
              }

              entry[1] = value
            } else {
        // @ts-expect-error: fine.
              attachers.push([...arguments])
            }
          }
        }

  /** @type {Processor['parse']} */
        function parse(doc) {
          processor.freeze()
          const file = vfile(doc)
          const Parser = processor.Parser
          assertParser('parse', Parser)

          if (newable(Parser, 'parse')) {
      // @ts-expect-error: `newable` checks this.
            return new Parser(String(file), file).parse()
          }

    // @ts-expect-error: `newable` checks this.
          return Parser(String(file), file) // eslint-disable-line new-cap
        }

  /** @type {Processor['stringify']} */
        function stringify(node, doc) {
          processor.freeze()
          const file = vfile(doc)
          const Compiler = processor.Compiler
          assertCompiler('stringify', Compiler)
          assertNode(node)

          if (newable(Compiler, 'compile')) {
      // @ts-expect-error: `newable` checks this.
            return new Compiler(node, file).compile()
          }

    // @ts-expect-error: `newable` checks this.
          return Compiler(node, file) // eslint-disable-line new-cap
        }

  /**
   * @param {Node} node
   * @param {VFileCompatible|RunCallback} [doc]
   * @param {RunCallback} [callback]
   * @returns {Promise<Node>|void}
   */
        function run(node, doc, callback) {
          assertNode(node)
          processor.freeze()

          if (!callback && typeof doc === 'function') {
            callback = doc
            doc = undefined
          }

          if (!callback) {
            return new Promise(executor)
          }

          executor(null, callback)

    /**
     * @param {null|((node: Node) => void)} resolve
     * @param {(error: Error) => void} reject
     * @returns {void}
     */
          function executor(resolve, reject) {
      // @ts-expect-error: `doc` can’t be a callback anymore, we checked.
            transformers.run(node, vfile(doc), done)

      /**
       * @param {Error|null} error
       * @param {Node} tree
       * @param {VFile} file
       * @returns {void}
       */
            function done(error, tree, file) {
              tree = tree || node
              if (error) {
                reject(error)
              } else if (resolve) {
                resolve(tree)
              } else {
          // @ts-expect-error: `callback` is defined if `resolve` is not.
                callback(null, tree, file)
              }
            }
          }
        }

  /** @type {Processor['runSync']} */
        function runSync(node, file) {
    /** @type {Node|undefined} */
          let result
    /** @type {boolean|undefined} */
          let complete

          processor.run(node, file, done)

          assertDone('runSync', 'run', complete)

    // @ts-expect-error: we either bailed on an error or have a tree.
          return result

    /**
     * @param {Error|null} [error]
     * @param {Node} [tree]
     * @returns {void}
     */
          function done(error, tree) {
            (0,bail__WEBPACK_IMPORTED_MODULE_0__.bail)(error)
            result = tree
            complete = true
          }
        }

  /**
   * @param {VFileCompatible} doc
   * @param {ProcessCallback} [callback]
   * @returns {Promise<VFile>|undefined}
   */
        function process(doc, callback) {
          processor.freeze()
          assertParser('process', processor.Parser)
          assertCompiler('process', processor.Compiler)

          if (!callback) {
            return new Promise(executor)
          }

          executor(null, callback)

    /**
     * @param {null|((file: VFile) => void)} resolve
     * @param {(error?: Error|null|undefined) => void} reject
     * @returns {void}
     */
          function executor(resolve, reject) {
            const file = vfile(doc)

            processor.run(processor.parse(file), file, (error, tree, file) => {
              if (error || !tree || !file) {
                done(error)
              } else {
          /** @type {unknown} */
                const result = processor.stringify(tree, file)

                if (result === undefined || result === null) {
            // Empty.
                } else if (looksLikeAVFileValue(result)) {
                  file.value = result
                } else {
                  file.result = result
                }

                done(error, file)
              }
            })

      /**
       * @param {Error|null|undefined} [error]
       * @param {VFile|undefined} [file]
       * @returns {void}
       */
            function done(error, file) {
              if (error || !file) {
                reject(error)
              } else if (resolve) {
                resolve(file)
              } else {
          // @ts-expect-error: `callback` is defined if `resolve` is not.
                callback(null, file)
              }
            }
          }
        }

  /** @type {Processor['processSync']} */
        function processSync(doc) {
    /** @type {boolean|undefined} */
          let complete

          processor.freeze()
          assertParser('processSync', processor.Parser)
          assertCompiler('processSync', processor.Compiler)

          const file = vfile(doc)

          processor.process(file, done)

          assertDone('processSync', 'process', complete)

          return file

    /**
     * @param {Error|null|undefined} [error]
     * @returns {void}
     */
          function done(error) {
            complete = true
            ;(0,bail__WEBPACK_IMPORTED_MODULE_0__.bail)(error)
          }
        }
      }

/**
 * Check if `value` is a constructor.
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {boolean}
 */
      function newable(value, name) {
        return (
          typeof value === 'function' &&
    // Prototypes do exist.
    // type-coverage:ignore-next-line
    value.prototype &&
    // A function with keys in its prototype is probably a constructor.
    // Classes’ prototype methods are not enumerable, so we check if some value
    // exists in the prototype.
    // type-coverage:ignore-next-line
    (keys(value.prototype) || name in value.prototype)
        )
      }

/**
 * Check if `value` is an object with keys.
 *
 * @param {Record<string, unknown>} value
 * @returns {boolean}
 */
      function keys(value) {
  /** @type {string} */
        let key

        for (key in value) {
          if (own.call(value, key)) {
            return true
          }
        }

        return false
      }

/**
 * Assert a parser is available.
 *
 * @param {string} name
 * @param {unknown} value
 * @returns {asserts value is Parser}
 */
      function assertParser(name, value) {
        if (typeof value !== 'function') {
          throw new TypeError('Cannot `' + name + '` without `Parser`')
        }
      }

/**
 * Assert a compiler is available.
 *
 * @param {string} name
 * @param {unknown} value
 * @returns {asserts value is Compiler}
 */
      function assertCompiler(name, value) {
        if (typeof value !== 'function') {
          throw new TypeError('Cannot `' + name + '` without `Compiler`')
        }
      }

/**
 * Assert the processor is not frozen.
 *
 * @param {string} name
 * @param {unknown} frozen
 * @returns {asserts frozen is false}
 */
      function assertUnfrozen(name, frozen) {
        if (frozen) {
          throw new Error(
            'Cannot call `' +
        name +
        '` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.'
          )
        }
      }

/**
 * Assert `node` is a unist node.
 *
 * @param {unknown} node
 * @returns {asserts node is Node}
 */
      function assertNode(node) {
  // `isPlainObj` unfortunately uses `any` instead of `unknown`.
  // type-coverage:ignore-next-line
        if (!(0,is_plain_obj__WEBPACK_IMPORTED_MODULE_3__["default"])(node) || typeof node.type !== 'string') {
          throw new TypeError('Expected node, got `' + node + '`')
    // Fine.
        }
      }

/**
 * Assert that `complete` is `true`.
 *
 * @param {string} name
 * @param {string} asyncName
 * @param {unknown} complete
 * @returns {asserts complete is true}
 */
      function assertDone(name, asyncName, complete) {
        if (!complete) {
          throw new Error(
            '`' + name + '` finished async. Use `' + asyncName + '` instead'
          )
        }
      }

/**
 * @param {VFileCompatible} [value]
 * @returns {VFile}
 */
      function vfile(value) {
        return looksLikeAVFile(value) ? value : new vfile__WEBPACK_IMPORTED_MODULE_5__.VFile(value)
      }

/**
 * @param {VFileCompatible} [value]
 * @returns {value is VFile}
 */
      function looksLikeAVFile(value) {
        return Boolean(
          value &&
      typeof value === 'object' &&
      'message' in value &&
      'messages' in value
        )
      }

/**
 * @param {unknown} [value]
 * @returns {value is VFileValue}
 */
      function looksLikeAVFileValue(value) {
        return typeof value === 'string' || is_buffer__WEBPACK_IMPORTED_MODULE_1__(value)
      }


/***/ }),

/***/ "./node_modules/unist-builder/lib/index.js":
/*!*************************************************!*\
  !*** ./node_modules/unist-builder/lib/index.js ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   u: () => (/* binding */ u)
/* harmony export */ });
/**
 * @typedef {import('unist').Node} Node
 */

/**
 * @typedef {Array<Node> | string} ChildrenOrValue
 *   List to use as `children` or value to use as `value`.
 *
 * @typedef {Record<string, unknown>} Props
 *   Other fields to add to the node.
 */

/**
 * Build a node.
 *
 * @param type
 *   Node type.
 * @param props
 *   Fields assigned to node.
 * @param value
 *   Children of node or value of `node` (cast to string).
 * @returns
 *   Built node.
 */
      const u =
  /**
   * @type {(
   *   (<T extends string>(type: T) => {type: T}) &
   *   (<T extends string, P extends Props>(type: T, props: P) => {type: T} & P) &
   *   (<T extends string>(type: T, value: string) => {type: T, value: string}) &
   *   (<T extends string, P extends Props>(type: T, props: P, value: string) => {type: T, value: string} & P) &
   *   (<T extends string, C extends Array<Node>>(type: T, children: C) => {type: T, children: C}) &
   *   (<T extends string, P extends Props, C extends Array<Node>>(type: T, props: P, children: C) => {type: T, children: C} & P)
   * )}
   */
  (
    /**
     * @param {string} type
     * @param {Props | ChildrenOrValue | null | undefined} [props]
     * @param {ChildrenOrValue | null | undefined} [value]
     * @returns {Node}
     */
    function (type, props, value) {
      /** @type {Node} */
      const node = {type: String(type)}

      if (
        (value === undefined || value === null) &&
        (typeof props === 'string' || Array.isArray(props))
      ) {
        value = props
      } else {
        Object.assign(node, props)
      }

      if (Array.isArray(value)) {
        // @ts-expect-error: create a parent.
        node.children = value
      } else if (value !== undefined && value !== null) {
        // @ts-expect-error: create a literal.
        node.value = String(value)
      }

      return node
    }
  )


/***/ }),

/***/ "./node_modules/unist-util-generated/lib/index.js":
/*!********************************************************!*\
  !*** ./node_modules/unist-util-generated/lib/index.js ***!
  \********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   generated: () => (/* binding */ generated)
/* harmony export */ });
/**
 * @typedef PointLike
 * @property {number | null | undefined} [line]
 * @property {number | null | undefined} [column]
 * @property {number | null | undefined} [offset]
 *
 * @typedef PositionLike
 * @property {PointLike | null | undefined} [start]
 * @property {PointLike | null | undefined} [end]
 *
 * @typedef NodeLike
 * @property {PositionLike | null | undefined} [position]
 */

/**
 * Check if `node` is generated.
 *
 * @param {NodeLike | null | undefined} [node]
 *   Node to check.
 * @returns {boolean}
 *   Whether `node` is generated (does not have positional info).
 */
      function generated(node) {
        return (
          !node ||
    !node.position ||
    !node.position.start ||
    !node.position.start.line ||
    !node.position.start.column ||
    !node.position.end ||
    !node.position.end.line ||
    !node.position.end.column
        )
      }


/***/ }),

/***/ "./node_modules/unist-util-is/lib/index.js":
/*!*************************************************!*\
  !*** ./node_modules/unist-util-is/lib/index.js ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   convert: () => (/* binding */ convert),
/* harmony export */   is: () => (/* binding */ is)
/* harmony export */ });
/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist').Parent} Parent
 */

/**
 * @typedef {Record<string, unknown>} Props
 * @typedef {null | undefined | string | Props | TestFunctionAnything | Array<string | Props | TestFunctionAnything>} Test
 *   Check for an arbitrary node, unaware of TypeScript inferral.
 *
 * @callback TestFunctionAnything
 *   Check if a node passes a test, unaware of TypeScript inferral.
 * @param {unknown} this
 *   The given context.
 * @param {Node} node
 *   A node.
 * @param {number | null | undefined} [index]
 *   The node’s position in its parent.
 * @param {Parent | null | undefined} [parent]
 *   The node’s parent.
 * @returns {boolean | void}
 *   Whether this node passes the test.
 */

/**
 * @template {Node} Kind
 *   Node type.
 * @typedef {Kind['type'] | Partial<Kind> | TestFunctionPredicate<Kind> | Array<Kind['type'] | Partial<Kind> | TestFunctionPredicate<Kind>>} PredicateTest
 *   Check for a node that can be inferred by TypeScript.
 */

/**
 * Check if a node passes a certain test.
 *
 * @template {Node} Kind
 *   Node type.
 * @callback TestFunctionPredicate
 *   Complex test function for a node that can be inferred by TypeScript.
 * @param {Node} node
 *   A node.
 * @param {number | null | undefined} [index]
 *   The node’s position in its parent.
 * @param {Parent | null | undefined} [parent]
 *   The node’s parent.
 * @returns {node is Kind}
 *   Whether this node passes the test.
 */

/**
 * @callback AssertAnything
 *   Check that an arbitrary value is a node, unaware of TypeScript inferral.
 * @param {unknown} [node]
 *   Anything (typically a node).
 * @param {number | null | undefined} [index]
 *   The node’s position in its parent.
 * @param {Parent | null | undefined} [parent]
 *   The node’s parent.
 * @returns {boolean}
 *   Whether this is a node and passes a test.
 */

/**
 * Check if a node is a node and passes a certain node test.
 *
 * @template {Node} Kind
 *   Node type.
 * @callback AssertPredicate
 *   Check that an arbitrary value is a specific node, aware of TypeScript.
 * @param {unknown} [node]
 *   Anything (typically a node).
 * @param {number | null | undefined} [index]
 *   The node’s position in its parent.
 * @param {Parent | null | undefined} [parent]
 *   The node’s parent.
 * @returns {node is Kind}
 *   Whether this is a node and passes a test.
 */

/**
 * Check if `node` is a `Node` and whether it passes the given test.
 *
 * @param node
 *   Thing to check, typically `Node`.
 * @param test
 *   A check for a specific node.
 * @param index
 *   The node’s position in its parent.
 * @param parent
 *   The node’s parent.
 * @returns
 *   Whether `node` is a node and passes a test.
 */
      const is =
  /**
   * @type {(
   *   (() => false) &
   *   (<Kind extends Node = Node>(node: unknown, test: PredicateTest<Kind>, index: number, parent: Parent, context?: unknown) => node is Kind) &
   *   (<Kind extends Node = Node>(node: unknown, test: PredicateTest<Kind>, index?: null | undefined, parent?: null | undefined, context?: unknown) => node is Kind) &
   *   ((node: unknown, test: Test, index: number, parent: Parent, context?: unknown) => boolean) &
   *   ((node: unknown, test?: Test, index?: null | undefined, parent?: null | undefined, context?: unknown) => boolean)
   * )}
   */
  (
    /**
     * @param {unknown} [node]
     * @param {Test} [test]
     * @param {number | null | undefined} [index]
     * @param {Parent | null | undefined} [parent]
     * @param {unknown} [context]
     * @returns {boolean}
     */
    // eslint-disable-next-line max-params
    function is(node, test, index, parent, context) {
      const check = convert(test)

      if (
        index !== undefined &&
        index !== null &&
        (typeof index !== 'number' ||
          index < 0 ||
          index === Number.POSITIVE_INFINITY)
      ) {
        throw new Error('Expected positive finite index')
      }

      if (
        parent !== undefined &&
        parent !== null &&
        (!is(parent) || !parent.children)
      ) {
        throw new Error('Expected parent node')
      }

      if (
        (parent === undefined || parent === null) !==
        (index === undefined || index === null)
      ) {
        throw new Error('Expected both parent and index')
      }

      // @ts-expect-error Looks like a node.
      return node && node.type && typeof node.type === 'string'
        ? Boolean(check.call(context, node, index, parent))
        : false
    }
  )

/**
 * Generate an assertion from a test.
 *
 * Useful if you’re going to test many nodes, for example when creating a
 * utility where something else passes a compatible test.
 *
 * The created function is a bit faster because it expects valid input only:
 * a `node`, `index`, and `parent`.
 *
 * @param test
 *   *   when nullish, checks if `node` is a `Node`.
 *   *   when `string`, works like passing `(node) => node.type === test`.
 *   *   when `function` checks if function passed the node is true.
 *   *   when `object`, checks that all keys in test are in node, and that they have (strictly) equal values.
 *   *   when `array`, checks if any one of the subtests pass.
 * @returns
 *   An assertion.
 */
      const convert =
  /**
   * @type {(
   *   (<Kind extends Node>(test: PredicateTest<Kind>) => AssertPredicate<Kind>) &
   *   ((test?: Test) => AssertAnything)
   * )}
   */
  (
    /**
     * @param {Test} [test]
     * @returns {AssertAnything}
     */
    function (test) {
      if (test === undefined || test === null) {
        return ok
      }

      if (typeof test === 'string') {
        return typeFactory(test)
      }

      if (typeof test === 'object') {
        return Array.isArray(test) ? anyFactory(test) : propsFactory(test)
      }

      if (typeof test === 'function') {
        return castFactory(test)
      }

      throw new Error('Expected function, string, or object as test')
    }
  )

/**
 * @param {Array<string | Props | TestFunctionAnything>} tests
 * @returns {AssertAnything}
 */
      function anyFactory(tests) {
  /** @type {Array<AssertAnything>} */
        const checks = []
        let index = -1

        while (++index < tests.length) {
          checks[index] = convert(tests[index])
        }

        return castFactory(any)

  /**
   * @this {unknown}
   * @param {Array<unknown>} parameters
   * @returns {boolean}
   */
        function any(...parameters) {
          let index = -1

          while (++index < checks.length) {
            if (checks[index].call(this, ...parameters)) return true
          }

          return false
        }
      }

/**
 * Turn an object into a test for a node with a certain fields.
 *
 * @param {Props} check
 * @returns {AssertAnything}
 */
      function propsFactory(check) {
        return castFactory(all)

  /**
   * @param {Node} node
   * @returns {boolean}
   */
        function all(node) {
    /** @type {string} */
          let key

          for (key in check) {
      // @ts-expect-error: hush, it sure works as an index.
            if (node[key] !== check[key]) return false
          }

          return true
        }
      }

/**
 * Turn a string into a test for a node with a certain type.
 *
 * @param {string} check
 * @returns {AssertAnything}
 */
      function typeFactory(check) {
        return castFactory(type)

  /**
   * @param {Node} node
   */
        function type(node) {
          return node && node.type === check
        }
      }

/**
 * Turn a custom test into a test for a node that passes that test.
 *
 * @param {TestFunctionAnything} check
 * @returns {AssertAnything}
 */
      function castFactory(check) {
        return assertion

  /**
   * @this {unknown}
   * @param {unknown} node
   * @param {Array<unknown>} parameters
   * @returns {boolean}
   */
        function assertion(node, ...parameters) {
          return Boolean(
            node &&
        typeof node === 'object' &&
        'type' in node &&
        // @ts-expect-error: fine.
        Boolean(check.call(this, node, ...parameters))
          )
        }
      }

      function ok() {
        return true
      }


/***/ }),

/***/ "./node_modules/unist-util-position/lib/index.js":
/*!*******************************************************!*\
  !*** ./node_modules/unist-util-position/lib/index.js ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pointEnd: () => (/* binding */ pointEnd),
/* harmony export */   pointStart: () => (/* binding */ pointStart),
/* harmony export */   position: () => (/* binding */ position)
/* harmony export */ });
/**
 * @typedef {import('unist').Position} Position
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist').Point} Point
 */

/**
 * @typedef NodeLike
 * @property {string} type
 * @property {PositionLike | null | undefined} [position]
 *
 * @typedef PositionLike
 * @property {PointLike | null | undefined} [start]
 * @property {PointLike | null | undefined} [end]
 *
 * @typedef PointLike
 * @property {number | null | undefined} [line]
 * @property {number | null | undefined} [column]
 * @property {number | null | undefined} [offset]
 */

/**
 * Get the starting point of `node`.
 *
 * @param node
 *   Node.
 * @returns
 *   Point.
 */
      const pointStart = point('start')

/**
 * Get the ending point of `node`.
 *
 * @param node
 *   Node.
 * @returns
 *   Point.
 */
      const pointEnd = point('end')

/**
 * Get the positional info of `node`.
 *
 * @param {NodeLike | Node | null | undefined} [node]
 *   Node.
 * @returns {Position}
 *   Position.
 */
      function position(node) {
        return {start: pointStart(node), end: pointEnd(node)}
      }

/**
 * Get the positional info of `node`.
 *
 * @param {'start' | 'end'} type
 *   Side.
 * @returns
 *   Getter.
 */
      function point(type) {
        return point

  /**
   * Get the point info of `node` at a bound side.
   *
   * @param {NodeLike | Node | null | undefined} [node]
   * @returns {Point}
   */
        function point(node) {
          const point = (node && node.position && node.position[type]) || {}

    // To do: next major: don’t return points when invalid.
          return {
      // @ts-expect-error: in practice, null is allowed.
            line: point.line || null,
      // @ts-expect-error: in practice, null is allowed.
            column: point.column || null,
      // @ts-expect-error: in practice, null is allowed.
            offset: point.offset > -1 ? point.offset : null
          }
        }
      }


/***/ }),

/***/ "./node_modules/unist-util-stringify-position/lib/index.js":
/*!*****************************************************************!*\
  !*** ./node_modules/unist-util-stringify-position/lib/index.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   stringifyPosition: () => (/* binding */ stringifyPosition)
/* harmony export */ });
/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist').Point} Point
 * @typedef {import('unist').Position} Position
 */

/**
 * @typedef NodeLike
 * @property {string} type
 * @property {PositionLike | null | undefined} [position]
 *
 * @typedef PositionLike
 * @property {PointLike | null | undefined} [start]
 * @property {PointLike | null | undefined} [end]
 *
 * @typedef PointLike
 * @property {number | null | undefined} [line]
 * @property {number | null | undefined} [column]
 * @property {number | null | undefined} [offset]
 */

/**
 * Serialize the positional info of a point, position (start and end points),
 * or node.
 *
 * @param {Node | NodeLike | Position | PositionLike | Point | PointLike | null | undefined} [value]
 *   Node, position, or point.
 * @returns {string}
 *   Pretty printed positional info of a node (`string`).
 *
 *   In the format of a range `ls:cs-le:ce` (when given `node` or `position`)
 *   or a point `l:c` (when given `point`), where `l` stands for line, `c` for
 *   column, `s` for `start`, and `e` for end.
 *   An empty string (`''`) is returned if the given value is neither `node`,
 *   `position`, nor `point`.
 */
      function stringifyPosition(value) {
  // Nothing.
        if (!value || typeof value !== 'object') {
          return ''
        }

  // Node.
        if ('position' in value || 'type' in value) {
          return position(value.position)
        }

  // Position.
        if ('start' in value || 'end' in value) {
          return position(value)
        }

  // Point.
        if ('line' in value || 'column' in value) {
          return point(value)
        }

  // ?
        return ''
      }

/**
 * @param {Point | PointLike | null | undefined} point
 * @returns {string}
 */
      function point(point) {
        return index(point && point.line) + ':' + index(point && point.column)
      }

/**
 * @param {Position | PositionLike | null | undefined} pos
 * @returns {string}
 */
      function position(pos) {
        return point(pos && pos.start) + '-' + point(pos && pos.end)
      }

/**
 * @param {number | null | undefined} value
 * @returns {number}
 */
      function index(value) {
        return value && typeof value === 'number' ? value : 1
      }


/***/ }),

/***/ "./node_modules/unist-util-visit-parents/lib/color.browser.js":
/*!********************************************************************!*\
  !*** ./node_modules/unist-util-visit-parents/lib/color.browser.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   color: () => (/* binding */ color)
/* harmony export */ });
/**
 * @param {string} d
 * @returns {string}
 */
      function color(d) {
        return d
      }


/***/ }),

/***/ "./node_modules/unist-util-visit-parents/lib/index.js":
/*!************************************************************!*\
  !*** ./node_modules/unist-util-visit-parents/lib/index.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CONTINUE: () => (/* binding */ CONTINUE),
/* harmony export */   EXIT: () => (/* binding */ EXIT),
/* harmony export */   SKIP: () => (/* binding */ SKIP),
/* harmony export */   visitParents: () => (/* binding */ visitParents)
/* harmony export */ });
/* harmony import */ const unist_util_is__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-util-is */ "./node_modules/unist-util-is/lib/index.js");
/* harmony import */ const _color_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./color.js */ "./node_modules/unist-util-visit-parents/lib/color.browser.js");
/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist').Parent} Parent
 * @typedef {import('unist-util-is').Test} Test
 */

/**
 * @typedef {boolean | 'skip'} Action
 *   Union of the action types.
 *
 * @typedef {number} Index
 *   Move to the sibling at `index` next (after node itself is completely
 *   traversed).
 *
 *   Useful if mutating the tree, such as removing the node the visitor is
 *   currently on, or any of its previous siblings.
 *   Results less than 0 or greater than or equal to `children.length` stop
 *   traversing the parent.
 *
 * @typedef {[(Action | null | undefined | void)?, (Index | null | undefined)?]} ActionTuple
 *   List with one or two values, the first an action, the second an index.
 *
 * @typedef {Action | ActionTuple | Index | null | undefined | void} VisitorResult
 *   Any value that can be returned from a visitor.
 */

/**
 * @template {Node} [Visited=Node]
 *   Visited node type.
 * @template {Parent} [Ancestor=Parent]
 *   Ancestor type.
 * @callback Visitor
 *   Handle a node (matching `test`, if given).
 *
 *   Visitors are free to transform `node`.
 *   They can also transform the parent of node (the last of `ancestors`).
 *
 *   Replacing `node` itself, if `SKIP` is not returned, still causes its
 *   descendants to be walked (which is a bug).
 *
 *   When adding or removing previous siblings of `node` (or next siblings, in
 *   case of reverse), the `Visitor` should return a new `Index` to specify the
 *   sibling to traverse after `node` is traversed.
 *   Adding or removing next siblings of `node` (or previous siblings, in case
 *   of reverse) is handled as expected without needing to return a new `Index`.
 *
 *   Removing the children property of an ancestor still results in them being
 *   traversed.
 * @param {Visited} node
 *   Found node.
 * @param {Array<Ancestor>} ancestors
 *   Ancestors of `node`.
 * @returns {VisitorResult}
 *   What to do next.
 *
 *   An `Index` is treated as a tuple of `[CONTINUE, Index]`.
 *   An `Action` is treated as a tuple of `[Action]`.
 *
 *   Passing a tuple back only makes sense if the `Action` is `SKIP`.
 *   When the `Action` is `EXIT`, that action can be returned.
 *   When the `Action` is `CONTINUE`, `Index` can be returned.
 */

/**
 * @template {Node} [Tree=Node]
 *   Tree type.
 * @template {Test} [Check=string]
 *   Test type.
 * @typedef {Visitor<import('./complex-types.js').Matches<import('./complex-types.js').InclusiveDescendant<Tree>, Check>, Extract<import('./complex-types.js').InclusiveDescendant<Tree>, Parent>>} BuildVisitor
 *   Build a typed `Visitor` function from a tree and a test.
 *
 *   It will infer which values are passed as `node` and which as `parents`.
 */




/**
 * Continue traversing as normal.
 */
      const CONTINUE = true

/**
 * Stop traversing immediately.
 */
      const EXIT = false

/**
 * Do not traverse this node’s children.
 */
      const SKIP = 'skip'

/**
 * Visit nodes, with ancestral information.
 *
 * This algorithm performs *depth-first* *tree traversal* in *preorder*
 * (**NLR**) or if `reverse` is given, in *reverse preorder* (**NRL**).
 *
 * You can choose for which nodes `visitor` is called by passing a `test`.
 * For complex tests, you should test yourself in `visitor`, as it will be
 * faster and will have improved type information.
 *
 * Walking the tree is an intensive task.
 * Make use of the return values of the visitor when possible.
 * Instead of walking a tree multiple times, walk it once, use `unist-util-is`
 * to check if a node matches, and then perform different operations.
 *
 * You can change the tree.
 * See `Visitor` for more info.
 *
 * @param tree
 *   Tree to traverse.
 * @param test
 *   `unist-util-is`-compatible test
 * @param visitor
 *   Handle each node.
 * @param reverse
 *   Traverse in reverse preorder (NRL) instead of the default preorder (NLR).
 * @returns
 *   Nothing.
 */
      const visitParents =
  /**
   * @type {(
   *   (<Tree extends Node, Check extends Test>(tree: Tree, test: Check, visitor: BuildVisitor<Tree, Check>, reverse?: boolean | null | undefined) => void) &
   *   (<Tree extends Node>(tree: Tree, visitor: BuildVisitor<Tree>, reverse?: boolean | null | undefined) => void)
   * )}
   */
  (
    /**
     * @param {Node} tree
     * @param {Test} test
     * @param {Visitor<Node>} visitor
     * @param {boolean | null | undefined} [reverse]
     * @returns {void}
     */
    function (tree, test, visitor, reverse) {
      if (typeof test === 'function' && typeof visitor !== 'function') {
        reverse = visitor
        // @ts-expect-error no visitor given, so `visitor` is test.
        visitor = test
        test = null
      }

      const is = (0,unist_util_is__WEBPACK_IMPORTED_MODULE_0__.convert)(test)
      const step = reverse ? -1 : 1

      factory(tree, undefined, [])()

      /**
       * @param {Node} node
       * @param {number | undefined} index
       * @param {Array<Parent>} parents
       */
      function factory(node, index, parents) {
        /** @type {Record<string, unknown>} */
        // @ts-expect-error: hush
        const value = node && typeof node === 'object' ? node : {}

        if (typeof value.type === 'string') {
          const name =
            // `hast`
            typeof value.tagName === 'string'
              ? value.tagName
              : // `xast`
              typeof value.name === 'string'
                ? value.name
                : undefined

          Object.defineProperty(visit, 'name', {
            value:
              'node (' + (0,_color_js__WEBPACK_IMPORTED_MODULE_1__.color)(node.type + (name ? '<' + name + '>' : '')) + ')'
          })
        }

        return visit

        function visit() {
          /** @type {ActionTuple} */
          let result = []
          /** @type {ActionTuple} */
          let subresult
          /** @type {number} */
          let offset
          /** @type {Array<Parent>} */
          let grandparents

          if (!test || is(node, index, parents[parents.length - 1] || null)) {
            result = toResult(visitor(node, parents))

            if (result[0] === EXIT) {
              return result
            }
          }

          // @ts-expect-error looks like a parent.
          if (node.children && result[0] !== SKIP) {
            // @ts-expect-error looks like a parent.
            offset = (reverse ? node.children.length : -1) + step
            // @ts-expect-error looks like a parent.
            grandparents = parents.concat(node)

            // @ts-expect-error looks like a parent.
            while (offset > -1 && offset < node.children.length) {
              // @ts-expect-error looks like a parent.
              subresult = factory(node.children[offset], offset, grandparents)()

              if (subresult[0] === EXIT) {
                return subresult
              }

              offset =
                typeof subresult[1] === 'number' ? subresult[1] : offset + step
            }
          }

          return result
        }
      }
    }
  )

/**
 * Turn a return value into a clean result.
 *
 * @param {VisitorResult} value
 *   Valid return values from visitors.
 * @returns {ActionTuple}
 *   Clean result.
 */
      function toResult(value) {
        if (Array.isArray(value)) {
          return value
        }

        if (typeof value === 'number') {
          return [CONTINUE, value]
        }

        return [value]
      }


/***/ }),

/***/ "./node_modules/unist-util-visit/lib/index.js":
/*!****************************************************!*\
  !*** ./node_modules/unist-util-visit/lib/index.js ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CONTINUE: () => (/* reexport safe */ unist_util_visit_parents__WEBPACK_IMPORTED_MODULE_0__.CONTINUE),
/* harmony export */   EXIT: () => (/* reexport safe */ unist_util_visit_parents__WEBPACK_IMPORTED_MODULE_0__.EXIT),
/* harmony export */   SKIP: () => (/* reexport safe */ unist_util_visit_parents__WEBPACK_IMPORTED_MODULE_0__.SKIP),
/* harmony export */   visit: () => (/* binding */ visit)
/* harmony export */ });
/* harmony import */ var unist_util_visit_parents__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-util-visit-parents */ "./node_modules/unist-util-visit-parents/lib/index.js");
/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist').Parent} Parent
 * @typedef {import('unist-util-is').Test} Test
 * @typedef {import('unist-util-visit-parents').VisitorResult} VisitorResult
 */

/**
 * Check if `Child` can be a child of `Ancestor`.
 *
 * Returns the ancestor when `Child` can be a child of `Ancestor`, or returns
 * `never`.
 *
 * @template {Node} Ancestor
 *   Node type.
 * @template {Node} Child
 *   Node type.
 * @typedef {(
 *   Ancestor extends Parent
 *     ? Child extends Ancestor['children'][number]
 *       ? Ancestor
 *       : never
 *     : never
 * )} ParentsOf
 */

/**
 * @template {Node} [Visited=Node]
 *   Visited node type.
 * @template {Parent} [Ancestor=Parent]
 *   Ancestor type.
 * @callback Visitor
 *   Handle a node (matching `test`, if given).
 *
 *   Visitors are free to transform `node`.
 *   They can also transform `parent`.
 *
 *   Replacing `node` itself, if `SKIP` is not returned, still causes its
 *   descendants to be walked (which is a bug).
 *
 *   When adding or removing previous siblings of `node` (or next siblings, in
 *   case of reverse), the `Visitor` should return a new `Index` to specify the
 *   sibling to traverse after `node` is traversed.
 *   Adding or removing next siblings of `node` (or previous siblings, in case
 *   of reverse) is handled as expected without needing to return a new `Index`.
 *
 *   Removing the children property of `parent` still results in them being
 *   traversed.
 * @param {Visited} node
 *   Found node.
 * @param {Visited extends Node ? number | null : never} index
 *   Index of `node` in `parent`.
 * @param {Ancestor extends Node ? Ancestor | null : never} parent
 *   Parent of `node`.
 * @returns {VisitorResult}
 *   What to do next.
 *
 *   An `Index` is treated as a tuple of `[CONTINUE, Index]`.
 *   An `Action` is treated as a tuple of `[Action]`.
 *
 *   Passing a tuple back only makes sense if the `Action` is `SKIP`.
 *   When the `Action` is `EXIT`, that action can be returned.
 *   When the `Action` is `CONTINUE`, `Index` can be returned.
 */

/**
 * Build a typed `Visitor` function from a node and all possible parents.
 *
 * It will infer which values are passed as `node` and which as `parent`.
 *
 * @template {Node} Visited
 *   Node type.
 * @template {Parent} Ancestor
 *   Parent type.
 * @typedef {Visitor<Visited, ParentsOf<Ancestor, Visited>>} BuildVisitorFromMatch
 */

/**
 * Build a typed `Visitor` function from a list of descendants and a test.
 *
 * It will infer which values are passed as `node` and which as `parent`.
 *
 * @template {Node} Descendant
 *   Node type.
 * @template {Test} Check
 *   Test type.
 * @typedef {(
 *   BuildVisitorFromMatch<
 *     import('unist-util-visit-parents/complex-types.js').Matches<Descendant, Check>,
 *     Extract<Descendant, Parent>
 *   >
 * )} BuildVisitorFromDescendants
 */

/**
 * Build a typed `Visitor` function from a tree and a test.
 *
 * It will infer which values are passed as `node` and which as `parent`.
 *
 * @template {Node} [Tree=Node]
 *   Node type.
 * @template {Test} [Check=string]
 *   Test type.
 * @typedef {(
 *   BuildVisitorFromDescendants<
 *     import('unist-util-visit-parents/complex-types.js').InclusiveDescendant<Tree>,
 *     Check
 *   >
 * )} BuildVisitor
 */



/**
 * Visit nodes.
 *
 * This algorithm performs *depth-first* *tree traversal* in *preorder*
 * (**NLR**) or if `reverse` is given, in *reverse preorder* (**NRL**).
 *
 * You can choose for which nodes `visitor` is called by passing a `test`.
 * For complex tests, you should test yourself in `visitor`, as it will be
 * faster and will have improved type information.
 *
 * Walking the tree is an intensive task.
 * Make use of the return values of the visitor when possible.
 * Instead of walking a tree multiple times, walk it once, use `unist-util-is`
 * to check if a node matches, and then perform different operations.
 *
 * You can change the tree.
 * See `Visitor` for more info.
 *
 * @param tree
 *   Tree to traverse.
 * @param test
 *   `unist-util-is`-compatible test
 * @param visitor
 *   Handle each node.
 * @param reverse
 *   Traverse in reverse preorder (NRL) instead of the default preorder (NLR).
 * @returns
 *   Nothing.
 */
      const visit =
  /**
   * @type {(
   *   (<Tree extends Node, Check extends Test>(tree: Tree, test: Check, visitor: BuildVisitor<Tree, Check>, reverse?: boolean | null | undefined) => void) &
   *   (<Tree extends Node>(tree: Tree, visitor: BuildVisitor<Tree>, reverse?: boolean | null | undefined) => void)
   * )}
   */
  (
    /**
     * @param {Node} tree
     * @param {Test} test
     * @param {Visitor} visitor
     * @param {boolean | null | undefined} [reverse]
     * @returns {void}
     */
    function (tree, test, visitor, reverse) {
      if (typeof test === 'function' && typeof visitor !== 'function') {
        reverse = visitor
        visitor = test
        test = null
      }

      (0,unist_util_visit_parents__WEBPACK_IMPORTED_MODULE_0__.visitParents)(tree, test, overload, reverse)

      /**
       * @param {Node} node
       * @param {Array<Parent>} parents
       */
      function overload(node, parents) {
        const parent = parents[parents.length - 1]
        return visitor(
          node,
          parent ? parent.children.indexOf(node) : null,
          parent
        )
      }
    }
  )




/***/ }),

/***/ "./node_modules/uvu/assert/index.mjs":
/*!*******************************************!*\
  !*** ./node_modules/uvu/assert/index.mjs ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Assertion: () => (/* binding */ Assertion),
/* harmony export */   equal: () => (/* binding */ equal),
/* harmony export */   fixture: () => (/* binding */ fixture),
/* harmony export */   instance: () => (/* binding */ instance),
/* harmony export */   is: () => (/* binding */ is),
/* harmony export */   match: () => (/* binding */ match),
/* harmony export */   not: () => (/* binding */ not),
/* harmony export */   ok: () => (/* binding */ ok),
/* harmony export */   snapshot: () => (/* binding */ snapshot),
/* harmony export */   throws: () => (/* binding */ throws),
/* harmony export */   type: () => (/* binding */ type),
/* harmony export */   unreachable: () => (/* binding */ unreachable)
/* harmony export */ });
/* harmony import */ const dequal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! dequal */ "./node_modules/dequal/dist/index.mjs");
/* harmony import */ const uvu_diff__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! uvu/diff */ "./node_modules/uvu/diff/index.mjs");



      function dedent(str) {
        str = str.replace(/\r?\n/g, '\n');
        const arr = str.match(/^[ \t]*(?=\S)/gm);
        let i = 0, min = 1/0, len = (arr||[]).length;
        for (; i < len; i++) min = Math.min(min, arr[i].length);
        return len && min ? str.replace(new RegExp(`^[ \\t]{${min}}`, 'gm'), '') : str;
      }

      class Assertion extends Error {
        constructor(opts={}) {
          super(opts.message);
          this.name = 'Assertion';
          this.code = 'ERR_ASSERTION';
          if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
          }
          this.details = opts.details || false;
          this.generated = !!opts.generated;
          this.operator = opts.operator;
          this.expects = opts.expects;
          this.actual = opts.actual;
        }
      }

      function assert(bool, actual, expects, operator, detailer, backup, msg) {
        if (bool) return;
        const message = msg || backup;
        if (msg instanceof Error) throw msg;
        const details = detailer && detailer(actual, expects);
        throw new Assertion({ actual, expects, operator, message, details, generated: !msg });
      }

      function ok(val, msg) {
        assert(!!val, false, true, 'ok', false, 'Expected value to be truthy', msg);
      }

      function is(val, exp, msg) {
        assert(val === exp, val, exp, 'is', uvu_diff__WEBPACK_IMPORTED_MODULE_1__.compare, 'Expected values to be strictly equal:', msg);
      }

      function equal(val, exp, msg) {
        assert((0,dequal__WEBPACK_IMPORTED_MODULE_0__.dequal)(val, exp), val, exp, 'equal', uvu_diff__WEBPACK_IMPORTED_MODULE_1__.compare, 'Expected values to be deeply equal:', msg);
      }

      function unreachable(msg) {
        assert(false, true, false, 'unreachable', false, 'Expected not to be reached!', msg);
      }

      function type(val, exp, msg) {
        const tmp = typeof val;
        assert(tmp === exp, tmp, exp, 'type', false, `Expected "${tmp}" to be "${exp}"`, msg);
      }

      function instance(val, exp, msg) {
        const name = '`' + (exp.name || exp.constructor.name) + '`';
        assert(val instanceof exp, val, exp, 'instance', false, `Expected value to be an instance of ${name}`, msg);
      }

      function match(val, exp, msg) {
        if (typeof exp === 'string') {
          assert(val.includes(exp), val, exp, 'match', false, `Expected value to include "${exp}" substring`, msg);
        } else {
          assert(exp.test(val), val, exp, 'match', false, `Expected value to match \`${String(exp)}\` pattern`, msg);
        }
      }

      function snapshot(val, exp, msg) {
        val=dedent(val); exp=dedent(exp);
        assert(val === exp, val, exp, 'snapshot', uvu_diff__WEBPACK_IMPORTED_MODULE_1__.lines, 'Expected value to match snapshot:', msg);
      }

      const lineNums = (x, y) => (0,uvu_diff__WEBPACK_IMPORTED_MODULE_1__.lines)(x, y, 1);
      function fixture(val, exp, msg) {
        val=dedent(val); exp=dedent(exp);
        assert(val === exp, val, exp, 'fixture', lineNums, 'Expected value to match fixture:', msg);
      }

      function throws(blk, exp, msg) {
        if (!msg && typeof exp === 'string') {
          msg = exp; exp = null;
        }

        try {
          blk();
          assert(false, false, true, 'throws', false, 'Expected function to throw', msg);
        } catch (err) {
          if (err instanceof Assertion) throw err;

          if (typeof exp === 'function') {
            assert(exp(err), false, true, 'throws', false, 'Expected function to throw matching exception', msg);
          } else if (exp instanceof RegExp) {
            assert(exp.test(err.message), false, true, 'throws', false, `Expected function to throw exception matching \`${String(exp)}\` pattern`, msg);
          }
        }
      }

// ---

      function not(val, msg) {
        assert(!val, true, false, 'not', false, 'Expected value to be falsey', msg);
      }

      not.ok = not;

      is.not = function (val, exp, msg) {
        assert(val !== exp, val, exp, 'is.not', false, 'Expected values not to be strictly equal', msg);
      }

      not.equal = function (val, exp, msg) {
        assert(!(0,dequal__WEBPACK_IMPORTED_MODULE_0__.dequal)(val, exp), val, exp, 'not.equal', false, 'Expected values not to be deeply equal', msg);
      }

      not.type = function (val, exp, msg) {
        const tmp = typeof val;
        assert(tmp !== exp, tmp, exp, 'not.type', false, `Expected "${tmp}" not to be "${exp}"`, msg);
      }

      not.instance = function (val, exp, msg) {
        const name = '`' + (exp.name || exp.constructor.name) + '`';
        assert(!(val instanceof exp), val, exp, 'not.instance', false, `Expected value not to be an instance of ${name}`, msg);
      }

      not.snapshot = function (val, exp, msg) {
        val=dedent(val); exp=dedent(exp);
        assert(val !== exp, val, exp, 'not.snapshot', false, 'Expected value not to match snapshot', msg);
      }

      not.fixture = function (val, exp, msg) {
        val=dedent(val); exp=dedent(exp);
        assert(val !== exp, val, exp, 'not.fixture', false, 'Expected value not to match fixture', msg);
      }

      not.match = function (val, exp, msg) {
        if (typeof exp === 'string') {
          assert(!val.includes(exp), val, exp, 'not.match', false, `Expected value not to include "${exp}" substring`, msg);
        } else {
          assert(!exp.test(val), val, exp, 'not.match', false, `Expected value not to match \`${String(exp)}\` pattern`, msg);
        }
      }

      not.throws = function (blk, exp, msg) {
        if (!msg && typeof exp === 'string') {
          msg = exp; exp = null;
        }

        try {
          blk();
        } catch (err) {
          if (typeof exp === 'function') {
            assert(!exp(err), true, false, 'not.throws', false, 'Expected function not to throw matching exception', msg);
          } else if (exp instanceof RegExp) {
            assert(!exp.test(err.message), true, false, 'not.throws', false, `Expected function not to throw exception matching \`${String(exp)}\` pattern`, msg);
          } else if (!exp) {
            assert(false, true, false, 'not.throws', false, 'Expected function not to throw', msg);
          }
        }
      }


/***/ }),

/***/ "./node_modules/uvu/diff/index.mjs":
/*!*****************************************!*\
  !*** ./node_modules/uvu/diff/index.mjs ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   arrays: () => (/* binding */ arrays),
/* harmony export */   chars: () => (/* binding */ chars),
/* harmony export */   circular: () => (/* binding */ circular),
/* harmony export */   compare: () => (/* binding */ compare),
/* harmony export */   direct: () => (/* binding */ direct),
/* harmony export */   lines: () => (/* binding */ lines),
/* harmony export */   sort: () => (/* binding */ sort),
/* harmony export */   stringify: () => (/* binding */ stringify)
/* harmony export */ });
/* harmony import */ const kleur__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! kleur */ "./node_modules/kleur/index.mjs");
/* harmony import */ const diff__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! diff */ "./node_modules/diff/lib/index.mjs");



      const colors = {
        '--': kleur__WEBPACK_IMPORTED_MODULE_0__["default"].red,
        '··': kleur__WEBPACK_IMPORTED_MODULE_0__["default"].grey,
        '++': kleur__WEBPACK_IMPORTED_MODULE_0__["default"].green,
      };

      const TITLE = kleur__WEBPACK_IMPORTED_MODULE_0__["default"].dim().italic;
      const TAB=kleur__WEBPACK_IMPORTED_MODULE_0__["default"].dim('→'), SPACE=kleur__WEBPACK_IMPORTED_MODULE_0__["default"].dim('·'), NL=kleur__WEBPACK_IMPORTED_MODULE_0__["default"].dim('↵');
      const LOG = (sym, str) => colors[sym](sym + PRETTY(str)) + '\n';
      const LINE = (num, x) => kleur__WEBPACK_IMPORTED_MODULE_0__["default"].dim('L' + String(num).padStart(x, '0') + ' ');
      const PRETTY = str => str.replace(/[ ]/g, SPACE).replace(/\t/g, TAB).replace(/(\r?\n)/g, NL);

      function line(obj, prev, pad) {
        const char = obj.removed ? '--' : obj.added ? '++' : '··';
        const arr = obj.value.replace(/\r?\n$/, '').split('\n');
        let i=0, tmp, out='';

        if (obj.added) out += colors[char]().underline(TITLE('Expected:')) + '\n';
        else if (obj.removed) out += colors[char]().underline(TITLE('Actual:')) + '\n';

        for (; i < arr.length; i++) {
          tmp = arr[i];
          if (tmp != null) {
            if (prev) out += LINE(prev + i, pad);
            out += LOG(char, tmp || '\n');
          }
        }

        return out;
      }

// TODO: want better diffing
//~> complex items bail outright
      function arrays(input, expect) {
        const arr = diff__WEBPACK_IMPORTED_MODULE_1__.diffArrays(input, expect);
        let i=0, j=0, k=0, tmp, val, char, isObj, str;
        let out = LOG('··', '[');

        for (; i < arr.length; i++) {
          char = (tmp = arr[i]).removed ? '--' : tmp.added ? '++' : '··';

          if (tmp.added) {
            out += colors[char]().underline(TITLE('Expected:')) + '\n';
          } else if (tmp.removed) {
            out += colors[char]().underline(TITLE('Actual:')) + '\n';
          }

          for (j=0; j < tmp.value.length; j++) {
            isObj = (tmp.value[j] && typeof tmp.value[j] === 'object');
            val = stringify(tmp.value[j]).split(/\r?\n/g);
            for (k=0; k < val.length;) {
              str = '  ' + val[k++] + (isObj ? '' : ',');
              if (isObj && k === val.length && (j + 1) < tmp.value.length) str += ',';
              out += LOG(char, str);
            }
          }
        }

        return out + LOG('··', ']');
      }

      function lines(input, expect, linenum = 0) {
        let i=0, tmp, output='';
        const arr = diff__WEBPACK_IMPORTED_MODULE_1__.diffLines(input, expect);
        const pad = String(expect.split(/\r?\n/g).length - linenum).length;

        for (; i < arr.length; i++) {
          output += line(tmp = arr[i], linenum, pad);
          if (linenum && !tmp.removed) linenum += tmp.count;
        }

        return output;
      }

      function chars(input, expect) {
        const arr = diff__WEBPACK_IMPORTED_MODULE_1__.diffChars(input, expect);
        let i=0, output='', tmp;

        let l1 = input.length;
        let l2 = expect.length;

        let p1 = PRETTY(input);
        let p2 = PRETTY(expect);

        tmp = arr[i];

        if (l1 === l2) {
		// no length offsets
        } else if (tmp.removed && arr[i + 1]) {
          const del = tmp.count - arr[i + 1].count;
          if (del == 0) {
			// wash~
          } else if (del > 0) {
            expect = ' '.repeat(del) + expect;
            p2 = ' '.repeat(del) + p2;
            l2 += del;
          } else if (del < 0) {
            input = ' '.repeat(-del) + input;
            p1 = ' '.repeat(-del) + p1;
            l1 += -del;
          }
        }

        output += direct(p1, p2, l1, l2);

        if (l1 === l2) {
          for (tmp='  '; i < l1; i++) {
            tmp += input[i] === expect[i] ? ' ' : '^';
          }
        } else {
          for (tmp='  '; i < arr.length; i++) {
            tmp += ((arr[i].added || arr[i].removed) ? '^' : ' ').repeat(Math.max(arr[i].count, 0));
            if (i + 1 < arr.length && ((arr[i].added && arr[i+1].removed) || (arr[i].removed && arr[i+1].added))) {
              arr[i + 1].count -= arr[i].count;
            }
          }
        }

        return output + kleur__WEBPACK_IMPORTED_MODULE_0__["default"].red(tmp);
      }

      function direct(input, expect, lenA = String(input).length, lenB = String(expect).length) {
        let gutter = 4;
        let lenC = Math.max(lenA, lenB);
        const typeA=typeof input, typeB=typeof expect;

        if (typeA !== typeB) {
          gutter = 2;

          const delA = gutter + lenC - lenA;
          const delB = gutter + lenC - lenB;

          input += ' '.repeat(delA) + kleur__WEBPACK_IMPORTED_MODULE_0__["default"].dim(`[${typeA}]`);
          expect += ' '.repeat(delB) + kleur__WEBPACK_IMPORTED_MODULE_0__["default"].dim(`[${typeB}]`);

          lenA += delA + typeA.length + 2;
          lenB += delB + typeB.length + 2;
          lenC = Math.max(lenA, lenB);
        }

        const output = colors['++']('++' + expect + ' '.repeat(gutter + lenC - lenB) + TITLE('(Expected)')) + '\n';
        return output + colors['--']('--' + input + ' '.repeat(gutter + lenC - lenA) + TITLE('(Actual)')) + '\n';
      }

      function sort(input, expect) {
        let k, i=0, tmp, isArr = Array.isArray(input);
        const keys=[], out=isArr ? Array(input.length) : {};

        if (isArr) {
          for (i=0; i < out.length; i++) {
            tmp = input[i];
            if (!tmp || typeof tmp !== 'object') out[i] = tmp;
            else out[i] = sort(tmp, expect[i]); // might not be right
          }
        } else {
          for (k in expect)
            keys.push(k);

          for (; i < keys.length; i++) {
            if (Object.prototype.hasOwnProperty.call(input, k = keys[i])) {
              if (!(tmp = input[k]) || typeof tmp !== 'object') out[k] = tmp;
              else out[k] = sort(tmp, expect[k]);
            }
          }

          for (k in input) {
            if (!out.hasOwnProperty(k)) {
              out[k] = input[k]; // expect didnt have
            }
          }
        }

        return out;
      }

      function circular() {
        const cache = new Set;
        return function print(key, val) {
          if (val === void 0) return '[__VOID__]';
          if (typeof val === 'number' && val !== val) return '[__NAN__]';
          if (typeof val === 'bigint') return val.toString();
          if (!val || typeof val !== 'object') return val;
          if (cache.has(val)) return '[Circular]';
          cache.add(val); return val;
        }
      }

      function stringify(input) {
        return JSON.stringify(input, circular(), 2).replace(/"\[__NAN__\]"/g, 'NaN').replace(/"\[__VOID__\]"/g, 'undefined');
      }

      function compare(input, expect) {
        if (Array.isArray(expect) && Array.isArray(input)) return arrays(input, expect);
        if (expect instanceof RegExp) return chars(''+input, ''+expect);

        let isA = input && typeof input == 'object';
        let isB = expect && typeof expect == 'object';

        if (isA && isB) input = sort(input, expect);
        if (isB) expect = stringify(expect);
        if (isA) input = stringify(input);

        if (expect && typeof expect == 'object') {
          input = stringify(sort(input, expect));
          expect = stringify(expect);
        }

        isA = typeof input == 'string';
        isB = typeof expect == 'string';

        if (isA && /\r?\n/.test(input)) return lines(input, ''+expect);
        if (isB && /\r?\n/.test(expect)) return lines(''+input, expect);
        if (isA && isB) return chars(input, expect);

        return direct(input, expect);
      }


/***/ }),

/***/ "./node_modules/vfile-message/lib/index.js":
/*!*************************************************!*\
  !*** ./node_modules/vfile-message/lib/index.js ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VFileMessage: () => (/* binding */ VFileMessage)
/* harmony export */ });
/* harmony import */ const unist_util_stringify_position__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-util-stringify-position */ "./node_modules/unist-util-stringify-position/lib/index.js");
/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist').Position} Position
 * @typedef {import('unist').Point} Point
 * @typedef {object & {type: string, position?: Position | undefined}} NodeLike
 */



/**
 * Message.
 */
      class VFileMessage extends Error {
  /**
   * Create a message for `reason` at `place` from `origin`.
   *
   * When an error is passed in as `reason`, the `stack` is copied.
   *
   * @param {string | Error | VFileMessage} reason
   *   Reason for message, uses the stack and message of the error if given.
   *
   *   > 👉 **Note**: you should use markdown.
   * @param {Node | NodeLike | Position | Point | null | undefined} [place]
   *   Place in file where the message occurred.
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns
   *   Instance of `VFileMessage`.
   */
  // To do: next major: expose `undefined` everywhere instead of `null`.
        constructor(reason, place, origin) {
    /** @type {[string | null, string | null]} */
          const parts = [null, null]
    /** @type {Position} */
          let position = {
      // @ts-expect-error: we always follows the structure of `position`.
            start: {line: null, column: null},
      // @ts-expect-error: "
            end: {line: null, column: null}
          }

          super()

          if (typeof place === 'string') {
            origin = place
            place = undefined
          }

          if (typeof origin === 'string') {
            const index = origin.indexOf(':')

            if (index === -1) {
              parts[1] = origin
            } else {
              parts[0] = origin.slice(0, index)
              parts[1] = origin.slice(index + 1)
            }
          }

          if (place) {
      // Node.
            if ('type' in place || 'position' in place) {
              if (place.position) {
          // To do: next major: deep clone.
          // @ts-expect-error: looks like a position.
                position = place.position
              }
            }
      // Position.
            else if ('start' in place || 'end' in place) {
        // @ts-expect-error: looks like a position.
        // To do: next major: deep clone.
              position = place
            }
      // Point.
            else if ('line' in place || 'column' in place) {
        // To do: next major: deep clone.
              position.start = place
            }
          }

    // Fields from `Error`.
    /**
     * Serialized positional info of error.
     *
     * On normal errors, this would be something like `ParseError`, buit in
     * `VFile` messages we use this space to show where an error happened.
     */
          this.name = (0,unist_util_stringify_position__WEBPACK_IMPORTED_MODULE_0__.stringifyPosition)(place) || '1:1'

    /**
     * Reason for message.
     *
     * @type {string}
     */
          this.message = typeof reason === 'object' ? reason.message : reason

    /**
     * Stack of message.
     *
     * This is used by normal errors to show where something happened in
     * programming code, irrelevant for `VFile` messages,
     *
     * @type {string}
     */
          this.stack = ''

          if (typeof reason === 'object' && reason.stack) {
            this.stack = reason.stack
          }

    /**
     * Reason for message.
     *
     * > 👉 **Note**: you should use markdown.
     *
     * @type {string}
     */
          this.reason = this.message

    /* eslint-disable no-unused-expressions */
    /**
     * State of problem.
     *
     * * `true` — marks associated file as no longer processable (error)
     * * `false` — necessitates a (potential) change (warning)
     * * `null | undefined` — for things that might not need changing (info)
     *
     * @type {boolean | null | undefined}
     */
          this.fatal

    /**
     * Starting line of error.
     *
     * @type {number | null}
     */
          this.line = position.start.line

    /**
     * Starting column of error.
     *
     * @type {number | null}
     */
          this.column = position.start.column

    /**
     * Full unist position.
     *
     * @type {Position | null}
     */
          this.position = position

    /**
     * Namespace of message (example: `'my-package'`).
     *
     * @type {string | null}
     */
          this.source = parts[0]

    /**
     * Category of message (example: `'my-rule'`).
     *
     * @type {string | null}
     */
          this.ruleId = parts[1]

    /**
     * Path of a file (used throughout the `VFile` ecosystem).
     *
     * @type {string | null}
     */
          this.file

    // The following fields are “well known”.
    // Not standard.
    // Feel free to add other non-standard fields to your messages.

    /**
     * Specify the source value that’s being reported, which is deemed
     * incorrect.
     *
     * @type {string | null}
     */
          this.actual

    /**
     * Suggest acceptable values that can be used instead of `actual`.
     *
     * @type {Array<string> | null}
     */
          this.expected

    /**
     * Link to docs for the message.
     *
     * > 👉 **Note**: this must be an absolute URL that can be passed as `x`
     * > to `new URL(x)`.
     *
     * @type {string | null}
     */
          this.url

    /**
     * Long form description of the message (you should use markdown).
     *
     * @type {string | null}
     */
          this.note
    /* eslint-enable no-unused-expressions */
        }
      }

      VFileMessage.prototype.file = ''
      VFileMessage.prototype.name = ''
      VFileMessage.prototype.reason = ''
      VFileMessage.prototype.message = ''
      VFileMessage.prototype.stack = ''
      VFileMessage.prototype.fatal = null
      VFileMessage.prototype.column = null
      VFileMessage.prototype.line = null
      VFileMessage.prototype.source = null
      VFileMessage.prototype.ruleId = null
      VFileMessage.prototype.position = null


/***/ }),

/***/ "./node_modules/vfile/lib/index.js":
/*!*****************************************!*\
  !*** ./node_modules/vfile/lib/index.js ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VFile: () => (/* binding */ VFile)
/* harmony export */ });
/* harmony import */ const is_buffer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! is-buffer */ "./node_modules/is-buffer/index.js");
/* harmony import */ const vfile_message__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! vfile-message */ "./node_modules/vfile-message/lib/index.js");
/* harmony import */ const _minpath_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./minpath.js */ "./node_modules/vfile/lib/minpath.browser.js");
/* harmony import */ const _minproc_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./minproc.js */ "./node_modules/vfile/lib/minproc.browser.js");
/* harmony import */ const _minurl_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./minurl.js */ "./node_modules/vfile/lib/minurl.shared.js");
/* harmony import */ const _minurl_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./minurl.js */ "./node_modules/vfile/lib/minurl.browser.js");
/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist').Position} Position
 * @typedef {import('unist').Point} Point
 * @typedef {import('./minurl.shared.js').URL} URL
 * @typedef {import('../index.js').Data} Data
 * @typedef {import('../index.js').Value} Value
 */

/**
 * @typedef {Record<string, unknown> & {type: string, position?: Position | undefined}} NodeLike
 *
 * @typedef {'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'hex'} BufferEncoding
 *   Encodings supported by the buffer class.
 *
 *   This is a copy of the types from Node, copied to prevent Node globals from
 *   being needed.
 *   Copied from: <https://github.com/DefinitelyTyped/DefinitelyTyped/blob/90a4ec8/types/node/buffer.d.ts#L170>
 *
 * @typedef {Options | URL | Value | VFile} Compatible
 *   Things that can be passed to the constructor.
 *
 * @typedef VFileCoreOptions
 *   Set multiple values.
 * @property {Value | null | undefined} [value]
 *   Set `value`.
 * @property {string | null | undefined} [cwd]
 *   Set `cwd`.
 * @property {Array<string> | null | undefined} [history]
 *   Set `history`.
 * @property {URL | string | null | undefined} [path]
 *   Set `path`.
 * @property {string | null | undefined} [basename]
 *   Set `basename`.
 * @property {string | null | undefined} [stem]
 *   Set `stem`.
 * @property {string | null | undefined} [extname]
 *   Set `extname`.
 * @property {string | null | undefined} [dirname]
 *   Set `dirname`.
 * @property {Data | null | undefined} [data]
 *   Set `data`.
 *
 * @typedef Map
 *   Raw source map.
 *
 *   See:
 *   <https://github.com/mozilla/source-map/blob/58819f0/source-map.d.ts#L15-L23>.
 * @property {number} version
 *   Which version of the source map spec this map is following.
 * @property {Array<string>} sources
 *   An array of URLs to the original source files.
 * @property {Array<string>} names
 *   An array of identifiers which can be referenced by individual mappings.
 * @property {string | undefined} [sourceRoot]
 *   The URL root from which all sources are relative.
 * @property {Array<string> | undefined} [sourcesContent]
 *   An array of contents of the original source files.
 * @property {string} mappings
 *   A string of base64 VLQs which contain the actual mappings.
 * @property {string} file
 *   The generated file this source map is associated with.
 *
 * @typedef {{[key: string]: unknown} & VFileCoreOptions} Options
 *   Configuration.
 *
 *   A bunch of keys that will be shallow copied over to the new file.
 *
 * @typedef {Record<string, unknown>} ReporterSettings
 *   Configuration for reporters.
 */

/**
 * @template {ReporterSettings} Settings
 *   Options type.
 * @callback Reporter
 *   Type for a reporter.
 * @param {Array<VFile>} files
 *   Files to report.
 * @param {Settings} options
 *   Configuration.
 * @returns {string}
 *   Report.
 */







/**
 * Order of setting (least specific to most), we need this because otherwise
 * `{stem: 'a', path: '~/b.js'}` would throw, as a path is needed before a
 * stem can be set.
 *
 * @type {Array<'basename' | 'dirname' | 'extname' | 'history' | 'path' | 'stem'>}
 */
      const order = ['history', 'path', 'basename', 'stem', 'extname', 'dirname']

      class VFile {
  /**
   * Create a new virtual file.
   *
   * `options` is treated as:
   *
   * *   `string` or `Buffer` — `{value: options}`
   * *   `URL` — `{path: options}`
   * *   `VFile` — shallow copies its data over to the new file
   * *   `object` — all fields are shallow copied over to the new file
   *
   * Path related fields are set in the following order (least specific to
   * most specific): `history`, `path`, `basename`, `stem`, `extname`,
   * `dirname`.
   *
   * You cannot set `dirname` or `extname` without setting either `history`,
   * `path`, `basename`, or `stem` too.
   *
   * @param {Compatible | null | undefined} [value]
   *   File value.
   * @returns
   *   New instance.
   */
        constructor(value) {
    /** @type {Options | VFile} */
          let options

          if (!value) {
            options = {}
          } else if (typeof value === 'string' || buffer(value)) {
            options = {value}
          } else if ((0,_minurl_js__WEBPACK_IMPORTED_MODULE_4__.isUrl)(value)) {
            options = {path: value}
          } else {
            options = value
          }

    /**
     * Place to store custom information (default: `{}`).
     *
     * It’s OK to store custom data directly on the file but moving it to
     * `data` is recommended.
     *
     * @type {Data}
     */
          this.data = {}

    /**
     * List of messages associated with the file.
     *
     * @type {Array<VFileMessage>}
     */
          this.messages = []

    /**
     * List of filepaths the file moved between.
     *
     * The first is the original path and the last is the current path.
     *
     * @type {Array<string>}
     */
          this.history = []

    /**
     * Base of `path` (default: `process.cwd()` or `'/'` in browsers).
     *
     * @type {string}
     */
          this.cwd = _minproc_js__WEBPACK_IMPORTED_MODULE_3__.proc.cwd()

    /* eslint-disable no-unused-expressions */
    /**
     * Raw value.
     *
     * @type {Value}
     */
          this.value

    // The below are non-standard, they are “well-known”.
    // As in, used in several tools.

    /**
     * Whether a file was saved to disk.
     *
     * This is used by vfile reporters.
     *
     * @type {boolean}
     */
          this.stored

    /**
     * Custom, non-string, compiled, representation.
     *
     * This is used by unified to store non-string results.
     * One example is when turning markdown into React nodes.
     *
     * @type {unknown}
     */
          this.result

    /**
     * Source map.
     *
     * This type is equivalent to the `RawSourceMap` type from the `source-map`
     * module.
     *
     * @type {Map | null | undefined}
     */
          this.map
    /* eslint-enable no-unused-expressions */

    // Set path related properties in the correct order.
          let index = -1

          while (++index < order.length) {
            const prop = order[index]

      // Note: we specifically use `in` instead of `hasOwnProperty` to accept
      // `vfile`s too.
            if (
              prop in options &&
        options[prop] !== undefined &&
        options[prop] !== null
            ) {
        // @ts-expect-error: TS doesn’t understand basic reality.
              this[prop] = prop === 'history' ? [...options[prop]] : options[prop]
            }
          }

    /** @type {string} */
          let prop

    // Set non-path related properties.
          for (prop in options) {
      // @ts-expect-error: fine to set other things.
            if (!order.includes(prop)) {
        // @ts-expect-error: fine to set other things.
              this[prop] = options[prop]
            }
          }
        }

  /**
   * Get the full path (example: `'~/index.min.js'`).
   *
   * @returns {string}
   */
        get path() {
          return this.history[this.history.length - 1]
        }

  /**
   * Set the full path (example: `'~/index.min.js'`).
   *
   * Cannot be nullified.
   * You can set a file URL (a `URL` object with a `file:` protocol) which will
   * be turned into a path with `url.fileURLToPath`.
   *
   * @param {string | URL} path
   */
        set path(path) {
          if ((0,_minurl_js__WEBPACK_IMPORTED_MODULE_4__.isUrl)(path)) {
            path = (0,_minurl_js__WEBPACK_IMPORTED_MODULE_5__.urlToPath)(path)
          }

          assertNonEmpty(path, 'path')

          if (this.path !== path) {
            this.history.push(path)
          }
        }

  /**
   * Get the parent path (example: `'~'`).
   */
        get dirname() {
          return typeof this.path === 'string' ? _minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.dirname(this.path) : undefined
        }

  /**
   * Set the parent path (example: `'~'`).
   *
   * Cannot be set if there’s no `path` yet.
   */
        set dirname(dirname) {
          assertPath(this.basename, 'dirname')
          this.path = _minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.join(dirname || '', this.basename)
        }

  /**
   * Get the basename (including extname) (example: `'index.min.js'`).
   */
        get basename() {
          return typeof this.path === 'string' ? _minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.basename(this.path) : undefined
        }

  /**
   * Set basename (including extname) (`'index.min.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   */
        set basename(basename) {
          assertNonEmpty(basename, 'basename')
          assertPart(basename, 'basename')
          this.path = _minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.join(this.dirname || '', basename)
        }

  /**
   * Get the extname (including dot) (example: `'.js'`).
   */
        get extname() {
          return typeof this.path === 'string' ? _minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.extname(this.path) : undefined
        }

  /**
   * Set the extname (including dot) (example: `'.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be set if there’s no `path` yet.
   */
        set extname(extname) {
          assertPart(extname, 'extname')
          assertPath(this.dirname, 'extname')

          if (extname) {
            if (extname.charCodeAt(0) !== 46 /* `.` */) {
              throw new Error('`extname` must start with `.`')
            }

            if (extname.includes('.', 1)) {
              throw new Error('`extname` cannot contain multiple dots')
            }
          }

          this.path = _minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.join(this.dirname, this.stem + (extname || ''))
        }

  /**
   * Get the stem (basename w/o extname) (example: `'index.min'`).
   */
        get stem() {
          return typeof this.path === 'string'
            ? _minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.basename(this.path, this.extname)
            : undefined
        }

  /**
   * Set the stem (basename w/o extname) (example: `'index.min'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   */
        set stem(stem) {
          assertNonEmpty(stem, 'stem')
          assertPart(stem, 'stem')
          this.path = _minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.join(this.dirname || '', stem + (this.extname || ''))
        }

  /**
   * Serialize the file.
   *
   * @param {BufferEncoding | null | undefined} [encoding='utf8']
   *   Character encoding to understand `value` as when it’s a `Buffer`
   *   (default: `'utf8'`).
   * @returns {string}
   *   Serialized file.
   */
        toString(encoding) {
          return (this.value || '').toString(encoding || undefined)
        }

  /**
   * Create a warning message associated with the file.
   *
   * Its `fatal` is set to `false` and `file` is set to the current file path.
   * Its added to `file.messages`.
   *
   * @param {string | Error | VFileMessage} reason
   *   Reason for message, uses the stack and message of the error if given.
   * @param {Node | NodeLike | Position | Point | null | undefined} [place]
   *   Place in file where the message occurred.
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
        message(reason, place, origin) {
          const message = new vfile_message__WEBPACK_IMPORTED_MODULE_1__.VFileMessage(reason, place, origin)

          if (this.path) {
            message.name = this.path + ':' + message.name
            message.file = this.path
          }

          message.fatal = false

          this.messages.push(message)

          return message
        }

  /**
   * Create an info message associated with the file.
   *
   * Its `fatal` is set to `null` and `file` is set to the current file path.
   * Its added to `file.messages`.
   *
   * @param {string | Error | VFileMessage} reason
   *   Reason for message, uses the stack and message of the error if given.
   * @param {Node | NodeLike | Position | Point | null | undefined} [place]
   *   Place in file where the message occurred.
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
        info(reason, place, origin) {
          const message = this.message(reason, place, origin)

          message.fatal = null

          return message
        }

  /**
   * Create a fatal error associated with the file.
   *
   * Its `fatal` is set to `true` and `file` is set to the current file path.
   * Its added to `file.messages`.
   *
   * > 👉 **Note**: a fatal error means that a file is no longer processable.
   *
   * @param {string | Error | VFileMessage} reason
   *   Reason for message, uses the stack and message of the error if given.
   * @param {Node | NodeLike | Position | Point | null | undefined} [place]
   *   Place in file where the message occurred.
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Message.
   * @throws {VFileMessage}
   *   Message.
   */
        fail(reason, place, origin) {
          const message = this.message(reason, place, origin)

          message.fatal = true

          throw message
        }
      }

/**
 * Assert that `part` is not a path (as in, does not contain `path.sep`).
 *
 * @param {string | null | undefined} part
 *   File path part.
 * @param {string} name
 *   Part name.
 * @returns {void}
 *   Nothing.
 */
      function assertPart(part, name) {
        if (part && part.includes(_minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.sep)) {
          throw new Error(
            '`' + name + '` cannot be a path: did not expect `' + _minpath_js__WEBPACK_IMPORTED_MODULE_2__.path.sep + '`'
          )
        }
      }

/**
 * Assert that `part` is not empty.
 *
 * @param {string | undefined} part
 *   Thing.
 * @param {string} name
 *   Part name.
 * @returns {asserts part is string}
 *   Nothing.
 */
      function assertNonEmpty(part, name) {
        if (!part) {
          throw new Error('`' + name + '` cannot be empty')
        }
      }

/**
 * Assert `path` exists.
 *
 * @param {string | undefined} path
 *   Path.
 * @param {string} name
 *   Dependency name.
 * @returns {asserts path is string}
 *   Nothing.
 */
      function assertPath(path, name) {
        if (!path) {
          throw new Error('Setting `' + name + '` requires `path` to be set too')
        }
      }

/**
 * Assert `value` is a buffer.
 *
 * @param {unknown} value
 *   thing.
 * @returns {value is Buffer}
 *   Whether `value` is a Node.js buffer.
 */
      function buffer(value) {
        return is_buffer__WEBPACK_IMPORTED_MODULE_0__(value)
      }


/***/ }),

/***/ "./node_modules/vfile/lib/minpath.browser.js":
/*!***************************************************!*\
  !*** ./node_modules/vfile/lib/minpath.browser.js ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   path: () => (/* binding */ path)
/* harmony export */ });
// A derivative work based on:
// <https://github.com/browserify/path-browserify>.
// Which is licensed:
//
// MIT License
//
// Copyright (c) 2013 James Halliday
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
// FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// A derivative work based on:
//
// Parts of that are extracted from Node’s internal `path` module:
// <https://github.com/nodejs/node/blob/master/lib/path.js>.
// Which is licensed:
//
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

      const path = {basename, dirname, extname, join, sep: '/'}

/* eslint-disable max-depth, complexity */

/**
 * Get the basename from a path.
 *
 * @param {string} path
 *   File path.
 * @param {string | undefined} [ext]
 *   Extension to strip.
 * @returns {string}
 *   Stem or basename.
 */
      function basename(path, ext) {
        if (ext !== undefined && typeof ext !== 'string') {
          throw new TypeError('"ext" argument must be a string')
        }

        assertPath(path)
        let start = 0
        let end = -1
        let index = path.length
  /** @type {boolean | undefined} */
        let seenNonSlash

        if (ext === undefined || ext.length === 0 || ext.length > path.length) {
          while (index--) {
            if (path.charCodeAt(index) === 47 /* `/` */) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now.
              if (seenNonSlash) {
                start = index + 1
                break
              }
            } else if (end < 0) {
        // We saw the first non-path separator, mark this as the end of our
        // path component.
              seenNonSlash = true
              end = index + 1
            }
          }

          return end < 0 ? '' : path.slice(start, end)
        }

        if (ext === path) {
          return ''
        }

        let firstNonSlashEnd = -1
        let extIndex = ext.length - 1

        while (index--) {
          if (path.charCodeAt(index) === 47 /* `/` */) {
      // If we reached a path separator that was not part of a set of path
      // separators at the end of the string, stop now.
            if (seenNonSlash) {
              start = index + 1
              break
            }
          } else {
            if (firstNonSlashEnd < 0) {
        // We saw the first non-path separator, remember this index in case
        // we need it if the extension ends up not matching.
              seenNonSlash = true
              firstNonSlashEnd = index + 1
            }

            if (extIndex > -1) {
        // Try to match the explicit extension.
              if (path.charCodeAt(index) === ext.charCodeAt(extIndex--)) {
                if (extIndex < 0) {
            // We matched the extension, so mark this as the end of our path
            // component
                  end = index
                }
              } else {
          // Extension does not match, so our result is the entire path
          // component
                extIndex = -1
                end = firstNonSlashEnd
              }
            }
          }
        }

        if (start === end) {
          end = firstNonSlashEnd
        } else if (end < 0) {
          end = path.length
        }

        return path.slice(start, end)
      }

/**
 * Get the dirname from a path.
 *
 * @param {string} path
 *   File path.
 * @returns {string}
 *   File path.
 */
      function dirname(path) {
        assertPath(path)

        if (path.length === 0) {
          return '.'
        }

        let end = -1
        let index = path.length
  /** @type {boolean | undefined} */
        let unmatchedSlash

  // Prefix `--` is important to not run on `0`.
        while (--index) {
          if (path.charCodeAt(index) === 47 /* `/` */) {
            if (unmatchedSlash) {
              end = index
              break
            }
          } else if (!unmatchedSlash) {
      // We saw the first non-path separator
            unmatchedSlash = true
          }
        }

        return end < 0
          ? path.charCodeAt(0) === 47 /* `/` */
            ? '/'
            : '.'
          : end === 1 && path.charCodeAt(0) === 47 /* `/` */
            ? '//'
            : path.slice(0, end)
      }

/**
 * Get an extname from a path.
 *
 * @param {string} path
 *   File path.
 * @returns {string}
 *   Extname.
 */
      function extname(path) {
        assertPath(path)

        let index = path.length

        let end = -1
        let startPart = 0
        let startDot = -1
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find.
        let preDotState = 0
  /** @type {boolean | undefined} */
        let unmatchedSlash

        while (index--) {
          const code = path.charCodeAt(index)

          if (code === 47 /* `/` */) {
      // If we reached a path separator that was not part of a set of path
      // separators at the end of the string, stop now.
            if (unmatchedSlash) {
              startPart = index + 1
              break
            }

            continue
          }

          if (end < 0) {
      // We saw the first non-path separator, mark this as the end of our
      // extension.
            unmatchedSlash = true
            end = index + 1
          }

          if (code === 46 /* `.` */) {
      // If this is our first dot, mark it as the start of our extension.
            if (startDot < 0) {
              startDot = index
            } else if (preDotState !== 1) {
              preDotState = 1
            }
          } else if (startDot > -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension.
            preDotState = -1
          }
        }

        if (
          startDot < 0 ||
    end < 0 ||
    // We saw a non-dot character immediately before the dot.
    preDotState === 0 ||
    // The (right-most) trimmed path component is exactly `..`.
    (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
        ) {
          return ''
        }

        return path.slice(startDot, end)
      }

/**
 * Join segments from a path.
 *
 * @param {Array<string>} segments
 *   Path segments.
 * @returns {string}
 *   File path.
 */
      function join(...segments) {
        let index = -1
  /** @type {string | undefined} */
        let joined

        while (++index < segments.length) {
          assertPath(segments[index])

          if (segments[index]) {
            joined =
        joined === undefined ? segments[index] : joined + '/' + segments[index]
          }
        }

        return joined === undefined ? '.' : normalize(joined)
      }

/**
 * Normalize a basic file path.
 *
 * @param {string} path
 *   File path.
 * @returns {string}
 *   File path.
 */
// Note: `normalize` is not exposed as `path.normalize`, so some code is
// manually removed from it.
      function normalize(path) {
        assertPath(path)

        const absolute = path.charCodeAt(0) === 47 /* `/` */

  // Normalize the path according to POSIX rules.
        let value = normalizeString(path, !absolute)

        if (value.length === 0 && !absolute) {
          value = '.'
        }

        if (value.length > 0 && path.charCodeAt(path.length - 1) === 47 /* / */) {
          value += '/'
        }

        return absolute ? '/' + value : value
      }

/**
 * Resolve `.` and `..` elements in a path with directory names.
 *
 * @param {string} path
 *   File path.
 * @param {boolean} allowAboveRoot
 *   Whether `..` can move above root.
 * @returns {string}
 *   File path.
 */
      function normalizeString(path, allowAboveRoot) {
        let result = ''
        let lastSegmentLength = 0
        let lastSlash = -1
        let dots = 0
        let index = -1
  /** @type {number | undefined} */
        let code
  /** @type {number} */
        let lastSlashIndex

        while (++index <= path.length) {
          if (index < path.length) {
            code = path.charCodeAt(index)
          } else if (code === 47 /* `/` */) {
            break
          } else {
            code = 47 /* `/` */
          }

          if (code === 47 /* `/` */) {
            if (lastSlash === index - 1 || dots === 1) {
        // Empty.
            } else if (lastSlash !== index - 1 && dots === 2) {
              if (
                result.length < 2 ||
          lastSegmentLength !== 2 ||
          result.charCodeAt(result.length - 1) !== 46 /* `.` */ ||
          result.charCodeAt(result.length - 2) !== 46 /* `.` */
              ) {
                if (result.length > 2) {
                  lastSlashIndex = result.lastIndexOf('/')

                  if (lastSlashIndex !== result.length - 1) {
                    if (lastSlashIndex < 0) {
                      result = ''
                      lastSegmentLength = 0
                    } else {
                      result = result.slice(0, lastSlashIndex)
                      lastSegmentLength = result.length - 1 - result.lastIndexOf('/')
                    }

                    lastSlash = index
                    dots = 0
                    continue
                  }
                } else if (result.length > 0) {
                  result = ''
                  lastSegmentLength = 0
                  lastSlash = index
                  dots = 0
                  continue
                }
              }

              if (allowAboveRoot) {
                result = result.length > 0 ? result + '/..' : '..'
                lastSegmentLength = 2
              }
            } else {
              if (result.length > 0) {
                result += '/' + path.slice(lastSlash + 1, index)
              } else {
                result = path.slice(lastSlash + 1, index)
              }

              lastSegmentLength = index - lastSlash - 1
            }

            lastSlash = index
            dots = 0
          } else if (code === 46 /* `.` */ && dots > -1) {
            dots++
          } else {
            dots = -1
          }
        }

        return result
      }

/**
 * Make sure `path` is a string.
 *
 * @param {string} path
 *   File path.
 * @returns {asserts path is string}
 *   Nothing.
 */
      function assertPath(path) {
        if (typeof path !== 'string') {
          throw new TypeError(
            'Path must be a string. Received ' + JSON.stringify(path)
          )
        }
      }

/* eslint-enable max-depth, complexity */


/***/ }),

/***/ "./node_modules/vfile/lib/minproc.browser.js":
/*!***************************************************!*\
  !*** ./node_modules/vfile/lib/minproc.browser.js ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   proc: () => (/* binding */ proc)
/* harmony export */ });
// Somewhat based on:
// <https://github.com/defunctzombie/node-process/blob/master/browser.js>.
// But I don’t think one tiny line of code can be copyrighted. 😅
      const proc = {cwd}

      function cwd() {
        return '/'
      }


/***/ }),

/***/ "./node_modules/vfile/lib/minurl.browser.js":
/*!**************************************************!*\
  !*** ./node_modules/vfile/lib/minurl.browser.js ***!
  \**************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isUrl: () => (/* reexport safe */ _minurl_shared_js__WEBPACK_IMPORTED_MODULE_0__.isUrl),
/* harmony export */   urlToPath: () => (/* binding */ urlToPath)
/* harmony export */ });
/* harmony import */ var _minurl_shared_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./minurl.shared.js */ "./node_modules/vfile/lib/minurl.shared.js");
/// <reference lib="dom" />



// See: <https://github.com/nodejs/node/blob/fcf8ba4/lib/internal/url.js>

/**
 * @param {string | URL} path
 *   File URL.
 * @returns {string}
 *   File URL.
 */
      function urlToPath(path) {
        if (typeof path === 'string') {
          path = new URL(path)
        } else if (!(0,_minurl_shared_js__WEBPACK_IMPORTED_MODULE_0__.isUrl)(path)) {
    /** @type {NodeJS.ErrnoException} */
          const error = new TypeError(
            'The "path" argument must be of type string or an instance of URL. Received `' +
        path +
        '`'
          )
          error.code = 'ERR_INVALID_ARG_TYPE'
          throw error
        }

        if (path.protocol !== 'file:') {
    /** @type {NodeJS.ErrnoException} */
          const error = new TypeError('The URL must be of scheme file')
          error.code = 'ERR_INVALID_URL_SCHEME'
          throw error
        }

        return getPathFromURLPosix(path)
      }

/**
 * Get a path from a POSIX URL.
 *
 * @param {URL} url
 *   URL.
 * @returns {string}
 *   File path.
 */
      function getPathFromURLPosix(url) {
        if (url.hostname !== '') {
    /** @type {NodeJS.ErrnoException} */
          const error = new TypeError(
            'File URL host must be "localhost" or empty on darwin'
          )
          error.code = 'ERR_INVALID_FILE_URL_HOST'
          throw error
        }

        const pathname = url.pathname
        let index = -1

        while (++index < pathname.length) {
          if (
            pathname.charCodeAt(index) === 37 /* `%` */ &&
      pathname.charCodeAt(index + 1) === 50 /* `2` */
          ) {
            const third = pathname.charCodeAt(index + 2)
            if (third === 70 /* `F` */ || third === 102 /* `f` */) {
        /** @type {NodeJS.ErrnoException} */
              const error = new TypeError(
                'File URL path must not include encoded / characters'
              )
              error.code = 'ERR_INVALID_FILE_URL_PATH'
              throw error
            }
          }
        }

        return decodeURIComponent(pathname)
      }




/***/ }),

/***/ "./node_modules/vfile/lib/minurl.shared.js":
/*!*************************************************!*\
  !*** ./node_modules/vfile/lib/minurl.shared.js ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

      "use strict";
      __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isUrl: () => (/* binding */ isUrl)
/* harmony export */ });
/**
 * @typedef URL
 * @property {string} hash
 * @property {string} host
 * @property {string} hostname
 * @property {string} href
 * @property {string} origin
 * @property {string} password
 * @property {string} pathname
 * @property {string} port
 * @property {string} protocol
 * @property {string} search
 * @property {any} searchParams
 * @property {string} username
 * @property {() => string} toString
 * @property {() => string} toJSON
 */

/**
 * Check if `fileUrlOrPath` looks like a URL.
 *
 * @param {unknown} fileUrlOrPath
 *   File path or URL.
 * @returns {fileUrlOrPath is URL}
 *   Whether it’s a URL.
 */
// From: <https://github.com/nodejs/node/blob/fcf8ba4/lib/internal/url.js#L1501>
      function isUrl(fileUrlOrPath) {
        return (
          fileUrlOrPath !== null &&
    typeof fileUrlOrPath === 'object' &&
    // @ts-expect-error: indexable.
    fileUrlOrPath.href &&
    // @ts-expect-error: indexable.
    fileUrlOrPath.origin
        )
      }


/***/ }),

/***/ "./src/ChangelogDashlet.tsx":
/*!**********************************!*\
  !*** ./src/ChangelogDashlet.tsx ***!
  \**********************************/
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
      const React = __importStar(__webpack_require__(/*! react */ "react"));
      const react_i18next_1 = __webpack_require__(/*! react-i18next */ "react-i18next");
      const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
      const semver = __importStar(__webpack_require__(/*! semver */ "semver"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      const react_markdown_1 = __importDefault(__webpack_require__(/*! react-markdown */ "./node_modules/react-markdown/index.js"));
      class ChangelogDashlet extends vortex_api_1.ComponentEx {
        constructor(props) {
          super(props);
          this.prev = () => {
            this.context.api.events.emit('analytics-track-click-event', 'Dashboard', 'Previous Changelog');
            this.nextState.current = Math.max(0, this.state.current - 1);
          };
          this.next = () => {
            const { changelogs } = this.props;
            this.context.api.events.emit('analytics-track-click-event', 'Dashboard', 'Next Changelog');
            this.nextState.current = Math.min(changelogs.length - 1, this.state.current + 1);
          };
          this.mAppVersion = vortex_api_1.util['getApplication']().version;
          this.initState({
            current: 0,
          });
        }
        UNSAFE_componentWillMount() {
          this.nextState.current = Math.max(this.props.changelogs.findIndex(changelog => semver.gte(changelog.version, this.mAppVersion)), 0);
        }
        UNSAFE_componentWillReceiveProps(nextProps) {
          if (this.props.changelogs !== nextProps.changelogs) {
            this.nextState.current = Math.max(nextProps.changelogs.findIndex(changelog => semver.gte(changelog.version, this.mAppVersion)), 0);
          }
        }
        render() {
          const { t, changelogs, channel } = this.props;
          const { current } = this.state;
          return (React.createElement(vortex_api_1.Dashlet, { className: 'dashlet-changelog', title: t('What\'s New') }, this.renderContent()));
        }
        renderContent() {
          const { t, changelogs, channel } = this.props;
          const { current } = this.state;
          const filteredChangelogs = changelogs.filter((changelog) => {
            const comparisonResult = semver.compare(changelog.version, this.mAppVersion);
            return comparisonResult === 0 || comparisonResult === -1;
          });
          return (React.createElement("div", { className: 'changelog-container' }, filteredChangelogs.length === 0 ? (React.createElement("div", { className: 'changelog-entry' }, "No changelogs found")) : (filteredChangelogs.slice(0, 10).map((changelog) => (React.createElement("div", { className: 'changelog-entry', key: changelog.version },
                                                                                                                                                                                                                                                                                      React.createElement("h4", { className: 'changelog-title' },
                                                                                                                                                                                                                                                                                                          "Version ",
                                                                                                                                                                                                                                                                                                          changelog.version),
                                                                                                                                                                                                                                                                                      React.createElement(react_markdown_1.default, { className: 'changelog-text' }, changelog.text)))))));
        }
      }
      function mapStateToProps(state) {
        return {
          changelogs: state.persistent.changelogs.changelogs,
          channel: state.settings.update.channel
        };
      }
      exports["default"] = (0, react_redux_1.connect)(mapStateToProps)((0, react_i18next_1.withTranslation)(['changelog-dashlet', 'common'])(ChangelogDashlet));


/***/ }),

/***/ "./src/actions.ts":
/*!************************!*\
  !*** ./src/actions.ts ***!
  \************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

      "use strict";

      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.setChangelogs = void 0;
      const redux_act_1 = __webpack_require__(/*! redux-act */ "redux-act");
      exports.setChangelogs = (0, redux_act_1.createAction)('SET_CHANGELOGS', (changelogs) => changelogs);


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
      const actions_1 = __webpack_require__(/*! ./actions */ "./src/actions.ts");
      const ChangelogDashlet_1 = __importDefault(__webpack_require__(/*! ./ChangelogDashlet */ "./src/ChangelogDashlet.tsx"));
      const reducers_1 = __importDefault(__webpack_require__(/*! ./reducers */ "./src/reducers.ts"));
      const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
      const path = __importStar(__webpack_require__(/*! path */ "path"));
      const semver = __importStar(__webpack_require__(/*! semver */ "semver"));
      const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
      function updateReleases(store) {
        const state = store.getState();
        const persistentLogs = vortex_api_1.util.getSafe(state, ['persistent', 'changelogs', 'changelogs'], []);
        if (persistentLogs.length !== 0) {
          const copiedChangelogs = Array.from(persistentLogs);
          const sortedChangelogs = copiedChangelogs.sort((a, b) => semver.compare(b.version, a.version));
          store.dispatch((0, actions_1.setChangelogs)(sortedChangelogs));
        }
        if (!store.getState().session.base.networkConnected) {
          return bluebird_1.default.resolve();
        }
        return vortex_api_1.util.github.releases()
          .then(releases => {
            const len = releases.length;
            const changeLogs = releases.map(rel => ({
              version: rel.name,
              text: rel.body,
              prerelease: rel.prerelease,
            }));
            const copiedChangelogsArray = Array.from(changeLogs);
            const sortedChangelogs = copiedChangelogsArray.sort((a, b) => semver.compare(b.version, a.version));
            store.dispatch((0, actions_1.setChangelogs)(sortedChangelogs));
          });
      }
      function main(context) {
        context.registerReducer(['persistent', 'changelogs'], reducers_1.default);
        context.registerDashlet('Changelog', 1, 3, 200, ChangelogDashlet_1.default, (state) => true, () => ({}), { closable: true });
        context.once(() => {
          context.api.setStylesheet('changelog', path.join(__dirname, 'changelog.scss'));
          updateReleases(context.api.store)
            .catch(err => {
              (0, vortex_api_1.log)('warn', 'failed to retrieve list of releases', err.message);
            });
        });
        return true;
      }
      exports["default"] = main;


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
      const sessionReducer = {
        reducers: {
          [actions.setChangelogs]: (state, payload) => vortex_api_1.util.setSafe(state, ['changelogs'], payload),
        },
        defaults: {
          changelogs: [],
        },
      };
      exports["default"] = sessionReducer;


/***/ }),

/***/ "bluebird":
/*!***************************!*\
  !*** external "bluebird" ***!
  \***************************/
/***/ ((module) => {

      "use strict";
      module.exports = require("bluebird");

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

/***/ "semver":
/*!*************************!*\
  !*** external "semver" ***!
  \*************************/
/***/ ((module) => {

      "use strict";
      module.exports = require("semver");

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
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(const key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
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
//# sourceMappingURL=bundledPlugins/changelog-dashlet/changelog-dashlet.js.map