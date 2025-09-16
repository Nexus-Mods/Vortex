/******/ (() => { // webpackBootstrap
/******/ 	const __webpack_modules__ = ({

/***/ "../../node_modules/bail/index.js":
/*!****************************************!*\
  !*** ../../node_modules/bail/index.js ***!
  \****************************************/
/***/ ((module) => {

      "use strict";


      module.exports = bail

      function bail(err) {
        if (err) {
          throw err
        }
      }


/***/ }),

/***/ "../../node_modules/comma-separated-tokens/index.js":
/*!**********************************************************!*\
  !*** ../../node_modules/comma-separated-tokens/index.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, exports) => {

      "use strict";


      exports.parse = parse
      exports.stringify = stringify

      const comma = ','
      const space = ' '
      const empty = ''

// Parse comma-separated tokens to an array.
      function parse(value) {
        const values = []
        const input = String(value || empty)
        let index = input.indexOf(comma)
        let lastIndex = 0
        let end = false
        let val

        while (!end) {
          if (index === -1) {
            index = input.length
            end = true
          }

          val = input.slice(lastIndex, index).trim()

          if (val || !end) {
            values.push(val)
          }

          lastIndex = index + 1
          index = input.indexOf(comma, lastIndex)
        }

        return values
      }

// Compile an array to comma-separated tokens.
// `options.padLeft` (default: `true`) pads a space left of each token, and
// `options.padRight` (default: `false`) pads a space to the right of each token.
      function stringify(values, options) {
        const settings = options || {}
        const left = settings.padLeft === false ? empty : space
        const right = settings.padRight ? space : empty

  // Ensure the last empty entry is seen.
        if (values[values.length - 1] === empty) {
          values = values.concat(empty)
        }

        return values.join(right + comma + left).trim()
      }


/***/ }),

/***/ "../../node_modules/extend/index.js":
/*!******************************************!*\
  !*** ../../node_modules/extend/index.js ***!
  \******************************************/
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

/***/ "../../node_modules/inline-style-parser/index.js":
/*!*******************************************************!*\
  !*** ../../node_modules/inline-style-parser/index.js ***!
  \*******************************************************/
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

/***/ "../../node_modules/is-plain-obj/index.js":
/*!************************************************!*\
  !*** ../../node_modules/is-plain-obj/index.js ***!
  \************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = value => {
        if (Object.prototype.toString.call(value) !== '[object Object]') {
          return false;
        }

        const prototype = Object.getPrototypeOf(value);
        return prototype === null || prototype === Object.prototype;
      };


/***/ }),

/***/ "../../node_modules/mdast-util-definitions/index.js":
/*!**********************************************************!*\
  !*** ../../node_modules/mdast-util-definitions/index.js ***!
  \**********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const visit = __webpack_require__(/*! unist-util-visit */ "../../node_modules/unist-util-visit/index.js")

      module.exports = getDefinitionFactory

      const own = {}.hasOwnProperty

// Get a definition in `node` by `identifier`.
      function getDefinitionFactory(node, options) {
        return getterFactory(gather(node, options))
      }

// Gather all definitions in `node`
      function gather(node) {
        const cache = {}

        if (!node || !node.type) {
          throw new Error('mdast-util-definitions expected node')
        }

        visit(node, 'definition', ondefinition)

        return cache

        function ondefinition(definition) {
          const id = normalise(definition.identifier)
          if (!own.call(cache, id)) {
            cache[id] = definition
          }
        }
      }

// Factory to get a node from the given definition-cache.
      function getterFactory(cache) {
        return getter

  // Get a node from the bound definition-cache.
        function getter(identifier) {
          const id = identifier && normalise(identifier)
          return id && own.call(cache, id) ? cache[id] : null
        }
      }

      function normalise(identifier) {
        return identifier.toUpperCase()
      }


/***/ }),

/***/ "../../node_modules/mdast-util-from-markdown/dist/index.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/mdast-util-from-markdown/dist/index.js ***!
  \*****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = fromMarkdown

// These three are compiled away in the `dist/`

      const toString = __webpack_require__(/*! mdast-util-to-string */ "../../node_modules/mdast-util-to-string/index.js")
      const assign = __webpack_require__(/*! micromark/dist/constant/assign */ "../../node_modules/micromark/dist/constant/assign.js")
      const own = __webpack_require__(/*! micromark/dist/constant/has-own-property */ "../../node_modules/micromark/dist/constant/has-own-property.js")
      const normalizeIdentifier = __webpack_require__(/*! micromark/dist/util/normalize-identifier */ "../../node_modules/micromark/dist/util/normalize-identifier.js")
      const safeFromInt = __webpack_require__(/*! micromark/dist/util/safe-from-int */ "../../node_modules/micromark/dist/util/safe-from-int.js")
      const parser = __webpack_require__(/*! micromark/dist/parse */ "../../node_modules/micromark/dist/parse.js")
      const preprocessor = __webpack_require__(/*! micromark/dist/preprocess */ "../../node_modules/micromark/dist/preprocess.js")
      const postprocess = __webpack_require__(/*! micromark/dist/postprocess */ "../../node_modules/micromark/dist/postprocess.js")
      const decode = __webpack_require__(/*! parse-entities/decode-entity */ "../../node_modules/parse-entities/decode-entity.browser.js")
      const stringifyPosition = __webpack_require__(/*! unist-util-stringify-position */ "../../node_modules/unist-util-stringify-position/index.js")

      function fromMarkdown(value, encoding, options) {
        if (typeof encoding !== 'string') {
          options = encoding
          encoding = undefined
        }

        return compiler(options)(
          postprocess(
            parser(options).document().write(preprocessor()(value, encoding, true))
          )
        )
      }

// Note this compiler only understand complete buffering, not streaming.
      function compiler(options) {
        const settings = options || {}
        const config = configure(
          {
            transforms: [],
            canContainEols: [
              'emphasis',
              'fragment',
              'heading',
              'paragraph',
              'strong'
            ],

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
          },

          settings.mdastExtensions || []
        )

        const data = {}

        return compile

        function compile(events) {
          let tree = {type: 'root', children: []}
          const stack = [tree]
          const tokenStack = []
          const listStack = []
          let index = -1
          let handler
          let listStart

          const context = {
            stack: stack,
            tokenStack: tokenStack,
            config: config,
            enter: enter,
            exit: exit,
            buffer: buffer,
            resume: resume,
            setData: setData,
            getData: getData
          }

          while (++index < events.length) {
      // We preprocess lists to add `listItem` tokens, and to infer whether
      // items the list itself are spread out.
            if (
              events[index][1].type === 'listOrdered' ||
        events[index][1].type === 'listUnordered'
            ) {
              if (events[index][0] === 'enter') {
                listStack.push(index)
              } else {
                listStart = listStack.pop(index)
                index = prepareList(events, listStart, index)
              }
            }
          }

          index = -1

          while (++index < events.length) {
            handler = config[events[index][0]]

            if (own.call(handler, events[index][1].type)) {
              handler[events[index][1].type].call(
                assign({sliceSerialize: events[index][2].sliceSerialize}, context),
                events[index][1]
              )
            }
          }

          if (tokenStack.length) {
            throw new Error(
              'Cannot close document, a token (`' +
          tokenStack[tokenStack.length - 1].type +
          '`, ' +
          stringifyPosition({
            start: tokenStack[tokenStack.length - 1].start,
            end: tokenStack[tokenStack.length - 1].end
          }) +
          ') is still open'
            )
          }

    // Figure out `root` position.
          tree.position = {
            start: point(
              events.length ? events[0][1].start : {line: 1, column: 1, offset: 0}
            ),

            end: point(
              events.length
                ? events[events.length - 2][1].end
                : {line: 1, column: 1, offset: 0}
            )
          }

          index = -1
          while (++index < config.transforms.length) {
            tree = config.transforms[index](tree) || tree
          }

          return tree
        }

        function prepareList(events, start, length) {
          let index = start - 1
          let containerBalance = -1
          let listSpread = false
          let listItem
          let tailIndex
          let lineIndex
          let tailEvent
          let event
          let firstBlankLineIndex
          let atMarker

          while (++index <= length) {
            event = events[index]

            if (
              event[1].type === 'listUnordered' ||
        event[1].type === 'listOrdered' ||
        event[1].type === 'blockQuote'
            ) {
              if (event[0] === 'enter') {
                containerBalance++
              } else {
                containerBalance--
              }

              atMarker = undefined
            } else if (event[1].type === 'lineEndingBlank') {
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
              event[1].type === 'linePrefix' ||
        event[1].type === 'listItemValue' ||
        event[1].type === 'listItemMarker' ||
        event[1].type === 'listItemPrefix' ||
        event[1].type === 'listItemPrefixWhitespace'
            ) {
        // Empty.
            } else {
              atMarker = undefined
            }

            if (
              (!containerBalance &&
          event[0] === 'enter' &&
          event[1].type === 'listItemPrefix') ||
        (containerBalance === -1 &&
          event[0] === 'exit' &&
          (event[1].type === 'listUnordered' ||
            event[1].type === 'listOrdered'))
            ) {
              if (listItem) {
                tailIndex = index
                lineIndex = undefined

                while (tailIndex--) {
                  tailEvent = events[tailIndex]

                  if (
                    tailEvent[1].type === 'lineEnding' ||
              tailEvent[1].type === 'lineEndingBlank'
                  ) {
                    if (tailEvent[0] === 'exit') continue

                    if (lineIndex) {
                      events[lineIndex][1].type = 'lineEndingBlank'
                      listSpread = true
                    }

                    tailEvent[1].type = 'lineEnding'
                    lineIndex = tailIndex
                  } else if (
                    tailEvent[1].type === 'linePrefix' ||
              tailEvent[1].type === 'blockQuotePrefix' ||
              tailEvent[1].type === 'blockQuotePrefixWhitespace' ||
              tailEvent[1].type === 'blockQuoteMarker' ||
              tailEvent[1].type === 'listItemIndent'
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
                listItem.end = point(
                  lineIndex ? events[lineIndex][1].start : event[1].end
                )

                events.splice(lineIndex || index, 0, ['exit', listItem, event[2]])
                index++
                length++
              }

        // Create a new list item.
              if (event[1].type === 'listItemPrefix') {
                listItem = {
                  type: 'listItem',
                  _spread: false,
                  start: point(event[1].start)
                }

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

        function setData(key, value) {
          data[key] = value
        }

        function getData(key) {
          return data[key]
        }

        function point(d) {
          return {line: d.line, column: d.column, offset: d.offset}
        }

        function opener(create, and) {
          return open

          function open(token) {
            enter.call(this, create(token), token)
            if (and) and.call(this, token)
          }
        }

        function buffer() {
          this.stack.push({type: 'fragment', children: []})
        }

        function enter(node, token) {
          this.stack[this.stack.length - 1].children.push(node)
          this.stack.push(node)
          this.tokenStack.push(token)
          node.position = {start: point(token.start)}
          return node
        }

        function closer(and) {
          return close

          function close(token) {
            if (and) and.call(this, token)
            exit.call(this, token)
          }
        }

        function exit(token) {
          const node = this.stack.pop()
          const open = this.tokenStack.pop()

          if (!open) {
            throw new Error(
              'Cannot close `' +
          token.type +
          '` (' +
          stringifyPosition({start: token.start, end: token.end}) +
          '): it’s not open'
            )
          } else if (open.type !== token.type) {
            throw new Error(
              'Cannot close `' +
          token.type +
          '` (' +
          stringifyPosition({start: token.start, end: token.end}) +
          '): a different token (`' +
          open.type +
          '`, ' +
          stringifyPosition({start: open.start, end: open.end}) +
          ') is open'
            )
          }

          node.position.end = point(token.end)
          return node
        }

        function resume() {
          return toString(this.stack.pop())
        }

  //
  // Handlers.
  //

        function onenterlistordered() {
          setData('expectingFirstListItemValue', true)
        }

        function onenterlistitemvalue(token) {
          if (getData('expectingFirstListItemValue')) {
            this.stack[this.stack.length - 2].start = parseInt(
              this.sliceSerialize(token),
              10
            )

            setData('expectingFirstListItemValue')
          }
        }

        function onexitcodefencedfenceinfo() {
          const data = this.resume()
          this.stack[this.stack.length - 1].lang = data
        }

        function onexitcodefencedfencemeta() {
          const data = this.resume()
          this.stack[this.stack.length - 1].meta = data
        }

        function onexitcodefencedfence() {
    // Exit if this is the closing fence.
          if (getData('flowCodeInside')) return
          this.buffer()
          setData('flowCodeInside', true)
        }

        function onexitcodefenced() {
          const data = this.resume()
          this.stack[this.stack.length - 1].value = data.replace(
            /^(\r?\n|\r)|(\r?\n|\r)$/g,
            ''
          )

          setData('flowCodeInside')
        }

        function onexitcodeindented() {
          const data = this.resume()
          this.stack[this.stack.length - 1].value = data
        }

        function onexitdefinitionlabelstring(token) {
    // Discard label, use the source content instead.
          const label = this.resume()
          this.stack[this.stack.length - 1].label = label
          this.stack[this.stack.length - 1].identifier = normalizeIdentifier(
            this.sliceSerialize(token)
          ).toLowerCase()
        }

        function onexitdefinitiontitlestring() {
          const data = this.resume()
          this.stack[this.stack.length - 1].title = data
        }

        function onexitdefinitiondestinationstring() {
          const data = this.resume()
          this.stack[this.stack.length - 1].url = data
        }

        function onexitatxheadingsequence(token) {
          if (!this.stack[this.stack.length - 1].depth) {
            this.stack[this.stack.length - 1].depth = this.sliceSerialize(
              token
            ).length
          }
        }

        function onexitsetextheadingtext() {
          setData('setextHeadingSlurpLineEnding', true)
        }

        function onexitsetextheadinglinesequence(token) {
          this.stack[this.stack.length - 1].depth =
      this.sliceSerialize(token).charCodeAt(0) === 61 ? 1 : 2
        }

        function onexitsetextheading() {
          setData('setextHeadingSlurpLineEnding')
        }

        function onenterdata(token) {
          const siblings = this.stack[this.stack.length - 1].children
          let tail = siblings[siblings.length - 1]

          if (!tail || tail.type !== 'text') {
      // Add a new text node.
            tail = text()
            tail.position = {start: point(token.start)}
            this.stack[this.stack.length - 1].children.push(tail)
          }

          this.stack.push(tail)
        }

        function onexitdata(token) {
          const tail = this.stack.pop()
          tail.value += this.sliceSerialize(token)
          tail.position.end = point(token.end)
        }

        function onexitlineending(token) {
          const context = this.stack[this.stack.length - 1]

    // If we’re at a hard break, include the line ending in there.
          if (getData('atHardBreak')) {
            context.children[context.children.length - 1].position.end = point(
              token.end
            )

            setData('atHardBreak')
            return
          }

          if (
            !getData('setextHeadingSlurpLineEnding') &&
      config.canContainEols.indexOf(context.type) > -1
          ) {
            onenterdata.call(this, token)
            onexitdata.call(this, token)
          }
        }

        function onexithardbreak() {
          setData('atHardBreak', true)
        }

        function onexithtmlflow() {
          const data = this.resume()
          this.stack[this.stack.length - 1].value = data
        }

        function onexithtmltext() {
          const data = this.resume()
          this.stack[this.stack.length - 1].value = data
        }

        function onexitcodetext() {
          const data = this.resume()
          this.stack[this.stack.length - 1].value = data
        }

        function onexitlink() {
          const context = this.stack[this.stack.length - 1]

    // To do: clean.
          if (getData('inReference')) {
            context.type += 'Reference'
            context.referenceType = getData('referenceType') || 'shortcut'
            delete context.url
            delete context.title
          } else {
            delete context.identifier
            delete context.label
            delete context.referenceType
          }

          setData('referenceType')
        }

        function onexitimage() {
          const context = this.stack[this.stack.length - 1]

    // To do: clean.
          if (getData('inReference')) {
            context.type += 'Reference'
            context.referenceType = getData('referenceType') || 'shortcut'
            delete context.url
            delete context.title
          } else {
            delete context.identifier
            delete context.label
            delete context.referenceType
          }

          setData('referenceType')
        }

        function onexitlabeltext(token) {
          this.stack[this.stack.length - 2].identifier = normalizeIdentifier(
            this.sliceSerialize(token)
          ).toLowerCase()
        }

        function onexitlabel() {
          const fragment = this.stack[this.stack.length - 1]
          const value = this.resume()

          this.stack[this.stack.length - 1].label = value

    // Assume a reference.
          setData('inReference', true)

          if (this.stack[this.stack.length - 1].type === 'link') {
            this.stack[this.stack.length - 1].children = fragment.children
          } else {
            this.stack[this.stack.length - 1].alt = value
          }
        }

        function onexitresourcedestinationstring() {
          const data = this.resume()
          this.stack[this.stack.length - 1].url = data
        }

        function onexitresourcetitlestring() {
          const data = this.resume()
          this.stack[this.stack.length - 1].title = data
        }

        function onexitresource() {
          setData('inReference')
        }

        function onenterreference() {
          setData('referenceType', 'collapsed')
        }

        function onexitreferencestring(token) {
          const label = this.resume()
          this.stack[this.stack.length - 1].label = label
          this.stack[this.stack.length - 1].identifier = normalizeIdentifier(
            this.sliceSerialize(token)
          ).toLowerCase()
          setData('referenceType', 'full')
        }

        function onexitcharacterreferencemarker(token) {
          setData('characterReferenceType', token.type)
        }

        function onexitcharacterreferencevalue(token) {
          const data = this.sliceSerialize(token)
          const type = getData('characterReferenceType')
          let value
          let tail

          if (type) {
            value = safeFromInt(
              data,
              type === 'characterReferenceMarkerNumeric' ? 10 : 16
            )

            setData('characterReferenceType')
          } else {
            value = decode(data)
          }

          tail = this.stack.pop()
          tail.value += value
          tail.position.end = point(token.end)
        }

        function onexitautolinkprotocol(token) {
          onexitdata.call(this, token)
          this.stack[this.stack.length - 1].url = this.sliceSerialize(token)
        }

        function onexitautolinkemail(token) {
          onexitdata.call(this, token)
          this.stack[this.stack.length - 1].url =
      'mailto:' + this.sliceSerialize(token)
        }

  //
  // Creaters.
  //

        function blockQuote() {
          return {type: 'blockquote', children: []}
        }

        function codeFlow() {
          return {type: 'code', lang: null, meta: null, value: ''}
        }

        function codeText() {
          return {type: 'inlineCode', value: ''}
        }

        function definition() {
          return {
            type: 'definition',
            identifier: '',
            label: null,
            title: null,
            url: ''
          }
        }

        function emphasis() {
          return {type: 'emphasis', children: []}
        }

        function heading() {
          return {type: 'heading', depth: undefined, children: []}
        }

        function hardBreak() {
          return {type: 'break'}
        }

        function html() {
          return {type: 'html', value: ''}
        }

        function image() {
          return {type: 'image', title: null, url: '', alt: null}
        }

        function link() {
          return {type: 'link', title: null, url: '', children: []}
        }

        function list(token) {
          return {
            type: 'list',
            ordered: token.type === 'listOrdered',
            start: null,
            spread: token._spread,
            children: []
          }
        }

        function listItem(token) {
          return {
            type: 'listItem',
            spread: token._spread,
            checked: null,
            children: []
          }
        }

        function paragraph() {
          return {type: 'paragraph', children: []}
        }

        function strong() {
          return {type: 'strong', children: []}
        }

        function text() {
          return {type: 'text', value: ''}
        }

        function thematicBreak() {
          return {type: 'thematicBreak'}
        }
      }

      function configure(config, extensions) {
        let index = -1

        while (++index < extensions.length) {
          extension(config, extensions[index])
        }

        return config
      }

      function extension(config, extension) {
        let key
        let left

        for (key in extension) {
          left = own.call(config, key) ? config[key] : (config[key] = {})

          if (key === 'canContainEols' || key === 'transforms') {
            config[key] = [].concat(left, extension[key])
          } else {
            Object.assign(left, extension[key])
          }
        }
      }


/***/ }),

/***/ "../../node_modules/mdast-util-from-markdown/index.js":
/*!************************************************************!*\
  !*** ../../node_modules/mdast-util-from-markdown/index.js ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = __webpack_require__(/*! ./dist */ "../../node_modules/mdast-util-from-markdown/dist/index.js")


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/index.js":
/*!******************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/index.js ***!
  \******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";

      module.exports = __webpack_require__(/*! ./lib */ "../../node_modules/mdast-util-to-hast/lib/index.js")


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/all.js":
/*!********************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/all.js ***!
  \********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = all

      const one = __webpack_require__(/*! ./one */ "../../node_modules/mdast-util-to-hast/lib/one.js")

      function all(h, parent) {
        const nodes = parent.children || []
        const length = nodes.length
        let values = []
        let index = -1
        let result
        let head

        while (++index < length) {
          result = one(h, nodes[index], parent)

          if (result) {
            if (index && nodes[index - 1].type === 'break') {
              if (result.value) {
                result.value = result.value.replace(/^\s+/, '')
              }

              head = result.children && result.children[0]

              if (head && head.value) {
                head.value = head.value.replace(/^\s+/, '')
              }
            }

            values = values.concat(result)
          }
        }

        return values
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/footer.js":
/*!***********************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/footer.js ***!
  \***********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = generateFootnotes

      const thematicBreak = __webpack_require__(/*! ./handlers/thematic-break */ "../../node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js")
      const list = __webpack_require__(/*! ./handlers/list */ "../../node_modules/mdast-util-to-hast/lib/handlers/list.js")
      const wrap = __webpack_require__(/*! ./wrap */ "../../node_modules/mdast-util-to-hast/lib/wrap.js")

      function generateFootnotes(h) {
        const footnoteById = h.footnoteById
        const footnoteOrder = h.footnoteOrder
        const length = footnoteOrder.length
        let index = -1
        const listItems = []
        let def
        let backReference
        let content
        let tail

        while (++index < length) {
          def = footnoteById[footnoteOrder[index].toUpperCase()]

          if (!def) {
            continue
          }

          content = def.children.concat()
          tail = content[content.length - 1]
          backReference = {
            type: 'link',
            url: '#fnref-' + def.identifier,
            data: {hProperties: {className: ['footnote-backref']}},
            children: [{type: 'text', value: '↩'}]
          }

          if (!tail || tail.type !== 'paragraph') {
            tail = {type: 'paragraph', children: []}
            content.push(tail)
          }

          tail.children.push(backReference)

          listItems.push({
            type: 'listItem',
            data: {hProperties: {id: 'fn-' + def.identifier}},
            children: content,
            position: def.position
          })
        }

        if (listItems.length === 0) {
          return null
        }

        return h(
          null,
          'div',
          {className: ['footnotes']},
          wrap(
            [
              thematicBreak(h),
              list(h, {type: 'list', ordered: true, children: listItems})
            ],
            true
          )
        )
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/blockquote.js":
/*!************************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/blockquote.js ***!
  \************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = blockquote

      const wrap = __webpack_require__(/*! ../wrap */ "../../node_modules/mdast-util-to-hast/lib/wrap.js")
      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function blockquote(h, node) {
        return h(node, 'blockquote', wrap(all(h, node), true))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/break.js":
/*!*******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/break.js ***!
  \*******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = hardBreak

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")

      function hardBreak(h, node) {
        return [h(node, 'br'), u('text', '\n')]
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/code.js":
/*!******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/code.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = code

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")

      function code(h, node) {
        const value = node.value ? node.value + '\n' : ''
  // To do: next major, use `node.lang` w/o regex, the splitting’s been going
  // on for years in remark now.
        const lang = node.lang && node.lang.match(/^[^ \t]+(?=[ \t]|$)/)
        const props = {}
        let code

        if (lang) {
          props.className = ['language-' + lang]
        }

        code = h(node, 'code', props, [u('text', value)])

        if (node.meta) {
          code.data = {meta: node.meta}
        }

        return h(node.position, 'pre', [code])
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/delete.js":
/*!********************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/delete.js ***!
  \********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = strikethrough

      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function strikethrough(h, node) {
        return h(node, 'del', all(h, node))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/emphasis.js":
/*!**********************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/emphasis.js ***!
  \**********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = emphasis

      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function emphasis(h, node) {
        return h(node, 'em', all(h, node))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js":
/*!********************************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js ***!
  \********************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = footnoteReference

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")

      function footnoteReference(h, node) {
        const footnoteOrder = h.footnoteOrder
        const identifier = String(node.identifier)

        if (footnoteOrder.indexOf(identifier) === -1) {
          footnoteOrder.push(identifier)
        }

        return h(node.position, 'sup', {id: 'fnref-' + identifier}, [
          h(node, 'a', {href: '#fn-' + identifier, className: ['footnote-ref']}, [
            u('text', node.label || identifier)
          ])
        ])
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/footnote.js":
/*!**********************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/footnote.js ***!
  \**********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = footnote

      const footnoteReference = __webpack_require__(/*! ./footnote-reference */ "../../node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js")

      function footnote(h, node) {
        const footnoteById = h.footnoteById
        const footnoteOrder = h.footnoteOrder
        let identifier = 1

        while (identifier in footnoteById) {
          identifier++
        }

        identifier = String(identifier)

  // No need to check if `identifier` exists in `footnoteOrder`, it’s guaranteed
  // to not exist because we just generated it.
        footnoteOrder.push(identifier)

        footnoteById[identifier] = {
          type: 'footnoteDefinition',
          identifier: identifier,
          children: [{type: 'paragraph', children: node.children}],
          position: node.position
        }

        return footnoteReference(h, {
          type: 'footnoteReference',
          identifier: identifier,
          position: node.position
        })
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/heading.js":
/*!*********************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/heading.js ***!
  \*********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = heading

      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function heading(h, node) {
        return h(node, 'h' + node.depth, all(h, node))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/html.js":
/*!******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/html.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = html

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")

// Return either a `raw` node in dangerous mode, otherwise nothing.
      function html(h, node) {
        return h.dangerous ? h.augment(node, u('raw', node.value)) : null
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/image-reference.js":
/*!*****************************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/image-reference.js ***!
  \*****************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = imageReference

      const normalize = __webpack_require__(/*! mdurl/encode */ "../../node_modules/mdurl/encode.js")
      const revert = __webpack_require__(/*! ../revert */ "../../node_modules/mdast-util-to-hast/lib/revert.js")

      function imageReference(h, node) {
        const def = h.definition(node.identifier)
        let props

        if (!def) {
          return revert(h, node)
        }

        props = {src: normalize(def.url || ''), alt: node.alt}

        if (def.title !== null && def.title !== undefined) {
          props.title = def.title
        }

        return h(node, 'img', props)
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/image.js":
/*!*******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/image.js ***!
  \*******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const normalize = __webpack_require__(/*! mdurl/encode */ "../../node_modules/mdurl/encode.js")

      module.exports = image

      function image(h, node) {
        const props = {src: normalize(node.url), alt: node.alt}

        if (node.title !== null && node.title !== undefined) {
          props.title = node.title
        }

        return h(node, 'img', props)
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/index.js":
/*!*******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/index.js ***!
  \*******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = {
        blockquote: __webpack_require__(/*! ./blockquote */ "../../node_modules/mdast-util-to-hast/lib/handlers/blockquote.js"),
        break: __webpack_require__(/*! ./break */ "../../node_modules/mdast-util-to-hast/lib/handlers/break.js"),
        code: __webpack_require__(/*! ./code */ "../../node_modules/mdast-util-to-hast/lib/handlers/code.js"),
        delete: __webpack_require__(/*! ./delete */ "../../node_modules/mdast-util-to-hast/lib/handlers/delete.js"),
        emphasis: __webpack_require__(/*! ./emphasis */ "../../node_modules/mdast-util-to-hast/lib/handlers/emphasis.js"),
        footnoteReference: __webpack_require__(/*! ./footnote-reference */ "../../node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js"),
        footnote: __webpack_require__(/*! ./footnote */ "../../node_modules/mdast-util-to-hast/lib/handlers/footnote.js"),
        heading: __webpack_require__(/*! ./heading */ "../../node_modules/mdast-util-to-hast/lib/handlers/heading.js"),
        html: __webpack_require__(/*! ./html */ "../../node_modules/mdast-util-to-hast/lib/handlers/html.js"),
        imageReference: __webpack_require__(/*! ./image-reference */ "../../node_modules/mdast-util-to-hast/lib/handlers/image-reference.js"),
        image: __webpack_require__(/*! ./image */ "../../node_modules/mdast-util-to-hast/lib/handlers/image.js"),
        inlineCode: __webpack_require__(/*! ./inline-code */ "../../node_modules/mdast-util-to-hast/lib/handlers/inline-code.js"),
        linkReference: __webpack_require__(/*! ./link-reference */ "../../node_modules/mdast-util-to-hast/lib/handlers/link-reference.js"),
        link: __webpack_require__(/*! ./link */ "../../node_modules/mdast-util-to-hast/lib/handlers/link.js"),
        listItem: __webpack_require__(/*! ./list-item */ "../../node_modules/mdast-util-to-hast/lib/handlers/list-item.js"),
        list: __webpack_require__(/*! ./list */ "../../node_modules/mdast-util-to-hast/lib/handlers/list.js"),
        paragraph: __webpack_require__(/*! ./paragraph */ "../../node_modules/mdast-util-to-hast/lib/handlers/paragraph.js"),
        root: __webpack_require__(/*! ./root */ "../../node_modules/mdast-util-to-hast/lib/handlers/root.js"),
        strong: __webpack_require__(/*! ./strong */ "../../node_modules/mdast-util-to-hast/lib/handlers/strong.js"),
        table: __webpack_require__(/*! ./table */ "../../node_modules/mdast-util-to-hast/lib/handlers/table.js"),
        text: __webpack_require__(/*! ./text */ "../../node_modules/mdast-util-to-hast/lib/handlers/text.js"),
        thematicBreak: __webpack_require__(/*! ./thematic-break */ "../../node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js"),
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

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/inline-code.js":
/*!*************************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/inline-code.js ***!
  \*************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = inlineCode

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")

      function inlineCode(h, node) {
        const value = node.value.replace(/\r?\n|\r/g, ' ')
        return h(node, 'code', [u('text', value)])
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/link-reference.js":
/*!****************************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/link-reference.js ***!
  \****************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = linkReference

      const normalize = __webpack_require__(/*! mdurl/encode */ "../../node_modules/mdurl/encode.js")
      const revert = __webpack_require__(/*! ../revert */ "../../node_modules/mdast-util-to-hast/lib/revert.js")
      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function linkReference(h, node) {
        const def = h.definition(node.identifier)
        let props

        if (!def) {
          return revert(h, node)
        }

        props = {href: normalize(def.url || '')}

        if (def.title !== null && def.title !== undefined) {
          props.title = def.title
        }

        return h(node, 'a', props, all(h, node))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/link.js":
/*!******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/link.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const normalize = __webpack_require__(/*! mdurl/encode */ "../../node_modules/mdurl/encode.js")
      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      module.exports = link

      function link(h, node) {
        const props = {href: normalize(node.url)}

        if (node.title !== null && node.title !== undefined) {
          props.title = node.title
        }

        return h(node, 'a', props, all(h, node))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/list-item.js":
/*!***********************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/list-item.js ***!
  \***********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = listItem

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")
      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function listItem(h, node, parent) {
        const result = all(h, node)
        let head = result[0]
        const loose = parent ? listLoose(parent) : listItemLoose(node)
        const props = {}
        let wrapped = []
        let length
        let index
        let child

        if (typeof node.checked === 'boolean') {
          if (!head || head.tagName !== 'p') {
            head = h(null, 'p', [])
            result.unshift(head)
          }

          if (head.children.length > 0) {
            head.children.unshift(u('text', ' '))
          }

          head.children.unshift(
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

        length = result.length
        index = -1

        while (++index < length) {
          child = result[index]

    // Add eols before nodes, except if this is a loose, first paragraph.
          if (loose || index !== 0 || child.tagName !== 'p') {
            wrapped.push(u('text', '\n'))
          }

          if (child.tagName === 'p' && !loose) {
            wrapped = wrapped.concat(child.children)
          } else {
            wrapped.push(child)
          }
        }

  // Add a final eol.
        if (length && (loose || child.tagName !== 'p')) {
          wrapped.push(u('text', '\n'))
        }

        return h(node, 'li', props, wrapped)
      }

      function listLoose(node) {
        let loose = node.spread
        const children = node.children
        const length = children.length
        let index = -1

        while (!loose && ++index < length) {
          loose = listItemLoose(children[index])
        }

        return loose
      }

      function listItemLoose(node) {
        const spread = node.spread

        return spread === undefined || spread === null
          ? node.children.length > 1
          : spread
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/list.js":
/*!******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/list.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = list

      const wrap = __webpack_require__(/*! ../wrap */ "../../node_modules/mdast-util-to-hast/lib/wrap.js")
      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function list(h, node) {
        const props = {}
        const name = node.ordered ? 'ol' : 'ul'
        let items
        let index = -1
        let length

        if (typeof node.start === 'number' && node.start !== 1) {
          props.start = node.start
        }

        items = all(h, node)
        length = items.length

  // Like GitHub, add a class for custom styling.
        while (++index < length) {
          if (
            items[index].properties.className &&
      items[index].properties.className.indexOf('task-list-item') !== -1
          ) {
            props.className = ['contains-task-list']
            break
          }
        }

        return h(node, name, props, wrap(items, true))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/paragraph.js":
/*!***********************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/paragraph.js ***!
  \***********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = paragraph

      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function paragraph(h, node) {
        return h(node, 'p', all(h, node))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/root.js":
/*!******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/root.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = root

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")
      const wrap = __webpack_require__(/*! ../wrap */ "../../node_modules/mdast-util-to-hast/lib/wrap.js")
      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function root(h, node) {
        return h.augment(node, u('root', wrap(all(h, node))))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/strong.js":
/*!********************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/strong.js ***!
  \********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = strong

      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function strong(h, node) {
        return h(node, 'strong', all(h, node))
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/table.js":
/*!*******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/table.js ***!
  \*******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = table

      const position = __webpack_require__(/*! unist-util-position */ "../../node_modules/unist-util-position/index.js")
      const wrap = __webpack_require__(/*! ../wrap */ "../../node_modules/mdast-util-to-hast/lib/wrap.js")
      const all = __webpack_require__(/*! ../all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      function table(h, node) {
        const rows = node.children
        let index = rows.length
        const align = node.align || []
        const alignLength = align.length
        const result = []
        let pos
        let row
        let out
        let name
        let cell

        while (index--) {
          row = rows[index].children
          name = index === 0 ? 'th' : 'td'
          pos = alignLength || row.length
          out = []

          while (pos--) {
            cell = row[pos]
            out[pos] = h(cell, name, {align: align[pos]}, cell ? all(h, cell) : [])
          }

          result[index] = h(rows[index], 'tr', wrap(out, true))
        }

        return h(
          node,
          'table',
          wrap(
            [h(result[0].position, 'thead', wrap([result[0]], true))].concat(
              result[1]
                ? h(
                  {
                    start: position.start(result[1]),
                    end: position.end(result[result.length - 1])
                  },
                  'tbody',
                  wrap(result.slice(1), true)
                )
                : []
            ),
            true
          )
        )
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/text.js":
/*!******************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/text.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = text

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")

      function text(h, node) {
        return h.augment(
          node,
          u('text', String(node.value).replace(/[ \t]*(\r?\n|\r)[ \t]*/g, '$1'))
        )
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js":
/*!****************************************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js ***!
  \****************************************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = thematicBreak

      function thematicBreak(h, node) {
        return h(node, 'hr')
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/index.js":
/*!**********************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/index.js ***!
  \**********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = toHast

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")
      const visit = __webpack_require__(/*! unist-util-visit */ "../../node_modules/unist-util-visit/index.js")
      const position = __webpack_require__(/*! unist-util-position */ "../../node_modules/unist-util-position/index.js")
      const generated = __webpack_require__(/*! unist-util-generated */ "../../node_modules/unist-util-generated/index.js")
      const definitions = __webpack_require__(/*! mdast-util-definitions */ "../../node_modules/mdast-util-definitions/index.js")
      const one = __webpack_require__(/*! ./one */ "../../node_modules/mdast-util-to-hast/lib/one.js")
      const footer = __webpack_require__(/*! ./footer */ "../../node_modules/mdast-util-to-hast/lib/footer.js")
      const handlers = __webpack_require__(/*! ./handlers */ "../../node_modules/mdast-util-to-hast/lib/handlers/index.js")

      const own = {}.hasOwnProperty

      let deprecationWarningIssued = false

// Factory to transform.
      function factory(tree, options) {
        const settings = options || {}

  // Issue a warning if the deprecated tag 'allowDangerousHTML' is used
        if (settings.allowDangerousHTML !== undefined && !deprecationWarningIssued) {
          deprecationWarningIssued = true
          console.warn(
            'mdast-util-to-hast: deprecation: `allowDangerousHTML` is nonstandard, use `allowDangerousHtml` instead'
          )
        }

        const dangerous = settings.allowDangerousHtml || settings.allowDangerousHTML
        const footnoteById = {}

        h.dangerous = dangerous
        h.definition = definitions(tree)
        h.footnoteById = footnoteById
        h.footnoteOrder = []
        h.augment = augment
        h.handlers = Object.assign({}, handlers, settings.handlers)
        h.unknownHandler = settings.unknownHandler
        h.passThrough = settings.passThrough

        visit(tree, 'footnoteDefinition', onfootnotedefinition)

        return h

  // Finalise the created `right`, a hast node, from `left`, an mdast node.
        function augment(left, right) {
          let data
          let ctx

    // Handle `data.hName`, `data.hProperties, `data.hChildren`.
          if (left && left.data) {
            data = left.data

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
              right.properties = Object.assign({}, right.properties, data.hProperties)
            }

            if (right.children && data.hChildren) {
              right.children = data.hChildren
            }
          }

          ctx = left && left.position ? left : {position: left}

          if (!generated(ctx)) {
            right.position = {
              start: position.start(ctx),
              end: position.end(ctx)
            }
          }

          return right
        }

  // Create an element for `node`.
        function h(node, tagName, props, children) {
          if (
            (children === undefined || children === null) &&
      typeof props === 'object' &&
      'length' in props
          ) {
            children = props
            props = {}
          }

          return augment(node, {
            type: 'element',
            tagName: tagName,
            properties: props || {},
            children: children || []
          })
        }

        function onfootnotedefinition(definition) {
          const id = String(definition.identifier).toUpperCase()

    // Mimick CM behavior of link definitions.
    // See: <https://github.com/syntax-tree/mdast-util-definitions/blob/8290999/index.js#L26>.
          if (!own.call(footnoteById, id)) {
            footnoteById[id] = definition
          }
        }
      }

// Transform `tree`, which is an mdast node, to a hast node.
      function toHast(tree, options) {
        const h = factory(tree, options)
        const node = one(h, tree)
        const foot = footer(h)

        if (foot) {
          node.children = node.children.concat(u('text', '\n'), foot)
        }

        return node
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/one.js":
/*!********************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/one.js ***!
  \********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = one

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")
      const all = __webpack_require__(/*! ./all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

      const own = {}.hasOwnProperty

// Transform an unknown node.
      function unknown(h, node) {
        if (text(node)) {
          return h.augment(node, u('text', node.value))
        }

        return h(node, 'div', all(h, node))
      }

// Visit a node.
      function one(h, node, parent) {
        const type = node && node.type
        let fn

  // Fail on non-nodes.
        if (!type) {
          throw new Error('Expected node, got `' + node + '`')
        }

        if (own.call(h.handlers, type)) {
          fn = h.handlers[type]
        } else if (h.passThrough && h.passThrough.indexOf(type) > -1) {
          fn = returnNode
        } else {
          fn = h.unknownHandler
        }

        return (typeof fn === 'function' ? fn : unknown)(h, node, parent)
      }

// Check if the node should be renderered as a text node.
      function text(node) {
        const data = node.data || {}

        if (
          own.call(data, 'hName') ||
    own.call(data, 'hProperties') ||
    own.call(data, 'hChildren')
        ) {
          return false
        }

        return 'value' in node
      }

      function returnNode(h, node) {
        let clone

        if (node.children) {
          clone = Object.assign({}, node)
          clone.children = all(h, node)
          return clone
        }

        return node
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/revert.js":
/*!***********************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/revert.js ***!
  \***********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = revert

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")
      const all = __webpack_require__(/*! ./all */ "../../node_modules/mdast-util-to-hast/lib/all.js")

// Return the content of a reference without definition as Markdown.
      function revert(h, node) {
        const subtype = node.referenceType
        let suffix = ']'
        let contents
        let head
        let tail

        if (subtype === 'collapsed') {
          suffix += '[]'
        } else if (subtype === 'full') {
          suffix += '[' + (node.label || node.identifier) + ']'
        }

        if (node.type === 'imageReference') {
          return u('text', '![' + node.alt + suffix)
        }

        contents = all(h, node)
        head = contents[0]

        if (head && head.type === 'text') {
          head.value = '[' + head.value
        } else {
          contents.unshift(u('text', '['))
        }

        tail = contents[contents.length - 1]

        if (tail && tail.type === 'text') {
          tail.value += suffix
        } else {
          contents.push(u('text', suffix))
        }

        return contents
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-hast/lib/wrap.js":
/*!*********************************************************!*\
  !*** ../../node_modules/mdast-util-to-hast/lib/wrap.js ***!
  \*********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = wrap

      const u = __webpack_require__(/*! unist-builder */ "../../node_modules/unist-builder/index.js")

// Wrap `nodes` with line feeds between each entry.
// Optionally adds line feeds at the start and end.
      function wrap(nodes, loose) {
        const result = []
        let index = -1
        const length = nodes.length

        if (loose) {
          result.push(u('text', '\n'))
        }

        while (++index < length) {
          if (index) {
            result.push(u('text', '\n'))
          }

          result.push(nodes[index])
        }

        if (loose && nodes.length > 0) {
          result.push(u('text', '\n'))
        }

        return result
      }


/***/ }),

/***/ "../../node_modules/mdast-util-to-string/index.js":
/*!********************************************************!*\
  !*** ../../node_modules/mdast-util-to-string/index.js ***!
  \********************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = toString

// Get the text content of a node.
// Prefer the node’s plain-text fields, otherwise serialize its children,
// and if the given value is an array, serialize the nodes in it.
      function toString(node) {
        return (
          (node &&
      (node.value ||
        node.alt ||
        node.title ||
        ('children' in node && all(node.children)) ||
        ('length' in node && all(node)))) ||
    ''
        )
      }

      function all(values) {
        const result = []
        let index = -1

        while (++index < values.length) {
          result[index] = toString(values[index])
        }

        return result.join('')
      }


/***/ }),

/***/ "../../node_modules/mdurl/encode.js":
/*!******************************************!*\
  !*** ../../node_modules/mdurl/encode.js ***!
  \******************************************/
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

/***/ "../../node_modules/micromark/dist/character/ascii-alpha.js":
/*!******************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/ascii-alpha.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const regexCheck = __webpack_require__(/*! ../util/regex-check.js */ "../../node_modules/micromark/dist/util/regex-check.js")

      const asciiAlpha = regexCheck(/[A-Za-z]/)

      module.exports = asciiAlpha


/***/ }),

/***/ "../../node_modules/micromark/dist/character/ascii-alphanumeric.js":
/*!*************************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/ascii-alphanumeric.js ***!
  \*************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const regexCheck = __webpack_require__(/*! ../util/regex-check.js */ "../../node_modules/micromark/dist/util/regex-check.js")

      const asciiAlphanumeric = regexCheck(/[\dA-Za-z]/)

      module.exports = asciiAlphanumeric


/***/ }),

/***/ "../../node_modules/micromark/dist/character/ascii-atext.js":
/*!******************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/ascii-atext.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const regexCheck = __webpack_require__(/*! ../util/regex-check.js */ "../../node_modules/micromark/dist/util/regex-check.js")

      const asciiAtext = regexCheck(/[#-'*+\--9=?A-Z^-~]/)

      module.exports = asciiAtext


/***/ }),

/***/ "../../node_modules/micromark/dist/character/ascii-control.js":
/*!********************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/ascii-control.js ***!
  \********************************************************************/
/***/ ((module) => {

      "use strict";


// Note: EOF is seen as ASCII control here, because `null < 32 == true`.
      function asciiControl(code) {
        return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
          code < 32 || code === 127
        )
      }

      module.exports = asciiControl


/***/ }),

/***/ "../../node_modules/micromark/dist/character/ascii-digit.js":
/*!******************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/ascii-digit.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const regexCheck = __webpack_require__(/*! ../util/regex-check.js */ "../../node_modules/micromark/dist/util/regex-check.js")

      const asciiDigit = regexCheck(/\d/)

      module.exports = asciiDigit


/***/ }),

/***/ "../../node_modules/micromark/dist/character/ascii-hex-digit.js":
/*!**********************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/ascii-hex-digit.js ***!
  \**********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const regexCheck = __webpack_require__(/*! ../util/regex-check.js */ "../../node_modules/micromark/dist/util/regex-check.js")

      const asciiHexDigit = regexCheck(/[\dA-Fa-f]/)

      module.exports = asciiHexDigit


/***/ }),

/***/ "../../node_modules/micromark/dist/character/ascii-punctuation.js":
/*!************************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/ascii-punctuation.js ***!
  \************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const regexCheck = __webpack_require__(/*! ../util/regex-check.js */ "../../node_modules/micromark/dist/util/regex-check.js")

      const asciiPunctuation = regexCheck(/[!-/:-@[-`{-~]/)

      module.exports = asciiPunctuation


/***/ }),

/***/ "../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js":
/*!************************************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js ***!
  \************************************************************************************/
/***/ ((module) => {

      "use strict";


      function markdownLineEndingOrSpace(code) {
        return code < 0 || code === 32
      }

      module.exports = markdownLineEndingOrSpace


/***/ }),

/***/ "../../node_modules/micromark/dist/character/markdown-line-ending.js":
/*!***************************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/markdown-line-ending.js ***!
  \***************************************************************************/
/***/ ((module) => {

      "use strict";


      function markdownLineEnding(code) {
        return code < -2
      }

      module.exports = markdownLineEnding


/***/ }),

/***/ "../../node_modules/micromark/dist/character/markdown-space.js":
/*!*********************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/markdown-space.js ***!
  \*********************************************************************/
/***/ ((module) => {

      "use strict";


      function markdownSpace(code) {
        return code === -2 || code === -1 || code === 32
      }

      module.exports = markdownSpace


/***/ }),

/***/ "../../node_modules/micromark/dist/character/unicode-punctuation.js":
/*!**************************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/unicode-punctuation.js ***!
  \**************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const unicodePunctuationRegex = __webpack_require__(/*! ../constant/unicode-punctuation-regex.js */ "../../node_modules/micromark/dist/constant/unicode-punctuation-regex.js")
      const regexCheck = __webpack_require__(/*! ../util/regex-check.js */ "../../node_modules/micromark/dist/util/regex-check.js")

// In fact adds to the bundle size.

      const unicodePunctuation = regexCheck(unicodePunctuationRegex)

      module.exports = unicodePunctuation


/***/ }),

/***/ "../../node_modules/micromark/dist/character/unicode-whitespace.js":
/*!*************************************************************************!*\
  !*** ../../node_modules/micromark/dist/character/unicode-whitespace.js ***!
  \*************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const regexCheck = __webpack_require__(/*! ../util/regex-check.js */ "../../node_modules/micromark/dist/util/regex-check.js")

      const unicodeWhitespace = regexCheck(/\s/)

      module.exports = unicodeWhitespace


/***/ }),

/***/ "../../node_modules/micromark/dist/constant/assign.js":
/*!************************************************************!*\
  !*** ../../node_modules/micromark/dist/constant/assign.js ***!
  \************************************************************/
/***/ ((module) => {

      "use strict";


      const assign = Object.assign

      module.exports = assign


/***/ }),

/***/ "../../node_modules/micromark/dist/constant/from-char-code.js":
/*!********************************************************************!*\
  !*** ../../node_modules/micromark/dist/constant/from-char-code.js ***!
  \********************************************************************/
/***/ ((module) => {

      "use strict";


      const fromCharCode = String.fromCharCode

      module.exports = fromCharCode


/***/ }),

/***/ "../../node_modules/micromark/dist/constant/has-own-property.js":
/*!**********************************************************************!*\
  !*** ../../node_modules/micromark/dist/constant/has-own-property.js ***!
  \**********************************************************************/
/***/ ((module) => {

      "use strict";


      const own = {}.hasOwnProperty

      module.exports = own


/***/ }),

/***/ "../../node_modules/micromark/dist/constant/html-block-names.js":
/*!**********************************************************************!*\
  !*** ../../node_modules/micromark/dist/constant/html-block-names.js ***!
  \**********************************************************************/
/***/ ((module) => {

      "use strict";


// This module is copied from <https://spec.commonmark.org/0.29/#html-blocks>.
      const basics = [
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
        'section',
        'source',
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

      module.exports = basics


/***/ }),

/***/ "../../node_modules/micromark/dist/constant/html-raw-names.js":
/*!********************************************************************!*\
  !*** ../../node_modules/micromark/dist/constant/html-raw-names.js ***!
  \********************************************************************/
/***/ ((module) => {

      "use strict";


// This module is copied from <https://spec.commonmark.org/0.29/#html-blocks>.
      const raws = ['pre', 'script', 'style', 'textarea']

      module.exports = raws


/***/ }),

/***/ "../../node_modules/micromark/dist/constant/splice.js":
/*!************************************************************!*\
  !*** ../../node_modules/micromark/dist/constant/splice.js ***!
  \************************************************************/
/***/ ((module) => {

      "use strict";


      const splice = [].splice

      module.exports = splice


/***/ }),

/***/ "../../node_modules/micromark/dist/constant/unicode-punctuation-regex.js":
/*!*******************************************************************************!*\
  !*** ../../node_modules/micromark/dist/constant/unicode-punctuation-regex.js ***!
  \*******************************************************************************/
/***/ ((module) => {

      "use strict";


// This module is generated by `script/`.
//
// CommonMark handles attention (emphasis, strong) markers based on what comes
// before or after them.
// One such difference is if those characters are Unicode punctuation.
// This script is generated from the Unicode data.
      const unicodePunctuation = /[!-\/:-@\[-`\{-~\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]/

      module.exports = unicodePunctuation


/***/ }),

/***/ "../../node_modules/micromark/dist/constructs.js":
/*!*******************************************************!*\
  !*** ../../node_modules/micromark/dist/constructs.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

      "use strict";


      Object.defineProperty(exports, "__esModule", ({value: true}))

      const text$1 = __webpack_require__(/*! ./initialize/text.js */ "../../node_modules/micromark/dist/initialize/text.js")
      const attention = __webpack_require__(/*! ./tokenize/attention.js */ "../../node_modules/micromark/dist/tokenize/attention.js")
      const autolink = __webpack_require__(/*! ./tokenize/autolink.js */ "../../node_modules/micromark/dist/tokenize/autolink.js")
      const blockQuote = __webpack_require__(/*! ./tokenize/block-quote.js */ "../../node_modules/micromark/dist/tokenize/block-quote.js")
      const characterEscape = __webpack_require__(/*! ./tokenize/character-escape.js */ "../../node_modules/micromark/dist/tokenize/character-escape.js")
      const characterReference = __webpack_require__(/*! ./tokenize/character-reference.js */ "../../node_modules/micromark/dist/tokenize/character-reference.js")
      const codeFenced = __webpack_require__(/*! ./tokenize/code-fenced.js */ "../../node_modules/micromark/dist/tokenize/code-fenced.js")
      const codeIndented = __webpack_require__(/*! ./tokenize/code-indented.js */ "../../node_modules/micromark/dist/tokenize/code-indented.js")
      const codeText = __webpack_require__(/*! ./tokenize/code-text.js */ "../../node_modules/micromark/dist/tokenize/code-text.js")
      const definition = __webpack_require__(/*! ./tokenize/definition.js */ "../../node_modules/micromark/dist/tokenize/definition.js")
      const hardBreakEscape = __webpack_require__(/*! ./tokenize/hard-break-escape.js */ "../../node_modules/micromark/dist/tokenize/hard-break-escape.js")
      const headingAtx = __webpack_require__(/*! ./tokenize/heading-atx.js */ "../../node_modules/micromark/dist/tokenize/heading-atx.js")
      const htmlFlow = __webpack_require__(/*! ./tokenize/html-flow.js */ "../../node_modules/micromark/dist/tokenize/html-flow.js")
      const htmlText = __webpack_require__(/*! ./tokenize/html-text.js */ "../../node_modules/micromark/dist/tokenize/html-text.js")
      const labelEnd = __webpack_require__(/*! ./tokenize/label-end.js */ "../../node_modules/micromark/dist/tokenize/label-end.js")
      const labelStartImage = __webpack_require__(/*! ./tokenize/label-start-image.js */ "../../node_modules/micromark/dist/tokenize/label-start-image.js")
      const labelStartLink = __webpack_require__(/*! ./tokenize/label-start-link.js */ "../../node_modules/micromark/dist/tokenize/label-start-link.js")
      const lineEnding = __webpack_require__(/*! ./tokenize/line-ending.js */ "../../node_modules/micromark/dist/tokenize/line-ending.js")
      const list = __webpack_require__(/*! ./tokenize/list.js */ "../../node_modules/micromark/dist/tokenize/list.js")
      const setextUnderline = __webpack_require__(/*! ./tokenize/setext-underline.js */ "../../node_modules/micromark/dist/tokenize/setext-underline.js")
      const thematicBreak = __webpack_require__(/*! ./tokenize/thematic-break.js */ "../../node_modules/micromark/dist/tokenize/thematic-break.js")

      const document = {
        42: list,
  // Asterisk
        43: list,
  // Plus sign
        45: list,
  // Dash
        48: list,
  // 0
        49: list,
  // 1
        50: list,
  // 2
        51: list,
  // 3
        52: list,
  // 4
        53: list,
  // 5
        54: list,
  // 6
        55: list,
  // 7
        56: list,
  // 8
        57: list,
  // 9
        62: blockQuote // Greater than
      }
      const contentInitial = {
        91: definition // Left square bracket
      }
      const flowInitial = {
        '-2': codeIndented,
  // Horizontal tab
        '-1': codeIndented,
  // Virtual space
        32: codeIndented // Space
      }
      const flow = {
        35: headingAtx,
  // Number sign
        42: thematicBreak,
  // Asterisk
        45: [setextUnderline, thematicBreak],
  // Dash
        60: htmlFlow,
  // Less than
        61: setextUnderline,
  // Equals to
        95: thematicBreak,
  // Underscore
        96: codeFenced,
  // Grave accent
        126: codeFenced // Tilde
      }
      const string = {
        38: characterReference,
  // Ampersand
        92: characterEscape // Backslash
      }
      const text = {
        '-5': lineEnding,
  // Carriage return
        '-4': lineEnding,
  // Line feed
        '-3': lineEnding,
  // Carriage return + line feed
        33: labelStartImage,
  // Exclamation mark
        38: characterReference,
  // Ampersand
        42: attention,
  // Asterisk
        60: [autolink, htmlText],
  // Less than
        91: labelStartLink,
  // Left square bracket
        92: [hardBreakEscape, characterEscape],
  // Backslash
        93: labelEnd,
  // Right square bracket
        95: attention,
  // Underscore
        96: codeText // Grave accent
      }
      const insideSpan = {
        null: [attention, text$1.resolver]
      }
      const disable = {
        null: []
      }

      exports.contentInitial = contentInitial
      exports.disable = disable
      exports.document = document
      exports.flow = flow
      exports.flowInitial = flowInitial
      exports.insideSpan = insideSpan
      exports.string = string
      exports.text = text


/***/ }),

/***/ "../../node_modules/micromark/dist/initialize/content.js":
/*!***************************************************************!*\
  !*** ../../node_modules/micromark/dist/initialize/content.js ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

      "use strict";


      Object.defineProperty(exports, "__esModule", ({value: true}))

      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const factorySpace = __webpack_require__(/*! ../tokenize/factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const tokenize = initializeContent

      function initializeContent(effects) {
        const contentStart = effects.attempt(
          this.parser.constructs.contentInitial,
          afterContentStartConstruct,
          paragraphInitial
        )
        let previous
        return contentStart

        function afterContentStartConstruct(code) {
          if (code === null) {
            effects.consume(code)
            return
          }

          effects.enter('lineEnding')
          effects.consume(code)
          effects.exit('lineEnding')
          return factorySpace(effects, contentStart, 'linePrefix')
        }

        function paragraphInitial(code) {
          effects.enter('paragraph')
          return lineStart(code)
        }

        function lineStart(code) {
          const token = effects.enter('chunkText', {
            contentType: 'text',
            previous: previous
          })

          if (previous) {
            previous.next = token
          }

          previous = token
          return data(code)
        }

        function data(code) {
          if (code === null) {
            effects.exit('chunkText')
            effects.exit('paragraph')
            effects.consume(code)
            return
          }

          if (markdownLineEnding(code)) {
            effects.consume(code)
            effects.exit('chunkText')
            return lineStart
          } // Data.

          effects.consume(code)
          return data
        }
      }

      exports.tokenize = tokenize


/***/ }),

/***/ "../../node_modules/micromark/dist/initialize/document.js":
/*!****************************************************************!*\
  !*** ../../node_modules/micromark/dist/initialize/document.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

      "use strict";


      Object.defineProperty(exports, "__esModule", ({value: true}))

      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const factorySpace = __webpack_require__(/*! ../tokenize/factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")
      const partialBlankLine = __webpack_require__(/*! ../tokenize/partial-blank-line.js */ "../../node_modules/micromark/dist/tokenize/partial-blank-line.js")

      const tokenize = initializeDocument
      const containerConstruct = {
        tokenize: tokenizeContainer
      }
      const lazyFlowConstruct = {
        tokenize: tokenizeLazyFlow
      }

      function initializeDocument(effects) {
        const self = this
        const stack = []
        let continued = 0
        const inspectConstruct = {
          tokenize: tokenizeInspect,
          partial: true
        }
        let inspectResult
        let childFlow
        let childToken
        return start

        function start(code) {
          if (continued < stack.length) {
            self.containerState = stack[continued][1]
            return effects.attempt(
              stack[continued][0].continuation,
              documentContinue,
              documentContinued
            )(code)
          }

          return documentContinued(code)
        }

        function documentContinue(code) {
          continued++
          return start(code)
        }

        function documentContinued(code) {
    // If we’re in a concrete construct (such as when expecting another line of
    // HTML, or we resulted in lazy content), we can immediately start flow.
          if (inspectResult && inspectResult.flowContinue) {
            return flowStart(code)
          }

          self.interrupt =
      childFlow &&
      childFlow.currentConstruct &&
      childFlow.currentConstruct.interruptible
          self.containerState = {}
          return effects.attempt(
            containerConstruct,
            containerContinue,
            flowStart
          )(code)
        }

        function containerContinue(code) {
          stack.push([self.currentConstruct, self.containerState])
          self.containerState = undefined
          return documentContinued(code)
        }

        function flowStart(code) {
          if (code === null) {
            exitContainers(0, true)
            effects.consume(code)
            return
          }

          childFlow = childFlow || self.parser.flow(self.now())
          effects.enter('chunkFlow', {
            contentType: 'flow',
            previous: childToken,
            _tokenizer: childFlow
          })
          return flowContinue(code)
        }

        function flowContinue(code) {
          if (code === null) {
            continueFlow(effects.exit('chunkFlow'))
            return flowStart(code)
          }

          if (markdownLineEnding(code)) {
            effects.consume(code)
            continueFlow(effects.exit('chunkFlow'))
            return effects.check(inspectConstruct, documentAfterPeek)
          }

          effects.consume(code)
          return flowContinue
        }

        function documentAfterPeek(code) {
          exitContainers(
            inspectResult.continued,
            inspectResult && inspectResult.flowEnd
          )
          continued = 0
          return start(code)
        }

        function continueFlow(token) {
          if (childToken) childToken.next = token
          childToken = token
          childFlow.lazy = inspectResult && inspectResult.lazy
          childFlow.defineSkip(token.start)
          childFlow.write(self.sliceStream(token))
        }

        function exitContainers(size, end) {
          let index = stack.length // Close the flow.

          if (childFlow && end) {
            childFlow.write([null])
            childToken = childFlow = undefined
          } // Exit open containers.

          while (index-- > size) {
            self.containerState = stack[index][1]
            stack[index][0].exit.call(self, effects)
          }

          stack.length = size
        }

        function tokenizeInspect(effects, ok) {
          let subcontinued = 0
          inspectResult = {}
          return inspectStart

          function inspectStart(code) {
            if (subcontinued < stack.length) {
              self.containerState = stack[subcontinued][1]
              return effects.attempt(
                stack[subcontinued][0].continuation,
                inspectContinue,
                inspectLess
              )(code)
            } // If we’re continued but in a concrete flow, we can’t have more
      // containers.

            if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) {
              inspectResult.flowContinue = true
              return inspectDone(code)
            }

            self.interrupt =
        childFlow.currentConstruct && childFlow.currentConstruct.interruptible
            self.containerState = {}
            return effects.attempt(
              containerConstruct,
              inspectFlowEnd,
              inspectDone
            )(code)
          }

          function inspectContinue(code) {
            subcontinued++
            return self.containerState._closeFlow
              ? inspectFlowEnd(code)
              : inspectStart(code)
          }

          function inspectLess(code) {
            if (childFlow.currentConstruct && childFlow.currentConstruct.lazy) {
        // Maybe another container?
              self.containerState = {}
              return effects.attempt(
                containerConstruct,
                inspectFlowEnd, // Maybe flow, or a blank line?
                effects.attempt(
                  lazyFlowConstruct,
                  inspectFlowEnd,
                  effects.check(partialBlankLine, inspectFlowEnd, inspectLazy)
                )
              )(code)
            } // Otherwise we’re interrupting.

            return inspectFlowEnd(code)
          }

          function inspectLazy(code) {
      // Act as if all containers are continued.
            subcontinued = stack.length
            inspectResult.lazy = true
            inspectResult.flowContinue = true
            return inspectDone(code)
          } // We’re done with flow if we have more containers, or an interruption.

          function inspectFlowEnd(code) {
            inspectResult.flowEnd = true
            return inspectDone(code)
          }

          function inspectDone(code) {
            inspectResult.continued = subcontinued
            self.interrupt = self.containerState = undefined
            return ok(code)
          }
        }
      }

      function tokenizeContainer(effects, ok, nok) {
        return factorySpace(
          effects,
          effects.attempt(this.parser.constructs.document, ok, nok),
          'linePrefix',
          this.parser.constructs.disable.null.indexOf('codeIndented') > -1
            ? undefined
            : 4
        )
      }

      function tokenizeLazyFlow(effects, ok, nok) {
        return factorySpace(
          effects,
          effects.lazy(this.parser.constructs.flow, ok, nok),
          'linePrefix',
          this.parser.constructs.disable.null.indexOf('codeIndented') > -1
            ? undefined
            : 4
        )
      }

      exports.tokenize = tokenize


/***/ }),

/***/ "../../node_modules/micromark/dist/initialize/flow.js":
/*!************************************************************!*\
  !*** ../../node_modules/micromark/dist/initialize/flow.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

      "use strict";


      Object.defineProperty(exports, "__esModule", ({value: true}))

      const content = __webpack_require__(/*! ../tokenize/content.js */ "../../node_modules/micromark/dist/tokenize/content.js")
      const factorySpace = __webpack_require__(/*! ../tokenize/factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")
      const partialBlankLine = __webpack_require__(/*! ../tokenize/partial-blank-line.js */ "../../node_modules/micromark/dist/tokenize/partial-blank-line.js")

      const tokenize = initializeFlow

      function initializeFlow(effects) {
        const self = this
        const initial = effects.attempt(
    // Try to parse a blank line.
          partialBlankLine,
          atBlankEnding, // Try to parse initial flow (essentially, only code).
          effects.attempt(
            this.parser.constructs.flowInitial,
            afterConstruct,
            factorySpace(
              effects,
              effects.attempt(
                this.parser.constructs.flow,
                afterConstruct,
                effects.attempt(content, afterConstruct)
              ),
              'linePrefix'
            )
          )
        )
        return initial

        function atBlankEnding(code) {
          if (code === null) {
            effects.consume(code)
            return
          }

          effects.enter('lineEndingBlank')
          effects.consume(code)
          effects.exit('lineEndingBlank')
          self.currentConstruct = undefined
          return initial
        }

        function afterConstruct(code) {
          if (code === null) {
            effects.consume(code)
            return
          }

          effects.enter('lineEnding')
          effects.consume(code)
          effects.exit('lineEnding')
          self.currentConstruct = undefined
          return initial
        }
      }

      exports.tokenize = tokenize


/***/ }),

/***/ "../../node_modules/micromark/dist/initialize/text.js":
/*!************************************************************!*\
  !*** ../../node_modules/micromark/dist/initialize/text.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

      "use strict";


      Object.defineProperty(exports, "__esModule", ({value: true}))

      const assign = __webpack_require__(/*! ../constant/assign.js */ "../../node_modules/micromark/dist/constant/assign.js")
      const shallow = __webpack_require__(/*! ../util/shallow.js */ "../../node_modules/micromark/dist/util/shallow.js")

      const text = initializeFactory('text')
      const string = initializeFactory('string')
      const resolver = {
        resolveAll: createResolver()
      }

      function initializeFactory(field) {
        return {
          tokenize: initializeText,
          resolveAll: createResolver(
            field === 'text' ? resolveAllLineSuffixes : undefined
          )
        }

        function initializeText(effects) {
          const self = this
          const constructs = this.parser.constructs[field]
          const text = effects.attempt(constructs, start, notText)
          return start

          function start(code) {
            return atBreak(code) ? text(code) : notText(code)
          }

          function notText(code) {
            if (code === null) {
              effects.consume(code)
              return
            }

            effects.enter('data')
            effects.consume(code)
            return data
          }

          function data(code) {
            if (atBreak(code)) {
              effects.exit('data')
              return text(code)
            } // Data.

            effects.consume(code)
            return data
          }

          function atBreak(code) {
            const list = constructs[code]
            let index = -1

            if (code === null) {
              return true
            }

            if (list) {
              while (++index < list.length) {
                if (
                  !list[index].previous ||
            list[index].previous.call(self, self.previous)
                ) {
                  return true
                }
              }
            }
          }
        }
      }

      function createResolver(extraResolver) {
        return resolveAllText

        function resolveAllText(events, context) {
          let index = -1
          let enter // A rather boring computation (to merge adjacent `data` events) which
    // improves mm performance by 29%.

          while (++index <= events.length) {
            if (enter === undefined) {
              if (events[index] && events[index][1].type === 'data') {
                enter = index
                index++
              }
            } else if (!events[index] || events[index][1].type !== 'data') {
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
      } // A rather ugly set of instructions which again looks at chunks in the input
// stream.
// The reason to do this here is that it is *much* faster to parse in reverse.
// And that we can’t hook into `null` to split the line suffix before an EOF.
// To do: figure out if we can make this into a clean utility, or even in core.
// As it will be useful for GFMs literal autolink extension (and maybe even
// tables?)

      function resolveAllLineSuffixes(events, context) {
        let eventIndex = -1
        let chunks
        let data
        let chunk
        let index
        let bufferIndex
        let size
        let tabs
        let token

        while (++eventIndex <= events.length) {
          if (
            (eventIndex === events.length ||
        events[eventIndex][1].type === 'lineEnding') &&
      events[eventIndex - 1][1].type === 'data'
          ) {
            data = events[eventIndex - 1][1]
            chunks = context.sliceStream(data)
            index = chunks.length
            bufferIndex = -1
            size = 0
            tabs = undefined

            while (index--) {
              chunk = chunks[index]

              if (typeof chunk === 'string') {
                bufferIndex = chunk.length

                while (chunk.charCodeAt(bufferIndex - 1) === 32) {
                  size++
                  bufferIndex--
                }

                if (bufferIndex) break
                bufferIndex = -1
              } // Number
              else if (chunk === -2) {
                tabs = true
                size++
              } else if (chunk === -1);
              else {
          // Replacement character, exit.
                index++
                break
              }
            }

            if (size) {
              token = {
                type:
            eventIndex === events.length || tabs || size < 2
              ? 'lineSuffix'
              : 'hardBreakTrailing',
                start: {
                  line: data.end.line,
                  column: data.end.column - size,
                  offset: data.end.offset - size,
                  _index: data.start._index + index,
                  _bufferIndex: index
                    ? bufferIndex
                    : data.start._bufferIndex + bufferIndex
                },
                end: shallow(data.end)
              }
              data.end = shallow(token.start)

              if (data.start.offset === data.end.offset) {
                assign(data, token)
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

      exports.resolver = resolver
      exports.string = string
      exports.text = text


/***/ }),

/***/ "../../node_modules/micromark/dist/parse.js":
/*!**************************************************!*\
  !*** ../../node_modules/micromark/dist/parse.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const content = __webpack_require__(/*! ./initialize/content.js */ "../../node_modules/micromark/dist/initialize/content.js")
      const document = __webpack_require__(/*! ./initialize/document.js */ "../../node_modules/micromark/dist/initialize/document.js")
      const flow = __webpack_require__(/*! ./initialize/flow.js */ "../../node_modules/micromark/dist/initialize/flow.js")
      const text = __webpack_require__(/*! ./initialize/text.js */ "../../node_modules/micromark/dist/initialize/text.js")
      const combineExtensions = __webpack_require__(/*! ./util/combine-extensions.js */ "../../node_modules/micromark/dist/util/combine-extensions.js")
      const createTokenizer = __webpack_require__(/*! ./util/create-tokenizer.js */ "../../node_modules/micromark/dist/util/create-tokenizer.js")
      const miniflat = __webpack_require__(/*! ./util/miniflat.js */ "../../node_modules/micromark/dist/util/miniflat.js")
      const constructs = __webpack_require__(/*! ./constructs.js */ "../../node_modules/micromark/dist/constructs.js")

      function parse(options) {
        const settings = options || {}
        const parser = {
          defined: [],
          constructs: combineExtensions(
            [constructs].concat(miniflat(settings.extensions))
          ),
          content: create(content),
          document: create(document),
          flow: create(flow),
          string: create(text.string),
          text: create(text.text)
        }
        return parser

        function create(initializer) {
          return creator

          function creator(from) {
            return createTokenizer(parser, initializer, from)
          }
        }
      }

      module.exports = parse


/***/ }),

/***/ "../../node_modules/micromark/dist/postprocess.js":
/*!********************************************************!*\
  !*** ../../node_modules/micromark/dist/postprocess.js ***!
  \********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const subtokenize = __webpack_require__(/*! ./util/subtokenize.js */ "../../node_modules/micromark/dist/util/subtokenize.js")

      function postprocess(events) {
        while (!subtokenize(events)) {
    // Empty
        }

        return events
      }

      module.exports = postprocess


/***/ }),

/***/ "../../node_modules/micromark/dist/preprocess.js":
/*!*******************************************************!*\
  !*** ../../node_modules/micromark/dist/preprocess.js ***!
  \*******************************************************/
/***/ ((module) => {

      "use strict";


      const search = /[\0\t\n\r]/g

      function preprocess() {
        let start = true
        let column = 1
        let buffer = ''
        let atCarriageReturn
        return preprocessor

        function preprocessor(value, encoding, end) {
          const chunks = []
          let match
          let next
          let startPosition
          let endPosition
          let code
          value = buffer + value.toString(encoding)
          startPosition = 0
          buffer = ''

          if (start) {
            if (value.charCodeAt(0) === 65279) {
              startPosition++
            }

            start = undefined
          }

          while (startPosition < value.length) {
            search.lastIndex = startPosition
            match = search.exec(value)
            endPosition = match ? match.index : value.length
            code = value.charCodeAt(endPosition)

            if (!match) {
              buffer = value.slice(startPosition)
              break
            }

            if (code === 10 && startPosition === endPosition && atCarriageReturn) {
              chunks.push(-3)
              atCarriageReturn = undefined
            } else {
              if (atCarriageReturn) {
                chunks.push(-5)
                atCarriageReturn = undefined
              }

              if (startPosition < endPosition) {
                chunks.push(value.slice(startPosition, endPosition))
                column += endPosition - startPosition
              }

              if (code === 0) {
                chunks.push(65533)
                column++
              } else if (code === 9) {
                next = Math.ceil(column / 4) * 4
                chunks.push(-2)

                while (column++ < next) chunks.push(-1)
              } else if (code === 10) {
                chunks.push(-4)
                column = 1
              } // Must be carriage return.
              else {
                atCarriageReturn = true
                column = 1
              }
            }

            startPosition = endPosition + 1
          }

          if (end) {
            if (atCarriageReturn) chunks.push(-5)
            if (buffer) chunks.push(buffer)
            chunks.push(null)
          }

          return chunks
        }
      }

      module.exports = preprocess


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/attention.js":
/*!***************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/attention.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const chunkedPush = __webpack_require__(/*! ../util/chunked-push.js */ "../../node_modules/micromark/dist/util/chunked-push.js")
      const chunkedSplice = __webpack_require__(/*! ../util/chunked-splice.js */ "../../node_modules/micromark/dist/util/chunked-splice.js")
      const classifyCharacter = __webpack_require__(/*! ../util/classify-character.js */ "../../node_modules/micromark/dist/util/classify-character.js")
      const movePoint = __webpack_require__(/*! ../util/move-point.js */ "../../node_modules/micromark/dist/util/move-point.js")
      const resolveAll = __webpack_require__(/*! ../util/resolve-all.js */ "../../node_modules/micromark/dist/util/resolve-all.js")
      const shallow = __webpack_require__(/*! ../util/shallow.js */ "../../node_modules/micromark/dist/util/shallow.js")

      const attention = {
        name: 'attention',
        tokenize: tokenizeAttention,
        resolveAll: resolveAllAttention
      }

      function resolveAllAttention(events, context) {
        let index = -1
        let open
        let group
        let text
        let openingSequence
        let closingSequence
        let use
        let nextEvents
        let offset // Walk through all events.
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
            open = index // Now walk back to find an opener.

            while (open--) {
        // Find a token that can open the closer.
              if (
                events[open][0] === 'exit' &&
          events[open][1].type === 'attentionSequence' &&
          events[open][1]._open && // If the markers are the same:
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
                } // Number of markers to use from the sequence.

                use =
            events[open][1].end.offset - events[open][1].start.offset > 1 &&
            events[index][1].end.offset - events[index][1].start.offset > 1
              ? 2
              : 1
                openingSequence = {
                  type: use > 1 ? 'strongSequence' : 'emphasisSequence',
                  start: movePoint(shallow(events[open][1].end), -use),
                  end: shallow(events[open][1].end)
                }
                closingSequence = {
                  type: use > 1 ? 'strongSequence' : 'emphasisSequence',
                  start: shallow(events[index][1].start),
                  end: movePoint(shallow(events[index][1].start), use)
                }
                text = {
                  type: use > 1 ? 'strongText' : 'emphasisText',
                  start: shallow(events[open][1].end),
                  end: shallow(events[index][1].start)
                }
                group = {
                  type: use > 1 ? 'strong' : 'emphasis',
                  start: shallow(openingSequence.start),
                  end: shallow(closingSequence.end)
                }
                events[open][1].end = shallow(openingSequence.start)
                events[index][1].start = shallow(closingSequence.end)
                nextEvents = [] // If there are more markers in the opening, add them before.

                if (events[open][1].end.offset - events[open][1].start.offset) {
                  nextEvents = chunkedPush(nextEvents, [
                    ['enter', events[open][1], context],
                    ['exit', events[open][1], context]
                  ])
                } // Opening.

                nextEvents = chunkedPush(nextEvents, [
                  ['enter', group, context],
                  ['enter', openingSequence, context],
                  ['exit', openingSequence, context],
                  ['enter', text, context]
                ]) // Between.

                nextEvents = chunkedPush(
                  nextEvents,
                  resolveAll(
                    context.parser.constructs.insideSpan.null,
                    events.slice(open + 1, index),
                    context
                  )
                ) // Closing.

                nextEvents = chunkedPush(nextEvents, [
                  ['exit', text, context],
                  ['enter', closingSequence, context],
                  ['exit', closingSequence, context],
                  ['exit', group, context]
                ]) // If there are more markers in the closing, add them after.

                if (events[index][1].end.offset - events[index][1].start.offset) {
                  offset = 2
                  nextEvents = chunkedPush(nextEvents, [
                    ['enter', events[index][1], context],
                    ['exit', events[index][1], context]
                  ])
                } else {
                  offset = 0
                }

                chunkedSplice(events, open - 1, index - open + 3, nextEvents)
                index = open + nextEvents.length - offset - 2
                break
              }
            }
          }
        } // Remove remaining sequences.

        index = -1

        while (++index < events.length) {
          if (events[index][1].type === 'attentionSequence') {
            events[index][1].type = 'data'
          }
        }

        return events
      }

      function tokenizeAttention(effects, ok) {
        const before = classifyCharacter(this.previous)
        let marker
        return start

        function start(code) {
          effects.enter('attentionSequence')
          marker = code
          return sequence(code)
        }

        function sequence(code) {
          let token
          let after
          let open
          let close

          if (code === marker) {
            effects.consume(code)
            return sequence
          }

          token = effects.exit('attentionSequence')
          after = classifyCharacter(code)
          open = !after || (after === 2 && before)
          close = !before || (before === 2 && after)
          token._open = marker === 42 ? open : open && (before || !close)
          token._close = marker === 42 ? close : close && (after || !open)
          return ok(code)
        }
      }

      module.exports = attention


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/autolink.js":
/*!**************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/autolink.js ***!
  \**************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const asciiAlpha = __webpack_require__(/*! ../character/ascii-alpha.js */ "../../node_modules/micromark/dist/character/ascii-alpha.js")
      const asciiAlphanumeric = __webpack_require__(/*! ../character/ascii-alphanumeric.js */ "../../node_modules/micromark/dist/character/ascii-alphanumeric.js")
      const asciiAtext = __webpack_require__(/*! ../character/ascii-atext.js */ "../../node_modules/micromark/dist/character/ascii-atext.js")
      const asciiControl = __webpack_require__(/*! ../character/ascii-control.js */ "../../node_modules/micromark/dist/character/ascii-control.js")

      const autolink = {
        name: 'autolink',
        tokenize: tokenizeAutolink
      }

      function tokenizeAutolink(effects, ok, nok) {
        let size = 1
        return start

        function start(code) {
          effects.enter('autolink')
          effects.enter('autolinkMarker')
          effects.consume(code)
          effects.exit('autolinkMarker')
          effects.enter('autolinkProtocol')
          return open
        }

        function open(code) {
          if (asciiAlpha(code)) {
            effects.consume(code)
            return schemeOrEmailAtext
          }

          return asciiAtext(code) ? emailAtext(code) : nok(code)
        }

        function schemeOrEmailAtext(code) {
          return code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code)
            ? schemeInsideOrEmailAtext(code)
            : emailAtext(code)
        }

        function schemeInsideOrEmailAtext(code) {
          if (code === 58) {
            effects.consume(code)
            return urlInside
          }

          if (
            (code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code)) &&
      size++ < 32
          ) {
            effects.consume(code)
            return schemeInsideOrEmailAtext
          }

          return emailAtext(code)
        }

        function urlInside(code) {
          if (code === 62) {
            effects.exit('autolinkProtocol')
            return end(code)
          }

          if (code === 32 || code === 60 || asciiControl(code)) {
            return nok(code)
          }

          effects.consume(code)
          return urlInside
        }

        function emailAtext(code) {
          if (code === 64) {
            effects.consume(code)
            size = 0
            return emailAtSignOrDot
          }

          if (asciiAtext(code)) {
            effects.consume(code)
            return emailAtext
          }

          return nok(code)
        }

        function emailAtSignOrDot(code) {
          return asciiAlphanumeric(code) ? emailLabel(code) : nok(code)
        }

        function emailLabel(code) {
          if (code === 46) {
            effects.consume(code)
            size = 0
            return emailAtSignOrDot
          }

          if (code === 62) {
      // Exit, then change the type.
            effects.exit('autolinkProtocol').type = 'autolinkEmail'
            return end(code)
          }

          return emailValue(code)
        }

        function emailValue(code) {
          if ((code === 45 || asciiAlphanumeric(code)) && size++ < 63) {
            effects.consume(code)
            return code === 45 ? emailValue : emailLabel
          }

          return nok(code)
        }

        function end(code) {
          effects.enter('autolinkMarker')
          effects.consume(code)
          effects.exit('autolinkMarker')
          effects.exit('autolink')
          return ok
        }
      }

      module.exports = autolink


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/block-quote.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/block-quote.js ***!
  \*****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownSpace = __webpack_require__(/*! ../character/markdown-space.js */ "../../node_modules/micromark/dist/character/markdown-space.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const blockQuote = {
        name: 'blockQuote',
        tokenize: tokenizeBlockQuoteStart,
        continuation: {
          tokenize: tokenizeBlockQuoteContinuation
        },
        exit: exit
      }

      function tokenizeBlockQuoteStart(effects, ok, nok) {
        const self = this
        return start

        function start(code) {
          if (code === 62) {
            if (!self.containerState.open) {
              effects.enter('blockQuote', {
                _container: true
              })
              self.containerState.open = true
            }

            effects.enter('blockQuotePrefix')
            effects.enter('blockQuoteMarker')
            effects.consume(code)
            effects.exit('blockQuoteMarker')
            return after
          }

          return nok(code)
        }

        function after(code) {
          if (markdownSpace(code)) {
            effects.enter('blockQuotePrefixWhitespace')
            effects.consume(code)
            effects.exit('blockQuotePrefixWhitespace')
            effects.exit('blockQuotePrefix')
            return ok
          }

          effects.exit('blockQuotePrefix')
          return ok(code)
        }
      }

      function tokenizeBlockQuoteContinuation(effects, ok, nok) {
        return factorySpace(
          effects,
          effects.attempt(blockQuote, ok, nok),
          'linePrefix',
          this.parser.constructs.disable.null.indexOf('codeIndented') > -1
            ? undefined
            : 4
        )
      }

      function exit(effects) {
        effects.exit('blockQuote')
      }

      module.exports = blockQuote


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/character-escape.js":
/*!**********************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/character-escape.js ***!
  \**********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const asciiPunctuation = __webpack_require__(/*! ../character/ascii-punctuation.js */ "../../node_modules/micromark/dist/character/ascii-punctuation.js")

      const characterEscape = {
        name: 'characterEscape',
        tokenize: tokenizeCharacterEscape
      }

      function tokenizeCharacterEscape(effects, ok, nok) {
        return start

        function start(code) {
          effects.enter('characterEscape')
          effects.enter('escapeMarker')
          effects.consume(code)
          effects.exit('escapeMarker')
          return open
        }

        function open(code) {
          if (asciiPunctuation(code)) {
            effects.enter('characterEscapeValue')
            effects.consume(code)
            effects.exit('characterEscapeValue')
            effects.exit('characterEscape')
            return ok
          }

          return nok(code)
        }
      }

      module.exports = characterEscape


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/character-reference.js":
/*!*************************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/character-reference.js ***!
  \*************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const decodeEntity = __webpack_require__(/*! parse-entities/decode-entity.js */ "../../node_modules/parse-entities/decode-entity.browser.js")
      const asciiAlphanumeric = __webpack_require__(/*! ../character/ascii-alphanumeric.js */ "../../node_modules/micromark/dist/character/ascii-alphanumeric.js")
      const asciiDigit = __webpack_require__(/*! ../character/ascii-digit.js */ "../../node_modules/micromark/dist/character/ascii-digit.js")
      const asciiHexDigit = __webpack_require__(/*! ../character/ascii-hex-digit.js */ "../../node_modules/micromark/dist/character/ascii-hex-digit.js")

      function _interopDefaultLegacy(e) {
        return e && typeof e === 'object' && 'default' in e ? e : {default: e}
      }

      const decodeEntity__default = /*#__PURE__*/ _interopDefaultLegacy(decodeEntity)

      const characterReference = {
        name: 'characterReference',
        tokenize: tokenizeCharacterReference
      }

      function tokenizeCharacterReference(effects, ok, nok) {
        const self = this
        let size = 0
        let max
        let test
        return start

        function start(code) {
          effects.enter('characterReference')
          effects.enter('characterReferenceMarker')
          effects.consume(code)
          effects.exit('characterReferenceMarker')
          return open
        }

        function open(code) {
          if (code === 35) {
            effects.enter('characterReferenceMarkerNumeric')
            effects.consume(code)
            effects.exit('characterReferenceMarkerNumeric')
            return numeric
          }

          effects.enter('characterReferenceValue')
          max = 31
          test = asciiAlphanumeric
          return value(code)
        }

        function numeric(code) {
          if (code === 88 || code === 120) {
            effects.enter('characterReferenceMarkerHexadecimal')
            effects.consume(code)
            effects.exit('characterReferenceMarkerHexadecimal')
            effects.enter('characterReferenceValue')
            max = 6
            test = asciiHexDigit
            return value
          }

          effects.enter('characterReferenceValue')
          max = 7
          test = asciiDigit
          return value(code)
        }

        function value(code) {
          let token

          if (code === 59 && size) {
            token = effects.exit('characterReferenceValue')

            if (
              test === asciiAlphanumeric &&
        !decodeEntity__default['default'](self.sliceSerialize(token))
            ) {
              return nok(code)
            }

            effects.enter('characterReferenceMarker')
            effects.consume(code)
            effects.exit('characterReferenceMarker')
            effects.exit('characterReference')
            return ok
          }

          if (test(code) && size++ < max) {
            effects.consume(code)
            return value
          }

          return nok(code)
        }
      }

      module.exports = characterReference


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/code-fenced.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/code-fenced.js ***!
  \*****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space.js */ "../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js")
      const prefixSize = __webpack_require__(/*! ../util/prefix-size.js */ "../../node_modules/micromark/dist/util/prefix-size.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const codeFenced = {
        name: 'codeFenced',
        tokenize: tokenizeCodeFenced,
        concrete: true
      }

      function tokenizeCodeFenced(effects, ok, nok) {
        const self = this
        const closingFenceConstruct = {
          tokenize: tokenizeClosingFence,
          partial: true
        }
        const initialPrefix = prefixSize(this.events, 'linePrefix')
        let sizeOpen = 0
        let marker
        return start

        function start(code) {
          effects.enter('codeFenced')
          effects.enter('codeFencedFence')
          effects.enter('codeFencedFenceSequence')
          marker = code
          return sequenceOpen(code)
        }

        function sequenceOpen(code) {
          if (code === marker) {
            effects.consume(code)
            sizeOpen++
            return sequenceOpen
          }

          effects.exit('codeFencedFenceSequence')
          return sizeOpen < 3
            ? nok(code)
            : factorySpace(effects, infoOpen, 'whitespace')(code)
        }

        function infoOpen(code) {
          if (code === null || markdownLineEnding(code)) {
            return openAfter(code)
          }

          effects.enter('codeFencedFenceInfo')
          effects.enter('chunkString', {
            contentType: 'string'
          })
          return info(code)
        }

        function info(code) {
          if (code === null || markdownLineEndingOrSpace(code)) {
            effects.exit('chunkString')
            effects.exit('codeFencedFenceInfo')
            return factorySpace(effects, infoAfter, 'whitespace')(code)
          }

          if (code === 96 && code === marker) return nok(code)
          effects.consume(code)
          return info
        }

        function infoAfter(code) {
          if (code === null || markdownLineEnding(code)) {
            return openAfter(code)
          }

          effects.enter('codeFencedFenceMeta')
          effects.enter('chunkString', {
            contentType: 'string'
          })
          return meta(code)
        }

        function meta(code) {
          if (code === null || markdownLineEnding(code)) {
            effects.exit('chunkString')
            effects.exit('codeFencedFenceMeta')
            return openAfter(code)
          }

          if (code === 96 && code === marker) return nok(code)
          effects.consume(code)
          return meta
        }

        function openAfter(code) {
          effects.exit('codeFencedFence')
          return self.interrupt ? ok(code) : content(code)
        }

        function content(code) {
          if (code === null) {
            return after(code)
          }

          if (markdownLineEnding(code)) {
            effects.enter('lineEnding')
            effects.consume(code)
            effects.exit('lineEnding')
            return effects.attempt(
              closingFenceConstruct,
              after,
              initialPrefix
                ? factorySpace(effects, content, 'linePrefix', initialPrefix + 1)
                : content
            )
          }

          effects.enter('codeFlowValue')
          return contentContinue(code)
        }

        function contentContinue(code) {
          if (code === null || markdownLineEnding(code)) {
            effects.exit('codeFlowValue')
            return content(code)
          }

          effects.consume(code)
          return contentContinue
        }

        function after(code) {
          effects.exit('codeFenced')
          return ok(code)
        }

        function tokenizeClosingFence(effects, ok, nok) {
          let size = 0
          return factorySpace(
            effects,
            closingSequenceStart,
            'linePrefix',
            this.parser.constructs.disable.null.indexOf('codeIndented') > -1
              ? undefined
              : 4
          )

          function closingSequenceStart(code) {
            effects.enter('codeFencedFence')
            effects.enter('codeFencedFenceSequence')
            return closingSequence(code)
          }

          function closingSequence(code) {
            if (code === marker) {
              effects.consume(code)
              size++
              return closingSequence
            }

            if (size < sizeOpen) return nok(code)
            effects.exit('codeFencedFenceSequence')
            return factorySpace(effects, closingSequenceEnd, 'whitespace')(code)
          }

          function closingSequenceEnd(code) {
            if (code === null || markdownLineEnding(code)) {
              effects.exit('codeFencedFence')
              return ok(code)
            }

            return nok(code)
          }
        }
      }

      module.exports = codeFenced


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/code-indented.js":
/*!*******************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/code-indented.js ***!
  \*******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const chunkedSplice = __webpack_require__(/*! ../util/chunked-splice.js */ "../../node_modules/micromark/dist/util/chunked-splice.js")
      const prefixSize = __webpack_require__(/*! ../util/prefix-size.js */ "../../node_modules/micromark/dist/util/prefix-size.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const codeIndented = {
        name: 'codeIndented',
        tokenize: tokenizeCodeIndented,
        resolve: resolveCodeIndented
      }
      const indentedContentConstruct = {
        tokenize: tokenizeIndentedContent,
        partial: true
      }

      function resolveCodeIndented(events, context) {
        const code = {
          type: 'codeIndented',
          start: events[0][1].start,
          end: events[events.length - 1][1].end
        }
        chunkedSplice(events, 0, 0, [['enter', code, context]])
        chunkedSplice(events, events.length, 0, [['exit', code, context]])
        return events
      }

      function tokenizeCodeIndented(effects, ok, nok) {
        return effects.attempt(indentedContentConstruct, afterPrefix, nok)

        function afterPrefix(code) {
          if (code === null) {
            return ok(code)
          }

          if (markdownLineEnding(code)) {
            return effects.attempt(indentedContentConstruct, afterPrefix, ok)(code)
          }

          effects.enter('codeFlowValue')
          return content(code)
        }

        function content(code) {
          if (code === null || markdownLineEnding(code)) {
            effects.exit('codeFlowValue')
            return afterPrefix(code)
          }

          effects.consume(code)
          return content
        }
      }

      function tokenizeIndentedContent(effects, ok, nok) {
        const self = this
        return factorySpace(effects, afterPrefix, 'linePrefix', 4 + 1)

        function afterPrefix(code) {
          if (markdownLineEnding(code)) {
            effects.enter('lineEnding')
            effects.consume(code)
            effects.exit('lineEnding')
            return factorySpace(effects, afterPrefix, 'linePrefix', 4 + 1)
          }

          return prefixSize(self.events, 'linePrefix') < 4 ? nok(code) : ok(code)
        }
      }

      module.exports = codeIndented


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/code-text.js":
/*!***************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/code-text.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")

      const codeText = {
        name: 'codeText',
        tokenize: tokenizeCodeText,
        resolve: resolveCodeText,
        previous: previous
      }

      function resolveCodeText(events) {
        let tailExitIndex = events.length - 4
        let headEnterIndex = 3
        let index
        let enter // If we start and end with an EOL or a space.

        if (
          (events[headEnterIndex][1].type === 'lineEnding' ||
      events[headEnterIndex][1].type === 'space') &&
    (events[tailExitIndex][1].type === 'lineEnding' ||
      events[tailExitIndex][1].type === 'space')
        ) {
          index = headEnterIndex // And we have data.

          while (++index < tailExitIndex) {
            if (events[index][1].type === 'codeTextData') {
        // Then we have padding.
              events[tailExitIndex][1].type = events[headEnterIndex][1].type =
          'codeTextPadding'
              headEnterIndex += 2
              tailExitIndex -= 2
              break
            }
          }
        } // Merge adjacent spaces and data.

        index = headEnterIndex - 1
        tailExitIndex++

        while (++index <= tailExitIndex) {
          if (enter === undefined) {
            if (index !== tailExitIndex && events[index][1].type !== 'lineEnding') {
              enter = index
            }
          } else if (
            index === tailExitIndex ||
      events[index][1].type === 'lineEnding'
          ) {
            events[enter][1].type = 'codeTextData'

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

      function previous(code) {
  // If there is a previous code, there will always be a tail.
        return (
          code !== 96 ||
    this.events[this.events.length - 1][1].type === 'characterEscape'
        )
      }

      function tokenizeCodeText(effects, ok, nok) {
        let sizeOpen = 0
        let size
        let token
        return start

        function start(code) {
          effects.enter('codeText')
          effects.enter('codeTextSequence')
          return openingSequence(code)
        }

        function openingSequence(code) {
          if (code === 96) {
            effects.consume(code)
            sizeOpen++
            return openingSequence
          }

          effects.exit('codeTextSequence')
          return gap(code)
        }

        function gap(code) {
    // EOF.
          if (code === null) {
            return nok(code)
          } // Closing fence?
    // Could also be data.

          if (code === 96) {
            token = effects.enter('codeTextSequence')
            size = 0
            return closingSequence(code)
          } // Tabs don’t work, and virtual spaces don’t make sense.

          if (code === 32) {
            effects.enter('space')
            effects.consume(code)
            effects.exit('space')
            return gap
          }

          if (markdownLineEnding(code)) {
            effects.enter('lineEnding')
            effects.consume(code)
            effects.exit('lineEnding')
            return gap
          } // Data.

          effects.enter('codeTextData')
          return data(code)
        } // In code.

        function data(code) {
          if (
            code === null ||
      code === 32 ||
      code === 96 ||
      markdownLineEnding(code)
          ) {
            effects.exit('codeTextData')
            return gap(code)
          }

          effects.consume(code)
          return data
        } // Closing fence.

        function closingSequence(code) {
    // More.
          if (code === 96) {
            effects.consume(code)
            size++
            return closingSequence
          } // Done!

          if (size === sizeOpen) {
            effects.exit('codeTextSequence')
            effects.exit('codeText')
            return ok(code)
          } // More or less accents: mark as data.

          token.type = 'codeTextData'
          return data(code)
        }
      }

      module.exports = codeText


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/content.js":
/*!*************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/content.js ***!
  \*************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const prefixSize = __webpack_require__(/*! ../util/prefix-size.js */ "../../node_modules/micromark/dist/util/prefix-size.js")
      const subtokenize = __webpack_require__(/*! ../util/subtokenize.js */ "../../node_modules/micromark/dist/util/subtokenize.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

// No name because it must not be turned off.
      const content = {
        tokenize: tokenizeContent,
        resolve: resolveContent,
        interruptible: true,
        lazy: true
      }
      const continuationConstruct = {
        tokenize: tokenizeContinuation,
        partial: true
      } // Content is transparent: it’s parsed right now. That way, definitions are also
// parsed right now: before text in paragraphs (specifically, media) are parsed.

      function resolveContent(events) {
        subtokenize(events)
        return events
      }

      function tokenizeContent(effects, ok) {
        let previous
        return start

        function start(code) {
          effects.enter('content')
          previous = effects.enter('chunkContent', {
            contentType: 'content'
          })
          return data(code)
        }

        function data(code) {
          if (code === null) {
            return contentEnd(code)
          }

          if (markdownLineEnding(code)) {
            return effects.check(
              continuationConstruct,
              contentContinue,
              contentEnd
            )(code)
          } // Data.

          effects.consume(code)
          return data
        }

        function contentEnd(code) {
          effects.exit('chunkContent')
          effects.exit('content')
          return ok(code)
        }

        function contentContinue(code) {
          effects.consume(code)
          effects.exit('chunkContent')
          previous = previous.next = effects.enter('chunkContent', {
            contentType: 'content',
            previous: previous
          })
          return data
        }
      }

      function tokenizeContinuation(effects, ok, nok) {
        const self = this
        return startLookahead

        function startLookahead(code) {
          effects.enter('lineEnding')
          effects.consume(code)
          effects.exit('lineEnding')
          return factorySpace(effects, prefixed, 'linePrefix')
        }

        function prefixed(code) {
          if (code === null || markdownLineEnding(code)) {
            return nok(code)
          }

          if (
            self.parser.constructs.disable.null.indexOf('codeIndented') > -1 ||
      prefixSize(self.events, 'linePrefix') < 4
          ) {
            return effects.interrupt(self.parser.constructs.flow, nok, ok)(code)
          }

          return ok(code)
        }
      }

      module.exports = content


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/definition.js":
/*!****************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/definition.js ***!
  \****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space.js */ "../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js")
      const normalizeIdentifier = __webpack_require__(/*! ../util/normalize-identifier.js */ "../../node_modules/micromark/dist/util/normalize-identifier.js")
      const factoryDestination = __webpack_require__(/*! ./factory-destination.js */ "../../node_modules/micromark/dist/tokenize/factory-destination.js")
      const factoryLabel = __webpack_require__(/*! ./factory-label.js */ "../../node_modules/micromark/dist/tokenize/factory-label.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")
      const factoryWhitespace = __webpack_require__(/*! ./factory-whitespace.js */ "../../node_modules/micromark/dist/tokenize/factory-whitespace.js")
      const factoryTitle = __webpack_require__(/*! ./factory-title.js */ "../../node_modules/micromark/dist/tokenize/factory-title.js")

      const definition = {
        name: 'definition',
        tokenize: tokenizeDefinition
      }
      const titleConstruct = {
        tokenize: tokenizeTitle,
        partial: true
      }

      function tokenizeDefinition(effects, ok, nok) {
        const self = this
        let identifier
        return start

        function start(code) {
          effects.enter('definition')
          return factoryLabel.call(
            self,
            effects,
            labelAfter,
            nok,
            'definitionLabel',
            'definitionLabelMarker',
            'definitionLabelString'
          )(code)
        }

        function labelAfter(code) {
          identifier = normalizeIdentifier(
            self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1)
          )

          if (code === 58) {
            effects.enter('definitionMarker')
            effects.consume(code)
            effects.exit('definitionMarker') // Note: blank lines can’t exist in content.

            return factoryWhitespace(
              effects,
              factoryDestination(
                effects,
                effects.attempt(
                  titleConstruct,
                  factorySpace(effects, after, 'whitespace'),
                  factorySpace(effects, after, 'whitespace')
                ),
                nok,
                'definitionDestination',
                'definitionDestinationLiteral',
                'definitionDestinationLiteralMarker',
                'definitionDestinationRaw',
                'definitionDestinationString'
              )
            )
          }

          return nok(code)
        }

        function after(code) {
          if (code === null || markdownLineEnding(code)) {
            effects.exit('definition')

            if (self.parser.defined.indexOf(identifier) < 0) {
              self.parser.defined.push(identifier)
            }

            return ok(code)
          }

          return nok(code)
        }
      }

      function tokenizeTitle(effects, ok, nok) {
        return start

        function start(code) {
          return markdownLineEndingOrSpace(code)
            ? factoryWhitespace(effects, before)(code)
            : nok(code)
        }

        function before(code) {
          if (code === 34 || code === 39 || code === 40) {
            return factoryTitle(
              effects,
              factorySpace(effects, after, 'whitespace'),
              nok,
              'definitionTitle',
              'definitionTitleMarker',
              'definitionTitleString'
            )(code)
          }

          return nok(code)
        }

        function after(code) {
          return code === null || markdownLineEnding(code) ? ok(code) : nok(code)
        }
      }

      module.exports = definition


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/factory-destination.js":
/*!*************************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/factory-destination.js ***!
  \*************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const asciiControl = __webpack_require__(/*! ../character/ascii-control.js */ "../../node_modules/micromark/dist/character/ascii-control.js")
      const markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space.js */ "../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js")
      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")

// eslint-disable-next-line max-params
      function destinationFactory(
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
        const limit = max || Infinity
        let balance = 0
        return start

        function start(code) {
          if (code === 60) {
            effects.enter(type)
            effects.enter(literalType)
            effects.enter(literalMarkerType)
            effects.consume(code)
            effects.exit(literalMarkerType)
            return destinationEnclosedBefore
          }

          if (asciiControl(code) || code === 41) {
            return nok(code)
          }

          effects.enter(type)
          effects.enter(rawType)
          effects.enter(stringType)
          effects.enter('chunkString', {
            contentType: 'string'
          })
          return destinationRaw(code)
        }

        function destinationEnclosedBefore(code) {
          if (code === 62) {
            effects.enter(literalMarkerType)
            effects.consume(code)
            effects.exit(literalMarkerType)
            effects.exit(literalType)
            effects.exit(type)
            return ok
          }

          effects.enter(stringType)
          effects.enter('chunkString', {
            contentType: 'string'
          })
          return destinationEnclosed(code)
        }

        function destinationEnclosed(code) {
          if (code === 62) {
            effects.exit('chunkString')
            effects.exit(stringType)
            return destinationEnclosedBefore(code)
          }

          if (code === null || code === 60 || markdownLineEnding(code)) {
            return nok(code)
          }

          effects.consume(code)
          return code === 92 ? destinationEnclosedEscape : destinationEnclosed
        }

        function destinationEnclosedEscape(code) {
          if (code === 60 || code === 62 || code === 92) {
            effects.consume(code)
            return destinationEnclosed
          }

          return destinationEnclosed(code)
        }

        function destinationRaw(code) {
          if (code === 40) {
            if (++balance > limit) return nok(code)
            effects.consume(code)
            return destinationRaw
          }

          if (code === 41) {
            if (!balance--) {
              effects.exit('chunkString')
              effects.exit(stringType)
              effects.exit(rawType)
              effects.exit(type)
              return ok(code)
            }

            effects.consume(code)
            return destinationRaw
          }

          if (code === null || markdownLineEndingOrSpace(code)) {
            if (balance) return nok(code)
            effects.exit('chunkString')
            effects.exit(stringType)
            effects.exit(rawType)
            effects.exit(type)
            return ok(code)
          }

          if (asciiControl(code)) return nok(code)
          effects.consume(code)
          return code === 92 ? destinationRawEscape : destinationRaw
        }

        function destinationRawEscape(code) {
          if (code === 40 || code === 41 || code === 92) {
            effects.consume(code)
            return destinationRaw
          }

          return destinationRaw(code)
        }
      }

      module.exports = destinationFactory


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/factory-label.js":
/*!*******************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/factory-label.js ***!
  \*******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const markdownSpace = __webpack_require__(/*! ../character/markdown-space.js */ "../../node_modules/micromark/dist/character/markdown-space.js")

// eslint-disable-next-line max-params
      function labelFactory(effects, ok, nok, type, markerType, stringType) {
        const self = this
        let size = 0
        let data
        return start

        function start(code) {
          effects.enter(type)
          effects.enter(markerType)
          effects.consume(code)
          effects.exit(markerType)
          effects.enter(stringType)
          return atBreak
        }

        function atBreak(code) {
          if (
            code === null ||
      code === 91 ||
      (code === 93 && !data) ||
      /* c8 ignore next */
      (code === 94 &&
        /* c8 ignore next */
        !size &&
        /* c8 ignore next */
        '_hiddenFootnoteSupport' in self.parser.constructs) ||
      size > 999
          ) {
            return nok(code)
          }

          if (code === 93) {
            effects.exit(stringType)
            effects.enter(markerType)
            effects.consume(code)
            effects.exit(markerType)
            effects.exit(type)
            return ok
          }

          if (markdownLineEnding(code)) {
            effects.enter('lineEnding')
            effects.consume(code)
            effects.exit('lineEnding')
            return atBreak
          }

          effects.enter('chunkString', {
            contentType: 'string'
          })
          return label(code)
        }

        function label(code) {
          if (
            code === null ||
      code === 91 ||
      code === 93 ||
      markdownLineEnding(code) ||
      size++ > 999
          ) {
            effects.exit('chunkString')
            return atBreak(code)
          }

          effects.consume(code)
          data = data || !markdownSpace(code)
          return code === 92 ? labelEscape : label
        }

        function labelEscape(code) {
          if (code === 91 || code === 92 || code === 93) {
            effects.consume(code)
            size++
            return label
          }

          return label(code)
        }
      }

      module.exports = labelFactory


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/factory-space.js":
/*!*******************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/factory-space.js ***!
  \*******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownSpace = __webpack_require__(/*! ../character/markdown-space.js */ "../../node_modules/micromark/dist/character/markdown-space.js")

      function spaceFactory(effects, ok, type, max) {
        const limit = max ? max - 1 : Infinity
        let size = 0
        return start

        function start(code) {
          if (markdownSpace(code)) {
            effects.enter(type)
            return prefix(code)
          }

          return ok(code)
        }

        function prefix(code) {
          if (markdownSpace(code) && size++ < limit) {
            effects.consume(code)
            return prefix
          }

          effects.exit(type)
          return ok(code)
        }
      }

      module.exports = spaceFactory


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/factory-title.js":
/*!*******************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/factory-title.js ***!
  \*******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      function titleFactory(effects, ok, nok, type, markerType, stringType) {
        let marker
        return start

        function start(code) {
          effects.enter(type)
          effects.enter(markerType)
          effects.consume(code)
          effects.exit(markerType)
          marker = code === 40 ? 41 : code
          return atFirstTitleBreak
        }

        function atFirstTitleBreak(code) {
          if (code === marker) {
            effects.enter(markerType)
            effects.consume(code)
            effects.exit(markerType)
            effects.exit(type)
            return ok
          }

          effects.enter(stringType)
          return atTitleBreak(code)
        }

        function atTitleBreak(code) {
          if (code === marker) {
            effects.exit(stringType)
            return atFirstTitleBreak(marker)
          }

          if (code === null) {
            return nok(code)
          } // Note: blank lines can’t exist in content.

          if (markdownLineEnding(code)) {
            effects.enter('lineEnding')
            effects.consume(code)
            effects.exit('lineEnding')
            return factorySpace(effects, atTitleBreak, 'linePrefix')
          }

          effects.enter('chunkString', {
            contentType: 'string'
          })
          return title(code)
        }

        function title(code) {
          if (code === marker || code === null || markdownLineEnding(code)) {
            effects.exit('chunkString')
            return atTitleBreak(code)
          }

          effects.consume(code)
          return code === 92 ? titleEscape : title
        }

        function titleEscape(code) {
          if (code === marker || code === 92) {
            effects.consume(code)
            return title
          }

          return title(code)
        }
      }

      module.exports = titleFactory


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/factory-whitespace.js":
/*!************************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/factory-whitespace.js ***!
  \************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const markdownSpace = __webpack_require__(/*! ../character/markdown-space.js */ "../../node_modules/micromark/dist/character/markdown-space.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      function whitespaceFactory(effects, ok) {
        let seen
        return start

        function start(code) {
          if (markdownLineEnding(code)) {
            effects.enter('lineEnding')
            effects.consume(code)
            effects.exit('lineEnding')
            seen = true
            return start
          }

          if (markdownSpace(code)) {
            return factorySpace(
              effects,
              start,
              seen ? 'linePrefix' : 'lineSuffix'
            )(code)
          }

          return ok(code)
        }
      }

      module.exports = whitespaceFactory


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/hard-break-escape.js":
/*!***********************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/hard-break-escape.js ***!
  \***********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")

      const hardBreakEscape = {
        name: 'hardBreakEscape',
        tokenize: tokenizeHardBreakEscape
      }

      function tokenizeHardBreakEscape(effects, ok, nok) {
        return start

        function start(code) {
          effects.enter('hardBreakEscape')
          effects.enter('escapeMarker')
          effects.consume(code)
          return open
        }

        function open(code) {
          if (markdownLineEnding(code)) {
            effects.exit('escapeMarker')
            effects.exit('hardBreakEscape')
            return ok(code)
          }

          return nok(code)
        }
      }

      module.exports = hardBreakEscape


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/heading-atx.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/heading-atx.js ***!
  \*****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space.js */ "../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js")
      const markdownSpace = __webpack_require__(/*! ../character/markdown-space.js */ "../../node_modules/micromark/dist/character/markdown-space.js")
      const chunkedSplice = __webpack_require__(/*! ../util/chunked-splice.js */ "../../node_modules/micromark/dist/util/chunked-splice.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const headingAtx = {
        name: 'headingAtx',
        tokenize: tokenizeHeadingAtx,
        resolve: resolveHeadingAtx
      }

      function resolveHeadingAtx(events, context) {
        let contentEnd = events.length - 2
        let contentStart = 3
        let content
        let text // Prefix whitespace, part of the opening.

        if (events[contentStart][1].type === 'whitespace') {
          contentStart += 2
        } // Suffix whitespace, part of the closing.

        if (
          contentEnd - 2 > contentStart &&
    events[contentEnd][1].type === 'whitespace'
        ) {
          contentEnd -= 2
        }

        if (
          events[contentEnd][1].type === 'atxHeadingSequence' &&
    (contentStart === contentEnd - 1 ||
      (contentEnd - 4 > contentStart &&
        events[contentEnd - 2][1].type === 'whitespace'))
        ) {
          contentEnd -= contentStart + 1 === contentEnd ? 2 : 4
        }

        if (contentEnd > contentStart) {
          content = {
            type: 'atxHeadingText',
            start: events[contentStart][1].start,
            end: events[contentEnd][1].end
          }
          text = {
            type: 'chunkText',
            start: events[contentStart][1].start,
            end: events[contentEnd][1].end,
            contentType: 'text'
          }
          chunkedSplice(events, contentStart, contentEnd - contentStart + 1, [
            ['enter', content, context],
            ['enter', text, context],
            ['exit', text, context],
            ['exit', content, context]
          ])
        }

        return events
      }

      function tokenizeHeadingAtx(effects, ok, nok) {
        const self = this
        let size = 0
        return start

        function start(code) {
          effects.enter('atxHeading')
          effects.enter('atxHeadingSequence')
          return fenceOpenInside(code)
        }

        function fenceOpenInside(code) {
          if (code === 35 && size++ < 6) {
            effects.consume(code)
            return fenceOpenInside
          }

          if (code === null || markdownLineEndingOrSpace(code)) {
            effects.exit('atxHeadingSequence')
            return self.interrupt ? ok(code) : headingBreak(code)
          }

          return nok(code)
        }

        function headingBreak(code) {
          if (code === 35) {
            effects.enter('atxHeadingSequence')
            return sequence(code)
          }

          if (code === null || markdownLineEnding(code)) {
            effects.exit('atxHeading')
            return ok(code)
          }

          if (markdownSpace(code)) {
            return factorySpace(effects, headingBreak, 'whitespace')(code)
          }

          effects.enter('atxHeadingText')
          return data(code)
        }

        function sequence(code) {
          if (code === 35) {
            effects.consume(code)
            return sequence
          }

          effects.exit('atxHeadingSequence')
          return headingBreak(code)
        }

        function data(code) {
          if (code === null || code === 35 || markdownLineEndingOrSpace(code)) {
            effects.exit('atxHeadingText')
            return headingBreak(code)
          }

          effects.consume(code)
          return data
        }
      }

      module.exports = headingAtx


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/html-flow.js":
/*!***************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/html-flow.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const asciiAlpha = __webpack_require__(/*! ../character/ascii-alpha.js */ "../../node_modules/micromark/dist/character/ascii-alpha.js")
      const asciiAlphanumeric = __webpack_require__(/*! ../character/ascii-alphanumeric.js */ "../../node_modules/micromark/dist/character/ascii-alphanumeric.js")
      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space.js */ "../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js")
      const markdownSpace = __webpack_require__(/*! ../character/markdown-space.js */ "../../node_modules/micromark/dist/character/markdown-space.js")
      const fromCharCode = __webpack_require__(/*! ../constant/from-char-code.js */ "../../node_modules/micromark/dist/constant/from-char-code.js")
      const htmlBlockNames = __webpack_require__(/*! ../constant/html-block-names.js */ "../../node_modules/micromark/dist/constant/html-block-names.js")
      const htmlRawNames = __webpack_require__(/*! ../constant/html-raw-names.js */ "../../node_modules/micromark/dist/constant/html-raw-names.js")
      const partialBlankLine = __webpack_require__(/*! ./partial-blank-line.js */ "../../node_modules/micromark/dist/tokenize/partial-blank-line.js")

      const htmlFlow = {
        name: 'htmlFlow',
        tokenize: tokenizeHtmlFlow,
        resolveTo: resolveToHtmlFlow,
        concrete: true
      }
      const nextBlankConstruct = {
        tokenize: tokenizeNextBlank,
        partial: true
      }

      function resolveToHtmlFlow(events) {
        let index = events.length

        while (index--) {
          if (events[index][0] === 'enter' && events[index][1].type === 'htmlFlow') {
            break
          }
        }

        if (index > 1 && events[index - 2][1].type === 'linePrefix') {
    // Add the prefix start to the HTML token.
          events[index][1].start = events[index - 2][1].start // Add the prefix start to the HTML line token.

          events[index + 1][1].start = events[index - 2][1].start // Remove the line prefix.

          events.splice(index - 2, 2)
        }

        return events
      }

      function tokenizeHtmlFlow(effects, ok, nok) {
        const self = this
        let kind
        let startTag
        let buffer
        let index
        let marker
        return start

        function start(code) {
          effects.enter('htmlFlow')
          effects.enter('htmlFlowData')
          effects.consume(code)
          return open
        }

        function open(code) {
          if (code === 33) {
            effects.consume(code)
            return declarationStart
          }

          if (code === 47) {
            effects.consume(code)
            return tagCloseStart
          }

          if (code === 63) {
            effects.consume(code)
            kind = 3 // While we’re in an instruction instead of a declaration, we’re on a `?`
      // right now, so we do need to search for `>`, similar to declarations.

            return self.interrupt ? ok : continuationDeclarationInside
          }

          if (asciiAlpha(code)) {
            effects.consume(code)
            buffer = fromCharCode(code)
            startTag = true
            return tagName
          }

          return nok(code)
        }

        function declarationStart(code) {
          if (code === 45) {
            effects.consume(code)
            kind = 2
            return commentOpenInside
          }

          if (code === 91) {
            effects.consume(code)
            kind = 5
            buffer = 'CDATA['
            index = 0
            return cdataOpenInside
          }

          if (asciiAlpha(code)) {
            effects.consume(code)
            kind = 4
            return self.interrupt ? ok : continuationDeclarationInside
          }

          return nok(code)
        }

        function commentOpenInside(code) {
          if (code === 45) {
            effects.consume(code)
            return self.interrupt ? ok : continuationDeclarationInside
          }

          return nok(code)
        }

        function cdataOpenInside(code) {
          if (code === buffer.charCodeAt(index++)) {
            effects.consume(code)
            return index === buffer.length
              ? self.interrupt
                ? ok
                : continuation
              : cdataOpenInside
          }

          return nok(code)
        }

        function tagCloseStart(code) {
          if (asciiAlpha(code)) {
            effects.consume(code)
            buffer = fromCharCode(code)
            return tagName
          }

          return nok(code)
        }

        function tagName(code) {
          if (
            code === null ||
      code === 47 ||
      code === 62 ||
      markdownLineEndingOrSpace(code)
          ) {
            if (
              code !== 47 &&
        startTag &&
        htmlRawNames.indexOf(buffer.toLowerCase()) > -1
            ) {
              kind = 1
              return self.interrupt ? ok(code) : continuation(code)
            }

            if (htmlBlockNames.indexOf(buffer.toLowerCase()) > -1) {
              kind = 6

              if (code === 47) {
                effects.consume(code)
                return basicSelfClosing
              }

              return self.interrupt ? ok(code) : continuation(code)
            }

            kind = 7 // Do not support complete HTML when interrupting.

            return self.interrupt
              ? nok(code)
              : startTag
                ? completeAttributeNameBefore(code)
                : completeClosingTagAfter(code)
          }

          if (code === 45 || asciiAlphanumeric(code)) {
            effects.consume(code)
            buffer += fromCharCode(code)
            return tagName
          }

          return nok(code)
        }

        function basicSelfClosing(code) {
          if (code === 62) {
            effects.consume(code)
            return self.interrupt ? ok : continuation
          }

          return nok(code)
        }

        function completeClosingTagAfter(code) {
          if (markdownSpace(code)) {
            effects.consume(code)
            return completeClosingTagAfter
          }

          return completeEnd(code)
        }

        function completeAttributeNameBefore(code) {
          if (code === 47) {
            effects.consume(code)
            return completeEnd
          }

          if (code === 58 || code === 95 || asciiAlpha(code)) {
            effects.consume(code)
            return completeAttributeName
          }

          if (markdownSpace(code)) {
            effects.consume(code)
            return completeAttributeNameBefore
          }

          return completeEnd(code)
        }

        function completeAttributeName(code) {
          if (
            code === 45 ||
      code === 46 ||
      code === 58 ||
      code === 95 ||
      asciiAlphanumeric(code)
          ) {
            effects.consume(code)
            return completeAttributeName
          }

          return completeAttributeNameAfter(code)
        }

        function completeAttributeNameAfter(code) {
          if (code === 61) {
            effects.consume(code)
            return completeAttributeValueBefore
          }

          if (markdownSpace(code)) {
            effects.consume(code)
            return completeAttributeNameAfter
          }

          return completeAttributeNameBefore(code)
        }

        function completeAttributeValueBefore(code) {
          if (
            code === null ||
      code === 60 ||
      code === 61 ||
      code === 62 ||
      code === 96
          ) {
            return nok(code)
          }

          if (code === 34 || code === 39) {
            effects.consume(code)
            marker = code
            return completeAttributeValueQuoted
          }

          if (markdownSpace(code)) {
            effects.consume(code)
            return completeAttributeValueBefore
          }

          marker = undefined
          return completeAttributeValueUnquoted(code)
        }

        function completeAttributeValueQuoted(code) {
          if (code === marker) {
            effects.consume(code)
            return completeAttributeValueQuotedAfter
          }

          if (code === null || markdownLineEnding(code)) {
            return nok(code)
          }

          effects.consume(code)
          return completeAttributeValueQuoted
        }

        function completeAttributeValueUnquoted(code) {
          if (
            code === null ||
      code === 34 ||
      code === 39 ||
      code === 60 ||
      code === 61 ||
      code === 62 ||
      code === 96 ||
      markdownLineEndingOrSpace(code)
          ) {
            return completeAttributeNameAfter(code)
          }

          effects.consume(code)
          return completeAttributeValueUnquoted
        }

        function completeAttributeValueQuotedAfter(code) {
          if (code === 47 || code === 62 || markdownSpace(code)) {
            return completeAttributeNameBefore(code)
          }

          return nok(code)
        }

        function completeEnd(code) {
          if (code === 62) {
            effects.consume(code)
            return completeAfter
          }

          return nok(code)
        }

        function completeAfter(code) {
          if (markdownSpace(code)) {
            effects.consume(code)
            return completeAfter
          }

          return code === null || markdownLineEnding(code)
            ? continuation(code)
            : nok(code)
        }

        function continuation(code) {
          if (code === 45 && kind === 2) {
            effects.consume(code)
            return continuationCommentInside
          }

          if (code === 60 && kind === 1) {
            effects.consume(code)
            return continuationRawTagOpen
          }

          if (code === 62 && kind === 4) {
            effects.consume(code)
            return continuationClose
          }

          if (code === 63 && kind === 3) {
            effects.consume(code)
            return continuationDeclarationInside
          }

          if (code === 93 && kind === 5) {
            effects.consume(code)
            return continuationCharacterDataInside
          }

          if (markdownLineEnding(code) && (kind === 6 || kind === 7)) {
            return effects.check(
              nextBlankConstruct,
              continuationClose,
              continuationAtLineEnding
            )(code)
          }

          if (code === null || markdownLineEnding(code)) {
            return continuationAtLineEnding(code)
          }

          effects.consume(code)
          return continuation
        }

        function continuationAtLineEnding(code) {
          effects.exit('htmlFlowData')
          return htmlContinueStart(code)
        }

        function htmlContinueStart(code) {
          if (code === null) {
            return done(code)
          }

          if (markdownLineEnding(code)) {
            effects.enter('lineEnding')
            effects.consume(code)
            effects.exit('lineEnding')
            return htmlContinueStart
          }

          effects.enter('htmlFlowData')
          return continuation(code)
        }

        function continuationCommentInside(code) {
          if (code === 45) {
            effects.consume(code)
            return continuationDeclarationInside
          }

          return continuation(code)
        }

        function continuationRawTagOpen(code) {
          if (code === 47) {
            effects.consume(code)
            buffer = ''
            return continuationRawEndTag
          }

          return continuation(code)
        }

        function continuationRawEndTag(code) {
          if (code === 62 && htmlRawNames.indexOf(buffer.toLowerCase()) > -1) {
            effects.consume(code)
            return continuationClose
          }

          if (asciiAlpha(code) && buffer.length < 8) {
            effects.consume(code)
            buffer += fromCharCode(code)
            return continuationRawEndTag
          }

          return continuation(code)
        }

        function continuationCharacterDataInside(code) {
          if (code === 93) {
            effects.consume(code)
            return continuationDeclarationInside
          }

          return continuation(code)
        }

        function continuationDeclarationInside(code) {
          if (code === 62) {
            effects.consume(code)
            return continuationClose
          }

          return continuation(code)
        }

        function continuationClose(code) {
          if (code === null || markdownLineEnding(code)) {
            effects.exit('htmlFlowData')
            return done(code)
          }

          effects.consume(code)
          return continuationClose
        }

        function done(code) {
          effects.exit('htmlFlow')
          return ok(code)
        }
      }

      function tokenizeNextBlank(effects, ok, nok) {
        return start

        function start(code) {
          effects.exit('htmlFlowData')
          effects.enter('lineEndingBlank')
          effects.consume(code)
          effects.exit('lineEndingBlank')
          return effects.attempt(partialBlankLine, ok, nok)
        }
      }

      module.exports = htmlFlow


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/html-text.js":
/*!***************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/html-text.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const asciiAlpha = __webpack_require__(/*! ../character/ascii-alpha.js */ "../../node_modules/micromark/dist/character/ascii-alpha.js")
      const asciiAlphanumeric = __webpack_require__(/*! ../character/ascii-alphanumeric.js */ "../../node_modules/micromark/dist/character/ascii-alphanumeric.js")
      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space.js */ "../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js")
      const markdownSpace = __webpack_require__(/*! ../character/markdown-space.js */ "../../node_modules/micromark/dist/character/markdown-space.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const htmlText = {
        name: 'htmlText',
        tokenize: tokenizeHtmlText
      }

      function tokenizeHtmlText(effects, ok, nok) {
        const self = this
        let marker
        let buffer
        let index
        let returnState
        return start

        function start(code) {
          effects.enter('htmlText')
          effects.enter('htmlTextData')
          effects.consume(code)
          return open
        }

        function open(code) {
          if (code === 33) {
            effects.consume(code)
            return declarationOpen
          }

          if (code === 47) {
            effects.consume(code)
            return tagCloseStart
          }

          if (code === 63) {
            effects.consume(code)
            return instruction
          }

          if (asciiAlpha(code)) {
            effects.consume(code)
            return tagOpen
          }

          return nok(code)
        }

        function declarationOpen(code) {
          if (code === 45) {
            effects.consume(code)
            return commentOpen
          }

          if (code === 91) {
            effects.consume(code)
            buffer = 'CDATA['
            index = 0
            return cdataOpen
          }

          if (asciiAlpha(code)) {
            effects.consume(code)
            return declaration
          }

          return nok(code)
        }

        function commentOpen(code) {
          if (code === 45) {
            effects.consume(code)
            return commentStart
          }

          return nok(code)
        }

        function commentStart(code) {
          if (code === null || code === 62) {
            return nok(code)
          }

          if (code === 45) {
            effects.consume(code)
            return commentStartDash
          }

          return comment(code)
        }

        function commentStartDash(code) {
          if (code === null || code === 62) {
            return nok(code)
          }

          return comment(code)
        }

        function comment(code) {
          if (code === null) {
            return nok(code)
          }

          if (code === 45) {
            effects.consume(code)
            return commentClose
          }

          if (markdownLineEnding(code)) {
            returnState = comment
            return atLineEnding(code)
          }

          effects.consume(code)
          return comment
        }

        function commentClose(code) {
          if (code === 45) {
            effects.consume(code)
            return end
          }

          return comment(code)
        }

        function cdataOpen(code) {
          if (code === buffer.charCodeAt(index++)) {
            effects.consume(code)
            return index === buffer.length ? cdata : cdataOpen
          }

          return nok(code)
        }

        function cdata(code) {
          if (code === null) {
            return nok(code)
          }

          if (code === 93) {
            effects.consume(code)
            return cdataClose
          }

          if (markdownLineEnding(code)) {
            returnState = cdata
            return atLineEnding(code)
          }

          effects.consume(code)
          return cdata
        }

        function cdataClose(code) {
          if (code === 93) {
            effects.consume(code)
            return cdataEnd
          }

          return cdata(code)
        }

        function cdataEnd(code) {
          if (code === 62) {
            return end(code)
          }

          if (code === 93) {
            effects.consume(code)
            return cdataEnd
          }

          return cdata(code)
        }

        function declaration(code) {
          if (code === null || code === 62) {
            return end(code)
          }

          if (markdownLineEnding(code)) {
            returnState = declaration
            return atLineEnding(code)
          }

          effects.consume(code)
          return declaration
        }

        function instruction(code) {
          if (code === null) {
            return nok(code)
          }

          if (code === 63) {
            effects.consume(code)
            return instructionClose
          }

          if (markdownLineEnding(code)) {
            returnState = instruction
            return atLineEnding(code)
          }

          effects.consume(code)
          return instruction
        }

        function instructionClose(code) {
          return code === 62 ? end(code) : instruction(code)
        }

        function tagCloseStart(code) {
          if (asciiAlpha(code)) {
            effects.consume(code)
            return tagClose
          }

          return nok(code)
        }

        function tagClose(code) {
          if (code === 45 || asciiAlphanumeric(code)) {
            effects.consume(code)
            return tagClose
          }

          return tagCloseBetween(code)
        }

        function tagCloseBetween(code) {
          if (markdownLineEnding(code)) {
            returnState = tagCloseBetween
            return atLineEnding(code)
          }

          if (markdownSpace(code)) {
            effects.consume(code)
            return tagCloseBetween
          }

          return end(code)
        }

        function tagOpen(code) {
          if (code === 45 || asciiAlphanumeric(code)) {
            effects.consume(code)
            return tagOpen
          }

          if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
            return tagOpenBetween(code)
          }

          return nok(code)
        }

        function tagOpenBetween(code) {
          if (code === 47) {
            effects.consume(code)
            return end
          }

          if (code === 58 || code === 95 || asciiAlpha(code)) {
            effects.consume(code)
            return tagOpenAttributeName
          }

          if (markdownLineEnding(code)) {
            returnState = tagOpenBetween
            return atLineEnding(code)
          }

          if (markdownSpace(code)) {
            effects.consume(code)
            return tagOpenBetween
          }

          return end(code)
        }

        function tagOpenAttributeName(code) {
          if (
            code === 45 ||
      code === 46 ||
      code === 58 ||
      code === 95 ||
      asciiAlphanumeric(code)
          ) {
            effects.consume(code)
            return tagOpenAttributeName
          }

          return tagOpenAttributeNameAfter(code)
        }

        function tagOpenAttributeNameAfter(code) {
          if (code === 61) {
            effects.consume(code)
            return tagOpenAttributeValueBefore
          }

          if (markdownLineEnding(code)) {
            returnState = tagOpenAttributeNameAfter
            return atLineEnding(code)
          }

          if (markdownSpace(code)) {
            effects.consume(code)
            return tagOpenAttributeNameAfter
          }

          return tagOpenBetween(code)
        }

        function tagOpenAttributeValueBefore(code) {
          if (
            code === null ||
      code === 60 ||
      code === 61 ||
      code === 62 ||
      code === 96
          ) {
            return nok(code)
          }

          if (code === 34 || code === 39) {
            effects.consume(code)
            marker = code
            return tagOpenAttributeValueQuoted
          }

          if (markdownLineEnding(code)) {
            returnState = tagOpenAttributeValueBefore
            return atLineEnding(code)
          }

          if (markdownSpace(code)) {
            effects.consume(code)
            return tagOpenAttributeValueBefore
          }

          effects.consume(code)
          marker = undefined
          return tagOpenAttributeValueUnquoted
        }

        function tagOpenAttributeValueQuoted(code) {
          if (code === marker) {
            effects.consume(code)
            return tagOpenAttributeValueQuotedAfter
          }

          if (code === null) {
            return nok(code)
          }

          if (markdownLineEnding(code)) {
            returnState = tagOpenAttributeValueQuoted
            return atLineEnding(code)
          }

          effects.consume(code)
          return tagOpenAttributeValueQuoted
        }

        function tagOpenAttributeValueQuotedAfter(code) {
          if (code === 62 || code === 47 || markdownLineEndingOrSpace(code)) {
            return tagOpenBetween(code)
          }

          return nok(code)
        }

        function tagOpenAttributeValueUnquoted(code) {
          if (
            code === null ||
      code === 34 ||
      code === 39 ||
      code === 60 ||
      code === 61 ||
      code === 96
          ) {
            return nok(code)
          }

          if (code === 62 || markdownLineEndingOrSpace(code)) {
            return tagOpenBetween(code)
          }

          effects.consume(code)
          return tagOpenAttributeValueUnquoted
        } // We can’t have blank lines in content, so no need to worry about empty
  // tokens.

        function atLineEnding(code) {
          effects.exit('htmlTextData')
          effects.enter('lineEnding')
          effects.consume(code)
          effects.exit('lineEnding')
          return factorySpace(
            effects,
            afterPrefix,
            'linePrefix',
            self.parser.constructs.disable.null.indexOf('codeIndented') > -1
              ? undefined
              : 4
          )
        }

        function afterPrefix(code) {
          effects.enter('htmlTextData')
          return returnState(code)
        }

        function end(code) {
          if (code === 62) {
            effects.consume(code)
            effects.exit('htmlTextData')
            effects.exit('htmlText')
            return ok
          }

          return nok(code)
        }
      }

      module.exports = htmlText


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/label-end.js":
/*!***************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/label-end.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space.js */ "../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js")
      const chunkedPush = __webpack_require__(/*! ../util/chunked-push.js */ "../../node_modules/micromark/dist/util/chunked-push.js")
      const chunkedSplice = __webpack_require__(/*! ../util/chunked-splice.js */ "../../node_modules/micromark/dist/util/chunked-splice.js")
      const normalizeIdentifier = __webpack_require__(/*! ../util/normalize-identifier.js */ "../../node_modules/micromark/dist/util/normalize-identifier.js")
      const resolveAll = __webpack_require__(/*! ../util/resolve-all.js */ "../../node_modules/micromark/dist/util/resolve-all.js")
      const shallow = __webpack_require__(/*! ../util/shallow.js */ "../../node_modules/micromark/dist/util/shallow.js")
      const factoryDestination = __webpack_require__(/*! ./factory-destination.js */ "../../node_modules/micromark/dist/tokenize/factory-destination.js")
      const factoryLabel = __webpack_require__(/*! ./factory-label.js */ "../../node_modules/micromark/dist/tokenize/factory-label.js")
      const factoryTitle = __webpack_require__(/*! ./factory-title.js */ "../../node_modules/micromark/dist/tokenize/factory-title.js")
      const factoryWhitespace = __webpack_require__(/*! ./factory-whitespace.js */ "../../node_modules/micromark/dist/tokenize/factory-whitespace.js")

      const labelEnd = {
        name: 'labelEnd',
        tokenize: tokenizeLabelEnd,
        resolveTo: resolveToLabelEnd,
        resolveAll: resolveAllLabelEnd
      }
      const resourceConstruct = {
        tokenize: tokenizeResource
      }
      const fullReferenceConstruct = {
        tokenize: tokenizeFullReference
      }
      const collapsedReferenceConstruct = {
        tokenize: tokenizeCollapsedReference
      }

      function resolveAllLabelEnd(events) {
        let index = -1
        let token

        while (++index < events.length) {
          token = events[index][1]

          if (
            !token._used &&
      (token.type === 'labelImage' ||
        token.type === 'labelLink' ||
        token.type === 'labelEnd')
          ) {
      // Remove the marker.
            events.splice(index + 1, token.type === 'labelImage' ? 4 : 2)
            token.type = 'data'
            index++
          }
        }

        return events
      }

      function resolveToLabelEnd(events, context) {
        let index = events.length
        let offset = 0
        let group
        let label
        let text
        let token
        let open
        let close
        let media // Find an opening.

        while (index--) {
          token = events[index][1]

          if (open) {
      // If we see another link, or inactive link label, we’ve been here before.
            if (
              token.type === 'link' ||
        (token.type === 'labelLink' && token._inactive)
            ) {
              break
            } // Mark other link openings as inactive, as we can’t have links in
      // links.

            if (events[index][0] === 'enter' && token.type === 'labelLink') {
              token._inactive = true
            }
          } else if (close) {
            if (
              events[index][0] === 'enter' &&
        (token.type === 'labelImage' || token.type === 'labelLink') &&
        !token._balanced
            ) {
              open = index

              if (token.type !== 'labelLink') {
                offset = 2
                break
              }
            }
          } else if (token.type === 'labelEnd') {
            close = index
          }
        }

        group = {
          type: events[open][1].type === 'labelLink' ? 'link' : 'image',
          start: shallow(events[open][1].start),
          end: shallow(events[events.length - 1][1].end)
        }
        label = {
          type: 'label',
          start: shallow(events[open][1].start),
          end: shallow(events[close][1].end)
        }
        text = {
          type: 'labelText',
          start: shallow(events[open + offset + 2][1].end),
          end: shallow(events[close - 2][1].start)
        }
        media = [
          ['enter', group, context],
          ['enter', label, context]
        ] // Opening marker.

        media = chunkedPush(media, events.slice(open + 1, open + offset + 3)) // Text open.

        media = chunkedPush(media, [['enter', text, context]]) // Between.

        media = chunkedPush(
          media,
          resolveAll(
            context.parser.constructs.insideSpan.null,
            events.slice(open + offset + 4, close - 3),
            context
          )
        ) // Text close, marker close, label close.

        media = chunkedPush(media, [
          ['exit', text, context],
          events[close - 2],
          events[close - 1],
          ['exit', label, context]
        ]) // Reference, resource, or so.

        media = chunkedPush(media, events.slice(close + 1)) // Media close.

        media = chunkedPush(media, [['exit', group, context]])
        chunkedSplice(events, open, events.length, media)
        return events
      }

      function tokenizeLabelEnd(effects, ok, nok) {
        const self = this
        let index = self.events.length
        let labelStart
        let defined // Find an opening.

        while (index--) {
          if (
            (self.events[index][1].type === 'labelImage' ||
        self.events[index][1].type === 'labelLink') &&
      !self.events[index][1]._balanced
          ) {
            labelStart = self.events[index][1]
            break
          }
        }

        return start

        function start(code) {
          if (!labelStart) {
            return nok(code)
          } // It’s a balanced bracket, but contains a link.

          if (labelStart._inactive) return balanced(code)
          defined =
      self.parser.defined.indexOf(
        normalizeIdentifier(
          self.sliceSerialize({
            start: labelStart.end,
            end: self.now()
          })
        )
      ) > -1
          effects.enter('labelEnd')
          effects.enter('labelMarker')
          effects.consume(code)
          effects.exit('labelMarker')
          effects.exit('labelEnd')
          return afterLabelEnd
        }

        function afterLabelEnd(code) {
    // Resource: `[asd](fgh)`.
          if (code === 40) {
            return effects.attempt(
              resourceConstruct,
              ok,
              defined ? ok : balanced
            )(code)
          } // Collapsed (`[asd][]`) or full (`[asd][fgh]`) reference?

          if (code === 91) {
            return effects.attempt(
              fullReferenceConstruct,
              ok,
              defined
                ? effects.attempt(collapsedReferenceConstruct, ok, balanced)
                : balanced
            )(code)
          } // Shortcut reference: `[asd]`?

          return defined ? ok(code) : balanced(code)
        }

        function balanced(code) {
          labelStart._balanced = true
          return nok(code)
        }
      }

      function tokenizeResource(effects, ok, nok) {
        return start

        function start(code) {
          effects.enter('resource')
          effects.enter('resourceMarker')
          effects.consume(code)
          effects.exit('resourceMarker')
          return factoryWhitespace(effects, open)
        }

        function open(code) {
          if (code === 41) {
            return end(code)
          }

          return factoryDestination(
            effects,
            destinationAfter,
            nok,
            'resourceDestination',
            'resourceDestinationLiteral',
            'resourceDestinationLiteralMarker',
            'resourceDestinationRaw',
            'resourceDestinationString',
            3
          )(code)
        }

        function destinationAfter(code) {
          return markdownLineEndingOrSpace(code)
            ? factoryWhitespace(effects, between)(code)
            : end(code)
        }

        function between(code) {
          if (code === 34 || code === 39 || code === 40) {
            return factoryTitle(
              effects,
              factoryWhitespace(effects, end),
              nok,
              'resourceTitle',
              'resourceTitleMarker',
              'resourceTitleString'
            )(code)
          }

          return end(code)
        }

        function end(code) {
          if (code === 41) {
            effects.enter('resourceMarker')
            effects.consume(code)
            effects.exit('resourceMarker')
            effects.exit('resource')
            return ok
          }

          return nok(code)
        }
      }

      function tokenizeFullReference(effects, ok, nok) {
        const self = this
        return start

        function start(code) {
          return factoryLabel.call(
            self,
            effects,
            afterLabel,
            nok,
            'reference',
            'referenceMarker',
            'referenceString'
          )(code)
        }

        function afterLabel(code) {
          return self.parser.defined.indexOf(
            normalizeIdentifier(
              self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1)
            )
          ) < 0
            ? nok(code)
            : ok(code)
        }
      }

      function tokenizeCollapsedReference(effects, ok, nok) {
        return start

        function start(code) {
          effects.enter('reference')
          effects.enter('referenceMarker')
          effects.consume(code)
          effects.exit('referenceMarker')
          return open
        }

        function open(code) {
          if (code === 93) {
            effects.enter('referenceMarker')
            effects.consume(code)
            effects.exit('referenceMarker')
            effects.exit('reference')
            return ok
          }

          return nok(code)
        }
      }

      module.exports = labelEnd


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/label-start-image.js":
/*!***********************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/label-start-image.js ***!
  \***********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const labelEnd = __webpack_require__(/*! ./label-end.js */ "../../node_modules/micromark/dist/tokenize/label-end.js")

      const labelStartImage = {
        name: 'labelStartImage',
        tokenize: tokenizeLabelStartImage,
        resolveAll: labelEnd.resolveAll
      }

      function tokenizeLabelStartImage(effects, ok, nok) {
        const self = this
        return start

        function start(code) {
          effects.enter('labelImage')
          effects.enter('labelImageMarker')
          effects.consume(code)
          effects.exit('labelImageMarker')
          return open
        }

        function open(code) {
          if (code === 91) {
            effects.enter('labelMarker')
            effects.consume(code)
            effects.exit('labelMarker')
            effects.exit('labelImage')
            return after
          }

          return nok(code)
        }

        function after(code) {
    /* c8 ignore next */
          return code === 94 &&
      /* c8 ignore next */
      '_hiddenFootnoteSupport' in self.parser.constructs
            ? /* c8 ignore next */
            nok(code)
            : ok(code)
        }
      }

      module.exports = labelStartImage


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/label-start-link.js":
/*!**********************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/label-start-link.js ***!
  \**********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const labelEnd = __webpack_require__(/*! ./label-end.js */ "../../node_modules/micromark/dist/tokenize/label-end.js")

      const labelStartLink = {
        name: 'labelStartLink',
        tokenize: tokenizeLabelStartLink,
        resolveAll: labelEnd.resolveAll
      }

      function tokenizeLabelStartLink(effects, ok, nok) {
        const self = this
        return start

        function start(code) {
          effects.enter('labelLink')
          effects.enter('labelMarker')
          effects.consume(code)
          effects.exit('labelMarker')
          effects.exit('labelLink')
          return after
        }

        function after(code) {
    /* c8 ignore next */
          return code === 94 &&
      /* c8 ignore next */
      '_hiddenFootnoteSupport' in self.parser.constructs
            ? /* c8 ignore next */
            nok(code)
            : ok(code)
        }
      }

      module.exports = labelStartLink


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/line-ending.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/line-ending.js ***!
  \*****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const lineEnding = {
        name: 'lineEnding',
        tokenize: tokenizeLineEnding
      }

      function tokenizeLineEnding(effects, ok) {
        return start

        function start(code) {
          effects.enter('lineEnding')
          effects.consume(code)
          effects.exit('lineEnding')
          return factorySpace(effects, ok, 'linePrefix')
        }
      }

      module.exports = lineEnding


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/list.js":
/*!**********************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/list.js ***!
  \**********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const asciiDigit = __webpack_require__(/*! ../character/ascii-digit.js */ "../../node_modules/micromark/dist/character/ascii-digit.js")
      const markdownSpace = __webpack_require__(/*! ../character/markdown-space.js */ "../../node_modules/micromark/dist/character/markdown-space.js")
      const prefixSize = __webpack_require__(/*! ../util/prefix-size.js */ "../../node_modules/micromark/dist/util/prefix-size.js")
      const sizeChunks = __webpack_require__(/*! ../util/size-chunks.js */ "../../node_modules/micromark/dist/util/size-chunks.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")
      const partialBlankLine = __webpack_require__(/*! ./partial-blank-line.js */ "../../node_modules/micromark/dist/tokenize/partial-blank-line.js")
      const thematicBreak = __webpack_require__(/*! ./thematic-break.js */ "../../node_modules/micromark/dist/tokenize/thematic-break.js")

      const list = {
        name: 'list',
        tokenize: tokenizeListStart,
        continuation: {
          tokenize: tokenizeListContinuation
        },
        exit: tokenizeListEnd
      }
      const listItemPrefixWhitespaceConstruct = {
        tokenize: tokenizeListItemPrefixWhitespace,
        partial: true
      }
      const indentConstruct = {
        tokenize: tokenizeIndent,
        partial: true
      }

      function tokenizeListStart(effects, ok, nok) {
        const self = this
        let initialSize = prefixSize(self.events, 'linePrefix')
        let size = 0
        return start

        function start(code) {
          const kind =
      self.containerState.type ||
      (code === 42 || code === 43 || code === 45
        ? 'listUnordered'
        : 'listOrdered')

          if (
            kind === 'listUnordered'
              ? !self.containerState.marker || code === self.containerState.marker
              : asciiDigit(code)
          ) {
            if (!self.containerState.type) {
              self.containerState.type = kind
              effects.enter(kind, {
                _container: true
              })
            }

            if (kind === 'listUnordered') {
              effects.enter('listItemPrefix')
              return code === 42 || code === 45
                ? effects.check(thematicBreak, nok, atMarker)(code)
                : atMarker(code)
            }

            if (!self.interrupt || code === 49) {
              effects.enter('listItemPrefix')
              effects.enter('listItemValue')
              return inside(code)
            }
          }

          return nok(code)
        }

        function inside(code) {
          if (asciiDigit(code) && ++size < 10) {
            effects.consume(code)
            return inside
          }

          if (
            (!self.interrupt || size < 2) &&
      (self.containerState.marker
        ? code === self.containerState.marker
        : code === 41 || code === 46)
          ) {
            effects.exit('listItemValue')
            return atMarker(code)
          }

          return nok(code)
        }

        function atMarker(code) {
          effects.enter('listItemMarker')
          effects.consume(code)
          effects.exit('listItemMarker')
          self.containerState.marker = self.containerState.marker || code
          return effects.check(
            partialBlankLine, // Can’t be empty when interrupting.
            self.interrupt ? nok : onBlank,
            effects.attempt(
              listItemPrefixWhitespaceConstruct,
              endOfPrefix,
              otherPrefix
            )
          )
        }

        function onBlank(code) {
          self.containerState.initialBlankLine = true
          initialSize++
          return endOfPrefix(code)
        }

        function otherPrefix(code) {
          if (markdownSpace(code)) {
            effects.enter('listItemPrefixWhitespace')
            effects.consume(code)
            effects.exit('listItemPrefixWhitespace')
            return endOfPrefix
          }

          return nok(code)
        }

        function endOfPrefix(code) {
          self.containerState.size =
      initialSize + sizeChunks(self.sliceStream(effects.exit('listItemPrefix')))
          return ok(code)
        }
      }

      function tokenizeListContinuation(effects, ok, nok) {
        const self = this
        self.containerState._closeFlow = undefined
        return effects.check(partialBlankLine, onBlank, notBlank)

        function onBlank(code) {
          self.containerState.furtherBlankLines =
      self.containerState.furtherBlankLines ||
      self.containerState.initialBlankLine // We have a blank line.
    // Still, try to consume at most the items size.

          return factorySpace(
            effects,
            ok,
            'listItemIndent',
            self.containerState.size + 1
          )(code)
        }

        function notBlank(code) {
          if (self.containerState.furtherBlankLines || !markdownSpace(code)) {
            self.containerState.furtherBlankLines = self.containerState.initialBlankLine = undefined
            return notInCurrentItem(code)
          }

          self.containerState.furtherBlankLines = self.containerState.initialBlankLine = undefined
          return effects.attempt(indentConstruct, ok, notInCurrentItem)(code)
        }

        function notInCurrentItem(code) {
    // While we do continue, we signal that the flow should be closed.
          self.containerState._closeFlow = true // As we’re closing flow, we’re no longer interrupting.

          self.interrupt = undefined
          return factorySpace(
            effects,
            effects.attempt(list, ok, nok),
            'linePrefix',
            self.parser.constructs.disable.null.indexOf('codeIndented') > -1
              ? undefined
              : 4
          )(code)
        }
      }

      function tokenizeIndent(effects, ok, nok) {
        const self = this
        return factorySpace(
          effects,
          afterPrefix,
          'listItemIndent',
          self.containerState.size + 1
        )

        function afterPrefix(code) {
          return prefixSize(self.events, 'listItemIndent') ===
      self.containerState.size
            ? ok(code)
            : nok(code)
        }
      }

      function tokenizeListEnd(effects) {
        effects.exit(this.containerState.type)
      }

      function tokenizeListItemPrefixWhitespace(effects, ok, nok) {
        const self = this
        return factorySpace(
          effects,
          afterPrefix,
          'listItemPrefixWhitespace',
          self.parser.constructs.disable.null.indexOf('codeIndented') > -1
            ? undefined
            : 4 + 1
        )

        function afterPrefix(code) {
          return markdownSpace(code) ||
      !prefixSize(self.events, 'listItemPrefixWhitespace')
            ? nok(code)
            : ok(code)
        }
      }

      module.exports = list


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/partial-blank-line.js":
/*!************************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/partial-blank-line.js ***!
  \************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const partialBlankLine = {
        tokenize: tokenizePartialBlankLine,
        partial: true
      }

      function tokenizePartialBlankLine(effects, ok, nok) {
        return factorySpace(effects, afterWhitespace, 'linePrefix')

        function afterWhitespace(code) {
          return code === null || markdownLineEnding(code) ? ok(code) : nok(code)
        }
      }

      module.exports = partialBlankLine


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/setext-underline.js":
/*!**********************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/setext-underline.js ***!
  \**********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const shallow = __webpack_require__(/*! ../util/shallow.js */ "../../node_modules/micromark/dist/util/shallow.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const setextUnderline = {
        name: 'setextUnderline',
        tokenize: tokenizeSetextUnderline,
        resolveTo: resolveToSetextUnderline
      }

      function resolveToSetextUnderline(events, context) {
        let index = events.length
        let content
        let text
        let definition
        let heading // Find the opening of the content.
  // It’ll always exist: we don’t tokenize if it isn’t there.

        while (index--) {
          if (events[index][0] === 'enter') {
            if (events[index][1].type === 'content') {
              content = index
              break
            }

            if (events[index][1].type === 'paragraph') {
              text = index
            }
          } // Exit
          else {
            if (events[index][1].type === 'content') {
        // Remove the content end (if needed we’ll add it later)
              events.splice(index, 1)
            }

            if (!definition && events[index][1].type === 'definition') {
              definition = index
            }
          }
        }

        heading = {
          type: 'setextHeading',
          start: shallow(events[text][1].start),
          end: shallow(events[events.length - 1][1].end)
        } // Change the paragraph to setext heading text.

        events[text][1].type = 'setextHeadingText' // If we have definitions in the content, we’ll keep on having content,
  // but we need move it.

        if (definition) {
          events.splice(text, 0, ['enter', heading, context])
          events.splice(definition + 1, 0, ['exit', events[content][1], context])
          events[content][1].end = shallow(events[definition][1].end)
        } else {
          events[content][1] = heading
        } // Add the heading exit at the end.

        events.push(['exit', heading, context])
        return events
      }

      function tokenizeSetextUnderline(effects, ok, nok) {
        const self = this
        let index = self.events.length
        let marker
        let paragraph // Find an opening.

        while (index--) {
    // Skip enter/exit of line ending, line prefix, and content.
    // We can now either have a definition or a paragraph.
          if (
            self.events[index][1].type !== 'lineEnding' &&
      self.events[index][1].type !== 'linePrefix' &&
      self.events[index][1].type !== 'content'
          ) {
            paragraph = self.events[index][1].type === 'paragraph'
            break
          }
        }

        return start

        function start(code) {
          if (!self.lazy && (self.interrupt || paragraph)) {
            effects.enter('setextHeadingLine')
            effects.enter('setextHeadingLineSequence')
            marker = code
            return closingSequence(code)
          }

          return nok(code)
        }

        function closingSequence(code) {
          if (code === marker) {
            effects.consume(code)
            return closingSequence
          }

          effects.exit('setextHeadingLineSequence')
          return factorySpace(effects, closingSequenceEnd, 'lineSuffix')(code)
        }

        function closingSequenceEnd(code) {
          if (code === null || markdownLineEnding(code)) {
            effects.exit('setextHeadingLine')
            return ok(code)
          }

          return nok(code)
        }
      }

      module.exports = setextUnderline


/***/ }),

/***/ "../../node_modules/micromark/dist/tokenize/thematic-break.js":
/*!********************************************************************!*\
  !*** ../../node_modules/micromark/dist/tokenize/thematic-break.js ***!
  \********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const markdownSpace = __webpack_require__(/*! ../character/markdown-space.js */ "../../node_modules/micromark/dist/character/markdown-space.js")
      const factorySpace = __webpack_require__(/*! ./factory-space.js */ "../../node_modules/micromark/dist/tokenize/factory-space.js")

      const thematicBreak = {
        name: 'thematicBreak',
        tokenize: tokenizeThematicBreak
      }

      function tokenizeThematicBreak(effects, ok, nok) {
        let size = 0
        let marker
        return start

        function start(code) {
          effects.enter('thematicBreak')
          marker = code
          return atBreak(code)
        }

        function atBreak(code) {
          if (code === marker) {
            effects.enter('thematicBreakSequence')
            return sequence(code)
          }

          if (markdownSpace(code)) {
            return factorySpace(effects, atBreak, 'whitespace')(code)
          }

          if (size < 3 || (code !== null && !markdownLineEnding(code))) {
            return nok(code)
          }

          effects.exit('thematicBreak')
          return ok(code)
        }

        function sequence(code) {
          if (code === marker) {
            effects.consume(code)
            size++
            return sequence
          }

          effects.exit('thematicBreakSequence')
          return atBreak(code)
        }
      }

      module.exports = thematicBreak


/***/ }),

/***/ "../../node_modules/micromark/dist/util/chunked-push.js":
/*!**************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/chunked-push.js ***!
  \**************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const chunkedSplice = __webpack_require__(/*! ./chunked-splice.js */ "../../node_modules/micromark/dist/util/chunked-splice.js")

      function chunkedPush(list, items) {
        if (list.length) {
          chunkedSplice(list, list.length, 0, items)
          return list
        }

        return items
      }

      module.exports = chunkedPush


/***/ }),

/***/ "../../node_modules/micromark/dist/util/chunked-splice.js":
/*!****************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/chunked-splice.js ***!
  \****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const splice = __webpack_require__(/*! ../constant/splice.js */ "../../node_modules/micromark/dist/constant/splice.js")

// causes a stack overflow in V8 when trying to insert 100k items for instance.

      function chunkedSplice(list, start, remove, items) {
        const end = list.length
        let chunkStart = 0
        let parameters // Make start between zero and `end` (included).

        if (start < 0) {
          start = -start > end ? 0 : end + start
        } else {
          start = start > end ? end : start
        }

        remove = remove > 0 ? remove : 0 // No need to chunk the items if there’s only a couple (10k) items.

        if (items.length < 10000) {
          parameters = Array.from(items)
          parameters.unshift(start, remove)
          splice.apply(list, parameters)
        } else {
    // Delete `remove` items starting from `start`
          if (remove) splice.apply(list, [start, remove]) // Insert the items in chunks to not cause stack overflows.

          while (chunkStart < items.length) {
            parameters = items.slice(chunkStart, chunkStart + 10000)
            parameters.unshift(start, 0)
            splice.apply(list, parameters)
            chunkStart += 10000
            start += 10000
          }
        }
      }

      module.exports = chunkedSplice


/***/ }),

/***/ "../../node_modules/micromark/dist/util/classify-character.js":
/*!********************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/classify-character.js ***!
  \********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space.js */ "../../node_modules/micromark/dist/character/markdown-line-ending-or-space.js")
      const unicodePunctuation = __webpack_require__(/*! ../character/unicode-punctuation.js */ "../../node_modules/micromark/dist/character/unicode-punctuation.js")
      const unicodeWhitespace = __webpack_require__(/*! ../character/unicode-whitespace.js */ "../../node_modules/micromark/dist/character/unicode-whitespace.js")

// Classify whether a character is unicode whitespace, unicode punctuation, or
// anything else.
// Used for attention (emphasis, strong), whose sequences can open or close
// based on the class of surrounding characters.
      function classifyCharacter(code) {
        if (
          code === null ||
    markdownLineEndingOrSpace(code) ||
    unicodeWhitespace(code)
        ) {
          return 1
        }

        if (unicodePunctuation(code)) {
          return 2
        }
      }

      module.exports = classifyCharacter


/***/ }),

/***/ "../../node_modules/micromark/dist/util/combine-extensions.js":
/*!********************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/combine-extensions.js ***!
  \********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const hasOwnProperty = __webpack_require__(/*! ../constant/has-own-property.js */ "../../node_modules/micromark/dist/constant/has-own-property.js")
      const chunkedSplice = __webpack_require__(/*! ./chunked-splice.js */ "../../node_modules/micromark/dist/util/chunked-splice.js")
      const miniflat = __webpack_require__(/*! ./miniflat.js */ "../../node_modules/micromark/dist/util/miniflat.js")

      function combineExtensions(extensions) {
        const all = {}
        let index = -1

        while (++index < extensions.length) {
          extension(all, extensions[index])
        }

        return all
      }

      function extension(all, extension) {
        let hook
        let left
        let right
        let code

        for (hook in extension) {
          left = hasOwnProperty.call(all, hook) ? all[hook] : (all[hook] = {})
          right = extension[hook]

          for (code in right) {
            left[code] = constructs(
              miniflat(right[code]),
              hasOwnProperty.call(left, code) ? left[code] : []
            )
          }
        }
      }

      function constructs(list, existing) {
        let index = -1
        const before = []

        while (++index < list.length) {
          (list[index].add === 'after' ? existing : before).push(list[index])
        }

        chunkedSplice(existing, 0, 0, before)
        return existing
      }

      module.exports = combineExtensions


/***/ }),

/***/ "../../node_modules/micromark/dist/util/create-tokenizer.js":
/*!******************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/create-tokenizer.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const assign = __webpack_require__(/*! ../constant/assign.js */ "../../node_modules/micromark/dist/constant/assign.js")
      const markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending.js */ "../../node_modules/micromark/dist/character/markdown-line-ending.js")
      const chunkedPush = __webpack_require__(/*! ./chunked-push.js */ "../../node_modules/micromark/dist/util/chunked-push.js")
      const chunkedSplice = __webpack_require__(/*! ./chunked-splice.js */ "../../node_modules/micromark/dist/util/chunked-splice.js")
      const miniflat = __webpack_require__(/*! ./miniflat.js */ "../../node_modules/micromark/dist/util/miniflat.js")
      const resolveAll = __webpack_require__(/*! ./resolve-all.js */ "../../node_modules/micromark/dist/util/resolve-all.js")
      const serializeChunks = __webpack_require__(/*! ./serialize-chunks.js */ "../../node_modules/micromark/dist/util/serialize-chunks.js")
      const shallow = __webpack_require__(/*! ./shallow.js */ "../../node_modules/micromark/dist/util/shallow.js")
      const sliceChunks = __webpack_require__(/*! ./slice-chunks.js */ "../../node_modules/micromark/dist/util/slice-chunks.js")

// Create a tokenizer.
// Tokenizers deal with one type of data (e.g., containers, flow, text).
// The parser is the object dealing with it all.
// `initialize` works like other constructs, except that only its `tokenize`
// function is used, in which case it doesn’t receive an `ok` or `nok`.
// `from` can be given to set the point before the first character, although
// when further lines are indented, they must be set with `defineSkip`.
      function createTokenizer(parser, initialize, from) {
        let point = from
          ? shallow(from)
          : {
            line: 1,
            column: 1,
            offset: 0
          }
        const columnStart = {}
        const resolveAllConstructs = []
        let chunks = []
        let stack = []

        const effects = {
          consume: consume,
          enter: enter,
          exit: exit,
          attempt: constructFactory(onsuccessfulconstruct),
          check: constructFactory(onsuccessfulcheck),
          interrupt: constructFactory(onsuccessfulcheck, {
            interrupt: true
          }),
          lazy: constructFactory(onsuccessfulcheck, {
            lazy: true
          })
        } // State and tools for resolving and serializing.

        const context = {
          previous: null,
          events: [],
          parser: parser,
          sliceStream: sliceStream,
          sliceSerialize: sliceSerialize,
          now: now,
          defineSkip: skip,
          write: write
        } // The state function.

        let state = initialize.tokenize.call(context, effects) // Track which character we expect to be consumed, to catch bugs.

        if (initialize.resolveAll) {
          resolveAllConstructs.push(initialize)
        } // Store where we are in the input stream.

        point._index = 0
        point._bufferIndex = -1
        return context

        function write(slice) {
          chunks = chunkedPush(chunks, slice)
          main() // Exit if we’re not done, resolve might change stuff.

          if (chunks[chunks.length - 1] !== null) {
            return []
          }

          addResult(initialize, 0) // Otherwise, resolve, and exit.

          context.events = resolveAll(resolveAllConstructs, context.events, context)
          return context.events
        } //
  // Tools.
  //

        function sliceSerialize(token) {
          return serializeChunks(sliceStream(token))
        }

        function sliceStream(token) {
          return sliceChunks(chunks, token)
        }

        function now() {
          return shallow(point)
        }

        function skip(value) {
          columnStart[value.line] = value.column
          accountForPotentialSkip()
        } //
  // State management.
  //
  // Main loop (note that `_index` and `_bufferIndex` in `point` are modified by
  // `consume`).
  // Here is where we walk through the chunks, which either include strings of
  // several characters, or numerical character codes.
  // The reason to do this in a loop instead of a call is so the stack can
  // drain.

        function main() {
          let chunkIndex
          let chunk

          while (point._index < chunks.length) {
            chunk = chunks[point._index] // If we’re in a buffer chunk, loop through it.

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
        } // Deal with one code.

        function go(code) {
          state = state(code)
        } // Move a character forward.

        function consume(code) {
          if (markdownLineEnding(code)) {
            point.line++
            point.column = 1
            point.offset += code === -3 ? 2 : 1
            accountForPotentialSkip()
          } else if (code !== -1) {
            point.column++
            point.offset++
          } // Not in a string chunk.

          if (point._bufferIndex < 0) {
            point._index++
          } else {
            point._bufferIndex++ // At end of string chunk.

            if (point._bufferIndex === chunks[point._index].length) {
              point._bufferIndex = -1
              point._index++
            }
          } // Expose the previous character.

          context.previous = code // Mark as consumed.
        } // Start a token.

        function enter(type, fields) {
          const token = fields || {}
          token.type = type
          token.start = now()
          context.events.push(['enter', token, context])
          stack.push(token)
          return token
        } // Stop a token.

        function exit(type) {
          const token = stack.pop()
          token.end = now()
          context.events.push(['exit', token, context])
          return token
        } // Use results.

        function onsuccessfulconstruct(construct, info) {
          addResult(construct, info.from)
        } // Discard results.

        function onsuccessfulcheck(construct, info) {
          info.restore()
        } // Factory to attempt/check/interrupt.

        function constructFactory(onreturn, fields) {
          return hook // Handle either an object mapping codes to constructs, a list of
    // constructs, or a single construct.

          function hook(constructs, returnState, bogusState) {
            let listOfConstructs
            let constructIndex
            let currentConstruct
            let info
            return constructs.tokenize || 'length' in constructs
              ? handleListOfConstructs(miniflat(constructs))
              : handleMapOfConstructs

            function handleMapOfConstructs(code) {
              if (code in constructs || null in constructs) {
                return handleListOfConstructs(
                  constructs.null
                    ? /* c8 ignore next */
                    miniflat(constructs[code]).concat(miniflat(constructs.null))
                    : constructs[code]
                )(code)
              }

              return bogusState(code)
            }

            function handleListOfConstructs(list) {
              listOfConstructs = list
              constructIndex = 0
              return handleConstruct(list[constructIndex])
            }

            function handleConstruct(construct) {
              return start

              function start(code) {
          // To do: not nede to store if there is no bogus state, probably?
          // Currently doesn’t work because `inspect` in document does a check
          // w/o a bogus, which doesn’t make sense. But it does seem to help perf
          // by not storing.
                info = store()
                currentConstruct = construct

                if (!construct.partial) {
                  context.currentConstruct = construct
                }

                if (
                  construct.name &&
            context.parser.constructs.disable.null.indexOf(construct.name) > -1
                ) {
                  return nok()
                }

                return construct.tokenize.call(
                  fields ? assign({}, context, fields) : context,
                  effects,
                  ok,
                  nok
                )(code)
              }
            }

            function ok(code) {
              onreturn(currentConstruct, info)
              return returnState
            }

            function nok(code) {
              info.restore()

              if (++constructIndex < listOfConstructs.length) {
                return handleConstruct(listOfConstructs[constructIndex])
              }

              return bogusState
            }
          }
        }

        function addResult(construct, from) {
          if (construct.resolveAll && resolveAllConstructs.indexOf(construct) < 0) {
            resolveAllConstructs.push(construct)
          }

          if (construct.resolve) {
            chunkedSplice(
              context.events,
              from,
              context.events.length - from,
              construct.resolve(context.events.slice(from), context)
            )
          }

          if (construct.resolveTo) {
            context.events = construct.resolveTo(context.events, context)
          }
        }

        function store() {
          const startPoint = now()
          const startPrevious = context.previous
          const startCurrentConstruct = context.currentConstruct
          const startEventsIndex = context.events.length
          const startStack = Array.from(stack)
          return {
            restore: restore,
            from: startEventsIndex
          }

          function restore() {
            point = startPoint
            context.previous = startPrevious
            context.currentConstruct = startCurrentConstruct
            context.events.length = startEventsIndex
            stack = startStack
            accountForPotentialSkip()
          }
        }

        function accountForPotentialSkip() {
          if (point.line in columnStart && point.column < 2) {
            point.column = columnStart[point.line]
            point.offset += columnStart[point.line] - 1
          }
        }
      }

      module.exports = createTokenizer


/***/ }),

/***/ "../../node_modules/micromark/dist/util/miniflat.js":
/*!**********************************************************!*\
  !*** ../../node_modules/micromark/dist/util/miniflat.js ***!
  \**********************************************************/
/***/ ((module) => {

      "use strict";


      function miniflat(value) {
        return value === null || value === undefined
          ? []
          : 'length' in value
            ? value
            : [value]
      }

      module.exports = miniflat


/***/ }),

/***/ "../../node_modules/micromark/dist/util/move-point.js":
/*!************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/move-point.js ***!
  \************************************************************/
/***/ ((module) => {

      "use strict";


// chunks (replacement characters, tabs, or line endings).

      function movePoint(point, offset) {
        point.column += offset
        point.offset += offset
        point._bufferIndex += offset
        return point
      }

      module.exports = movePoint


/***/ }),

/***/ "../../node_modules/micromark/dist/util/normalize-identifier.js":
/*!**********************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/normalize-identifier.js ***!
  \**********************************************************************/
/***/ ((module) => {

      "use strict";


      function normalizeIdentifier(value) {
        return (
          value // Collapse Markdown whitespace.
            .replace(/[\t\n\r ]+/g, ' ') // Trim.
            .replace(/^ | $/g, '') // Some characters are considered “uppercase”, but if their lowercase
      // counterpart is uppercased will result in a different uppercase
      // character.
      // Hence, to get that form, we perform both lower- and uppercase.
      // Upper case makes sure keys will not interact with default prototypal
      // methods: no object method is uppercase.
            .toLowerCase()
            .toUpperCase()
        )
      }

      module.exports = normalizeIdentifier


/***/ }),

/***/ "../../node_modules/micromark/dist/util/prefix-size.js":
/*!*************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/prefix-size.js ***!
  \*************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const sizeChunks = __webpack_require__(/*! ./size-chunks.js */ "../../node_modules/micromark/dist/util/size-chunks.js")

      function prefixSize(events, type) {
        const tail = events[events.length - 1]
        if (!tail || tail[1].type !== type) return 0
        return sizeChunks(tail[2].sliceStream(tail[1]))
      }

      module.exports = prefixSize


/***/ }),

/***/ "../../node_modules/micromark/dist/util/regex-check.js":
/*!*************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/regex-check.js ***!
  \*************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const fromCharCode = __webpack_require__(/*! ../constant/from-char-code.js */ "../../node_modules/micromark/dist/constant/from-char-code.js")

      function regexCheck(regex) {
        return check

        function check(code) {
          return regex.test(fromCharCode(code))
        }
      }

      module.exports = regexCheck


/***/ }),

/***/ "../../node_modules/micromark/dist/util/resolve-all.js":
/*!*************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/resolve-all.js ***!
  \*************************************************************/
/***/ ((module) => {

      "use strict";


      function resolveAll(constructs, events, context) {
        const called = []
        let index = -1
        let resolve

        while (++index < constructs.length) {
          resolve = constructs[index].resolveAll

          if (resolve && called.indexOf(resolve) < 0) {
            events = resolve(events, context)
            called.push(resolve)
          }
        }

        return events
      }

      module.exports = resolveAll


/***/ }),

/***/ "../../node_modules/micromark/dist/util/safe-from-int.js":
/*!***************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/safe-from-int.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const fromCharCode = __webpack_require__(/*! ../constant/from-char-code.js */ "../../node_modules/micromark/dist/constant/from-char-code.js")

      function safeFromInt(value, base) {
        const code = parseInt(value, base)

        if (
    // C0 except for HT, LF, FF, CR, space
          code < 9 ||
    code === 11 ||
    (code > 13 && code < 32) || // Control character (DEL) of the basic block and C1 controls.
    (code > 126 && code < 160) || // Lone high surrogates and low surrogates.
    (code > 55295 && code < 57344) || // Noncharacters.
    (code > 64975 && code < 65008) ||
    (code & 65535) === 65535 ||
    (code & 65535) === 65534 || // Out of range
    code > 1114111
        ) {
          return '\uFFFD'
        }

        return fromCharCode(code)
      }

      module.exports = safeFromInt


/***/ }),

/***/ "../../node_modules/micromark/dist/util/serialize-chunks.js":
/*!******************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/serialize-chunks.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const fromCharCode = __webpack_require__(/*! ../constant/from-char-code.js */ "../../node_modules/micromark/dist/constant/from-char-code.js")

      function serializeChunks(chunks) {
        let index = -1
        const result = []
        let chunk
        let value
        let atTab

        while (++index < chunks.length) {
          chunk = chunks[index]

          if (typeof chunk === 'string') {
            value = chunk
          } else if (chunk === -5) {
            value = '\r'
          } else if (chunk === -4) {
            value = '\n'
          } else if (chunk === -3) {
            value = '\r' + '\n'
          } else if (chunk === -2) {
            value = '\t'
          } else if (chunk === -1) {
            if (atTab) continue
            value = ' '
          } else {
      // Currently only replacement character.
            value = fromCharCode(chunk)
          }

          atTab = chunk === -2
          result.push(value)
        }

        return result.join('')
      }

      module.exports = serializeChunks


/***/ }),

/***/ "../../node_modules/micromark/dist/util/shallow.js":
/*!*********************************************************!*\
  !*** ../../node_modules/micromark/dist/util/shallow.js ***!
  \*********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const assign = __webpack_require__(/*! ../constant/assign.js */ "../../node_modules/micromark/dist/constant/assign.js")

      function shallow(object) {
        return assign({}, object)
      }

      module.exports = shallow


/***/ }),

/***/ "../../node_modules/micromark/dist/util/size-chunks.js":
/*!*************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/size-chunks.js ***!
  \*************************************************************/
/***/ ((module) => {

      "use strict";


// Counts tabs based on their expanded size, and CR+LF as one character.

      function sizeChunks(chunks) {
        let index = -1
        let size = 0

        while (++index < chunks.length) {
          size += typeof chunks[index] === 'string' ? chunks[index].length : 1
        }

        return size
      }

      module.exports = sizeChunks


/***/ }),

/***/ "../../node_modules/micromark/dist/util/slice-chunks.js":
/*!**************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/slice-chunks.js ***!
  \**************************************************************/
/***/ ((module) => {

      "use strict";


      function sliceChunks(chunks, token) {
        const startIndex = token.start._index
        const startBufferIndex = token.start._bufferIndex
        const endIndex = token.end._index
        const endBufferIndex = token.end._bufferIndex
        let view

        if (startIndex === endIndex) {
          view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)]
        } else {
          view = chunks.slice(startIndex, endIndex)

          if (startBufferIndex > -1) {
            view[0] = view[0].slice(startBufferIndex)
          }

          if (endBufferIndex > 0) {
            view.push(chunks[endIndex].slice(0, endBufferIndex))
          }
        }

        return view
      }

      module.exports = sliceChunks


/***/ }),

/***/ "../../node_modules/micromark/dist/util/subtokenize.js":
/*!*************************************************************!*\
  !*** ../../node_modules/micromark/dist/util/subtokenize.js ***!
  \*************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const assign = __webpack_require__(/*! ../constant/assign.js */ "../../node_modules/micromark/dist/constant/assign.js")
      const chunkedSplice = __webpack_require__(/*! ./chunked-splice.js */ "../../node_modules/micromark/dist/util/chunked-splice.js")
      const shallow = __webpack_require__(/*! ./shallow.js */ "../../node_modules/micromark/dist/util/shallow.js")

      function subtokenize(events) {
        const jumps = {}
        let index = -1
        let event
        let lineIndex
        let otherIndex
        let otherEvent
        let parameters
        let subevents
        let more

        while (++index < events.length) {
          while (index in jumps) {
            index = jumps[index]
          }

          event = events[index] // Add a hook for the GFM tasklist extension, which needs to know if text
    // is in the first content of a list item.

          if (
            index &&
      event[1].type === 'chunkFlow' &&
      events[index - 1][1].type === 'listItemPrefix'
          ) {
            subevents = event[1]._tokenizer.events
            otherIndex = 0

            if (
              otherIndex < subevents.length &&
        subevents[otherIndex][1].type === 'lineEndingBlank'
            ) {
              otherIndex += 2
            }

            if (
              otherIndex < subevents.length &&
        subevents[otherIndex][1].type === 'content'
            ) {
              while (++otherIndex < subevents.length) {
                if (subevents[otherIndex][1].type === 'content') {
                  break
                }

                if (subevents[otherIndex][1].type === 'chunkText') {
                  subevents[otherIndex][1].isInFirstContentOfListItem = true
                  otherIndex++
                }
              }
            }
          } // Enter.

          if (event[0] === 'enter') {
            if (event[1].contentType) {
              assign(jumps, subcontent(events, index))
              index = jumps[index]
              more = true
            }
          } // Exit.
          else if (event[1]._container || event[1]._movePreviousLineEndings) {
            otherIndex = index
            lineIndex = undefined

            while (otherIndex--) {
              otherEvent = events[otherIndex]

              if (
                otherEvent[1].type === 'lineEnding' ||
          otherEvent[1].type === 'lineEndingBlank'
              ) {
                if (otherEvent[0] === 'enter') {
                  if (lineIndex) {
                    events[lineIndex][1].type = 'lineEndingBlank'
                  }

                  otherEvent[1].type = 'lineEnding'
                  lineIndex = otherIndex
                }
              } else {
                break
              }
            }

            if (lineIndex) {
        // Fix position.
              event[1].end = shallow(events[lineIndex][1].start) // Switch container exit w/ line endings.

              parameters = events.slice(lineIndex, index)
              parameters.unshift(event)
              chunkedSplice(events, lineIndex, index - lineIndex + 1, parameters)
            }
          }
        }

        return !more
      }

      function subcontent(events, eventIndex) {
        let token = events[eventIndex][1]
        const context = events[eventIndex][2]
        let startPosition = eventIndex - 1
        const startPositions = []
        const tokenizer =
    token._tokenizer || context.parser[token.contentType](token.start)
        const childEvents = tokenizer.events
        const jumps = []
        const gaps = {}
        let stream
        let previous
        let index
        let entered
        let end
        let adjust // Loop forward through the linked tokens to pass them in order to the
  // subtokenizer.

        while (token) {
    // Find the position of the event for this token.
          while (events[++startPosition][1] !== token) {
      // Empty.
          }

          startPositions.push(startPosition)

          if (!token._tokenizer) {
            stream = context.sliceStream(token)

            if (!token.next) {
              stream.push(null)
            }

            if (previous) {
              tokenizer.defineSkip(token.start)
            }

            if (token.isInFirstContentOfListItem) {
              tokenizer._gfmTasklistFirstContentOfListItem = true
            }

            tokenizer.write(stream)

            if (token.isInFirstContentOfListItem) {
              tokenizer._gfmTasklistFirstContentOfListItem = undefined
            }
          } // Unravel the next token.

          previous = token
          token = token.next
        } // Now, loop back through all events (and linked tokens), to figure out which
  // parts belong where.

        token = previous
        index = childEvents.length

        while (index--) {
    // Make sure we’ve at least seen something (final eol is part of the last
    // token).
          if (childEvents[index][0] === 'enter') {
            entered = true
          } else if (
      // Find a void token that includes a break.
            entered &&
      childEvents[index][1].type === childEvents[index - 1][1].type &&
      childEvents[index][1].start.line !== childEvents[index][1].end.line
          ) {
            add(childEvents.slice(index + 1, end))
      // Help GC.
            token._tokenizer = token.next = undefined
            token = token.previous
            end = index + 1
          }
        }

  // Help GC.
        tokenizer.events = token._tokenizer = token.next = undefined // Do head:

        add(childEvents.slice(0, end))
        index = -1
        adjust = 0

        while (++index < jumps.length) {
          gaps[adjust + jumps[index][0]] = adjust + jumps[index][1]
          adjust += jumps[index][1] - jumps[index][0] - 1
        }

        return gaps

        function add(slice) {
          const start = startPositions.pop()
          jumps.unshift([start, start + slice.length - 1])
          chunkedSplice(events, start, 2, slice)
        }
      }

      module.exports = subtokenize


/***/ }),

/***/ "../../node_modules/object-assign/index.js":
/*!*************************************************!*\
  !*** ../../node_modules/object-assign/index.js ***!
  \*************************************************/
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

/***/ "../../node_modules/parse-entities/decode-entity.browser.js":
/*!******************************************************************!*\
  !*** ../../node_modules/parse-entities/decode-entity.browser.js ***!
  \******************************************************************/
/***/ ((module) => {

      "use strict";


/* eslint-env browser */

      let el

      const semicolon = 59 //  ';'

      module.exports = decodeEntity

      function decodeEntity(characters) {
        const entity = '&' + characters + ';'
        let char

        el = el || document.createElement('i')
        el.innerHTML = entity
        char = el.textContent

  // Some entities do not require the closing semicolon (`&not` - for instance),
  // which leads to situations where parsing the assumed entity of &notit; will
  // result in the string `¬it;`.  When we encounter a trailing semicolon after
  // parsing and the entity to decode was not a semicolon (`&semi;`), we can
  // assume that the matching was incomplete
        if (char.charCodeAt(char.length - 1) === semicolon && characters !== 'semi') {
          return false
        }

  // If the decoded string is equal to the input, the entity was not valid
        return char === entity ? false : char
      }


/***/ }),

/***/ "../../node_modules/prop-types/checkPropTypes.js":
/*!*******************************************************!*\
  !*** ../../node_modules/prop-types/checkPropTypes.js ***!
  \*******************************************************/
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
        var ReactPropTypesSecret = __webpack_require__(/*! ./lib/ReactPropTypesSecret */ "../../node_modules/prop-types/lib/ReactPropTypesSecret.js");
        var loggedTypeFailures = {};
        var has = __webpack_require__(/*! ./lib/has */ "../../node_modules/prop-types/lib/has.js");

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

/***/ "../../node_modules/prop-types/factoryWithTypeCheckers.js":
/*!****************************************************************!*\
  !*** ../../node_modules/prop-types/factoryWithTypeCheckers.js ***!
  \****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



      const ReactIs = __webpack_require__(/*! react-is */ "../../node_modules/react-is/index.js");
      const assign = __webpack_require__(/*! object-assign */ "../../node_modules/object-assign/index.js");

      const ReactPropTypesSecret = __webpack_require__(/*! ./lib/ReactPropTypesSecret */ "../../node_modules/prop-types/lib/ReactPropTypesSecret.js");
      const has = __webpack_require__(/*! ./lib/has */ "../../node_modules/prop-types/lib/has.js");
      const checkPropTypes = __webpack_require__(/*! ./checkPropTypes */ "../../node_modules/prop-types/checkPropTypes.js");

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

/***/ "../../node_modules/prop-types/index.js":
/*!**********************************************!*\
  !*** ../../node_modules/prop-types/index.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

      if (true) {
        const ReactIs = __webpack_require__(/*! react-is */ "../../node_modules/react-is/index.js");

  // By explicitly using `prop-types` you are opting into new development behavior.
  // http://fb.me/prop-types-in-prod
        const throwOnDirectAccess = true;
        module.exports = __webpack_require__(/*! ./factoryWithTypeCheckers */ "../../node_modules/prop-types/factoryWithTypeCheckers.js")(ReactIs.isElement, throwOnDirectAccess);
      } else // removed by dead control flow
      {}


/***/ }),

/***/ "../../node_modules/prop-types/lib/ReactPropTypesSecret.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/prop-types/lib/ReactPropTypesSecret.js ***!
  \*****************************************************************/
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

/***/ "../../node_modules/prop-types/lib/has.js":
/*!************************************************!*\
  !*** ../../node_modules/prop-types/lib/has.js ***!
  \************************************************/
/***/ ((module) => {

      module.exports = Function.call.bind(Object.prototype.hasOwnProperty);


/***/ }),

/***/ "../../node_modules/property-information/find.js":
/*!*******************************************************!*\
  !*** ../../node_modules/property-information/find.js ***!
  \*******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const normalize = __webpack_require__(/*! ./normalize */ "../../node_modules/property-information/normalize.js")
      const DefinedInfo = __webpack_require__(/*! ./lib/util/defined-info */ "../../node_modules/property-information/lib/util/defined-info.js")
      const Info = __webpack_require__(/*! ./lib/util/info */ "../../node_modules/property-information/lib/util/info.js")

      const data = 'data'

      module.exports = find

      const valid = /^data[-\w.:]+$/i
      const dash = /-[a-z]/g
      const cap = /[A-Z]/g

      function find(schema, value) {
        const normal = normalize(value)
        let prop = value
        let Type = Info

        if (normal in schema.normal) {
          return schema.property[schema.normal[normal]]
        }

        if (normal.length > 4 && normal.slice(0, 4) === data && valid.test(value)) {
    // Attribute or property.
          if (value.charAt(4) === '-') {
            prop = datasetToProperty(value)
          } else {
            value = datasetToAttribute(value)
          }

          Type = DefinedInfo
        }

        return new Type(prop, value)
      }

      function datasetToProperty(attribute) {
        const value = attribute.slice(5).replace(dash, camelcase)
        return data + value.charAt(0).toUpperCase() + value.slice(1)
      }

      function datasetToAttribute(property) {
        let value = property.slice(4)

        if (dash.test(value)) {
          return property
        }

        value = value.replace(cap, kebab)

        if (value.charAt(0) !== '-') {
          value = '-' + value
        }

        return data + value
      }

      function kebab($0) {
        return '-' + $0.toLowerCase()
      }

      function camelcase($0) {
        return $0.charAt(1).toUpperCase()
      }


/***/ }),

/***/ "../../node_modules/property-information/hast-to-react.json":
/*!******************************************************************!*\
  !*** ../../node_modules/property-information/hast-to-react.json ***!
  \******************************************************************/
/***/ ((module) => {

      "use strict";
      module.exports = /*#__PURE__*/JSON.parse('{"classId":"classID","dataType":"datatype","itemId":"itemID","strokeDashArray":"strokeDasharray","strokeDashOffset":"strokeDashoffset","strokeLineCap":"strokeLinecap","strokeLineJoin":"strokeLinejoin","strokeMiterLimit":"strokeMiterlimit","typeOf":"typeof","xLinkActuate":"xlinkActuate","xLinkArcRole":"xlinkArcrole","xLinkHref":"xlinkHref","xLinkRole":"xlinkRole","xLinkShow":"xlinkShow","xLinkTitle":"xlinkTitle","xLinkType":"xlinkType","xmlnsXLink":"xmlnsXlink"}');

/***/ }),

/***/ "../../node_modules/property-information/html.js":
/*!*******************************************************!*\
  !*** ../../node_modules/property-information/html.js ***!
  \*******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const merge = __webpack_require__(/*! ./lib/util/merge */ "../../node_modules/property-information/lib/util/merge.js")
      const xlink = __webpack_require__(/*! ./lib/xlink */ "../../node_modules/property-information/lib/xlink.js")
      const xml = __webpack_require__(/*! ./lib/xml */ "../../node_modules/property-information/lib/xml.js")
      const xmlns = __webpack_require__(/*! ./lib/xmlns */ "../../node_modules/property-information/lib/xmlns.js")
      const aria = __webpack_require__(/*! ./lib/aria */ "../../node_modules/property-information/lib/aria.js")
      const html = __webpack_require__(/*! ./lib/html */ "../../node_modules/property-information/lib/html.js")

      module.exports = merge([xml, xlink, xmlns, aria, html])


/***/ }),

/***/ "../../node_modules/property-information/lib/aria.js":
/*!***********************************************************!*\
  !*** ../../node_modules/property-information/lib/aria.js ***!
  \***********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const types = __webpack_require__(/*! ./util/types */ "../../node_modules/property-information/lib/util/types.js")
      const create = __webpack_require__(/*! ./util/create */ "../../node_modules/property-information/lib/util/create.js")

      const booleanish = types.booleanish
      const number = types.number
      const spaceSeparated = types.spaceSeparated

      module.exports = create({
        transform: ariaTransform,
        properties: {
          ariaActiveDescendant: null,
          ariaAtomic: booleanish,
          ariaAutoComplete: null,
          ariaBusy: booleanish,
          ariaChecked: booleanish,
          ariaColCount: number,
          ariaColIndex: number,
          ariaColSpan: number,
          ariaControls: spaceSeparated,
          ariaCurrent: null,
          ariaDescribedBy: spaceSeparated,
          ariaDetails: null,
          ariaDisabled: booleanish,
          ariaDropEffect: spaceSeparated,
          ariaErrorMessage: null,
          ariaExpanded: booleanish,
          ariaFlowTo: spaceSeparated,
          ariaGrabbed: booleanish,
          ariaHasPopup: null,
          ariaHidden: booleanish,
          ariaInvalid: null,
          ariaKeyShortcuts: null,
          ariaLabel: null,
          ariaLabelledBy: spaceSeparated,
          ariaLevel: number,
          ariaLive: null,
          ariaModal: booleanish,
          ariaMultiLine: booleanish,
          ariaMultiSelectable: booleanish,
          ariaOrientation: null,
          ariaOwns: spaceSeparated,
          ariaPlaceholder: null,
          ariaPosInSet: number,
          ariaPressed: booleanish,
          ariaReadOnly: booleanish,
          ariaRelevant: null,
          ariaRequired: booleanish,
          ariaRoleDescription: spaceSeparated,
          ariaRowCount: number,
          ariaRowIndex: number,
          ariaRowSpan: number,
          ariaSelected: booleanish,
          ariaSetSize: number,
          ariaSort: null,
          ariaValueMax: number,
          ariaValueMin: number,
          ariaValueNow: number,
          ariaValueText: null,
          role: null
        }
      })

      function ariaTransform(_, prop) {
        return prop === 'role' ? prop : 'aria-' + prop.slice(4).toLowerCase()
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/html.js":
/*!***********************************************************!*\
  !*** ../../node_modules/property-information/lib/html.js ***!
  \***********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const types = __webpack_require__(/*! ./util/types */ "../../node_modules/property-information/lib/util/types.js")
      const create = __webpack_require__(/*! ./util/create */ "../../node_modules/property-information/lib/util/create.js")
      const caseInsensitiveTransform = __webpack_require__(/*! ./util/case-insensitive-transform */ "../../node_modules/property-information/lib/util/case-insensitive-transform.js")

      const boolean = types.boolean
      const overloadedBoolean = types.overloadedBoolean
      const booleanish = types.booleanish
      const number = types.number
      const spaceSeparated = types.spaceSeparated
      const commaSeparated = types.commaSeparated

      module.exports = create({
        space: 'html',
        attributes: {
          acceptcharset: 'accept-charset',
          classname: 'class',
          htmlfor: 'for',
          httpequiv: 'http-equiv'
        },
        transform: caseInsensitiveTransform,
        mustUseProperty: ['checked', 'multiple', 'muted', 'selected'],
        properties: {
    // Standard Properties.
          abbr: null,
          accept: commaSeparated,
          acceptCharset: spaceSeparated,
          accessKey: spaceSeparated,
          action: null,
          allow: null,
          allowFullScreen: boolean,
          allowPaymentRequest: boolean,
          allowUserMedia: boolean,
          alt: null,
          as: null,
          async: boolean,
          autoCapitalize: null,
          autoComplete: spaceSeparated,
          autoFocus: boolean,
          autoPlay: boolean,
          capture: boolean,
          charSet: null,
          checked: boolean,
          cite: null,
          className: spaceSeparated,
          cols: number,
          colSpan: null,
          content: null,
          contentEditable: booleanish,
          controls: boolean,
          controlsList: spaceSeparated,
          coords: number | commaSeparated,
          crossOrigin: null,
          data: null,
          dateTime: null,
          decoding: null,
          default: boolean,
          defer: boolean,
          dir: null,
          dirName: null,
          disabled: boolean,
          download: overloadedBoolean,
          draggable: booleanish,
          encType: null,
          enterKeyHint: null,
          form: null,
          formAction: null,
          formEncType: null,
          formMethod: null,
          formNoValidate: boolean,
          formTarget: null,
          headers: spaceSeparated,
          height: number,
          hidden: boolean,
          high: number,
          href: null,
          hrefLang: null,
          htmlFor: spaceSeparated,
          httpEquiv: spaceSeparated,
          id: null,
          imageSizes: null,
          imageSrcSet: commaSeparated,
          inputMode: null,
          integrity: null,
          is: null,
          isMap: boolean,
          itemId: null,
          itemProp: spaceSeparated,
          itemRef: spaceSeparated,
          itemScope: boolean,
          itemType: spaceSeparated,
          kind: null,
          label: null,
          lang: null,
          language: null,
          list: null,
          loading: null,
          loop: boolean,
          low: number,
          manifest: null,
          max: null,
          maxLength: number,
          media: null,
          method: null,
          min: null,
          minLength: number,
          multiple: boolean,
          muted: boolean,
          name: null,
          nonce: null,
          noModule: boolean,
          noValidate: boolean,
          onAbort: null,
          onAfterPrint: null,
          onAuxClick: null,
          onBeforePrint: null,
          onBeforeUnload: null,
          onBlur: null,
          onCancel: null,
          onCanPlay: null,
          onCanPlayThrough: null,
          onChange: null,
          onClick: null,
          onClose: null,
          onContextMenu: null,
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
          open: boolean,
          optimum: number,
          pattern: null,
          ping: spaceSeparated,
          placeholder: null,
          playsInline: boolean,
          poster: null,
          preload: null,
          readOnly: boolean,
          referrerPolicy: null,
          rel: spaceSeparated,
          required: boolean,
          reversed: boolean,
          rows: number,
          rowSpan: number,
          sandbox: spaceSeparated,
          scope: null,
          scoped: boolean,
          seamless: boolean,
          selected: boolean,
          shape: null,
          size: number,
          sizes: null,
          slot: null,
          span: number,
          spellCheck: booleanish,
          src: null,
          srcDoc: null,
          srcLang: null,
          srcSet: commaSeparated,
          start: number,
          step: null,
          style: null,
          tabIndex: number,
          target: null,
          title: null,
          translate: null,
          type: null,
          typeMustMatch: boolean,
          useMap: null,
          value: booleanish,
          width: number,
          wrap: null,

    // Legacy.
    // See: https://html.spec.whatwg.org/#other-elements,-attributes-and-apis
          align: null, // Several. Use CSS `text-align` instead,
          aLink: null, // `<body>`. Use CSS `a:active {color}` instead
          archive: spaceSeparated, // `<object>`. List of URIs to archives
          axis: null, // `<td>` and `<th>`. Use `scope` on `<th>`
          background: null, // `<body>`. Use CSS `background-image` instead
          bgColor: null, // `<body>` and table elements. Use CSS `background-color` instead
          border: number, // `<table>`. Use CSS `border-width` instead,
          borderColor: null, // `<table>`. Use CSS `border-color` instead,
          bottomMargin: number, // `<body>`
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
          compact: boolean, // Lists. Use CSS to reduce space between items instead
          declare: boolean, // `<object>`
          event: null, // `<script>`
          face: null, // `<font>`. Use CSS instead
          frame: null, // `<table>`
          frameBorder: null, // `<iframe>`. Use CSS `border` instead
          hSpace: number, // `<img>` and `<object>`
          leftMargin: number, // `<body>`
          link: null, // `<body>`. Use CSS `a:link {color: *}` instead
          longDesc: null, // `<frame>`, `<iframe>`, and `<img>`. Use an `<a>`
          lowSrc: null, // `<img>`. Use a `<picture>`
          marginHeight: number, // `<body>`
          marginWidth: number, // `<body>`
          noResize: boolean, // `<frame>`
          noHref: boolean, // `<area>`. Use no href instead of an explicit `nohref`
          noShade: boolean, // `<hr>`. Use background-color and height instead of borders
          noWrap: boolean, // `<td>` and `<th>`
          object: null, // `<applet>`
          profile: null, // `<head>`
          prompt: null, // `<isindex>`
          rev: null, // `<link>`
          rightMargin: number, // `<body>`
          rules: null, // `<table>`
          scheme: null, // `<meta>`
          scrolling: booleanish, // `<frame>`. Use overflow in the child context
          standby: null, // `<object>`
          summary: null, // `<table>`
          text: null, // `<body>`. Use CSS `color` instead
          topMargin: number, // `<body>`
          valueType: null, // `<param>`
          version: null, // `<html>`. Use a doctype.
          vAlign: null, // Several. Use CSS `vertical-align` instead
          vLink: null, // `<body>`. Use CSS `a:visited {color}` instead
          vSpace: number, // `<img>` and `<object>`

    // Non-standard Properties.
          allowTransparency: null,
          autoCorrect: null,
          autoSave: null,
          disablePictureInPicture: boolean,
          disableRemotePlayback: boolean,
          prefix: null,
          property: null,
          results: number,
          security: null,
          unselectable: null
        }
      })


/***/ }),

/***/ "../../node_modules/property-information/lib/svg.js":
/*!**********************************************************!*\
  !*** ../../node_modules/property-information/lib/svg.js ***!
  \**********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const types = __webpack_require__(/*! ./util/types */ "../../node_modules/property-information/lib/util/types.js")
      const create = __webpack_require__(/*! ./util/create */ "../../node_modules/property-information/lib/util/create.js")
      const caseSensitiveTransform = __webpack_require__(/*! ./util/case-sensitive-transform */ "../../node_modules/property-information/lib/util/case-sensitive-transform.js")

      const boolean = types.boolean
      const number = types.number
      const spaceSeparated = types.spaceSeparated
      const commaSeparated = types.commaSeparated
      const commaOrSpaceSeparated = types.commaOrSpaceSeparated

      module.exports = create({
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
        transform: caseSensitiveTransform,
        properties: {
          about: commaOrSpaceSeparated,
          accentHeight: number,
          accumulate: null,
          additive: null,
          alignmentBaseline: null,
          alphabetic: number,
          amplitude: number,
          arabicForm: null,
          ascent: number,
          attributeName: null,
          attributeType: null,
          azimuth: number,
          bandwidth: null,
          baselineShift: null,
          baseFrequency: null,
          baseProfile: null,
          bbox: null,
          begin: null,
          bias: number,
          by: null,
          calcMode: null,
          capHeight: number,
          className: spaceSeparated,
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
          descent: number,
          diffuseConstant: number,
          direction: null,
          display: null,
          dur: null,
          divisor: number,
          dominantBaseline: null,
          download: boolean,
          dx: null,
          dy: null,
          edgeMode: null,
          editable: null,
          elevation: number,
          enableBackground: null,
          end: null,
          event: null,
          exponent: number,
          externalResourcesRequired: null,
          fill: null,
          fillOpacity: number,
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
          g1: commaSeparated,
          g2: commaSeparated,
          glyphName: commaSeparated,
          glyphOrientationHorizontal: null,
          glyphOrientationVertical: null,
          glyphRef: null,
          gradientTransform: null,
          gradientUnits: null,
          handler: null,
          hanging: number,
          hatchContentUnits: null,
          hatchUnits: null,
          height: null,
          href: null,
          hrefLang: null,
          horizAdvX: number,
          horizOriginX: number,
          horizOriginY: number,
          id: null,
          ideographic: number,
          imageRendering: null,
          initialVisibility: null,
          in: null,
          in2: null,
          intercept: number,
          k: number,
          k1: number,
          k2: number,
          k3: number,
          k4: number,
          kernelMatrix: commaOrSpaceSeparated,
          kernelUnitLength: null,
          keyPoints: null, // SEMI_COLON_SEPARATED
          keySplines: null, // SEMI_COLON_SEPARATED
          keyTimes: null, // SEMI_COLON_SEPARATED
          kerning: null,
          lang: null,
          lengthAdjust: null,
          letterSpacing: null,
          lightingColor: null,
          limitingConeAngle: number,
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
          mediaSize: number,
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
          overlinePosition: number,
          overlineThickness: number,
          paintOrder: null,
          panose1: null,
          path: null,
          pathLength: number,
          patternContentUnits: null,
          patternTransform: null,
          patternUnits: null,
          phase: null,
          ping: spaceSeparated,
          pitch: null,
          playbackOrder: null,
          pointerEvents: null,
          points: null,
          pointsAtX: number,
          pointsAtY: number,
          pointsAtZ: number,
          preserveAlpha: null,
          preserveAspectRatio: null,
          primitiveUnits: null,
          propagate: null,
          property: commaOrSpaceSeparated,
          r: null,
          radius: null,
          referrerPolicy: null,
          refX: null,
          refY: null,
          rel: commaOrSpaceSeparated,
          rev: commaOrSpaceSeparated,
          renderingIntent: null,
          repeatCount: null,
          repeatDur: null,
          requiredExtensions: commaOrSpaceSeparated,
          requiredFeatures: commaOrSpaceSeparated,
          requiredFonts: commaOrSpaceSeparated,
          requiredFormats: commaOrSpaceSeparated,
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
          specularConstant: number,
          specularExponent: number,
          spreadMethod: null,
          spacing: null,
          startOffset: null,
          stdDeviation: null,
          stemh: null,
          stemv: null,
          stitchTiles: null,
          stopColor: null,
          stopOpacity: null,
          strikethroughPosition: number,
          strikethroughThickness: number,
          string: null,
          stroke: null,
          strokeDashArray: commaOrSpaceSeparated,
          strokeDashOffset: null,
          strokeLineCap: null,
          strokeLineJoin: null,
          strokeMiterLimit: number,
          strokeOpacity: number,
          strokeWidth: null,
          style: null,
          surfaceScale: number,
          syncBehavior: null,
          syncBehaviorDefault: null,
          syncMaster: null,
          syncTolerance: null,
          syncToleranceDefault: null,
          systemLanguage: commaOrSpaceSeparated,
          tabIndex: number,
          tableValues: null,
          target: null,
          targetX: number,
          targetY: number,
          textAnchor: null,
          textDecoration: null,
          textRendering: null,
          textLength: null,
          timelineBegin: null,
          title: null,
          transformBehavior: null,
          type: null,
          typeOf: commaOrSpaceSeparated,
          to: null,
          transform: null,
          u1: null,
          u2: null,
          underlinePosition: number,
          underlineThickness: number,
          unicode: null,
          unicodeBidi: null,
          unicodeRange: null,
          unitsPerEm: number,
          values: null,
          vAlphabetic: number,
          vMathematical: number,
          vectorEffect: null,
          vHanging: number,
          vIdeographic: number,
          version: null,
          vertAdvY: number,
          vertOriginX: number,
          vertOriginY: number,
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
          xHeight: number,
          y: null,
          y1: null,
          y2: null,
          yChannelSelector: null,
          z: null,
          zoomAndPan: null
        }
      })


/***/ }),

/***/ "../../node_modules/property-information/lib/util/case-insensitive-transform.js":
/*!**************************************************************************************!*\
  !*** ../../node_modules/property-information/lib/util/case-insensitive-transform.js ***!
  \**************************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const caseSensitiveTransform = __webpack_require__(/*! ./case-sensitive-transform */ "../../node_modules/property-information/lib/util/case-sensitive-transform.js")

      module.exports = caseInsensitiveTransform

      function caseInsensitiveTransform(attributes, property) {
        return caseSensitiveTransform(attributes, property.toLowerCase())
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/util/case-sensitive-transform.js":
/*!************************************************************************************!*\
  !*** ../../node_modules/property-information/lib/util/case-sensitive-transform.js ***!
  \************************************************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = caseSensitiveTransform

      function caseSensitiveTransform(attributes, attribute) {
        return attribute in attributes ? attributes[attribute] : attribute
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/util/create.js":
/*!******************************************************************!*\
  !*** ../../node_modules/property-information/lib/util/create.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const normalize = __webpack_require__(/*! ../../normalize */ "../../node_modules/property-information/normalize.js")
      const Schema = __webpack_require__(/*! ./schema */ "../../node_modules/property-information/lib/util/schema.js")
      const DefinedInfo = __webpack_require__(/*! ./defined-info */ "../../node_modules/property-information/lib/util/defined-info.js")

      module.exports = create

      function create(definition) {
        const space = definition.space
        const mustUseProperty = definition.mustUseProperty || []
        const attributes = definition.attributes || {}
        const props = definition.properties
        const transform = definition.transform
        const property = {}
        const normal = {}
        let prop
        let info

        for (prop in props) {
          info = new DefinedInfo(
            prop,
            transform(attributes, prop),
            props[prop],
            space
          )

          if (mustUseProperty.indexOf(prop) !== -1) {
            info.mustUseProperty = true
          }

          property[prop] = info

          normal[normalize(prop)] = prop
          normal[normalize(info.attribute)] = prop
        }

        return new Schema(property, normal, space)
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/util/defined-info.js":
/*!************************************************************************!*\
  !*** ../../node_modules/property-information/lib/util/defined-info.js ***!
  \************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const Info = __webpack_require__(/*! ./info */ "../../node_modules/property-information/lib/util/info.js")
      const types = __webpack_require__(/*! ./types */ "../../node_modules/property-information/lib/util/types.js")

      module.exports = DefinedInfo

      DefinedInfo.prototype = new Info()
      DefinedInfo.prototype.defined = true

      const checks = [
        'boolean',
        'booleanish',
        'overloadedBoolean',
        'number',
        'commaSeparated',
        'spaceSeparated',
        'commaOrSpaceSeparated'
      ]
      const checksLength = checks.length

      function DefinedInfo(property, attribute, mask, space) {
        let index = -1
        let check

        mark(this, 'space', space)

        Info.call(this, property, attribute)

        while (++index < checksLength) {
          check = checks[index]
          mark(this, check, (mask & types[check]) === types[check])
        }
      }

      function mark(values, key, value) {
        if (value) {
          values[key] = value
        }
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/util/info.js":
/*!****************************************************************!*\
  !*** ../../node_modules/property-information/lib/util/info.js ***!
  \****************************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = Info

      const proto = Info.prototype

      proto.space = null
      proto.attribute = null
      proto.property = null
      proto.boolean = false
      proto.booleanish = false
      proto.overloadedBoolean = false
      proto.number = false
      proto.commaSeparated = false
      proto.spaceSeparated = false
      proto.commaOrSpaceSeparated = false
      proto.mustUseProperty = false
      proto.defined = false

      function Info(property, attribute) {
        this.property = property
        this.attribute = attribute
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/util/merge.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/property-information/lib/util/merge.js ***!
  \*****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const xtend = __webpack_require__(/*! xtend */ "../../node_modules/xtend/immutable.js")
      const Schema = __webpack_require__(/*! ./schema */ "../../node_modules/property-information/lib/util/schema.js")

      module.exports = merge

      function merge(definitions) {
        const length = definitions.length
        const property = []
        const normal = []
        let index = -1
        let info
        let space

        while (++index < length) {
          info = definitions[index]
          property.push(info.property)
          normal.push(info.normal)
          space = info.space
        }

        return new Schema(
          xtend.apply(null, property),
          xtend.apply(null, normal),
          space
        )
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/util/schema.js":
/*!******************************************************************!*\
  !*** ../../node_modules/property-information/lib/util/schema.js ***!
  \******************************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = Schema

      const proto = Schema.prototype

      proto.space = null
      proto.normal = {}
      proto.property = {}

      function Schema(property, normal, space) {
        this.property = property
        this.normal = normal

        if (space) {
          this.space = space
        }
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/util/types.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/property-information/lib/util/types.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, exports) => {

      "use strict";


      let powers = 0

      exports.boolean = increment()
      exports.booleanish = increment()
      exports.overloadedBoolean = increment()
      exports.number = increment()
      exports.spaceSeparated = increment()
      exports.commaSeparated = increment()
      exports.commaOrSpaceSeparated = increment()

      function increment() {
        return Math.pow(2, ++powers)
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/xlink.js":
/*!************************************************************!*\
  !*** ../../node_modules/property-information/lib/xlink.js ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const create = __webpack_require__(/*! ./util/create */ "../../node_modules/property-information/lib/util/create.js")

      module.exports = create({
        space: 'xlink',
        transform: xlinkTransform,
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

      function xlinkTransform(_, prop) {
        return 'xlink:' + prop.slice(5).toLowerCase()
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/xml.js":
/*!**********************************************************!*\
  !*** ../../node_modules/property-information/lib/xml.js ***!
  \**********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const create = __webpack_require__(/*! ./util/create */ "../../node_modules/property-information/lib/util/create.js")

      module.exports = create({
        space: 'xml',
        transform: xmlTransform,
        properties: {
          xmlLang: null,
          xmlBase: null,
          xmlSpace: null
        }
      })

      function xmlTransform(_, prop) {
        return 'xml:' + prop.slice(3).toLowerCase()
      }


/***/ }),

/***/ "../../node_modules/property-information/lib/xmlns.js":
/*!************************************************************!*\
  !*** ../../node_modules/property-information/lib/xmlns.js ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const create = __webpack_require__(/*! ./util/create */ "../../node_modules/property-information/lib/util/create.js")
      const caseInsensitiveTransform = __webpack_require__(/*! ./util/case-insensitive-transform */ "../../node_modules/property-information/lib/util/case-insensitive-transform.js")

      module.exports = create({
        space: 'xmlns',
        attributes: {
          xmlnsxlink: 'xmlns:xlink'
        },
        transform: caseInsensitiveTransform,
        properties: {
          xmlns: null,
          xmlnsXLink: null
        }
      })


/***/ }),

/***/ "../../node_modules/property-information/normalize.js":
/*!************************************************************!*\
  !*** ../../node_modules/property-information/normalize.js ***!
  \************************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = normalize

      function normalize(value) {
        return value.toLowerCase()
      }


/***/ }),

/***/ "../../node_modules/property-information/svg.js":
/*!******************************************************!*\
  !*** ../../node_modules/property-information/svg.js ***!
  \******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const merge = __webpack_require__(/*! ./lib/util/merge */ "../../node_modules/property-information/lib/util/merge.js")
      const xlink = __webpack_require__(/*! ./lib/xlink */ "../../node_modules/property-information/lib/xlink.js")
      const xml = __webpack_require__(/*! ./lib/xml */ "../../node_modules/property-information/lib/xml.js")
      const xmlns = __webpack_require__(/*! ./lib/xmlns */ "../../node_modules/property-information/lib/xmlns.js")
      const aria = __webpack_require__(/*! ./lib/aria */ "../../node_modules/property-information/lib/aria.js")
      const svg = __webpack_require__(/*! ./lib/svg */ "../../node_modules/property-information/lib/svg.js")

      module.exports = merge([xml, xlink, xmlns, aria, svg])


/***/ }),

/***/ "../../node_modules/react-is/cjs/react-is.development.js":
/*!***************************************************************!*\
  !*** ../../node_modules/react-is/cjs/react-is.development.js ***!
  \***************************************************************/
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

/***/ "../../node_modules/react-is/index.js":
/*!********************************************!*\
  !*** ../../node_modules/react-is/index.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      if (false) // removed by dead control flow
      {} else {
        module.exports = __webpack_require__(/*! ./cjs/react-is.development.js */ "../../node_modules/react-is/cjs/react-is.development.js");
      }


/***/ }),

/***/ "../../node_modules/react-markdown/node_modules/react-is/cjs/react-is.development.js":
/*!*******************************************************************************************!*\
  !*** ../../node_modules/react-markdown/node_modules/react-is/cjs/react-is.development.js ***!
  \*******************************************************************************************/
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

/***/ "../../node_modules/react-markdown/node_modules/react-is/index.js":
/*!************************************************************************!*\
  !*** ../../node_modules/react-markdown/node_modules/react-is/index.js ***!
  \************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      if (false) // removed by dead control flow
      {} else {
        module.exports = __webpack_require__(/*! ./cjs/react-is.development.js */ "../../node_modules/react-markdown/node_modules/react-is/cjs/react-is.development.js");
      }


/***/ }),

/***/ "../../node_modules/react-markdown/src/ast-to-react.js":
/*!*************************************************************!*\
  !*** ../../node_modules/react-markdown/src/ast-to-react.js ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

      "use strict";


      const React = __webpack_require__(/*! react */ "react")
      const ReactIs = __webpack_require__(/*! react-is */ "../../node_modules/react-markdown/node_modules/react-is/index.js")
      const svg = __webpack_require__(/*! property-information/svg */ "../../node_modules/property-information/svg.js")
      const find = __webpack_require__(/*! property-information/find */ "../../node_modules/property-information/find.js")
      const hastToReact = __webpack_require__(/*! property-information/hast-to-react.json */ "../../node_modules/property-information/hast-to-react.json")
      const spaces = __webpack_require__(/*! space-separated-tokens */ "../../node_modules/space-separated-tokens/index.js")
      const commas = __webpack_require__(/*! comma-separated-tokens */ "../../node_modules/comma-separated-tokens/index.js")
      const style = __webpack_require__(/*! style-to-object */ "../../node_modules/style-to-object/index.js")

      exports.hastToReact = toReact
      exports.hastChildrenToReact = childrenToReact

/**
 * @typedef {JSX.IntrinsicElements} IntrinsicElements
 * @typedef {import('react').ReactNode} ReactNode
 * @typedef {import('unist').Position} Position
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').Root} Root
 * @typedef {import('hast').Text} Text
 * @typedef {import('hast').Comment} Comment
 * @typedef {import('hast').DocType} Doctype
 */

/**
 * @typedef Info
 * @property {string?} space
 * @property {string?} attribute
 * @property {string?} property
 * @property {boolean} boolean
 * @property {boolean} booleanish
 * @property {boolean} overloadedBoolean
 * @property {boolean} number
 * @property {boolean} commaSeparated
 * @property {boolean} spaceSeparated
 * @property {boolean} commaOrSpaceSeparated
 * @property {boolean} mustUseProperty
 * @property {boolean} defined
 *
 * @typedef Schema
 * @property {Object.<string, Info>} property
 * @property {Object.<string, string>} normal
 * @property {string?} space
 *
 * @typedef Raw
 * @property {'raw'} type
 * @property {string} value
 *
 * @typedef Context
 * @property {TransformOptions} options
 * @property {Schema} schema
 * @property {number} listDepth
 *
 * @callback TransformLink
 * @param {string} href
 * @param {Array.<Comment|Element|Text>} children
 * @param {string?} title
 * @returns {string}
 *
 * @callback TransformImage
 * @param {string} src
 * @param {string} alt
 * @param {string?} title
 * @returns {string}
 *
 * @callback TransformLinkTarget
 * @param {string} href
 * @param {Array.<Comment|Element|Text>} children
 * @param {string?} title
 * @returns {string|undefined}
 *
 * @typedef {keyof IntrinsicElements} ReactMarkdownNames
 *
 * To do: is `data-sourcepos` typeable?
 *
 * @typedef ReactMarkdownProps
 * @property {Element} node
 * @property {string} key
 * @property {ReactNode[]} children
 * @property {Position?} [sourcePosition] Passed when `options.rawSourcePos` is given
 * @property {number} [index] Passed when `options.includeElementIndex` is given
 * @property {number} [siblingCount] Passed when `options.includeElementIndex` is given
 *
 * @callback CodeComponent
 * @param {JSX.IntrinsicElements['code'] & ReactMarkdownProps & {inline?: boolean}} props
 * @returns {ReactNode}
 *
 * @callback HeadingComponent
 * @param {JSX.IntrinsicElements['h1'] & ReactMarkdownProps & {level: number}} props
 * @returns {ReactNode}
 *
 * @callback LiComponent
 * @param {JSX.IntrinsicElements['li'] & ReactMarkdownProps & {checked: boolean|null, index: number, ordered: boolean}} props
 * @returns {ReactNode}
 *
 * @callback OrderedListComponent
 * @param {JSX.IntrinsicElements['ol'] & ReactMarkdownProps & {depth: number, ordered: true}} props
 * @returns {ReactNode}
 *
 * @callback TableCellComponent
 * @param {JSX.IntrinsicElements['table'] & ReactMarkdownProps & {style?: Object.<string, unknown>, isHeader: boolean}} props
 * @returns {ReactNode}
 *
 * @callback TableRowComponent
 * @param {JSX.IntrinsicElements['tr'] & ReactMarkdownProps & {isHeader: boolean}} props
 * @returns {ReactNode}
 *
 * @callback UnorderedListComponent
 * @param {JSX.IntrinsicElements['ul'] & ReactMarkdownProps & {depth: number, ordered: false}} props
 * @returns {ReactNode}
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
 * @typedef {{[TagName in keyof IntrinsicElements]: TagName | ((props: IntrinsicElements[TagName] & ReactMarkdownProps) => ReactNode)}} NormalComponents
 * @typedef {Partial<Omit<NormalComponents, keyof SpecialComponents> & SpecialComponents>} Components
 */

/**
 * @typedef TransformOptions
 * @property {boolean} [sourcePos=false]
 * @property {boolean} [rawSourcePos=false]
 * @property {boolean} [skipHtml=false]
 * @property {boolean} [includeElementIndex=false]
 * @property {null|false|TransformLink} [transformLinkUri]
 * @property {TransformImage} [transformImageUri]
 * @property {string|TransformLinkTarget} [linkTarget]
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
  /** @type {Array.<ReactNode>} */
        const children = []
        let childIndex = -1
  /** @type {Comment|Doctype|Element|Raw|Text} */
        let child

        while (++childIndex < node.children.length) {
          child = node.children[childIndex]

          if (child.type === 'element') {
            children.push(toReact(context, child, childIndex, node))
          } else if (child.type === 'text') {
      // React does not permit whitespace text elements as children of table:
      // cf. https://github.com/remarkjs/react-markdown/issues/576
            if (
              node.type !== 'element' ||
        !tableElements.has(node.tagName) ||
        child.value !== '\n'
            ) {
              children.push(child.value)
            }
          }
    // @ts-expect-error `raw` nodes are non-standard
          else if (child.type === 'raw' && !context.options.skipHtml) {
      // Default behavior is to show (encoded) HTML.
      // @ts-expect-error `raw` nodes are non-standard
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
  /** @type {Object.<string, unknown>} */
        const properties = {}
        let schema = parentSchema
  /** @type {string} */
        let property

        if (parentSchema.space === 'html' && name === 'svg') {
          schema = svg
          context.schema = schema
        }

  /* istanbul ignore else - types say they’re optional. */
        if (node.properties) {
          for (property in node.properties) {
      /* istanbul ignore else - prototype polution. */
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
  // an object that matches the positon interface.
        const position = node.position || {
          start: {line: null, column: null, offset: null},
          end: {line: null, column: null, offset: null}
        }
        const component =
    options.components && own.call(options.components, name)
      ? options.components[name]
      : name
        const basic = typeof component === 'string' || component === React.Fragment

        if (!ReactIs.isValidElementType(component)) {
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
        ? // @ts-expect-error assume `href` is a string
        options.linkTarget(properties.href, node.children, properties.title)
        : options.linkTarget
        }

        if (name === 'a' && options.transformLinkUri) {
          properties.href = options.transformLinkUri(
      // @ts-expect-error assume `href` is a string
            properties.href,
            node.children,
            properties.title
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
          properties.level = parseInt(name.charAt(1), 10)
        }

        if (name === 'img' && options.transformImageUri) {
          properties.src = options.transformImageUri(
      // @ts-expect-error assume `src` is a string
            properties.src,
            properties.alt,
            properties.title
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
          ? React.createElement(component, properties, children)
          : React.createElement(component, properties)
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
 * @param {Object.<string, unknown>} props
 * @param {string} prop
 * @param {unknown} value
 * @param {Context} ctx
 */
      function addProperty(props, prop, value, ctx) {
  /** @type {Info} */
        const info = find(ctx.schema, prop)
        let result = value

  // Ignore nullish and `NaN` values.
  // eslint-disable-next-line no-self-compare
        if (result === null || result === undefined || result !== result) {
          return
        }

  // Accept `array`.
  // Most props are space-separated.
        if (result && typeof result === 'object' && 'length' in result) {
    // type-coverage:ignore-next-line remove when typed.
          result = (info.commaSeparated ? commas : spaces).stringify(result)
        }

        if (info.property === 'style' && typeof result === 'string') {
          result = parseStyle(result)
        }

  /* istanbul ignore else - types say they’re optional. */
        if (info.space && info.property) {
          props[
            own.call(hastToReact, info.property)
              ? hastToReact[info.property]
              : info.property
          ] = result
        } else if (info.attribute) {
          props[info.attribute] = result
        }
      }

/**
 * @param {string} value
 * @returns {Object.<string, string>}
 */
      function parseStyle(value) {
  /** @type {Object.<string, string>} */
        const result = {}

        try {
          style(value, iterator)
        } catch (/** @type {unknown} */ _) {
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

/***/ "../../node_modules/react-markdown/src/react-markdown.js":
/*!***************************************************************!*\
  !*** ../../node_modules/react-markdown/src/react-markdown.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const React = __webpack_require__(/*! react */ "react")
      const vfile = __webpack_require__(/*! vfile */ "../../node_modules/vfile/index.js")
      const unified = __webpack_require__(/*! unified */ "../../node_modules/unified/index.js")
      const parse = __webpack_require__(/*! remark-parse */ "../../node_modules/remark-parse/index.js")
      const remarkRehype = __webpack_require__(/*! remark-rehype */ "../../node_modules/remark-rehype/index.js")
      const PropTypes = __webpack_require__(/*! prop-types */ "../../node_modules/prop-types/index.js")
      const html = __webpack_require__(/*! property-information/html */ "../../node_modules/property-information/html.js")
      const filter = __webpack_require__(/*! ./rehype-filter.js */ "../../node_modules/react-markdown/src/rehype-filter.js")
      const uriTransformer = __webpack_require__(/*! ./uri-transformer.js */ "../../node_modules/react-markdown/src/uri-transformer.js")
      const childrenToReact = (__webpack_require__(/*! ./ast-to-react.js */ "../../node_modules/react-markdown/src/ast-to-react.js").hastChildrenToReact)

/**
 * @typedef {import('react').ReactNode} ReactNode
 * @typedef {import('react').ReactElement<{}>} ReactElement
 * @typedef {import('unified').PluggableList} PluggableList
 * @typedef {import('hast').Root} Root
 * @typedef {import('./rehype-filter.js').RehypeFilterOptions} FilterOptions
 * @typedef {import('./ast-to-react.js').TransformOptions} TransformOptions
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
 */

      module.exports = ReactMarkdown

      const own = {}.hasOwnProperty
      const changelog =
  'https://github.com/remarkjs/react-markdown/blob/main/changelog.md'

/**
 * @typedef Deprecation
 * @property {string} id
 * @property {string} [to]
 */

/**
 * @type {Object.<string, Deprecation>}
 */
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
 * @param {ReactMarkdownOptions} options
 * @returns {ReactElement}
 */
      function ReactMarkdown(options) {
        for (const key in deprecated) {
          if (own.call(deprecated, key) && own.call(options, key)) {
      /** @type {Deprecation} */
            const deprecation = deprecated[key]
            console.warn(
              `[react-markdown] Warning: please ${
                deprecation.to ? `use \`${deprecation.to}\` instead of` : 'remove'
              } \`${key}\` (see <${changelog}#${deprecation.id}> for more info)`
            )
            delete deprecated[key]
          }
        }

        const processor = unified()
          .use(parse)
    // TODO: deprecate `plugins` in v7.0.0.
          .use(options.remarkPlugins || options.plugins || [])
          .use(remarkRehype, {allowDangerousHtml: true})
          .use(options.rehypePlugins || [])
          .use(filter, options)

  /** @type {vfile} */
        let file

        if (typeof options.children === 'string') {
          file = vfile(options.children)
        } else {
          if (options.children !== undefined && options.children !== null) {
            console.warn(
              `[react-markdown] Warning: please pass a string as \`children\` (not: \`${options.children}\`)`
            )
          }

          file = vfile()
        }

  /** @type {Root} */
  // @ts-expect-error we’ll throw if it isn’t a root next.
        const hastNode = processor.runSync(processor.parse(file), file)

        if (hastNode.type !== 'root') {
          throw new TypeError('Expected a `root` node')
        }

  /** @type {ReactElement} */
        let result = React.createElement(
          React.Fragment,
          {},
          childrenToReact({options: options, schema: html, listDepth: 0}, hastNode)
        )

        if (options.className) {
          result = React.createElement('div', {className: options.className}, result)
        }

        return result
      }

      ReactMarkdown.defaultProps = {transformLinkUri: uriTransformer}

      ReactMarkdown.propTypes = {
  // Core options:
        children: PropTypes.string,
  // Layout options:
        className: PropTypes.string,
  // Filter options:
        allowElement: PropTypes.func,
        allowedElements: PropTypes.arrayOf(PropTypes.string),
        disallowedElements: PropTypes.arrayOf(PropTypes.string),
        unwrapDisallowed: PropTypes.bool,
  // Plugin options:
  // type-coverage:ignore-next-line
        remarkPlugins: PropTypes.arrayOf(
          PropTypes.oneOfType([
            PropTypes.object,
            PropTypes.func,
            PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.object, PropTypes.func]))
          ])
        ),
  // type-coverage:ignore-next-line
        rehypePlugins: PropTypes.arrayOf(
          PropTypes.oneOfType([
            PropTypes.object,
            PropTypes.func,
            PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.object, PropTypes.func]))
          ])
        ),
  // Transform options:
        sourcePos: PropTypes.bool,
        rawSourcePos: PropTypes.bool,
        skipHtml: PropTypes.bool,
        includeElementIndex: PropTypes.bool,
        transformLinkUri: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
        linkTarget: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
        transformImageUri: PropTypes.func,
        components: PropTypes.object
      }

      ReactMarkdown.uriTransformer = uriTransformer


/***/ }),

/***/ "../../node_modules/react-markdown/src/rehype-filter.js":
/*!**************************************************************!*\
  !*** ../../node_modules/react-markdown/src/rehype-filter.js ***!
  \**************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      const visit = __webpack_require__(/*! unist-util-visit */ "../../node_modules/unist-util-visit/index.js")

      module.exports = rehypeFilter

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
 * @typedef RehypeFilterOptions
 * @property {Array.<string>} [allowedElements]
 * @property {Array.<string>} [disallowedElements=[]]
 * @property {AllowElement} [allowElement]
 * @property {boolean} [unwrapDisallowed=false]
 */

/**
 * @type {import('unified').Plugin<[RehypeFilterOptions]>}
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
            const node = /** @type {Root} */ (tree)
            visit(node, 'element', onelement)
          }
        }

  /**
   * @param {Node} node_
   * @param {number|null|undefined} index
   * @param {Node|null|undefined} parent_
   * @returns {number|void}
   */
        function onelement(node_, index, parent_) {
          const node = /** @type {Element} */ (node_)
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
        }
      }


/***/ }),

/***/ "../../node_modules/react-markdown/src/uri-transformer.js":
/*!****************************************************************!*\
  !*** ../../node_modules/react-markdown/src/uri-transformer.js ***!
  \****************************************************************/
/***/ ((module) => {

      const protocols = ['http', 'https', 'mailto', 'tel']

      module.exports = uriTransformer

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

/***/ "../../node_modules/remark-parse/index.js":
/*!************************************************!*\
  !*** ../../node_modules/remark-parse/index.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = parse

      const fromMarkdown = __webpack_require__(/*! mdast-util-from-markdown */ "../../node_modules/mdast-util-from-markdown/index.js")

      function parse(options) {
        const self = this

        this.Parser = parse

        function parse(doc) {
          return fromMarkdown(
            doc,
            Object.assign({}, self.data('settings'), options, {
        // Note: these options are not in the readme.
        // The goal is for them to be set by plugins on `data` instead of being
        // passed by users.
              extensions: self.data('micromarkExtensions') || [],
              mdastExtensions: self.data('fromMarkdownExtensions') || []
            })
          )
        }
      }


/***/ }),

/***/ "../../node_modules/remark-rehype/index.js":
/*!*************************************************!*\
  !*** ../../node_modules/remark-rehype/index.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const mdast2hast = __webpack_require__(/*! mdast-util-to-hast */ "../../node_modules/mdast-util-to-hast/index.js")

      module.exports = remark2rehype

// Attacher.
// If a destination is given, runs the destination with the new hast tree
// (bridge mode).
// Without destination, returns the tree: further plugins run on that tree
// (mutate mode).
      function remark2rehype(destination, options) {
        if (destination && !destination.process) {
          options = destination
          destination = null
        }

        return destination ? bridge(destination, options) : mutate(options)
      }

// Bridge mode.
// Runs the destination with the new hast tree.
      function bridge(destination, options) {
        return transformer

        function transformer(node, file, next) {
          destination.run(mdast2hast(node, options), file, done)

          function done(error) {
            next(error)
          }
        }
      }

// Mutate-mode.
// Further transformers run on the hast tree.
      function mutate(options) {
        return transformer

        function transformer(node) {
          return mdast2hast(node, options)
        }
      }


/***/ }),

/***/ "../../node_modules/space-separated-tokens/index.js":
/*!**********************************************************!*\
  !*** ../../node_modules/space-separated-tokens/index.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, exports) => {

      "use strict";


      exports.parse = parse
      exports.stringify = stringify

      const empty = ''
      const space = ' '
      const whiteSpace = /[ \t\n\r\f]+/g

      function parse(value) {
        const input = String(value || empty).trim()
        return input === empty ? [] : input.split(whiteSpace)
      }

      function stringify(values) {
        return values.join(space).trim()
      }


/***/ }),

/***/ "../../node_modules/style-to-object/index.js":
/*!***************************************************!*\
  !*** ../../node_modules/style-to-object/index.js ***!
  \***************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      const parse = __webpack_require__(/*! inline-style-parser */ "../../node_modules/inline-style-parser/index.js");

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

/***/ "../../node_modules/trough/index.js":
/*!******************************************!*\
  !*** ../../node_modules/trough/index.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const wrap = __webpack_require__(/*! ./wrap.js */ "../../node_modules/trough/wrap.js")

      module.exports = trough

      trough.wrap = wrap

      const slice = [].slice

// Create new middleware.
      function trough() {
        const fns = []
        const middleware = {}

        middleware.run = run
        middleware.use = use

        return middleware

  // Run `fns`.  Last argument must be a completion handler.
        function run() {
          let index = -1
          let input = slice.call(arguments, 0, -1)
          const done = arguments[arguments.length - 1]

          if (typeof done !== 'function') {
            throw new Error('Expected function as last argument, not ' + done)
          }

          next.apply(null, [null].concat(input))

    // Run the next `fn`, if any.
          function next(err) {
            const fn = fns[++index]
            const params = slice.call(arguments, 0)
            const values = params.slice(1)
            const length = input.length
            let pos = -1

            if (err) {
              done(err)
              return
            }

      // Copy non-nully input into values.
            while (++pos < length) {
              if (values[pos] === null || values[pos] === undefined) {
                values[pos] = input[pos]
              }
            }

            input = values

      // Next or done.
            if (fn) {
              wrap(fn, next).apply(null, input)
            } else {
              done.apply(null, [null].concat(input))
            }
          }
        }

  // Add `fn` to the list.
        function use(fn) {
          if (typeof fn !== 'function') {
            throw new Error('Expected `fn` to be a function, not ' + fn)
          }

          fns.push(fn)

          return middleware
        }
      }


/***/ }),

/***/ "../../node_modules/trough/wrap.js":
/*!*****************************************!*\
  !*** ../../node_modules/trough/wrap.js ***!
  \*****************************************/
/***/ ((module) => {

      "use strict";


      const slice = [].slice

      module.exports = wrap

// Wrap `fn`.
// Can be sync or async; return a promise, receive a completion handler, return
// new values and errors.
      function wrap(fn, callback) {
        let invoked

        return wrapped

        function wrapped() {
          const params = slice.call(arguments, 0)
          const callback = fn.length > params.length
          let result

          if (callback) {
            params.push(done)
          }

          try {
            result = fn.apply(null, params)
          } catch (error) {
      // Well, this is quite the pickle.
      // `fn` received a callback and invoked it (thus continuing the pipeline),
      // but later also threw an error.
      // We’re not about to restart the pipeline again, so the only thing left
      // to do is to throw the thing instead.
            if (callback && invoked) {
              throw error
            }

            return done(error)
          }

          if (!callback) {
            if (result && typeof result.then === 'function') {
              result.then(then, done)
            } else if (result instanceof Error) {
              done(result)
            } else {
              then(result)
            }
          }
        }

  // Invoke `next`, only once.
        function done() {
          if (!invoked) {
            invoked = true

            callback.apply(null, arguments)
          }
        }

  // Invoke `done` with one value.
  // Tracks if an error is passed, too.
        function then(value) {
          done(null, value)
        }
      }


/***/ }),

/***/ "../../node_modules/unified/index.js":
/*!*******************************************!*\
  !*** ../../node_modules/unified/index.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const bail = __webpack_require__(/*! bail */ "../../node_modules/bail/index.js")
      const buffer = __webpack_require__(/*! is-buffer */ "../../node_modules/unified/node_modules/is-buffer/index.js")
      const extend = __webpack_require__(/*! extend */ "../../node_modules/extend/index.js")
      const plain = __webpack_require__(/*! is-plain-obj */ "../../node_modules/is-plain-obj/index.js")
      const trough = __webpack_require__(/*! trough */ "../../node_modules/trough/index.js")
      const vfile = __webpack_require__(/*! vfile */ "../../node_modules/vfile/index.js")

// Expose a frozen processor.
      module.exports = unified().freeze()

      const slice = [].slice
      const own = {}.hasOwnProperty

// Process pipeline.
      const pipeline = trough()
        .use(pipelineParse)
        .use(pipelineRun)
        .use(pipelineStringify)

      function pipelineParse(p, ctx) {
        ctx.tree = p.parse(ctx.file)
      }

      function pipelineRun(p, ctx, next) {
        p.run(ctx.tree, ctx.file, done)

        function done(error, tree, file) {
          if (error) {
            next(error)
          } else {
            ctx.tree = tree
            ctx.file = file
            next()
          }
        }
      }

      function pipelineStringify(p, ctx) {
        const result = p.stringify(ctx.tree, ctx.file)

        if (result === undefined || result === null) {
    // Empty.
        } else if (typeof result === 'string' || buffer(result)) {
          if ('value' in ctx.file) {
            ctx.file.value = result
          }

          ctx.file.contents = result
        } else {
          ctx.file.result = result
        }
      }

// Function to create the first processor.
      function unified() {
        const attachers = []
        const transformers = trough()
        let namespace = {}
        let freezeIndex = -1
        let frozen

  // Data management.
        processor.data = data

  // Lock.
        processor.freeze = freeze

  // Plugins.
        processor.attachers = attachers
        processor.use = use

  // API.
        processor.parse = parse
        processor.stringify = stringify
        processor.run = run
        processor.runSync = runSync
        processor.process = process
        processor.processSync = processSync

  // Expose.
        return processor

  // Create a new processor based on the processor in the current scope.
        function processor() {
          const destination = unified()
          let index = -1

          while (++index < attachers.length) {
            destination.use.apply(null, attachers[index])
          }

          destination.data(extend(true, {}, namespace))

          return destination
        }

  // Freeze: used to signal a processor that has finished configuration.
  //
  // For example, take unified itself: it’s frozen.
  // Plugins should not be added to it.
  // Rather, it should be extended, by invoking it, before modifying it.
  //
  // In essence, always invoke this when exporting a processor.
        function freeze() {
          let values
          let transformer

          if (frozen) {
            return processor
          }

          while (++freezeIndex < attachers.length) {
            values = attachers[freezeIndex]

            if (values[1] === false) {
              continue
            }

            if (values[1] === true) {
              values[1] = undefined
            }

            transformer = values[0].apply(processor, values.slice(1))

            if (typeof transformer === 'function') {
              transformers.use(transformer)
            }
          }

          frozen = true
          freezeIndex = Infinity

          return processor
        }

  // Data management.
  // Getter / setter for processor-specific informtion.
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

  // Plugin management.
  //
  // Pass it:
  // *   an attacher and options,
  // *   a preset,
  // *   a list of presets, attachers, and arguments (list of attachers and
  //     options).
        function use(value) {
          let settings

          assertUnfrozen('use', frozen)

          if (value === null || value === undefined) {
      // Empty.
          } else if (typeof value === 'function') {
            addPlugin.apply(null, arguments)
          } else if (typeof value === 'object') {
            if ('length' in value) {
              addList(value)
            } else {
              addPreset(value)
            }
          } else {
            throw new Error('Expected usable value, not `' + value + '`')
          }

          if (settings) {
            namespace.settings = extend(namespace.settings || {}, settings)
          }

          return processor

          function addPreset(result) {
            addList(result.plugins)

            if (result.settings) {
              settings = extend(settings || {}, result.settings)
            }
          }

          function add(value) {
            if (typeof value === 'function') {
              addPlugin(value)
            } else if (typeof value === 'object') {
              if ('length' in value) {
                addPlugin.apply(null, value)
              } else {
                addPreset(value)
              }
            } else {
              throw new Error('Expected usable value, not `' + value + '`')
            }
          }

          function addList(plugins) {
            let index = -1

            if (plugins === null || plugins === undefined) {
        // Empty.
            } else if (typeof plugins === 'object' && 'length' in plugins) {
              while (++index < plugins.length) {
                add(plugins[index])
              }
            } else {
              throw new Error('Expected a list of plugins, not `' + plugins + '`')
            }
          }

          function addPlugin(plugin, value) {
            const entry = find(plugin)

            if (entry) {
              if (plain(entry[1]) && plain(value)) {
                value = extend(true, entry[1], value)
              }

              entry[1] = value
            } else {
              attachers.push(slice.call(arguments))
            }
          }
        }

        function find(plugin) {
          let index = -1

          while (++index < attachers.length) {
            if (attachers[index][0] === plugin) {
              return attachers[index]
            }
          }
        }

  // Parse a file (in string or vfile representation) into a unist node using
  // the `Parser` on the processor.
        function parse(doc) {
          const file = vfile(doc)
          let Parser

          freeze()
          Parser = processor.Parser
          assertParser('parse', Parser)

          if (newable(Parser, 'parse')) {
            return new Parser(String(file), file).parse()
          }

          return Parser(String(file), file) // eslint-disable-line new-cap
        }

  // Run transforms on a unist node representation of a file (in string or
  // vfile representation), async.
        function run(node, file, cb) {
          assertNode(node)
          freeze()

          if (!cb && typeof file === 'function') {
            cb = file
            file = null
          }

          if (!cb) {
            return new Promise(executor)
          }

          executor(null, cb)

          function executor(resolve, reject) {
            transformers.run(node, vfile(file), done)

            function done(error, tree, file) {
              tree = tree || node
              if (error) {
                reject(error)
              } else if (resolve) {
                resolve(tree)
              } else {
                cb(null, tree, file)
              }
            }
          }
        }

  // Run transforms on a unist node representation of a file (in string or
  // vfile representation), sync.
        function runSync(node, file) {
          let result
          let complete

          run(node, file, done)

          assertDone('runSync', 'run', complete)

          return result

          function done(error, tree) {
            complete = true
            result = tree
            bail(error)
          }
        }

  // Stringify a unist node representation of a file (in string or vfile
  // representation) into a string using the `Compiler` on the processor.
        function stringify(node, doc) {
          const file = vfile(doc)
          let Compiler

          freeze()
          Compiler = processor.Compiler
          assertCompiler('stringify', Compiler)
          assertNode(node)

          if (newable(Compiler, 'compile')) {
            return new Compiler(node, file).compile()
          }

          return Compiler(node, file) // eslint-disable-line new-cap
        }

  // Parse a file (in string or vfile representation) into a unist node using
  // the `Parser` on the processor, then run transforms on that node, and
  // compile the resulting node using the `Compiler` on the processor, and
  // store that result on the vfile.
        function process(doc, cb) {
          freeze()
          assertParser('process', processor.Parser)
          assertCompiler('process', processor.Compiler)

          if (!cb) {
            return new Promise(executor)
          }

          executor(null, cb)

          function executor(resolve, reject) {
            const file = vfile(doc)

            pipeline.run(processor, {file: file}, done)

            function done(error) {
              if (error) {
                reject(error)
              } else if (resolve) {
                resolve(file)
              } else {
                cb(null, file)
              }
            }
          }
        }

  // Process the given document (in string or vfile representation), sync.
        function processSync(doc) {
          let file
          let complete

          freeze()
          assertParser('processSync', processor.Parser)
          assertCompiler('processSync', processor.Compiler)
          file = vfile(doc)

          process(file, done)

          assertDone('processSync', 'process', complete)

          return file

          function done(error) {
            complete = true
            bail(error)
          }
        }
      }

// Check if `value` is a constructor.
      function newable(value, name) {
        return (
          typeof value === 'function' &&
    value.prototype &&
    // A function with keys in its prototype is probably a constructor.
    // Classes’ prototype methods are not enumerable, so we check if some value
    // exists in the prototype.
    (keys(value.prototype) || name in value.prototype)
        )
      }

// Check if `value` is an object with keys.
      function keys(value) {
        let key
        for (key in value) {
          return true
        }

        return false
      }

// Assert a parser is available.
      function assertParser(name, Parser) {
        if (typeof Parser !== 'function') {
          throw new Error('Cannot `' + name + '` without `Parser`')
        }
      }

// Assert a compiler is available.
      function assertCompiler(name, Compiler) {
        if (typeof Compiler !== 'function') {
          throw new Error('Cannot `' + name + '` without `Compiler`')
        }
      }

// Assert the processor is not frozen.
      function assertUnfrozen(name, frozen) {
        if (frozen) {
          throw new Error(
            'Cannot invoke `' +
        name +
        '` on a frozen processor.\nCreate a new processor first, by invoking it: use `processor()` instead of `processor`.'
          )
        }
      }

// Assert `node` is a unist node.
      function assertNode(node) {
        if (!node || typeof node.type !== 'string') {
          throw new Error('Expected node, got `' + node + '`')
        }
      }

// Assert that `complete` is `true`.
      function assertDone(name, asyncName, complete) {
        if (!complete) {
          throw new Error(
            '`' + name + '` finished async. Use `' + asyncName + '` instead'
          )
        }
      }


/***/ }),

/***/ "../../node_modules/unified/node_modules/is-buffer/index.js":
/*!******************************************************************!*\
  !*** ../../node_modules/unified/node_modules/is-buffer/index.js ***!
  \******************************************************************/
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

/***/ "../../node_modules/unist-builder/index.js":
/*!*************************************************!*\
  !*** ../../node_modules/unist-builder/index.js ***!
  \*************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = u

      function u(type, props, value) {
        let node

        if (
          (value === null || value === undefined) &&
    (typeof props !== 'object' || Array.isArray(props))
        ) {
          value = props
          props = {}
        }

        node = Object.assign({type: String(type)}, props)

        if (Array.isArray(value)) {
          node.children = value
        } else if (value !== null && value !== undefined) {
          node.value = String(value)
        }

        return node
      }


/***/ }),

/***/ "../../node_modules/unist-util-generated/index.js":
/*!********************************************************!*\
  !*** ../../node_modules/unist-util-generated/index.js ***!
  \********************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = generated

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

/***/ "../../node_modules/unist-util-is/convert.js":
/*!***************************************************!*\
  !*** ../../node_modules/unist-util-is/convert.js ***!
  \***************************************************/
/***/ ((module) => {

      "use strict";


      module.exports = convert

      function convert(test) {
        if (test == null) {
          return ok
        }

        if (typeof test === 'string') {
          return typeFactory(test)
        }

        if (typeof test === 'object') {
          return 'length' in test ? anyFactory(test) : allFactory(test)
        }

        if (typeof test === 'function') {
          return test
        }

        throw new Error('Expected function, string, or object as test')
      }

// Utility assert each property in `test` is represented in `node`, and each
// values are strictly equal.
      function allFactory(test) {
        return all

        function all(node) {
          let key

          for (key in test) {
            if (node[key] !== test[key]) return false
          }

          return true
        }
      }

      function anyFactory(tests) {
        const checks = []
        let index = -1

        while (++index < tests.length) {
          checks[index] = convert(tests[index])
        }

        return any

        function any() {
          let index = -1

          while (++index < checks.length) {
            if (checks[index].apply(this, arguments)) {
              return true
            }
          }

          return false
        }
      }

// Utility to convert a string into a function which checks a given node’s type
// for said string.
      function typeFactory(test) {
        return type

        function type(node) {
          return Boolean(node && node.type === test)
        }
      }

// Utility to return true.
      function ok() {
        return true
      }


/***/ }),

/***/ "../../node_modules/unist-util-position/index.js":
/*!*******************************************************!*\
  !*** ../../node_modules/unist-util-position/index.js ***!
  \*******************************************************/
/***/ ((module) => {

      "use strict";


      const start = factory('start')
      const end = factory('end')

      module.exports = position

      position.start = start
      position.end = end

      function position(node) {
        return {start: start(node), end: end(node)}
      }

      function factory(type) {
        point.displayName = type

        return point

        function point(node) {
          const point = (node && node.position && node.position[type]) || {}

          return {
            line: point.line || null,
            column: point.column || null,
            offset: isNaN(point.offset) ? null : point.offset
          }
        }
      }


/***/ }),

/***/ "../../node_modules/unist-util-stringify-position/index.js":
/*!*****************************************************************!*\
  !*** ../../node_modules/unist-util-stringify-position/index.js ***!
  \*****************************************************************/
/***/ ((module) => {

      "use strict";


      const own = {}.hasOwnProperty

      module.exports = stringify

      function stringify(value) {
  // Nothing.
        if (!value || typeof value !== 'object') {
          return ''
        }

  // Node.
        if (own.call(value, 'position') || own.call(value, 'type')) {
          return position(value.position)
        }

  // Position.
        if (own.call(value, 'start') || own.call(value, 'end')) {
          return position(value)
        }

  // Point.
        if (own.call(value, 'line') || own.call(value, 'column')) {
          return point(value)
        }

  // ?
        return ''
      }

      function point(point) {
        if (!point || typeof point !== 'object') {
          point = {}
        }

        return index(point.line) + ':' + index(point.column)
      }

      function position(pos) {
        if (!pos || typeof pos !== 'object') {
          pos = {}
        }

        return point(pos.start) + '-' + point(pos.end)
      }

      function index(value) {
        return value && typeof value === 'number' ? value : 1
      }


/***/ }),

/***/ "../../node_modules/unist-util-visit-parents/color.browser.js":
/*!********************************************************************!*\
  !*** ../../node_modules/unist-util-visit-parents/color.browser.js ***!
  \********************************************************************/
/***/ ((module) => {

      module.exports = identity
      function identity(d) {
        return d
      }


/***/ }),

/***/ "../../node_modules/unist-util-visit-parents/index.js":
/*!************************************************************!*\
  !*** ../../node_modules/unist-util-visit-parents/index.js ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = visitParents

      const convert = __webpack_require__(/*! unist-util-is/convert */ "../../node_modules/unist-util-is/convert.js")
      const color = __webpack_require__(/*! ./color */ "../../node_modules/unist-util-visit-parents/color.browser.js")

      const CONTINUE = true
      const SKIP = 'skip'
      const EXIT = false

      visitParents.CONTINUE = CONTINUE
      visitParents.SKIP = SKIP
      visitParents.EXIT = EXIT

      function visitParents(tree, test, visitor, reverse) {
        let step
        let is

        if (typeof test === 'function' && typeof visitor !== 'function') {
          reverse = visitor
          visitor = test
          test = null
        }

        is = convert(test)
        step = reverse ? -1 : 1

        factory(tree, null, [])()

        function factory(node, index, parents) {
          const value = typeof node === 'object' && node !== null ? node : {}
          let name

          if (typeof value.type === 'string') {
            name =
        typeof value.tagName === 'string'
          ? value.tagName
          : typeof value.name === 'string'
            ? value.name
            : undefined

            visit.displayName =
        'node (' + color(value.type + (name ? '<' + name + '>' : '')) + ')'
          }

          return visit

          function visit() {
            const grandparents = parents.concat(node)
            let result = []
            let subresult
            let offset

            if (!test || is(node, index, parents[parents.length - 1] || null)) {
              result = toResult(visitor(node, parents))

              if (result[0] === EXIT) {
                return result
              }
            }

            if (node.children && result[0] !== SKIP) {
              offset = (reverse ? node.children.length : -1) + step

              while (offset > -1 && offset < node.children.length) {
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

      function toResult(value) {
        if (value !== null && typeof value === 'object' && 'length' in value) {
          return value
        }

        if (typeof value === 'number') {
          return [CONTINUE, value]
        }

        return [value]
      }


/***/ }),

/***/ "../../node_modules/unist-util-visit/index.js":
/*!****************************************************!*\
  !*** ../../node_modules/unist-util-visit/index.js ***!
  \****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = visit

      const visitParents = __webpack_require__(/*! unist-util-visit-parents */ "../../node_modules/unist-util-visit-parents/index.js")

      const CONTINUE = visitParents.CONTINUE
      const SKIP = visitParents.SKIP
      const EXIT = visitParents.EXIT

      visit.CONTINUE = CONTINUE
      visit.SKIP = SKIP
      visit.EXIT = EXIT

      function visit(tree, test, visitor, reverse) {
        if (typeof test === 'function' && typeof visitor !== 'function') {
          reverse = visitor
          visitor = test
          test = null
        }

        visitParents(tree, test, overload, reverse)

        function overload(node, parents) {
          const parent = parents[parents.length - 1]
          const index = parent ? parent.children.indexOf(node) : null
          return visitor(node, index, parent)
        }
      }


/***/ }),

/***/ "../../node_modules/vfile-message/index.js":
/*!*************************************************!*\
  !*** ../../node_modules/vfile-message/index.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const stringify = __webpack_require__(/*! unist-util-stringify-position */ "../../node_modules/unist-util-stringify-position/index.js")

      module.exports = VMessage

// Inherit from `Error#`.
      function VMessagePrototype() {}
      VMessagePrototype.prototype = Error.prototype
      VMessage.prototype = new VMessagePrototype()

// Message properties.
      const proto = VMessage.prototype

      proto.file = ''
      proto.name = ''
      proto.reason = ''
      proto.message = ''
      proto.stack = ''
      proto.fatal = null
      proto.column = null
      proto.line = null

// Construct a new VMessage.
//
// Note: We cannot invoke `Error` on the created context, as that adds readonly
// `line` and `column` attributes on Safari 9, thus throwing and failing the
// data.
      function VMessage(reason, position, origin) {
        let parts
        let range
        let location

        if (typeof position === 'string') {
          origin = position
          position = null
        }

        parts = parseOrigin(origin)
        range = stringify(position) || '1:1'

        location = {
          start: {line: null, column: null},
          end: {line: null, column: null}
        }

  // Node.
        if (position && position.position) {
          position = position.position
        }

        if (position) {
    // Position.
          if (position.start) {
            location = position
            position = position.start
          } else {
      // Point.
            location.start = position
          }
        }

        if (reason.stack) {
          this.stack = reason.stack
          reason = reason.message
        }

        this.message = reason
        this.name = range
        this.reason = reason
        this.line = position ? position.line : null
        this.column = position ? position.column : null
        this.location = location
        this.source = parts[0]
        this.ruleId = parts[1]
      }

      function parseOrigin(origin) {
        const result = [null, null]
        let index

        if (typeof origin === 'string') {
          index = origin.indexOf(':')

          if (index === -1) {
            result[1] = origin
          } else {
            result[0] = origin.slice(0, index)
            result[1] = origin.slice(index + 1)
          }
        }

        return result
      }


/***/ }),

/***/ "../../node_modules/vfile/index.js":
/*!*****************************************!*\
  !*** ../../node_modules/vfile/index.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      module.exports = __webpack_require__(/*! ./lib */ "../../node_modules/vfile/lib/index.js")


/***/ }),

/***/ "../../node_modules/vfile/lib/core.js":
/*!********************************************!*\
  !*** ../../node_modules/vfile/lib/core.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const p = __webpack_require__(/*! ./minpath */ "../../node_modules/vfile/lib/minpath.browser.js")
      const proc = __webpack_require__(/*! ./minproc */ "../../node_modules/vfile/lib/minproc.browser.js")
      const buffer = __webpack_require__(/*! is-buffer */ "../../node_modules/vfile/node_modules/is-buffer/index.js")

      module.exports = VFile

      const own = {}.hasOwnProperty

// Order of setting (least specific to most), we need this because otherwise
// `{stem: 'a', path: '~/b.js'}` would throw, as a path is needed before a
// stem can be set.
      const order = ['history', 'path', 'basename', 'stem', 'extname', 'dirname']

      VFile.prototype.toString = toString

// Access full path (`~/index.min.js`).
      Object.defineProperty(VFile.prototype, 'path', {get: getPath, set: setPath})

// Access parent path (`~`).
      Object.defineProperty(VFile.prototype, 'dirname', {
        get: getDirname,
        set: setDirname
      })

// Access basename (`index.min.js`).
      Object.defineProperty(VFile.prototype, 'basename', {
        get: getBasename,
        set: setBasename
      })

// Access extname (`.js`).
      Object.defineProperty(VFile.prototype, 'extname', {
        get: getExtname,
        set: setExtname
      })

// Access stem (`index.min`).
      Object.defineProperty(VFile.prototype, 'stem', {get: getStem, set: setStem})

// Construct a new file.
      function VFile(options) {
        let prop
        let index

        if (!options) {
          options = {}
        } else if (typeof options === 'string' || buffer(options)) {
          options = {contents: options}
        } else if ('message' in options && 'messages' in options) {
          return options
        }

        if (!(this instanceof VFile)) {
          return new VFile(options)
        }

        this.data = {}
        this.messages = []
        this.history = []
        this.cwd = proc.cwd()

  // Set path related properties in the correct order.
        index = -1

        while (++index < order.length) {
          prop = order[index]

          if (own.call(options, prop)) {
            this[prop] = options[prop]
          }
        }

  // Set non-path related properties.
        for (prop in options) {
          if (order.indexOf(prop) < 0) {
            this[prop] = options[prop]
          }
        }
      }

      function getPath() {
        return this.history[this.history.length - 1]
      }

      function setPath(path) {
        assertNonEmpty(path, 'path')

        if (this.path !== path) {
          this.history.push(path)
        }
      }

      function getDirname() {
        return typeof this.path === 'string' ? p.dirname(this.path) : undefined
      }

      function setDirname(dirname) {
        assertPath(this.path, 'dirname')
        this.path = p.join(dirname || '', this.basename)
      }

      function getBasename() {
        return typeof this.path === 'string' ? p.basename(this.path) : undefined
      }

      function setBasename(basename) {
        assertNonEmpty(basename, 'basename')
        assertPart(basename, 'basename')
        this.path = p.join(this.dirname || '', basename)
      }

      function getExtname() {
        return typeof this.path === 'string' ? p.extname(this.path) : undefined
      }

      function setExtname(extname) {
        assertPart(extname, 'extname')
        assertPath(this.path, 'extname')

        if (extname) {
          if (extname.charCodeAt(0) !== 46 /* `.` */) {
            throw new Error('`extname` must start with `.`')
          }

          if (extname.indexOf('.', 1) > -1) {
            throw new Error('`extname` cannot contain multiple dots')
          }
        }

        this.path = p.join(this.dirname, this.stem + (extname || ''))
      }

      function getStem() {
        return typeof this.path === 'string'
          ? p.basename(this.path, this.extname)
          : undefined
      }

      function setStem(stem) {
        assertNonEmpty(stem, 'stem')
        assertPart(stem, 'stem')
        this.path = p.join(this.dirname || '', stem + (this.extname || ''))
      }

// Get the value of the file.
      function toString(encoding) {
        return (this.contents || '').toString(encoding)
      }

// Assert that `part` is not a path (i.e., does not contain `p.sep`).
      function assertPart(part, name) {
        if (part && part.indexOf(p.sep) > -1) {
          throw new Error(
            '`' + name + '` cannot be a path: did not expect `' + p.sep + '`'
          )
        }
      }

// Assert that `part` is not empty.
      function assertNonEmpty(part, name) {
        if (!part) {
          throw new Error('`' + name + '` cannot be empty')
        }
      }

// Assert `path` exists.
      function assertPath(path, name) {
        if (!path) {
          throw new Error('Setting `' + name + '` requires `path` to be set too')
        }
      }


/***/ }),

/***/ "../../node_modules/vfile/lib/index.js":
/*!*********************************************!*\
  !*** ../../node_modules/vfile/lib/index.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      "use strict";


      const VMessage = __webpack_require__(/*! vfile-message */ "../../node_modules/vfile-message/index.js")
      const VFile = __webpack_require__(/*! ./core.js */ "../../node_modules/vfile/lib/core.js")

      module.exports = VFile

      VFile.prototype.message = message
      VFile.prototype.info = info
      VFile.prototype.fail = fail

// Create a message with `reason` at `position`.
// When an error is passed in as `reason`, copies the stack.
      function message(reason, position, origin) {
        const message = new VMessage(reason, position, origin)

        if (this.path) {
          message.name = this.path + ':' + message.name
          message.file = this.path
        }

        message.fatal = false

        this.messages.push(message)

        return message
      }

// Fail: creates a vmessage, associates it with the file, and throws it.
      function fail() {
        const message = this.message.apply(this, arguments)

        message.fatal = true

        throw message
      }

// Info: creates a vmessage, associates it with the file, and marks the fatality
// as null.
      function info() {
        const message = this.message.apply(this, arguments)

        message.fatal = null

        return message
      }


/***/ }),

/***/ "../../node_modules/vfile/lib/minpath.browser.js":
/*!*******************************************************!*\
  !*** ../../node_modules/vfile/lib/minpath.browser.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, exports) => {

      "use strict";


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

      exports.basename = basename
      exports.dirname = dirname
      exports.extname = extname
      exports.join = join
      exports.sep = '/'

      function basename(path, ext) {
        let start = 0
        let end = -1
        let index
        let firstNonSlashEnd
        let seenNonSlash
        let extIndex

        if (ext !== undefined && typeof ext !== 'string') {
          throw new TypeError('"ext" argument must be a string')
        }

        assertPath(path)
        index = path.length

        if (ext === undefined || !ext.length || ext.length > path.length) {
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

        firstNonSlashEnd = -1
        extIndex = ext.length - 1

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

      function dirname(path) {
        let end
        let unmatchedSlash
        let index

        assertPath(path)

        if (!path.length) {
          return '.'
        }

        end = -1
        index = path.length

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

      function extname(path) {
        let startDot = -1
        let startPart = 0
        let end = -1
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find.
        let preDotState = 0
        let unmatchedSlash
        let code
        let index

        assertPath(path)

        index = path.length

        while (index--) {
          code = path.charCodeAt(index)

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

      function join() {
        let index = -1
        let joined

        while (++index < arguments.length) {
          assertPath(arguments[index])

          if (arguments[index]) {
            joined =
        joined === undefined
          ? arguments[index]
          : joined + '/' + arguments[index]
          }
        }

        return joined === undefined ? '.' : normalize(joined)
      }

// Note: `normalize` is not exposed as `path.normalize`, so some code is
// manually removed from it.
      function normalize(path) {
        let absolute
        let value

        assertPath(path)

        absolute = path.charCodeAt(0) === 47 /* `/` */

  // Normalize the path according to POSIX rules.
        value = normalizeString(path, !absolute)

        if (!value.length && !absolute) {
          value = '.'
        }

        if (value.length && path.charCodeAt(path.length - 1) === 47 /* / */) {
          value += '/'
        }

        return absolute ? '/' + value : value
      }

// Resolve `.` and `..` elements in a path with directory names.
      function normalizeString(path, allowAboveRoot) {
        let result = ''
        let lastSegmentLength = 0
        let lastSlash = -1
        let dots = 0
        let index = -1
        let code
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

            /* istanbul ignore else - No clue how to cover it. */
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
                } else if (result.length) {
                  result = ''
                  lastSegmentLength = 0
                  lastSlash = index
                  dots = 0
                  continue
                }
              }

              if (allowAboveRoot) {
                result = result.length ? result + '/..' : '..'
                lastSegmentLength = 2
              }
            } else {
              if (result.length) {
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

      function assertPath(path) {
        if (typeof path !== 'string') {
          throw new TypeError(
            'Path must be a string. Received ' + JSON.stringify(path)
          )
        }
      }


/***/ }),

/***/ "../../node_modules/vfile/lib/minproc.browser.js":
/*!*******************************************************!*\
  !*** ../../node_modules/vfile/lib/minproc.browser.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, exports) => {

      "use strict";


// Somewhat based on:
// <https://github.com/defunctzombie/node-process/blob/master/browser.js>.
// But I don’t think one tiny line of code can be copyrighted. 😅
      exports.cwd = cwd

      function cwd() {
        return '/'
      }


/***/ }),

/***/ "../../node_modules/vfile/node_modules/is-buffer/index.js":
/*!****************************************************************!*\
  !*** ../../node_modules/vfile/node_modules/is-buffer/index.js ***!
  \****************************************************************/
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

/***/ "../../node_modules/xtend/immutable.js":
/*!*********************************************!*\
  !*** ../../node_modules/xtend/immutable.js ***!
  \*********************************************/
/***/ ((module) => {

      module.exports = extend

      const hasOwnProperty = Object.prototype.hasOwnProperty;

      function extend() {
        const target = {}

        for (let i = 0; i < arguments.length; i++) {
          const source = arguments[i]

          for (const key in source) {
            if (hasOwnProperty.call(source, key)) {
              target[key] = source[key]
            }
          }
        }

        return target
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
      const react_markdown_1 = __importDefault(__webpack_require__(/*! react-markdown */ "../../node_modules/react-markdown/src/react-markdown.js"));
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