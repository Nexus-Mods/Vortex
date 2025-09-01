/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@iarna/toml/lib/create-date.js":
/*!*****************************************************!*\
  !*** ./node_modules/@iarna/toml/lib/create-date.js ***!
  \*****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const f = __webpack_require__(/*! ./format-num.js */ "./node_modules/@iarna/toml/lib/format-num.js")
const DateTime = global.Date

class Date extends DateTime {
  constructor (value) {
    super(value)
    this.isDate = true
  }
  toISOString () {
    return `${this.getUTCFullYear()}-${f(2, this.getUTCMonth() + 1)}-${f(2, this.getUTCDate())}`
  }
}

module.exports = value => {
  const date = new Date(value)
  /* istanbul ignore if */
  if (isNaN(date)) {
    throw new TypeError('Invalid Datetime')
  } else {
    return date
  }
}


/***/ }),

/***/ "./node_modules/@iarna/toml/lib/create-datetime-float.js":
/*!***************************************************************!*\
  !*** ./node_modules/@iarna/toml/lib/create-datetime-float.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const f = __webpack_require__(/*! ./format-num.js */ "./node_modules/@iarna/toml/lib/format-num.js")

class FloatingDateTime extends Date {
  constructor (value) {
    super(value + 'Z')
    this.isFloating = true
  }
  toISOString () {
    const date = `${this.getUTCFullYear()}-${f(2, this.getUTCMonth() + 1)}-${f(2, this.getUTCDate())}`
    const time = `${f(2, this.getUTCHours())}:${f(2, this.getUTCMinutes())}:${f(2, this.getUTCSeconds())}.${f(3, this.getUTCMilliseconds())}`
    return `${date}T${time}`
  }
}

module.exports = value => {
  const date = new FloatingDateTime(value)
  /* istanbul ignore if */
  if (isNaN(date)) {
    throw new TypeError('Invalid Datetime')
  } else {
    return date
  }
}


/***/ }),

/***/ "./node_modules/@iarna/toml/lib/create-datetime.js":
/*!*********************************************************!*\
  !*** ./node_modules/@iarna/toml/lib/create-datetime.js ***!
  \*********************************************************/
/***/ ((module) => {


module.exports = value => {
  const date = new Date(value)
  /* istanbul ignore if */
  if (isNaN(date)) {
    throw new TypeError('Invalid Datetime')
  } else {
    return date
  }
}


/***/ }),

/***/ "./node_modules/@iarna/toml/lib/create-time.js":
/*!*****************************************************!*\
  !*** ./node_modules/@iarna/toml/lib/create-time.js ***!
  \*****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const f = __webpack_require__(/*! ./format-num.js */ "./node_modules/@iarna/toml/lib/format-num.js")

class Time extends Date {
  constructor (value) {
    super(`0000-01-01T${value}Z`)
    this.isTime = true
  }
  toISOString () {
    return `${f(2, this.getUTCHours())}:${f(2, this.getUTCMinutes())}:${f(2, this.getUTCSeconds())}.${f(3, this.getUTCMilliseconds())}`
  }
}

module.exports = value => {
  const date = new Time(value)
  /* istanbul ignore if */
  if (isNaN(date)) {
    throw new TypeError('Invalid Datetime')
  } else {
    return date
  }
}


/***/ }),

/***/ "./node_modules/@iarna/toml/lib/format-num.js":
/*!****************************************************!*\
  !*** ./node_modules/@iarna/toml/lib/format-num.js ***!
  \****************************************************/
/***/ ((module) => {


module.exports = (d, num) => {
  num = String(num)
  while (num.length < d) num = '0' + num
  return num
}


/***/ }),

/***/ "./node_modules/@iarna/toml/lib/parser.js":
/*!************************************************!*\
  !*** ./node_modules/@iarna/toml/lib/parser.js ***!
  \************************************************/
/***/ ((module) => {


const ParserEND = 0x110000
class ParserError extends Error {
  /* istanbul ignore next */
  constructor (msg, filename, linenumber) {
    super('[ParserError] ' + msg, filename, linenumber)
    this.name = 'ParserError'
    this.code = 'ParserError'
    if (Error.captureStackTrace) Error.captureStackTrace(this, ParserError)
  }
}
class State {
  constructor (parser) {
    this.parser = parser
    this.buf = ''
    this.returned = null
    this.result = null
    this.resultTable = null
    this.resultArr = null
  }
}
class Parser {
  constructor () {
    this.pos = 0
    this.col = 0
    this.line = 0
    this.obj = {}
    this.ctx = this.obj
    this.stack = []
    this._buf = ''
    this.char = null
    this.ii = 0
    this.state = new State(this.parseStart)
  }

  parse (str) {
    /* istanbul ignore next */
    if (str.length === 0 || str.length == null) return

    this._buf = String(str)
    this.ii = -1
    this.char = -1
    let getNext
    while (getNext === false || this.nextChar()) {
      getNext = this.runOne()
    }
    this._buf = null
  }
  nextChar () {
    if (this.char === 0x0A) {
      ++this.line
      this.col = -1
    }
    ++this.ii
    this.char = this._buf.codePointAt(this.ii)
    ++this.pos
    ++this.col
    return this.haveBuffer()
  }
  haveBuffer () {
    return this.ii < this._buf.length
  }
  runOne () {
    return this.state.parser.call(this, this.state.returned)
  }
  finish () {
    this.char = ParserEND
    let last
    do {
      last = this.state.parser
      this.runOne()
    } while (this.state.parser !== last)

    this.ctx = null
    this.state = null
    this._buf = null

    return this.obj
  }
  next (fn) {
    /* istanbul ignore next */
    if (typeof fn !== 'function') throw new ParserError('Tried to set state to non-existent state: ' + JSON.stringify(fn))
    this.state.parser = fn
  }
  goto (fn) {
    this.next(fn)
    return this.runOne()
  }
  call (fn, returnWith) {
    if (returnWith) this.next(returnWith)
    this.stack.push(this.state)
    this.state = new State(fn)
  }
  callNow (fn, returnWith) {
    this.call(fn, returnWith)
    return this.runOne()
  }
  return (value) {
    /* istanbul ignore next */
    if (this.stack.length === 0) throw this.error(new ParserError('Stack underflow'))
    if (value === undefined) value = this.state.buf
    this.state = this.stack.pop()
    this.state.returned = value
  }
  returnNow (value) {
    this.return(value)
    return this.runOne()
  }
  consume () {
    /* istanbul ignore next */
    if (this.char === ParserEND) throw this.error(new ParserError('Unexpected end-of-buffer'))
    this.state.buf += this._buf[this.ii]
  }
  error (err) {
    err.line = this.line
    err.col = this.col
    err.pos = this.pos
    return err
  }
  /* istanbul ignore next */
  parseStart () {
    throw new ParserError('Must declare a parseStart method')
  }
}
Parser.END = ParserEND
Parser.Error = ParserError
module.exports = Parser


/***/ }),

/***/ "./node_modules/@iarna/toml/lib/toml-parser.js":
/*!*****************************************************!*\
  !*** ./node_modules/@iarna/toml/lib/toml-parser.js ***!
  \*****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


/* eslint-disable no-new-wrappers, no-eval, camelcase, operator-linebreak */
module.exports = makeParserClass(__webpack_require__(/*! ./parser.js */ "./node_modules/@iarna/toml/lib/parser.js"))
module.exports.makeParserClass = makeParserClass

class TomlError extends Error {
  constructor (msg) {
    super(msg)
    this.name = 'TomlError'
    /* istanbul ignore next */
    if (Error.captureStackTrace) Error.captureStackTrace(this, TomlError)
    this.fromTOML = true
    this.wrapped = null
  }
}
TomlError.wrap = err => {
  const terr = new TomlError(err.message)
  terr.code = err.code
  terr.wrapped = err
  return terr
}
module.exports.TomlError = TomlError

const createDateTime = __webpack_require__(/*! ./create-datetime.js */ "./node_modules/@iarna/toml/lib/create-datetime.js")
const createDateTimeFloat = __webpack_require__(/*! ./create-datetime-float.js */ "./node_modules/@iarna/toml/lib/create-datetime-float.js")
const createDate = __webpack_require__(/*! ./create-date.js */ "./node_modules/@iarna/toml/lib/create-date.js")
const createTime = __webpack_require__(/*! ./create-time.js */ "./node_modules/@iarna/toml/lib/create-time.js")

const CTRL_I = 0x09
const CTRL_J = 0x0A
const CTRL_M = 0x0D
const CTRL_CHAR_BOUNDARY = 0x1F // the last non-character in the latin1 region of unicode, except DEL
const CHAR_SP = 0x20
const CHAR_QUOT = 0x22
const CHAR_NUM = 0x23
const CHAR_APOS = 0x27
const CHAR_PLUS = 0x2B
const CHAR_COMMA = 0x2C
const CHAR_HYPHEN = 0x2D
const CHAR_PERIOD = 0x2E
const CHAR_0 = 0x30
const CHAR_1 = 0x31
const CHAR_7 = 0x37
const CHAR_9 = 0x39
const CHAR_COLON = 0x3A
const CHAR_EQUALS = 0x3D
const CHAR_A = 0x41
const CHAR_E = 0x45
const CHAR_F = 0x46
const CHAR_T = 0x54
const CHAR_U = 0x55
const CHAR_Z = 0x5A
const CHAR_LOWBAR = 0x5F
const CHAR_a = 0x61
const CHAR_b = 0x62
const CHAR_e = 0x65
const CHAR_f = 0x66
const CHAR_i = 0x69
const CHAR_l = 0x6C
const CHAR_n = 0x6E
const CHAR_o = 0x6F
const CHAR_r = 0x72
const CHAR_s = 0x73
const CHAR_t = 0x74
const CHAR_u = 0x75
const CHAR_x = 0x78
const CHAR_z = 0x7A
const CHAR_LCUB = 0x7B
const CHAR_RCUB = 0x7D
const CHAR_LSQB = 0x5B
const CHAR_BSOL = 0x5C
const CHAR_RSQB = 0x5D
const CHAR_DEL = 0x7F
const SURROGATE_FIRST = 0xD800
const SURROGATE_LAST = 0xDFFF

const escapes = {
  [CHAR_b]: '\u0008',
  [CHAR_t]: '\u0009',
  [CHAR_n]: '\u000A',
  [CHAR_f]: '\u000C',
  [CHAR_r]: '\u000D',
  [CHAR_QUOT]: '\u0022',
  [CHAR_BSOL]: '\u005C'
}

function isDigit (cp) {
  return cp >= CHAR_0 && cp <= CHAR_9
}
function isHexit (cp) {
  return (cp >= CHAR_A && cp <= CHAR_F) || (cp >= CHAR_a && cp <= CHAR_f) || (cp >= CHAR_0 && cp <= CHAR_9)
}
function isBit (cp) {
  return cp === CHAR_1 || cp === CHAR_0
}
function isOctit (cp) {
  return (cp >= CHAR_0 && cp <= CHAR_7)
}
function isAlphaNumQuoteHyphen (cp) {
  return (cp >= CHAR_A && cp <= CHAR_Z)
      || (cp >= CHAR_a && cp <= CHAR_z)
      || (cp >= CHAR_0 && cp <= CHAR_9)
      || cp === CHAR_APOS
      || cp === CHAR_QUOT
      || cp === CHAR_LOWBAR
      || cp === CHAR_HYPHEN
}
function isAlphaNumHyphen (cp) {
  return (cp >= CHAR_A && cp <= CHAR_Z)
      || (cp >= CHAR_a && cp <= CHAR_z)
      || (cp >= CHAR_0 && cp <= CHAR_9)
      || cp === CHAR_LOWBAR
      || cp === CHAR_HYPHEN
}
const _type = Symbol('type')
const _declared = Symbol('declared')

const hasOwnProperty = Object.prototype.hasOwnProperty
const defineProperty = Object.defineProperty
const descriptor = {configurable: true, enumerable: true, writable: true, value: undefined}

function hasKey (obj, key) {
  if (hasOwnProperty.call(obj, key)) return true
  if (key === '__proto__') defineProperty(obj, '__proto__', descriptor)
  return false
}

const INLINE_TABLE = Symbol('inline-table')
function InlineTable () {
  return Object.defineProperties({}, {
    [_type]: {value: INLINE_TABLE}
  })
}
function isInlineTable (obj) {
  if (obj === null || typeof (obj) !== 'object') return false
  return obj[_type] === INLINE_TABLE
}

const TABLE = Symbol('table')
function Table () {
  return Object.defineProperties({}, {
    [_type]: {value: TABLE},
    [_declared]: {value: false, writable: true}
  })
}
function isTable (obj) {
  if (obj === null || typeof (obj) !== 'object') return false
  return obj[_type] === TABLE
}

const _contentType = Symbol('content-type')
const INLINE_LIST = Symbol('inline-list')
function InlineList (type) {
  return Object.defineProperties([], {
    [_type]: {value: INLINE_LIST},
    [_contentType]: {value: type}
  })
}
function isInlineList (obj) {
  if (obj === null || typeof (obj) !== 'object') return false
  return obj[_type] === INLINE_LIST
}

const LIST = Symbol('list')
function List () {
  return Object.defineProperties([], {
    [_type]: {value: LIST}
  })
}
function isList (obj) {
  if (obj === null || typeof (obj) !== 'object') return false
  return obj[_type] === LIST
}

// in an eval, to let bundlers not slurp in a util proxy
let _custom
try {
  const utilInspect = eval("require('util').inspect")
  _custom = utilInspect.custom
} catch (_) {
  /* eval require not available in transpiled bundle */
}
/* istanbul ignore next */
const _inspect = _custom || 'inspect'

class BoxedBigInt {
  constructor (value) {
    try {
      this.value = global.BigInt.asIntN(64, value)
    } catch (_) {
      /* istanbul ignore next */
      this.value = null
    }
    Object.defineProperty(this, _type, {value: INTEGER})
  }
  isNaN () {
    return this.value === null
  }
  /* istanbul ignore next */
  toString () {
    return String(this.value)
  }
  /* istanbul ignore next */
  [_inspect] () {
    return `[BigInt: ${this.toString()}]}`
  }
  valueOf () {
    return this.value
  }
}

const INTEGER = Symbol('integer')
function Integer (value) {
  let num = Number(value)
  // -0 is a float thing, not an int thing
  if (Object.is(num, -0)) num = 0
  /* istanbul ignore else */
  if (global.BigInt && !Number.isSafeInteger(num)) {
    return new BoxedBigInt(value)
  } else {
    /* istanbul ignore next */
    return Object.defineProperties(new Number(num), {
      isNaN: {value: function () { return isNaN(this) }},
      [_type]: {value: INTEGER},
      [_inspect]: {value: () => `[Integer: ${value}]`}
    })
  }
}
function isInteger (obj) {
  if (obj === null || typeof (obj) !== 'object') return false
  return obj[_type] === INTEGER
}

const FLOAT = Symbol('float')
function Float (value) {
  /* istanbul ignore next */
  return Object.defineProperties(new Number(value), {
    [_type]: {value: FLOAT},
    [_inspect]: {value: () => `[Float: ${value}]`}
  })
}
function isFloat (obj) {
  if (obj === null || typeof (obj) !== 'object') return false
  return obj[_type] === FLOAT
}

function tomlType (value) {
  const type = typeof value
  if (type === 'object') {
    /* istanbul ignore if */
    if (value === null) return 'null'
    if (value instanceof Date) return 'datetime'
    /* istanbul ignore else */
    if (_type in value) {
      switch (value[_type]) {
        case INLINE_TABLE: return 'inline-table'
        case INLINE_LIST: return 'inline-list'
        /* istanbul ignore next */
        case TABLE: return 'table'
        /* istanbul ignore next */
        case LIST: return 'list'
        case FLOAT: return 'float'
        case INTEGER: return 'integer'
      }
    }
  }
  return type
}

function makeParserClass (Parser) {
  class TOMLParser extends Parser {
    constructor () {
      super()
      this.ctx = this.obj = Table()
    }

    /* MATCH HELPER */
    atEndOfWord () {
      return this.char === CHAR_NUM || this.char === CTRL_I || this.char === CHAR_SP || this.atEndOfLine()
    }
    atEndOfLine () {
      return this.char === Parser.END || this.char === CTRL_J || this.char === CTRL_M
    }

    parseStart () {
      if (this.char === Parser.END) {
        return null
      } else if (this.char === CHAR_LSQB) {
        return this.call(this.parseTableOrList)
      } else if (this.char === CHAR_NUM) {
        return this.call(this.parseComment)
      } else if (this.char === CTRL_J || this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M) {
        return null
      } else if (isAlphaNumQuoteHyphen(this.char)) {
        return this.callNow(this.parseAssignStatement)
      } else {
        throw this.error(new TomlError(`Unknown character "${this.char}"`))
      }
    }

    // HELPER, this strips any whitespace and comments to the end of the line
    // then RETURNS. Last state in a production.
    parseWhitespaceToEOL () {
      if (this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M) {
        return null
      } else if (this.char === CHAR_NUM) {
        return this.goto(this.parseComment)
      } else if (this.char === Parser.END || this.char === CTRL_J) {
        return this.return()
      } else {
        throw this.error(new TomlError('Unexpected character, expected only whitespace or comments till end of line'))
      }
    }

    /* ASSIGNMENT: key = value */
    parseAssignStatement () {
      return this.callNow(this.parseAssign, this.recordAssignStatement)
    }
    recordAssignStatement (kv) {
      let target = this.ctx
      let finalKey = kv.key.pop()
      for (let kw of kv.key) {
        if (hasKey(target, kw) && (!isTable(target[kw]) || target[kw][_declared])) {
          throw this.error(new TomlError("Can't redefine existing key"))
        }
        target = target[kw] = target[kw] || Table()
      }
      if (hasKey(target, finalKey)) {
        throw this.error(new TomlError("Can't redefine existing key"))
      }
      // unbox our numbers
      if (isInteger(kv.value) || isFloat(kv.value)) {
        target[finalKey] = kv.value.valueOf()
      } else {
        target[finalKey] = kv.value
      }
      return this.goto(this.parseWhitespaceToEOL)
    }

    /* ASSSIGNMENT expression, key = value possibly inside an inline table */
    parseAssign () {
      return this.callNow(this.parseKeyword, this.recordAssignKeyword)
    }
    recordAssignKeyword (key) {
      if (this.state.resultTable) {
        this.state.resultTable.push(key)
      } else {
        this.state.resultTable = [key]
      }
      return this.goto(this.parseAssignKeywordPreDot)
    }
    parseAssignKeywordPreDot () {
      if (this.char === CHAR_PERIOD) {
        return this.next(this.parseAssignKeywordPostDot)
      } else if (this.char !== CHAR_SP && this.char !== CTRL_I) {
        return this.goto(this.parseAssignEqual)
      }
    }
    parseAssignKeywordPostDot () {
      if (this.char !== CHAR_SP && this.char !== CTRL_I) {
        return this.callNow(this.parseKeyword, this.recordAssignKeyword)
      }
    }

    parseAssignEqual () {
      if (this.char === CHAR_EQUALS) {
        return this.next(this.parseAssignPreValue)
      } else {
        throw this.error(new TomlError('Invalid character, expected "="'))
      }
    }
    parseAssignPreValue () {
      if (this.char === CHAR_SP || this.char === CTRL_I) {
        return null
      } else {
        return this.callNow(this.parseValue, this.recordAssignValue)
      }
    }
    recordAssignValue (value) {
      return this.returnNow({key: this.state.resultTable, value: value})
    }

    /* COMMENTS: #...eol */
    parseComment () {
      do {
        if (this.char === Parser.END || this.char === CTRL_J) {
          return this.return()
        }
      } while (this.nextChar())
    }

    /* TABLES AND LISTS, [foo] and [[foo]] */
    parseTableOrList () {
      if (this.char === CHAR_LSQB) {
        this.next(this.parseList)
      } else {
        return this.goto(this.parseTable)
      }
    }

    /* TABLE [foo.bar.baz] */
    parseTable () {
      this.ctx = this.obj
      return this.goto(this.parseTableNext)
    }
    parseTableNext () {
      if (this.char === CHAR_SP || this.char === CTRL_I) {
        return null
      } else {
        return this.callNow(this.parseKeyword, this.parseTableMore)
      }
    }
    parseTableMore (keyword) {
      if (this.char === CHAR_SP || this.char === CTRL_I) {
        return null
      } else if (this.char === CHAR_RSQB) {
        if (hasKey(this.ctx, keyword) && (!isTable(this.ctx[keyword]) || this.ctx[keyword][_declared])) {
          throw this.error(new TomlError("Can't redefine existing key"))
        } else {
          this.ctx = this.ctx[keyword] = this.ctx[keyword] || Table()
          this.ctx[_declared] = true
        }
        return this.next(this.parseWhitespaceToEOL)
      } else if (this.char === CHAR_PERIOD) {
        if (!hasKey(this.ctx, keyword)) {
          this.ctx = this.ctx[keyword] = Table()
        } else if (isTable(this.ctx[keyword])) {
          this.ctx = this.ctx[keyword]
        } else if (isList(this.ctx[keyword])) {
          this.ctx = this.ctx[keyword][this.ctx[keyword].length - 1]
        } else {
          throw this.error(new TomlError("Can't redefine existing key"))
        }
        return this.next(this.parseTableNext)
      } else {
        throw this.error(new TomlError('Unexpected character, expected whitespace, . or ]'))
      }
    }

    /* LIST [[a.b.c]] */
    parseList () {
      this.ctx = this.obj
      return this.goto(this.parseListNext)
    }
    parseListNext () {
      if (this.char === CHAR_SP || this.char === CTRL_I) {
        return null
      } else {
        return this.callNow(this.parseKeyword, this.parseListMore)
      }
    }
    parseListMore (keyword) {
      if (this.char === CHAR_SP || this.char === CTRL_I) {
        return null
      } else if (this.char === CHAR_RSQB) {
        if (!hasKey(this.ctx, keyword)) {
          this.ctx[keyword] = List()
        }
        if (isInlineList(this.ctx[keyword])) {
          throw this.error(new TomlError("Can't extend an inline array"))
        } else if (isList(this.ctx[keyword])) {
          const next = Table()
          this.ctx[keyword].push(next)
          this.ctx = next
        } else {
          throw this.error(new TomlError("Can't redefine an existing key"))
        }
        return this.next(this.parseListEnd)
      } else if (this.char === CHAR_PERIOD) {
        if (!hasKey(this.ctx, keyword)) {
          this.ctx = this.ctx[keyword] = Table()
        } else if (isInlineList(this.ctx[keyword])) {
          throw this.error(new TomlError("Can't extend an inline array"))
        } else if (isInlineTable(this.ctx[keyword])) {
          throw this.error(new TomlError("Can't extend an inline table"))
        } else if (isList(this.ctx[keyword])) {
          this.ctx = this.ctx[keyword][this.ctx[keyword].length - 1]
        } else if (isTable(this.ctx[keyword])) {
          this.ctx = this.ctx[keyword]
        } else {
          throw this.error(new TomlError("Can't redefine an existing key"))
        }
        return this.next(this.parseListNext)
      } else {
        throw this.error(new TomlError('Unexpected character, expected whitespace, . or ]'))
      }
    }
    parseListEnd (keyword) {
      if (this.char === CHAR_RSQB) {
        return this.next(this.parseWhitespaceToEOL)
      } else {
        throw this.error(new TomlError('Unexpected character, expected whitespace, . or ]'))
      }
    }

    /* VALUE string, number, boolean, inline list, inline object */
    parseValue () {
      if (this.char === Parser.END) {
        throw this.error(new TomlError('Key without value'))
      } else if (this.char === CHAR_QUOT) {
        return this.next(this.parseDoubleString)
      } if (this.char === CHAR_APOS) {
        return this.next(this.parseSingleString)
      } else if (this.char === CHAR_HYPHEN || this.char === CHAR_PLUS) {
        return this.goto(this.parseNumberSign)
      } else if (this.char === CHAR_i) {
        return this.next(this.parseInf)
      } else if (this.char === CHAR_n) {
        return this.next(this.parseNan)
      } else if (isDigit(this.char)) {
        return this.goto(this.parseNumberOrDateTime)
      } else if (this.char === CHAR_t || this.char === CHAR_f) {
        return this.goto(this.parseBoolean)
      } else if (this.char === CHAR_LSQB) {
        return this.call(this.parseInlineList, this.recordValue)
      } else if (this.char === CHAR_LCUB) {
        return this.call(this.parseInlineTable, this.recordValue)
      } else {
        throw this.error(new TomlError('Unexpected character, expecting string, number, datetime, boolean, inline array or inline table'))
      }
    }
    recordValue (value) {
      return this.returnNow(value)
    }

    parseInf () {
      if (this.char === CHAR_n) {
        return this.next(this.parseInf2)
      } else {
        throw this.error(new TomlError('Unexpected character, expected "inf", "+inf" or "-inf"'))
      }
    }
    parseInf2 () {
      if (this.char === CHAR_f) {
        if (this.state.buf === '-') {
          return this.return(-Infinity)
        } else {
          return this.return(Infinity)
        }
      } else {
        throw this.error(new TomlError('Unexpected character, expected "inf", "+inf" or "-inf"'))
      }
    }

    parseNan () {
      if (this.char === CHAR_a) {
        return this.next(this.parseNan2)
      } else {
        throw this.error(new TomlError('Unexpected character, expected "nan"'))
      }
    }
    parseNan2 () {
      if (this.char === CHAR_n) {
        return this.return(NaN)
      } else {
        throw this.error(new TomlError('Unexpected character, expected "nan"'))
      }
    }

    /* KEYS, barewords or basic, literal, or dotted */
    parseKeyword () {
      if (this.char === CHAR_QUOT) {
        return this.next(this.parseBasicString)
      } else if (this.char === CHAR_APOS) {
        return this.next(this.parseLiteralString)
      } else {
        return this.goto(this.parseBareKey)
      }
    }

    /* KEYS: barewords */
    parseBareKey () {
      do {
        if (this.char === Parser.END) {
          throw this.error(new TomlError('Key ended without value'))
        } else if (isAlphaNumHyphen(this.char)) {
          this.consume()
        } else if (this.state.buf.length === 0) {
          throw this.error(new TomlError('Empty bare keys are not allowed'))
        } else {
          return this.returnNow()
        }
      } while (this.nextChar())
    }

    /* STRINGS, single quoted (literal) */
    parseSingleString () {
      if (this.char === CHAR_APOS) {
        return this.next(this.parseLiteralMultiStringMaybe)
      } else {
        return this.goto(this.parseLiteralString)
      }
    }
    parseLiteralString () {
      do {
        if (this.char === CHAR_APOS) {
          return this.return()
        } else if (this.atEndOfLine()) {
          throw this.error(new TomlError('Unterminated string'))
        } else if (this.char === CHAR_DEL || (this.char <= CTRL_CHAR_BOUNDARY && this.char !== CTRL_I)) {
          throw this.errorControlCharInString()
        } else {
          this.consume()
        }
      } while (this.nextChar())
    }
    parseLiteralMultiStringMaybe () {
      if (this.char === CHAR_APOS) {
        return this.next(this.parseLiteralMultiString)
      } else {
        return this.returnNow()
      }
    }
    parseLiteralMultiString () {
      if (this.char === CTRL_M) {
        return null
      } else if (this.char === CTRL_J) {
        return this.next(this.parseLiteralMultiStringContent)
      } else {
        return this.goto(this.parseLiteralMultiStringContent)
      }
    }
    parseLiteralMultiStringContent () {
      do {
        if (this.char === CHAR_APOS) {
          return this.next(this.parseLiteralMultiEnd)
        } else if (this.char === Parser.END) {
          throw this.error(new TomlError('Unterminated multi-line string'))
        } else if (this.char === CHAR_DEL || (this.char <= CTRL_CHAR_BOUNDARY && this.char !== CTRL_I && this.char !== CTRL_J && this.char !== CTRL_M)) {
          throw this.errorControlCharInString()
        } else {
          this.consume()
        }
      } while (this.nextChar())
    }
    parseLiteralMultiEnd () {
      if (this.char === CHAR_APOS) {
        return this.next(this.parseLiteralMultiEnd2)
      } else {
        this.state.buf += "'"
        return this.goto(this.parseLiteralMultiStringContent)
      }
    }
    parseLiteralMultiEnd2 () {
      if (this.char === CHAR_APOS) {
        return this.return()
      } else {
        this.state.buf += "''"
        return this.goto(this.parseLiteralMultiStringContent)
      }
    }

    /* STRINGS double quoted */
    parseDoubleString () {
      if (this.char === CHAR_QUOT) {
        return this.next(this.parseMultiStringMaybe)
      } else {
        return this.goto(this.parseBasicString)
      }
    }
    parseBasicString () {
      do {
        if (this.char === CHAR_BSOL) {
          return this.call(this.parseEscape, this.recordEscapeReplacement)
        } else if (this.char === CHAR_QUOT) {
          return this.return()
        } else if (this.atEndOfLine()) {
          throw this.error(new TomlError('Unterminated string'))
        } else if (this.char === CHAR_DEL || (this.char <= CTRL_CHAR_BOUNDARY && this.char !== CTRL_I)) {
          throw this.errorControlCharInString()
        } else {
          this.consume()
        }
      } while (this.nextChar())
    }
    recordEscapeReplacement (replacement) {
      this.state.buf += replacement
      return this.goto(this.parseBasicString)
    }
    parseMultiStringMaybe () {
      if (this.char === CHAR_QUOT) {
        return this.next(this.parseMultiString)
      } else {
        return this.returnNow()
      }
    }
    parseMultiString () {
      if (this.char === CTRL_M) {
        return null
      } else if (this.char === CTRL_J) {
        return this.next(this.parseMultiStringContent)
      } else {
        return this.goto(this.parseMultiStringContent)
      }
    }
    parseMultiStringContent () {
      do {
        if (this.char === CHAR_BSOL) {
          return this.call(this.parseMultiEscape, this.recordMultiEscapeReplacement)
        } else if (this.char === CHAR_QUOT) {
          return this.next(this.parseMultiEnd)
        } else if (this.char === Parser.END) {
          throw this.error(new TomlError('Unterminated multi-line string'))
        } else if (this.char === CHAR_DEL || (this.char <= CTRL_CHAR_BOUNDARY && this.char !== CTRL_I && this.char !== CTRL_J && this.char !== CTRL_M)) {
          throw this.errorControlCharInString()
        } else {
          this.consume()
        }
      } while (this.nextChar())
    }
    errorControlCharInString () {
      let displayCode = '\\u00'
      if (this.char < 16) {
        displayCode += '0'
      }
      displayCode += this.char.toString(16)

      return this.error(new TomlError(`Control characters (codes < 0x1f and 0x7f) are not allowed in strings, use ${displayCode} instead`))
    }
    recordMultiEscapeReplacement (replacement) {
      this.state.buf += replacement
      return this.goto(this.parseMultiStringContent)
    }
    parseMultiEnd () {
      if (this.char === CHAR_QUOT) {
        return this.next(this.parseMultiEnd2)
      } else {
        this.state.buf += '"'
        return this.goto(this.parseMultiStringContent)
      }
    }
    parseMultiEnd2 () {
      if (this.char === CHAR_QUOT) {
        return this.return()
      } else {
        this.state.buf += '""'
        return this.goto(this.parseMultiStringContent)
      }
    }
    parseMultiEscape () {
      if (this.char === CTRL_M || this.char === CTRL_J) {
        return this.next(this.parseMultiTrim)
      } else if (this.char === CHAR_SP || this.char === CTRL_I) {
        return this.next(this.parsePreMultiTrim)
      } else {
        return this.goto(this.parseEscape)
      }
    }
    parsePreMultiTrim () {
      if (this.char === CHAR_SP || this.char === CTRL_I) {
        return null
      } else if (this.char === CTRL_M || this.char === CTRL_J) {
        return this.next(this.parseMultiTrim)
      } else {
        throw this.error(new TomlError("Can't escape whitespace"))
      }
    }
    parseMultiTrim () {
      // explicitly whitespace here, END should follow the same path as chars
      if (this.char === CTRL_J || this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M) {
        return null
      } else {
        return this.returnNow()
      }
    }
    parseEscape () {
      if (this.char in escapes) {
        return this.return(escapes[this.char])
      } else if (this.char === CHAR_u) {
        return this.call(this.parseSmallUnicode, this.parseUnicodeReturn)
      } else if (this.char === CHAR_U) {
        return this.call(this.parseLargeUnicode, this.parseUnicodeReturn)
      } else {
        throw this.error(new TomlError('Unknown escape character: ' + this.char))
      }
    }
    parseUnicodeReturn (char) {
      try {
        const codePoint = parseInt(char, 16)
        if (codePoint >= SURROGATE_FIRST && codePoint <= SURROGATE_LAST) {
          throw this.error(new TomlError('Invalid unicode, character in range 0xD800 - 0xDFFF is reserved'))
        }
        return this.returnNow(String.fromCodePoint(codePoint))
      } catch (err) {
        throw this.error(TomlError.wrap(err))
      }
    }
    parseSmallUnicode () {
      if (!isHexit(this.char)) {
        throw this.error(new TomlError('Invalid character in unicode sequence, expected hex'))
      } else {
        this.consume()
        if (this.state.buf.length >= 4) return this.return()
      }
    }
    parseLargeUnicode () {
      if (!isHexit(this.char)) {
        throw this.error(new TomlError('Invalid character in unicode sequence, expected hex'))
      } else {
        this.consume()
        if (this.state.buf.length >= 8) return this.return()
      }
    }

    /* NUMBERS */
    parseNumberSign () {
      this.consume()
      return this.next(this.parseMaybeSignedInfOrNan)
    }
    parseMaybeSignedInfOrNan () {
      if (this.char === CHAR_i) {
        return this.next(this.parseInf)
      } else if (this.char === CHAR_n) {
        return this.next(this.parseNan)
      } else {
        return this.callNow(this.parseNoUnder, this.parseNumberIntegerStart)
      }
    }
    parseNumberIntegerStart () {
      if (this.char === CHAR_0) {
        this.consume()
        return this.next(this.parseNumberIntegerExponentOrDecimal)
      } else {
        return this.goto(this.parseNumberInteger)
      }
    }
    parseNumberIntegerExponentOrDecimal () {
      if (this.char === CHAR_PERIOD) {
        this.consume()
        return this.call(this.parseNoUnder, this.parseNumberFloat)
      } else if (this.char === CHAR_E || this.char === CHAR_e) {
        this.consume()
        return this.next(this.parseNumberExponentSign)
      } else {
        return this.returnNow(Integer(this.state.buf))
      }
    }
    parseNumberInteger () {
      if (isDigit(this.char)) {
        this.consume()
      } else if (this.char === CHAR_LOWBAR) {
        return this.call(this.parseNoUnder)
      } else if (this.char === CHAR_E || this.char === CHAR_e) {
        this.consume()
        return this.next(this.parseNumberExponentSign)
      } else if (this.char === CHAR_PERIOD) {
        this.consume()
        return this.call(this.parseNoUnder, this.parseNumberFloat)
      } else {
        const result = Integer(this.state.buf)
        /* istanbul ignore if */
        if (result.isNaN()) {
          throw this.error(new TomlError('Invalid number'))
        } else {
          return this.returnNow(result)
        }
      }
    }
    parseNoUnder () {
      if (this.char === CHAR_LOWBAR || this.char === CHAR_PERIOD || this.char === CHAR_E || this.char === CHAR_e) {
        throw this.error(new TomlError('Unexpected character, expected digit'))
      } else if (this.atEndOfWord()) {
        throw this.error(new TomlError('Incomplete number'))
      }
      return this.returnNow()
    }
    parseNoUnderHexOctBinLiteral () {
      if (this.char === CHAR_LOWBAR || this.char === CHAR_PERIOD) {
        throw this.error(new TomlError('Unexpected character, expected digit'))
      } else if (this.atEndOfWord()) {
        throw this.error(new TomlError('Incomplete number'))
      }
      return this.returnNow()
    }
    parseNumberFloat () {
      if (this.char === CHAR_LOWBAR) {
        return this.call(this.parseNoUnder, this.parseNumberFloat)
      } else if (isDigit(this.char)) {
        this.consume()
      } else if (this.char === CHAR_E || this.char === CHAR_e) {
        this.consume()
        return this.next(this.parseNumberExponentSign)
      } else {
        return this.returnNow(Float(this.state.buf))
      }
    }
    parseNumberExponentSign () {
      if (isDigit(this.char)) {
        return this.goto(this.parseNumberExponent)
      } else if (this.char === CHAR_HYPHEN || this.char === CHAR_PLUS) {
        this.consume()
        this.call(this.parseNoUnder, this.parseNumberExponent)
      } else {
        throw this.error(new TomlError('Unexpected character, expected -, + or digit'))
      }
    }
    parseNumberExponent () {
      if (isDigit(this.char)) {
        this.consume()
      } else if (this.char === CHAR_LOWBAR) {
        return this.call(this.parseNoUnder)
      } else {
        return this.returnNow(Float(this.state.buf))
      }
    }

    /* NUMBERS or DATETIMES  */
    parseNumberOrDateTime () {
      if (this.char === CHAR_0) {
        this.consume()
        return this.next(this.parseNumberBaseOrDateTime)
      } else {
        return this.goto(this.parseNumberOrDateTimeOnly)
      }
    }
    parseNumberOrDateTimeOnly () {
      // note, if two zeros are in a row then it MUST be a date
      if (this.char === CHAR_LOWBAR) {
        return this.call(this.parseNoUnder, this.parseNumberInteger)
      } else if (isDigit(this.char)) {
        this.consume()
        if (this.state.buf.length > 4) this.next(this.parseNumberInteger)
      } else if (this.char === CHAR_E || this.char === CHAR_e) {
        this.consume()
        return this.next(this.parseNumberExponentSign)
      } else if (this.char === CHAR_PERIOD) {
        this.consume()
        return this.call(this.parseNoUnder, this.parseNumberFloat)
      } else if (this.char === CHAR_HYPHEN) {
        return this.goto(this.parseDateTime)
      } else if (this.char === CHAR_COLON) {
        return this.goto(this.parseOnlyTimeHour)
      } else {
        return this.returnNow(Integer(this.state.buf))
      }
    }
    parseDateTimeOnly () {
      if (this.state.buf.length < 4) {
        if (isDigit(this.char)) {
          return this.consume()
        } else if (this.char === CHAR_COLON) {
          return this.goto(this.parseOnlyTimeHour)
        } else {
          throw this.error(new TomlError('Expected digit while parsing year part of a date'))
        }
      } else {
        if (this.char === CHAR_HYPHEN) {
          return this.goto(this.parseDateTime)
        } else {
          throw this.error(new TomlError('Expected hyphen (-) while parsing year part of date'))
        }
      }
    }
    parseNumberBaseOrDateTime () {
      if (this.char === CHAR_b) {
        this.consume()
        return this.call(this.parseNoUnderHexOctBinLiteral, this.parseIntegerBin)
      } else if (this.char === CHAR_o) {
        this.consume()
        return this.call(this.parseNoUnderHexOctBinLiteral, this.parseIntegerOct)
      } else if (this.char === CHAR_x) {
        this.consume()
        return this.call(this.parseNoUnderHexOctBinLiteral, this.parseIntegerHex)
      } else if (this.char === CHAR_PERIOD) {
        return this.goto(this.parseNumberInteger)
      } else if (isDigit(this.char)) {
        return this.goto(this.parseDateTimeOnly)
      } else {
        return this.returnNow(Integer(this.state.buf))
      }
    }
    parseIntegerHex () {
      if (isHexit(this.char)) {
        this.consume()
      } else if (this.char === CHAR_LOWBAR) {
        return this.call(this.parseNoUnderHexOctBinLiteral)
      } else {
        const result = Integer(this.state.buf)
        /* istanbul ignore if */
        if (result.isNaN()) {
          throw this.error(new TomlError('Invalid number'))
        } else {
          return this.returnNow(result)
        }
      }
    }
    parseIntegerOct () {
      if (isOctit(this.char)) {
        this.consume()
      } else if (this.char === CHAR_LOWBAR) {
        return this.call(this.parseNoUnderHexOctBinLiteral)
      } else {
        const result = Integer(this.state.buf)
        /* istanbul ignore if */
        if (result.isNaN()) {
          throw this.error(new TomlError('Invalid number'))
        } else {
          return this.returnNow(result)
        }
      }
    }
    parseIntegerBin () {
      if (isBit(this.char)) {
        this.consume()
      } else if (this.char === CHAR_LOWBAR) {
        return this.call(this.parseNoUnderHexOctBinLiteral)
      } else {
        const result = Integer(this.state.buf)
        /* istanbul ignore if */
        if (result.isNaN()) {
          throw this.error(new TomlError('Invalid number'))
        } else {
          return this.returnNow(result)
        }
      }
    }

    /* DATETIME */
    parseDateTime () {
      // we enter here having just consumed the year and about to consume the hyphen
      if (this.state.buf.length < 4) {
        throw this.error(new TomlError('Years less than 1000 must be zero padded to four characters'))
      }
      this.state.result = this.state.buf
      this.state.buf = ''
      return this.next(this.parseDateMonth)
    }
    parseDateMonth () {
      if (this.char === CHAR_HYPHEN) {
        if (this.state.buf.length < 2) {
          throw this.error(new TomlError('Months less than 10 must be zero padded to two characters'))
        }
        this.state.result += '-' + this.state.buf
        this.state.buf = ''
        return this.next(this.parseDateDay)
      } else if (isDigit(this.char)) {
        this.consume()
      } else {
        throw this.error(new TomlError('Incomplete datetime'))
      }
    }
    parseDateDay () {
      if (this.char === CHAR_T || this.char === CHAR_SP) {
        if (this.state.buf.length < 2) {
          throw this.error(new TomlError('Days less than 10 must be zero padded to two characters'))
        }
        this.state.result += '-' + this.state.buf
        this.state.buf = ''
        return this.next(this.parseStartTimeHour)
      } else if (this.atEndOfWord()) {
        return this.returnNow(createDate(this.state.result + '-' + this.state.buf))
      } else if (isDigit(this.char)) {
        this.consume()
      } else {
        throw this.error(new TomlError('Incomplete datetime'))
      }
    }
    parseStartTimeHour () {
      if (this.atEndOfWord()) {
        return this.returnNow(createDate(this.state.result))
      } else {
        return this.goto(this.parseTimeHour)
      }
    }
    parseTimeHour () {
      if (this.char === CHAR_COLON) {
        if (this.state.buf.length < 2) {
          throw this.error(new TomlError('Hours less than 10 must be zero padded to two characters'))
        }
        this.state.result += 'T' + this.state.buf
        this.state.buf = ''
        return this.next(this.parseTimeMin)
      } else if (isDigit(this.char)) {
        this.consume()
      } else {
        throw this.error(new TomlError('Incomplete datetime'))
      }
    }
    parseTimeMin () {
      if (this.state.buf.length < 2 && isDigit(this.char)) {
        this.consume()
      } else if (this.state.buf.length === 2 && this.char === CHAR_COLON) {
        this.state.result += ':' + this.state.buf
        this.state.buf = ''
        return this.next(this.parseTimeSec)
      } else {
        throw this.error(new TomlError('Incomplete datetime'))
      }
    }
    parseTimeSec () {
      if (isDigit(this.char)) {
        this.consume()
        if (this.state.buf.length === 2) {
          this.state.result += ':' + this.state.buf
          this.state.buf = ''
          return this.next(this.parseTimeZoneOrFraction)
        }
      } else {
        throw this.error(new TomlError('Incomplete datetime'))
      }
    }

    parseOnlyTimeHour () {
      /* istanbul ignore else */
      if (this.char === CHAR_COLON) {
        if (this.state.buf.length < 2) {
          throw this.error(new TomlError('Hours less than 10 must be zero padded to two characters'))
        }
        this.state.result = this.state.buf
        this.state.buf = ''
        return this.next(this.parseOnlyTimeMin)
      } else {
        throw this.error(new TomlError('Incomplete time'))
      }
    }
    parseOnlyTimeMin () {
      if (this.state.buf.length < 2 && isDigit(this.char)) {
        this.consume()
      } else if (this.state.buf.length === 2 && this.char === CHAR_COLON) {
        this.state.result += ':' + this.state.buf
        this.state.buf = ''
        return this.next(this.parseOnlyTimeSec)
      } else {
        throw this.error(new TomlError('Incomplete time'))
      }
    }
    parseOnlyTimeSec () {
      if (isDigit(this.char)) {
        this.consume()
        if (this.state.buf.length === 2) {
          return this.next(this.parseOnlyTimeFractionMaybe)
        }
      } else {
        throw this.error(new TomlError('Incomplete time'))
      }
    }
    parseOnlyTimeFractionMaybe () {
      this.state.result += ':' + this.state.buf
      if (this.char === CHAR_PERIOD) {
        this.state.buf = ''
        this.next(this.parseOnlyTimeFraction)
      } else {
        return this.return(createTime(this.state.result))
      }
    }
    parseOnlyTimeFraction () {
      if (isDigit(this.char)) {
        this.consume()
      } else if (this.atEndOfWord()) {
        if (this.state.buf.length === 0) throw this.error(new TomlError('Expected digit in milliseconds'))
        return this.returnNow(createTime(this.state.result + '.' + this.state.buf))
      } else {
        throw this.error(new TomlError('Unexpected character in datetime, expected period (.), minus (-), plus (+) or Z'))
      }
    }

    parseTimeZoneOrFraction () {
      if (this.char === CHAR_PERIOD) {
        this.consume()
        this.next(this.parseDateTimeFraction)
      } else if (this.char === CHAR_HYPHEN || this.char === CHAR_PLUS) {
        this.consume()
        this.next(this.parseTimeZoneHour)
      } else if (this.char === CHAR_Z) {
        this.consume()
        return this.return(createDateTime(this.state.result + this.state.buf))
      } else if (this.atEndOfWord()) {
        return this.returnNow(createDateTimeFloat(this.state.result + this.state.buf))
      } else {
        throw this.error(new TomlError('Unexpected character in datetime, expected period (.), minus (-), plus (+) or Z'))
      }
    }
    parseDateTimeFraction () {
      if (isDigit(this.char)) {
        this.consume()
      } else if (this.state.buf.length === 1) {
        throw this.error(new TomlError('Expected digit in milliseconds'))
      } else if (this.char === CHAR_HYPHEN || this.char === CHAR_PLUS) {
        this.consume()
        this.next(this.parseTimeZoneHour)
      } else if (this.char === CHAR_Z) {
        this.consume()
        return this.return(createDateTime(this.state.result + this.state.buf))
      } else if (this.atEndOfWord()) {
        return this.returnNow(createDateTimeFloat(this.state.result + this.state.buf))
      } else {
        throw this.error(new TomlError('Unexpected character in datetime, expected period (.), minus (-), plus (+) or Z'))
      }
    }
    parseTimeZoneHour () {
      if (isDigit(this.char)) {
        this.consume()
        // FIXME: No more regexps
        if (/\d\d$/.test(this.state.buf)) return this.next(this.parseTimeZoneSep)
      } else {
        throw this.error(new TomlError('Unexpected character in datetime, expected digit'))
      }
    }
    parseTimeZoneSep () {
      if (this.char === CHAR_COLON) {
        this.consume()
        this.next(this.parseTimeZoneMin)
      } else {
        throw this.error(new TomlError('Unexpected character in datetime, expected colon'))
      }
    }
    parseTimeZoneMin () {
      if (isDigit(this.char)) {
        this.consume()
        if (/\d\d$/.test(this.state.buf)) return this.return(createDateTime(this.state.result + this.state.buf))
      } else {
        throw this.error(new TomlError('Unexpected character in datetime, expected digit'))
      }
    }

    /* BOOLEAN */
    parseBoolean () {
      /* istanbul ignore else */
      if (this.char === CHAR_t) {
        this.consume()
        return this.next(this.parseTrue_r)
      } else if (this.char === CHAR_f) {
        this.consume()
        return this.next(this.parseFalse_a)
      }
    }
    parseTrue_r () {
      if (this.char === CHAR_r) {
        this.consume()
        return this.next(this.parseTrue_u)
      } else {
        throw this.error(new TomlError('Invalid boolean, expected true or false'))
      }
    }
    parseTrue_u () {
      if (this.char === CHAR_u) {
        this.consume()
        return this.next(this.parseTrue_e)
      } else {
        throw this.error(new TomlError('Invalid boolean, expected true or false'))
      }
    }
    parseTrue_e () {
      if (this.char === CHAR_e) {
        return this.return(true)
      } else {
        throw this.error(new TomlError('Invalid boolean, expected true or false'))
      }
    }

    parseFalse_a () {
      if (this.char === CHAR_a) {
        this.consume()
        return this.next(this.parseFalse_l)
      } else {
        throw this.error(new TomlError('Invalid boolean, expected true or false'))
      }
    }

    parseFalse_l () {
      if (this.char === CHAR_l) {
        this.consume()
        return this.next(this.parseFalse_s)
      } else {
        throw this.error(new TomlError('Invalid boolean, expected true or false'))
      }
    }

    parseFalse_s () {
      if (this.char === CHAR_s) {
        this.consume()
        return this.next(this.parseFalse_e)
      } else {
        throw this.error(new TomlError('Invalid boolean, expected true or false'))
      }
    }

    parseFalse_e () {
      if (this.char === CHAR_e) {
        return this.return(false)
      } else {
        throw this.error(new TomlError('Invalid boolean, expected true or false'))
      }
    }

    /* INLINE LISTS */
    parseInlineList () {
      if (this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M || this.char === CTRL_J) {
        return null
      } else if (this.char === Parser.END) {
        throw this.error(new TomlError('Unterminated inline array'))
      } else if (this.char === CHAR_NUM) {
        return this.call(this.parseComment)
      } else if (this.char === CHAR_RSQB) {
        return this.return(this.state.resultArr || InlineList())
      } else {
        return this.callNow(this.parseValue, this.recordInlineListValue)
      }
    }
    recordInlineListValue (value) {
      if (this.state.resultArr) {
        const listType = this.state.resultArr[_contentType]
        const valueType = tomlType(value)
        if (listType !== valueType) {
          throw this.error(new TomlError(`Inline lists must be a single type, not a mix of ${listType} and ${valueType}`))
        }
      } else {
        this.state.resultArr = InlineList(tomlType(value))
      }
      if (isFloat(value) || isInteger(value)) {
        // unbox now that we've verified they're ok
        this.state.resultArr.push(value.valueOf())
      } else {
        this.state.resultArr.push(value)
      }
      return this.goto(this.parseInlineListNext)
    }
    parseInlineListNext () {
      if (this.char === CHAR_SP || this.char === CTRL_I || this.char === CTRL_M || this.char === CTRL_J) {
        return null
      } else if (this.char === CHAR_NUM) {
        return this.call(this.parseComment)
      } else if (this.char === CHAR_COMMA) {
        return this.next(this.parseInlineList)
      } else if (this.char === CHAR_RSQB) {
        return this.goto(this.parseInlineList)
      } else {
        throw this.error(new TomlError('Invalid character, expected whitespace, comma (,) or close bracket (])'))
      }
    }

    /* INLINE TABLE */
    parseInlineTable () {
      if (this.char === CHAR_SP || this.char === CTRL_I) {
        return null
      } else if (this.char === Parser.END || this.char === CHAR_NUM || this.char === CTRL_J || this.char === CTRL_M) {
        throw this.error(new TomlError('Unterminated inline array'))
      } else if (this.char === CHAR_RCUB) {
        return this.return(this.state.resultTable || InlineTable())
      } else {
        if (!this.state.resultTable) this.state.resultTable = InlineTable()
        return this.callNow(this.parseAssign, this.recordInlineTableValue)
      }
    }
    recordInlineTableValue (kv) {
      let target = this.state.resultTable
      let finalKey = kv.key.pop()
      for (let kw of kv.key) {
        if (hasKey(target, kw) && (!isTable(target[kw]) || target[kw][_declared])) {
          throw this.error(new TomlError("Can't redefine existing key"))
        }
        target = target[kw] = target[kw] || Table()
      }
      if (hasKey(target, finalKey)) {
        throw this.error(new TomlError("Can't redefine existing key"))
      }
      if (isInteger(kv.value) || isFloat(kv.value)) {
        target[finalKey] = kv.value.valueOf()
      } else {
        target[finalKey] = kv.value
      }
      return this.goto(this.parseInlineTableNext)
    }
    parseInlineTableNext () {
      if (this.char === CHAR_SP || this.char === CTRL_I) {
        return null
      } else if (this.char === Parser.END || this.char === CHAR_NUM || this.char === CTRL_J || this.char === CTRL_M) {
        throw this.error(new TomlError('Unterminated inline array'))
      } else if (this.char === CHAR_COMMA) {
        return this.next(this.parseInlineTable)
      } else if (this.char === CHAR_RCUB) {
        return this.goto(this.parseInlineTable)
      } else {
        throw this.error(new TomlError('Invalid character, expected whitespace, comma (,) or close bracket (])'))
      }
    }
  }
  return TOMLParser
}


/***/ }),

/***/ "./node_modules/@iarna/toml/parse-async.js":
/*!*************************************************!*\
  !*** ./node_modules/@iarna/toml/parse-async.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


module.exports = parseAsync

const TOMLParser = __webpack_require__(/*! ./lib/toml-parser.js */ "./node_modules/@iarna/toml/lib/toml-parser.js")
const prettyError = __webpack_require__(/*! ./parse-pretty-error.js */ "./node_modules/@iarna/toml/parse-pretty-error.js")

function parseAsync (str, opts) {
  if (!opts) opts = {}
  const index = 0
  const blocksize = opts.blocksize || 40960
  const parser = new TOMLParser()
  return new Promise((resolve, reject) => {
    setImmediate(parseAsyncNext, index, blocksize, resolve, reject)
  })
  function parseAsyncNext (index, blocksize, resolve, reject) {
    if (index >= str.length) {
      try {
        return resolve(parser.finish())
      } catch (err) {
        return reject(prettyError(err, str))
      }
    }
    try {
      parser.parse(str.slice(index, index + blocksize))
      setImmediate(parseAsyncNext, index + blocksize, blocksize, resolve, reject)
    } catch (err) {
      reject(prettyError(err, str))
    }
  }
}


/***/ }),

/***/ "./node_modules/@iarna/toml/parse-pretty-error.js":
/*!********************************************************!*\
  !*** ./node_modules/@iarna/toml/parse-pretty-error.js ***!
  \********************************************************/
/***/ ((module) => {


module.exports = prettyError

function prettyError (err, buf) {
  /* istanbul ignore if */
  if (err.pos == null || err.line == null) return err
  let msg = err.message
  msg += ` at row ${err.line + 1}, col ${err.col + 1}, pos ${err.pos}:\n`

  /* istanbul ignore else */
  if (buf && buf.split) {
    const lines = buf.split(/\n/)
    const lineNumWidth = String(Math.min(lines.length, err.line + 3)).length
    let linePadding = ' '
    while (linePadding.length < lineNumWidth) linePadding += ' '
    for (let ii = Math.max(0, err.line - 1); ii < Math.min(lines.length, err.line + 2); ++ii) {
      let lineNum = String(ii + 1)
      if (lineNum.length < lineNumWidth) lineNum = ' ' + lineNum
      if (err.line === ii) {
        msg += lineNum + '> ' + lines[ii] + '\n'
        msg += linePadding + '  '
        for (let hh = 0; hh < err.col; ++hh) {
          msg += ' '
        }
        msg += '^\n'
      } else {
        msg += lineNum + ': ' + lines[ii] + '\n'
      }
    }
  }
  err.message = msg + '\n'
  return err
}


/***/ }),

/***/ "./node_modules/@iarna/toml/parse-stream.js":
/*!**************************************************!*\
  !*** ./node_modules/@iarna/toml/parse-stream.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


module.exports = parseStream

const stream = __webpack_require__(/*! stream */ "stream")
const TOMLParser = __webpack_require__(/*! ./lib/toml-parser.js */ "./node_modules/@iarna/toml/lib/toml-parser.js")

function parseStream (stm) {
  if (stm) {
    return parseReadable(stm)
  } else {
    return parseTransform(stm)
  }
}

function parseReadable (stm) {
  const parser = new TOMLParser()
  stm.setEncoding('utf8')
  return new Promise((resolve, reject) => {
    let readable
    let ended = false
    let errored = false
    function finish () {
      ended = true
      if (readable) return
      try {
        resolve(parser.finish())
      } catch (err) {
        reject(err)
      }
    }
    function error (err) {
      errored = true
      reject(err)
    }
    stm.once('end', finish)
    stm.once('error', error)
    readNext()

    function readNext () {
      readable = true
      let data
      while ((data = stm.read()) !== null) {
        try {
          parser.parse(data)
        } catch (err) {
          return error(err)
        }
      }
      readable = false
      /* istanbul ignore if */
      if (ended) return finish()
      /* istanbul ignore if */
      if (errored) return
      stm.once('readable', readNext)
    }
  })
}

function parseTransform () {
  const parser = new TOMLParser()
  return new stream.Transform({
    objectMode: true,
    transform (chunk, encoding, cb) {
      try {
        parser.parse(chunk.toString(encoding))
      } catch (err) {
        this.emit('error', err)
      }
      cb()
    },
    flush (cb) {
      try {
        this.push(parser.finish())
      } catch (err) {
        this.emit('error', err)
      }
      cb()
    }
  })
}


/***/ }),

/***/ "./node_modules/@iarna/toml/parse-string.js":
/*!**************************************************!*\
  !*** ./node_modules/@iarna/toml/parse-string.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


module.exports = parseString

const TOMLParser = __webpack_require__(/*! ./lib/toml-parser.js */ "./node_modules/@iarna/toml/lib/toml-parser.js")
const prettyError = __webpack_require__(/*! ./parse-pretty-error.js */ "./node_modules/@iarna/toml/parse-pretty-error.js")

function parseString (str) {
  if (global.Buffer && global.Buffer.isBuffer(str)) {
    str = str.toString('utf8')
  }
  const parser = new TOMLParser()
  try {
    parser.parse(str)
    return parser.finish()
  } catch (err) {
    throw prettyError(err, str)
  }
}


/***/ }),

/***/ "./node_modules/@iarna/toml/parse.js":
/*!*******************************************!*\
  !*** ./node_modules/@iarna/toml/parse.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


module.exports = __webpack_require__(/*! ./parse-string.js */ "./node_modules/@iarna/toml/parse-string.js")
module.exports.async = __webpack_require__(/*! ./parse-async.js */ "./node_modules/@iarna/toml/parse-async.js")
module.exports.stream = __webpack_require__(/*! ./parse-stream.js */ "./node_modules/@iarna/toml/parse-stream.js")
module.exports.prettyError = __webpack_require__(/*! ./parse-pretty-error.js */ "./node_modules/@iarna/toml/parse-pretty-error.js")


/***/ }),

/***/ "./node_modules/@iarna/toml/stringify.js":
/*!***********************************************!*\
  !*** ./node_modules/@iarna/toml/stringify.js ***!
  \***********************************************/
/***/ ((module) => {


module.exports = stringify
module.exports.value = stringifyInline

function stringify (obj) {
  if (obj === null) throw typeError('null')
  if (obj === void (0)) throw typeError('undefined')
  if (typeof obj !== 'object') throw typeError(typeof obj)

  if (typeof obj.toJSON === 'function') obj = obj.toJSON()
  if (obj == null) return null
  const type = tomlType(obj)
  if (type !== 'table') throw typeError(type)
  return stringifyObject('', '', obj)
}

function typeError (type) {
  return new Error('Can only stringify objects, not ' + type)
}

function arrayOneTypeError () {
  return new Error("Array values can't have mixed types")
}

function getInlineKeys (obj) {
  return Object.keys(obj).filter(key => isInline(obj[key]))
}
function getComplexKeys (obj) {
  return Object.keys(obj).filter(key => !isInline(obj[key]))
}

function toJSON (obj) {
  let nobj = Array.isArray(obj) ? [] : Object.prototype.hasOwnProperty.call(obj, '__proto__') ? {['__proto__']: undefined} : {}
  for (let prop of Object.keys(obj)) {
    if (obj[prop] && typeof obj[prop].toJSON === 'function' && !('toISOString' in obj[prop])) {
      nobj[prop] = obj[prop].toJSON()
    } else {
      nobj[prop] = obj[prop]
    }
  }
  return nobj
}

function stringifyObject (prefix, indent, obj) {
  obj = toJSON(obj)
  var inlineKeys
  var complexKeys
  inlineKeys = getInlineKeys(obj)
  complexKeys = getComplexKeys(obj)
  var result = []
  var inlineIndent = indent || ''
  inlineKeys.forEach(key => {
    var type = tomlType(obj[key])
    if (type !== 'undefined' && type !== 'null') {
      result.push(inlineIndent + stringifyKey(key) + ' = ' + stringifyAnyInline(obj[key], true))
    }
  })
  if (result.length > 0) result.push('')
  var complexIndent = prefix && inlineKeys.length > 0 ? indent + '  ' : ''
  complexKeys.forEach(key => {
    result.push(stringifyComplex(prefix, complexIndent, key, obj[key]))
  })
  return result.join('\n')
}

function isInline (value) {
  switch (tomlType(value)) {
    case 'undefined':
    case 'null':
    case 'integer':
    case 'nan':
    case 'float':
    case 'boolean':
    case 'string':
    case 'datetime':
      return true
    case 'array':
      return value.length === 0 || tomlType(value[0]) !== 'table'
    case 'table':
      return Object.keys(value).length === 0
    /* istanbul ignore next */
    default:
      return false
  }
}

function tomlType (value) {
  if (value === undefined) {
    return 'undefined'
  } else if (value === null) {
    return 'null'
  /* eslint-disable valid-typeof */
  } else if (typeof value === 'bigint' || (Number.isInteger(value) && !Object.is(value, -0))) {
    return 'integer'
  } else if (typeof value === 'number') {
    return 'float'
  } else if (typeof value === 'boolean') {
    return 'boolean'
  } else if (typeof value === 'string') {
    return 'string'
  } else if ('toISOString' in value) {
    return isNaN(value) ? 'undefined' : 'datetime'
  } else if (Array.isArray(value)) {
    return 'array'
  } else {
    return 'table'
  }
}

function stringifyKey (key) {
  var keyStr = String(key)
  if (/^[-A-Za-z0-9_]+$/.test(keyStr)) {
    return keyStr
  } else {
    return stringifyBasicString(keyStr)
  }
}

function stringifyBasicString (str) {
  return '"' + escapeString(str).replace(/"/g, '\\"') + '"'
}

function stringifyLiteralString (str) {
  return "'" + str + "'"
}

function numpad (num, str) {
  while (str.length < num) str = '0' + str
  return str
}

function escapeString (str) {
  return str.replace(/\\/g, '\\\\')
    .replace(/[\b]/g, '\\b')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\f/g, '\\f')
    .replace(/\r/g, '\\r')
    /* eslint-disable no-control-regex */
    .replace(/([\u0000-\u001f\u007f])/, c => '\\u' + numpad(4, c.codePointAt(0).toString(16)))
    /* eslint-enable no-control-regex */
}

function stringifyMultilineString (str) {
  let escaped = str.split(/\n/).map(str => {
    return escapeString(str).replace(/"(?="")/g, '\\"')
  }).join('\n')
  if (escaped.slice(-1) === '"') escaped += '\\\n'
  return '"""\n' + escaped + '"""'
}

function stringifyAnyInline (value, multilineOk) {
  let type = tomlType(value)
  if (type === 'string') {
    if (multilineOk && /\n/.test(value)) {
      type = 'string-multiline'
    } else if (!/[\b\t\n\f\r']/.test(value) && /"/.test(value)) {
      type = 'string-literal'
    }
  }
  return stringifyInline(value, type)
}

function stringifyInline (value, type) {
  /* istanbul ignore if */
  if (!type) type = tomlType(value)
  switch (type) {
    case 'string-multiline':
      return stringifyMultilineString(value)
    case 'string':
      return stringifyBasicString(value)
    case 'string-literal':
      return stringifyLiteralString(value)
    case 'integer':
      return stringifyInteger(value)
    case 'float':
      return stringifyFloat(value)
    case 'boolean':
      return stringifyBoolean(value)
    case 'datetime':
      return stringifyDatetime(value)
    case 'array':
      return stringifyInlineArray(value.filter(_ => tomlType(_) !== 'null' && tomlType(_) !== 'undefined' && tomlType(_) !== 'nan'))
    case 'table':
      return stringifyInlineTable(value)
    /* istanbul ignore next */
    default:
      throw typeError(type)
  }
}

function stringifyInteger (value) {
  /* eslint-disable security/detect-unsafe-regex */
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '_')
}

function stringifyFloat (value) {
  if (value === Infinity) {
    return 'inf'
  } else if (value === -Infinity) {
    return '-inf'
  } else if (Object.is(value, NaN)) {
    return 'nan'
  } else if (Object.is(value, -0)) {
    return '-0.0'
  }
  var chunks = String(value).split('.')
  var int = chunks[0]
  var dec = chunks[1] || 0
  return stringifyInteger(int) + '.' + dec
}

function stringifyBoolean (value) {
  return String(value)
}

function stringifyDatetime (value) {
  return value.toISOString()
}

function isNumber (type) {
  return type === 'float' || type === 'integer'
}
function arrayType (values) {
  var contentType = tomlType(values[0])
  if (values.every(_ => tomlType(_) === contentType)) return contentType
  // mixed integer/float, emit as floats
  if (values.every(_ => isNumber(tomlType(_)))) return 'float'
  return 'mixed'
}
function validateArray (values) {
  const type = arrayType(values)
  if (type === 'mixed') {
    throw arrayOneTypeError()
  }
  return type
}

function stringifyInlineArray (values) {
  values = toJSON(values)
  const type = validateArray(values)
  var result = '['
  var stringified = values.map(_ => stringifyInline(_, type))
  if (stringified.join(', ').length > 60 || /\n/.test(stringified)) {
    result += '\n  ' + stringified.join(',\n  ') + '\n'
  } else {
    result += ' ' + stringified.join(', ') + (stringified.length > 0 ? ' ' : '')
  }
  return result + ']'
}

function stringifyInlineTable (value) {
  value = toJSON(value)
  var result = []
  Object.keys(value).forEach(key => {
    result.push(stringifyKey(key) + ' = ' + stringifyAnyInline(value[key], false))
  })
  return '{ ' + result.join(', ') + (result.length > 0 ? ' ' : '') + '}'
}

function stringifyComplex (prefix, indent, key, value) {
  var valueType = tomlType(value)
  /* istanbul ignore else */
  if (valueType === 'array') {
    return stringifyArrayOfTables(prefix, indent, key, value)
  } else if (valueType === 'table') {
    return stringifyComplexTable(prefix, indent, key, value)
  } else {
    throw typeError(valueType)
  }
}

function stringifyArrayOfTables (prefix, indent, key, values) {
  values = toJSON(values)
  validateArray(values)
  var firstValueType = tomlType(values[0])
  /* istanbul ignore if */
  if (firstValueType !== 'table') throw typeError(firstValueType)
  var fullKey = prefix + stringifyKey(key)
  var result = ''
  values.forEach(table => {
    if (result.length > 0) result += '\n'
    result += indent + '[[' + fullKey + ']]\n'
    result += stringifyObject(fullKey + '.', indent, table)
  })
  return result
}

function stringifyComplexTable (prefix, indent, key, value) {
  var fullKey = prefix + stringifyKey(key)
  var result = ''
  if (getInlineKeys(value).length > 0) {
    result += indent + '[' + fullKey + ']\n'
  }
  return result + stringifyObject(fullKey + '.', indent, value)
}


/***/ }),

/***/ "./node_modules/@iarna/toml/toml.js":
/*!******************************************!*\
  !*** ./node_modules/@iarna/toml/toml.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


exports.parse = __webpack_require__(/*! ./parse.js */ "./node_modules/@iarna/toml/parse.js")
exports.stringify = __webpack_require__(/*! ./stringify.js */ "./node_modules/@iarna/toml/stringify.js")


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
const DOWNLOAD_PAGE = 'https://github.com/BepInEx/BepInEx';
const contributors = [
    'ghorsington', 'ManlyMarco', 'usagirei', 'js6pak', 'keelhauled',
    'notfood', 'exdownloader', 'Therzok', 'xoxfaby', 'TheLounger',
];
class BepInExAttribDashlet extends vortex_api_1.PureComponentEx {
    constructor() {
        super(...arguments);
        this.openPage = () => {
            vortex_api_1.util.opn(DOWNLOAD_PAGE).catch(err => null);
        };
    }
    render() {
        const { t } = this.props;
        return (React.createElement(vortex_api_1.Dashlet, { title: t('Support for this game is made possible using the Bepis Injector Extensible tool (BepInEx)'), className: 'dashlet-bepinex' },
            React.createElement("div", null, t('Special thanks to {{author}} for developing this tool, and all its contributors: {{nl}}"{{contributors}}"', { replace: { author: 'Bepis', nl: '\n', contributors: contributors.join(', ') } })),
            React.createElement("div", null,
                t('BepInEx lives here: '),
                React.createElement("a", { onClick: this.openPage }, DOWNLOAD_PAGE))));
    }
}
exports["default"] = (0, react_i18next_1.withTranslation)(['common', 'bepinex-modtype'])(BepInExAttribDashlet);


/***/ }),

/***/ "./src/bepInExDownloader.ts":
/*!**********************************!*\
  !*** ./src/bepInExDownloader.ts ***!
  \**********************************/
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
exports.raiseConsentDialog = exports.ensureBepInExPack = void 0;
const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
const semver_1 = __importDefault(__webpack_require__(/*! semver */ "semver"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const common_1 = __webpack_require__(/*! ./common */ "./src/common.ts");
const types_1 = __webpack_require__(/*! ./types */ "./src/types.ts");
const githubDownloader_1 = __webpack_require__(/*! ./githubDownloader */ "./src/githubDownloader.ts");
function genDownloadProps(api, archiveName) {
    const state = api.getState();
    const downloads = vortex_api_1.util.getSafe(state, ['persistent', 'downloads', 'files'], {});
    const downloadId = Object.keys(downloads).find(dId => downloads[dId].localPath === archiveName);
    return { downloads, downloadId, state };
}
function updateSupportedGames(api, downloadInfo) {
    const { downloadId, downloads } = genDownloadProps(api, downloadInfo.archiveName);
    if (downloadId === undefined) {
        throw new vortex_api_1.util.NotFound(`bepinex download is missing: ${downloadInfo.archiveName}`);
    }
    const currentlySupported = downloads[downloadId].game;
    const supportedGames = new Set(currentlySupported.concat(Object.keys((0, common_1.getSupportMap)())));
    api.store.dispatch(vortex_api_1.actions.setCompatibleGames(downloadId, Array.from(supportedGames)));
}
function install(api, downloadInfo, downloadId, force) {
    return __awaiter(this, void 0, void 0, function* () {
        const state = api.getState();
        if (downloadInfo.allowAutoInstall) {
            const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', downloadInfo.gameId], {});
            const isInjectorInstalled = (force) ? false : Object.keys(mods).find(id => mods[id].type === common_1.MODTYPE_BIX_INJECTOR) !== undefined;
            if (!isInjectorInstalled) {
                return new Promise((resolve, reject) => {
                    api.events.emit('start-install-download', downloadId, true, (err, modId) => {
                        return (err) ? reject(err) : resolve(modId);
                    });
                });
            }
            else {
                return Promise.resolve(undefined);
            }
        }
    });
}
function download(api, downloadInfo, force) {
    return __awaiter(this, void 0, void 0, function* () {
        const { domainId, modId, fileId, archiveName, allowAutoInstall } = downloadInfo;
        const state = api.getState();
        if (!vortex_api_1.util.getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false)) {
            return Promise.reject(new types_1.NotPremiumError());
        }
        const downloadId = genDownloadProps(api, archiveName).downloadId;
        if (downloadId !== undefined) {
            try {
                updateSupportedGames(api, downloadInfo);
                return install(api, downloadInfo, downloadId, force);
            }
            catch (err) {
                return Promise.reject(err);
            }
        }
        return api.emitAndAwait('nexus-download', domainId, modId, fileId, archiveName, allowAutoInstall)
            .then(() => {
            const { downloadId } = genDownloadProps(api, downloadInfo.archiveName);
            try {
                updateSupportedGames(api, downloadInfo);
                return install(api, downloadInfo, downloadId, force);
            }
            catch (err) {
                return Promise.reject(err);
            }
        })
            .catch(err => {
            if (err instanceof vortex_api_1.util.UserCanceled) {
                (0, vortex_api_1.log)('info', 'user canceled download of BepInEx');
            }
            else {
                (0, vortex_api_1.log)('error', 'failed to download from NexusMods.com', JSON.stringify(downloadInfo, undefined, 2));
                err['attachLogOnReport'] = true;
                api.showErrorNotification('Failed to download BepInEx dependency', err);
            }
        });
    });
}
function ensureBepInExPack(api, gameMode, force, isUpdate) {
    return __awaiter(this, void 0, void 0, function* () {
        const state = api.getState();
        const gameId = (gameMode === undefined)
            ? vortex_api_1.selectors.activeGameId(state)
            : gameMode;
        const profileId = vortex_api_1.selectors.lastActiveProfileForGame(state, gameId);
        const gameConf = (0, common_1.getSupportMap)()[gameId];
        if (gameConf === undefined || !gameConf.autoDownloadBepInEx) {
            return;
        }
        const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', gameId], {});
        const injectorModIds = Object.keys(mods).filter(id => { var _a; return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === common_1.MODTYPE_BIX_INJECTOR; });
        if (gameConf.bepinexVersion !== undefined && gameConf.forceGithubDownload !== true) {
            const hasRequiredVersion = injectorModIds.reduce((prev, iter) => {
                var _a, _b, _c, _d;
                let version = (_c = (_b = (_a = mods[iter]) === null || _a === void 0 ? void 0 : _a.attributes) === null || _b === void 0 ? void 0 : _b.version) !== null && _c !== void 0 ? _c : '0.0.0';
                if (version.length > 6) {
                    version = version.slice(0, 6);
                }
                const modVersion = ((_d = semver_1.default.coerce(version)) === null || _d === void 0 ? void 0 : _d.raw) || '0.0.0';
                if (modVersion === gameConf.bepinexVersion) {
                    prev = true;
                }
                return prev;
            }, false);
            if (!hasRequiredVersion) {
                force = true;
            }
        }
        else if (gameConf.forceGithubDownload === true && isUpdate) {
            const latest = injectorModIds.reduce((prev, iter) => {
                var _a, _b, _c, _d, _e;
                let version = (_c = (_b = (_a = mods[iter]) === null || _a === void 0 ? void 0 : _a.attributes) === null || _b === void 0 ? void 0 : _b.version) !== null && _c !== void 0 ? _c : '0.0.0';
                try {
                    const coerced = semver_1.default.coerce((_e = (_d = mods[iter]) === null || _d === void 0 ? void 0 : _d.attributes) === null || _e === void 0 ? void 0 : _e.version);
                    version = coerced.raw || '0.0.0';
                }
                catch (err) {
                    version = '0.0.0';
                }
                if (semver_1.default.gt(version, prev)) {
                    prev = version;
                }
                return prev;
            }, '0.0.0');
            try {
                yield (0, githubDownloader_1.checkForUpdates)(api, gameConf, latest);
            }
            catch (err) {
                api.showErrorNotification('Failed to update BepInEx', err);
            }
            return;
        }
        const isInjectorInstalled = (!force)
            ? Object.keys(mods).find(id => mods[id].type === common_1.MODTYPE_BIX_INJECTOR) !== undefined
            : false;
        if (isInjectorInstalled) {
            return;
        }
        let downloadRes;
        if (gameConf.customPackDownloader !== undefined) {
            try {
                downloadRes = yield gameConf.customPackDownloader(vortex_api_1.util.getVortexPath('temp'));
                if (downloadRes !== undefined) {
                    yield download(api, downloadRes, force);
                }
                else if (typeof (downloadRes) === 'string') {
                    if (!path_1.default.isAbsolute(downloadRes)) {
                        (0, vortex_api_1.log)('error', 'failed to download custom pack', 'expected absolute path');
                    }
                    const downloadsPath = vortex_api_1.selectors.downloadPathForGame(state, gameId);
                    yield vortex_api_1.fs.copyAsync(downloadRes, path_1.default.join(downloadsPath, path_1.default.basename(downloadRes)));
                }
                else {
                    (0, vortex_api_1.log)('error', 'failed to download custom pack', { downloadRes });
                    return;
                }
            }
            catch (err) {
                if (err instanceof types_1.NotPremiumError) {
                    const downloadInfo = downloadRes;
                    const url = path_1.default.join(common_1.NEXUS, downloadInfo.domainId, 'mods', downloadInfo.modId)
                        + `?tab=files&file_id=${downloadRes.fileId}&nmm=1`;
                    vortex_api_1.util.opn(url)
                        .catch(err2 => api.showErrorNotification('Failed to download custom pack', err2, { allowReport: false }));
                }
                (0, vortex_api_1.log)('error', 'failed to download custom pack', err);
                return;
            }
        }
        else if (gameConf.forceGithubDownload !== true) {
            const defaultDownload = (0, common_1.getDownload)(gameConf);
            try {
                if (!!gameConf.bepinexVersion && gameConf.bepinexVersion !== defaultDownload.version) {
                    throw new vortex_api_1.util.ProcessCanceled('BepInEx version mismatch');
                }
                yield download(api, defaultDownload, force);
            }
            catch (err) {
                yield (0, githubDownloader_1.downloadFromGithub)(api, gameConf);
            }
        }
        else {
            try {
                yield (0, githubDownloader_1.downloadFromGithub)(api, gameConf);
            }
            catch (err) {
                return Promise.reject(err);
            }
        }
    });
}
exports.ensureBepInExPack = ensureBepInExPack;
function raiseConsentDialog(api, gameConf) {
    return __awaiter(this, void 0, void 0, function* () {
        const t = api.translate;
        const replace = {
            game: gameConf.gameId,
            bl: '[br][/br][br][/br]',
        };
        return api.showDialog('info', 'BepInEx Required', {
            bbcode: t('The {{game}} game extension requires a widely used 3rd party assembly '
                + 'patching/injection library called Bepis Injector Extensible (BepInEx).{{bl}}'
                + 'Vortex can walk you through the download/installation process; once complete, BepInEx '
                + 'will be available in your mods page to enable/disable just like any other regular mod. '
                + 'Depending on the modding pattern of {{game}}, BepInEx may be a hard requirement '
                + 'for mods to function in-game, in which case you MUST have the library enabled and deployed '
                + 'at all times for the mods to work!{{bl}}'
                + 'To remove the library, simply disable the mod entry for BepInEx.', { replace }),
        }, [
            { label: 'Close' },
            {
                label: 'Download BepInEx',
                default: true,
            },
        ]);
    });
}
exports.raiseConsentDialog = raiseConsentDialog;


/***/ }),

/***/ "./src/common.ts":
/*!***********************!*\
  !*** ./src/common.ts ***!
  \***********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getDownload = exports.addGameSupport = exports.resolveBixPackage = exports.getSupportMap = exports.MODTYPE_BIX_INJECTOR = exports.INJECTOR_FILES = exports.DOORSTOP_FILES = exports.BEPINEX_CONFIG_REL_PATH = exports.BEPINEX_CONFIG_FILE = exports.DOORSTOPPER_CONFIG = exports.DOORSTOPPER_HOOK = exports.NEXUS = void 0;
const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const semver_1 = __importDefault(__webpack_require__(/*! semver */ "semver"));
const isWindows = () => isWindows();
const isMacOS = () => isMacOS();
const isLinux = () => isLinux();
const platformSwitch = (cases) => {
    if (isWindows() && cases.windows !== undefined)
        return cases.windows;
    if (isMacOS() && cases.macos !== undefined)
        return cases.macos;
    if (isLinux() && cases.linux !== undefined)
        return cases.linux;
    return cases.default;
};
exports.NEXUS = 'www.nexusmods.com';
exports.DOORSTOPPER_HOOK = 'winhttp.dll';
exports.DOORSTOPPER_CONFIG = 'doorstop_config.ini';
exports.BEPINEX_CONFIG_FILE = 'BepInEx.cfg';
exports.BEPINEX_CONFIG_REL_PATH = path_1.default.join('BepInEx', 'config', exports.BEPINEX_CONFIG_FILE);
exports.DOORSTOP_FILES = [exports.DOORSTOPPER_CONFIG, exports.DOORSTOPPER_HOOK];
exports.INJECTOR_FILES = [
    '0Harmony.dll', '0Harmony.xml', '0Harmony20.dll', 'BepInEx.dll', 'BepInEx.Core.dll',
    'BepInEx.Preloader.Core.dll', 'BepInEx.Preloader.Unity.dll', 'BepInEx.Harmony.dll',
    'BepInEx.Harmony.xml', 'BepInEx.Preloader.dll', 'BepInEx.Preloader.xml',
    'BepInEx.xml', 'HarmonyXInterop.dll', 'Mono.Cecil.dll', 'Mono.Cecil.Mdb.dll',
    'Mono.Cecil.Pdb.dll', 'Mono.Cecil.Rocks.dll', 'MonoMod.RuntimeDetour.dll',
    'MonoMod.RuntimeDetour.xml', 'MonoMod.Utils.dll', 'MonoMod.Utils.xml',
];
exports.MODTYPE_BIX_INJECTOR = 'bepinex-injector';
const DEFAULT_VERSION = '5.4.22';
const NEW_FILE_FORMAT_VERSION = '6.0.0';
const GAME_SUPPORT = {};
const getSupportMap = () => GAME_SUPPORT;
exports.getSupportMap = getSupportMap;
const resolveBixPackage = (gameConf) => {
    const { architecture, bepinexVersion, bepinexCoercedVersion, unityBuild } = gameConf;
    const arch = architecture !== undefined ? architecture : 'x64';
    const version = bepinexCoercedVersion !== undefined ? bepinexCoercedVersion : DEFAULT_VERSION;
    const platform = semver_1.default.gte(version.replace(/-.*$/igm, ''), '5.4.23') ? isWindows() ? 'win_' : 'linux_' : '';
    const unity = (unityBuild !== undefined)
        ? semver_1.default.gte(version, NEW_FILE_FORMAT_VERSION) ? `${unityBuild}_` : ''
        : semver_1.default.gte(version, NEW_FILE_FORMAT_VERSION) ? 'unitymono_' : '';
    const regex = `BepInEx_${platform}${unity}${arch}_${bepinexVersion}.*[.zip|.7z]`;
    return {
        rgx: new RegExp(regex, 'i'),
        version,
        architecture: arch,
        unityBuild,
    };
};
exports.resolveBixPackage = resolveBixPackage;
const addGameSupport = (gameConf) => {
    if ((gameConf.unityBuild === 'unityil2cpp')
        && (gameConf.bepinexVersion !== undefined)
        && (semver_1.default.lt(gameConf.bepinexVersion, '6.0.0'))) {
        throw new Error('IL2CPP builds require BepInEx 6.0.0 or above');
    }
    else {
        if (gameConf.unityBuild === 'unityil2cpp' && gameConf.bepinexVersion === undefined) {
            gameConf.bepinexVersion = '6.0.0';
        }
        else {
            if (gameConf.bepinexVersion == null) {
                gameConf.bepinexVersion = DEFAULT_VERSION;
            }
        }
        gameConf.bepinexCoercedVersion = vortex_api_1.util.semverCoerce(gameConf.bepinexVersion).version;
        GAME_SUPPORT[gameConf.gameId] = gameConf;
    }
};
exports.addGameSupport = addGameSupport;
const AVAILABLE = {
    '5.4.10x64': {
        architecture: 'x64',
        domainId: 'site',
        version: '5.4.10',
        modId: '115',
        fileId: '1023',
        archiveName: 'BepInEx_x64_5.4.10.0.zip',
        allowAutoInstall: true,
        githubUrl: 'https://github.com/BepInEx/BepInEx/releases/tag/v5.4.10',
    },
    '5.4.13x64': {
        architecture: 'x64',
        domainId: 'site',
        version: '5.4.13',
        modId: '115',
        fileId: '1137',
        archiveName: 'BepInEx_x64_5.4.13.0.zip',
        allowAutoInstall: true,
        githubUrl: 'https://github.com/BepInEx/BepInEx/releases/tag/v5.4.13',
    },
    '5.4.15x64': {
        architecture: 'x64',
        domainId: 'site',
        version: '5.4.15',
        modId: '115',
        fileId: '1175',
        archiveName: 'BepInEx_x64_5.4.15.0.zip',
        allowAutoInstall: true,
        githubUrl: 'https://github.com/BepInEx/BepInEx/releases/tag/v5.4.15',
    },
    '5.4.17x64': {
        architecture: 'x64',
        domainId: 'site',
        version: '5.4.17',
        modId: '115',
        fileId: '1273',
        archiveName: 'BepInEx_x64_5.4.17.0.zip',
        allowAutoInstall: true,
        githubUrl: 'https://github.com/BepInEx/BepInEx/releases/tag/v5.4.17',
    },
    '5.4.22x86': {
        architecture: 'x86',
        domainId: 'site',
        version: '5.4.22',
        modId: '115',
        fileId: '2528',
        archiveName: 'BepInEx_x86_5.4.22.0.zip',
        allowAutoInstall: true,
        githubUrl: 'https://github.com/BepInEx/BepInEx/releases/tag/v5.4.22',
    },
    '5.4.22x64': {
        architecture: 'x64',
        domainId: 'site',
        version: '5.4.22',
        modId: '115',
        fileId: '2526',
        archiveName: 'BepInEx_x64_5.4.22.0.zip',
        allowAutoInstall: true,
        githubUrl: 'https://github.com/BepInEx/BepInEx/releases/tag/v5.4.22',
    },
};
const getLatestVersion = (arch) => {
    const versions = Object.values(AVAILABLE);
    const latestVersion = versions.reduce((prev, iter) => {
        if (semver_1.default.gt(iter.version, prev)) {
            prev = iter.version;
        }
        return prev;
    }, DEFAULT_VERSION);
    return `${latestVersion}${arch}`;
};
const getDownload = (gameConf) => {
    const arch = !!gameConf.architecture ? gameConf.architecture : 'x64';
    const versionKey = `${gameConf.bepinexVersion}${arch}`;
    const download = ((gameConf.bepinexVersion !== undefined)
        && Object.keys(AVAILABLE).includes(versionKey))
        ? AVAILABLE[versionKey] : AVAILABLE[getLatestVersion(arch)];
    return Object.assign(Object.assign({}, download), { gameId: gameConf.gameId });
};
exports.getDownload = getDownload;


/***/ }),

/***/ "./src/githubDownloader.ts":
/*!*********************************!*\
  !*** ./src/githubDownloader.ts ***!
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.downloadFromGithub = exports.checkForUpdates = exports.getLatestReleases = void 0;
const https = __importStar(__webpack_require__(/*! https */ "https"));
const _ = __importStar(__webpack_require__(/*! lodash */ "lodash"));
const semver = __importStar(__webpack_require__(/*! semver */ "semver"));
const url = __importStar(__webpack_require__(/*! url */ "url"));
const bepInExDownloader_1 = __webpack_require__(/*! ./bepInExDownloader */ "./src/bepInExDownloader.ts");
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const common_1 = __webpack_require__(/*! ./common */ "./src/common.ts");
const GITHUB_URL = 'https://api.github.com/repos/BepInEx/BepInEx';
const BIX_LANDING = 'https://github.com/BepInEx/BepInEx';
const BIX_RELEASES = 'https://github.com/BepInEx/BepInEx/releases';
function query(baseUrl, request) {
    return new Promise((resolve, reject) => {
        const getRequest = getRequestOptions(`${baseUrl}/${request}`);
        https.get(getRequest, (res) => {
            res.setEncoding('utf-8');
            const msgHeaders = res.headers;
            const callsRemaining = parseInt(vortex_api_1.util.getSafe(msgHeaders, ['x-ratelimit-remaining'], '0'), 10);
            if ((res.statusCode === 403) && (callsRemaining === 0)) {
                const resetDate = parseInt(vortex_api_1.util.getSafe(msgHeaders, ['x-ratelimit-reset'], '0'), 10);
                (0, vortex_api_1.log)('info', 'GitHub rate limit exceeded', { reset_at: (new Date(resetDate)).toString() });
                return reject(new vortex_api_1.util.ProcessCanceled('GitHub rate limit exceeded'));
            }
            let output = '';
            res
                .on('data', data => output += data)
                .on('end', () => {
                try {
                    return resolve(JSON.parse(output));
                }
                catch (parseErr) {
                    return reject(parseErr);
                }
            });
        })
            .on('error', err => {
            return reject(err);
        })
            .end();
    });
}
function getRequestOptions(link) {
    const relUrl = url.parse(link);
    return (Object.assign(Object.assign({}, _.pick(relUrl, ['port', 'hostname', 'path'])), { headers: {
            'User-Agent': 'Vortex',
        } }));
}
function downloadConsent(api, gameConf) {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, bepInExDownloader_1.raiseConsentDialog)(api, gameConf)
            .then(result => (result.action === 'Close')
            ? Promise.reject(new vortex_api_1.util.UserCanceled())
            : Promise.resolve());
    });
}
function notifyUpdate(api, latest, current) {
    return __awaiter(this, void 0, void 0, function* () {
        const t = api.translate;
        return new Promise((resolve, reject) => {
            api.sendNotification({
                type: 'info',
                id: `bix-update`,
                noDismiss: true,
                allowSuppress: true,
                title: 'Update for {{name}}',
                message: 'Latest: {{latest}}, Installed: {{current}}',
                replace: {
                    latest,
                    current,
                },
                actions: [
                    {
                        title: 'More', action: (dismiss) => {
                            api.showDialog('info', '{{name}} Update', {
                                text: 'Vortex has detected a newer version of {{name}} ({{latest}}) available to download from {{website}}. You currently have version {{current}} installed.'
                                    + '\nVortex can download and attempt to install the new update for you.',
                                parameters: {
                                    name: 'BepInEx',
                                    website: BIX_LANDING,
                                    latest,
                                    current,
                                },
                            }, [
                                {
                                    label: 'Download',
                                    action: () => {
                                        resolve();
                                        dismiss();
                                    },
                                },
                            ]);
                        },
                    },
                    {
                        title: 'Dismiss',
                        action: (dismiss) => {
                            resolve();
                            dismiss();
                        },
                    },
                ],
            });
        });
    });
}
function getLatestReleases(currentVersion, constraint) {
    return __awaiter(this, void 0, void 0, function* () {
        if (GITHUB_URL) {
            return query(GITHUB_URL, 'releases')
                .then((releases) => {
                if (!Array.isArray(releases)) {
                    return Promise.reject(new vortex_api_1.util.DataInvalid('expected array of github releases'));
                }
                const current = releases
                    .filter(rel => {
                    const tagName = vortex_api_1.util.getSafe(rel, ['tag_name'], '5.4.22');
                    let version;
                    try {
                        version = semver.valid(vortex_api_1.util.semverCoerce(tagName));
                    }
                    catch (e) {
                        return false;
                    }
                    return !currentVersion || (version !== currentVersion && semver.satisfies(version, constraint));
                })
                    .sort((lhs, rhs) => semver.compare(vortex_api_1.util.semverCoerce(rhs.tag_name.slice(1)), vortex_api_1.util.semverCoerce((lhs.tag_name.slice(1)))));
                return Promise.resolve(current);
            });
        }
    });
}
exports.getLatestReleases = getLatestReleases;
function startDownload(api, gameConf, downloadLink) {
    return __awaiter(this, void 0, void 0, function* () {
        const { gameId } = gameConf;
        const redirectionURL = yield new Promise((resolve, reject) => {
            https.request(getRequestOptions(downloadLink), res => {
                return resolve(res.headers['location']);
            })
                .on('error', err => reject(err))
                .end();
        });
        const dlInfo = {
            game: gameId,
            name: 'BepInEx',
        };
        api.events.emit('start-download', [redirectionURL], dlInfo, undefined, (error, id) => {
            var _a;
            if (error !== null) {
                if ((error.name === 'AlreadyDownloaded')
                    && (error.downloadId !== undefined)) {
                    id = error.downloadId;
                }
                else {
                    api.showErrorNotification('Download failed', error, { allowReport: false });
                    return Promise.resolve();
                }
            }
            if (((_a = api.getState().settings.automation) === null || _a === void 0 ? void 0 : _a['install']) === true) {
                return Promise.resolve();
            }
            api.events.emit('start-install-download', id, true, (err, modId) => {
                if (err !== null) {
                    api.showErrorNotification('Failed to install BepInEx', err, { allowReport: false });
                }
                return Promise.resolve();
            });
        }, 'ask');
    });
}
function resolveDownloadLink(gameConf, currentReleases) {
    return __awaiter(this, void 0, void 0, function* () {
        const { rgx, version } = (0, common_1.resolveBixPackage)(gameConf);
        let assetLink;
        const matchingRelease = currentReleases.find((release) => {
            const tagVer = vortex_api_1.util.semverCoerce(release.tag_name.slice(1)).raw.replace(/-.*/igm, '');
            const constraint = `${gameConf.bepinexCoercedVersion.replace(/-.*/igm, '')}`;
            if (semver.gt(tagVer, constraint)) {
                return false;
            }
            else if (semver.gte(tagVer, constraint)) {
                const matches = release.assets.filter(asset => rgx.test(asset.name));
                if (matches.length > 0) {
                    assetLink = matches[0].browser_download_url;
                    return true;
                }
            }
        });
        if (matchingRelease === undefined) {
            return Promise.reject(new vortex_api_1.util.DataInvalid('Failed to find matching BepInEx archive'));
        }
        const downloadLink = assetLink || matchingRelease.assets[0].browser_download_url;
        return (downloadLink === undefined)
            ? Promise.reject(new vortex_api_1.util.DataInvalid('Failed to resolve browser download url'))
            : Promise.resolve({ version: matchingRelease.tag_name.slice(1), downloadLink });
    });
}
function checkForUpdates(api, gameConf, currentVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        return getLatestReleases(currentVersion, `^${gameConf.bepinexVersion}`)
            .then((currentReleases) => __awaiter(this, void 0, void 0, function* () {
            if ((currentReleases === null || currentReleases === void 0 ? void 0 : currentReleases[0]) === undefined) {
                (0, vortex_api_1.log)('error', 'Unable to update BepInEx', 'Failed to find any releases');
                return Promise.resolve(currentVersion);
            }
            const { version, downloadLink } = yield resolveDownloadLink(gameConf, currentReleases);
            if (semver.valid(version) === null) {
                return Promise.resolve(currentVersion);
            }
            else {
                if (semver.gt(version, currentVersion)) {
                    return notifyUpdate(api, version, currentVersion)
                        .then(() => startDownload(api, gameConf, downloadLink))
                        .then(() => Promise.resolve(version));
                }
                else {
                    return Promise.resolve(currentVersion);
                }
            }
        })).catch(err => {
            const suppressibleError = [vortex_api_1.util.DataInvalid, vortex_api_1.util.UserCanceled, vortex_api_1.util.ProcessCanceled].reduce((a, c) => a || err instanceof c, false);
            if (suppressibleError) {
                (0, vortex_api_1.log)('debug', 'Unable to update BepInEx', err.message);
                return Promise.resolve(currentVersion);
            }
            api.showErrorNotification('Unable to update BepInEx', err, { allowReport: false });
            vortex_api_1.util.opn(BIX_RELEASES).catch(() => null);
            return Promise.resolve(currentVersion);
        });
    });
}
exports.checkForUpdates = checkForUpdates;
function downloadFromGithub(api, gameConf) {
    return __awaiter(this, void 0, void 0, function* () {
        return getLatestReleases(undefined, `^${gameConf.bepinexVersion}`)
            .then((currentReleases) => __awaiter(this, void 0, void 0, function* () {
            const { version, downloadLink } = yield resolveDownloadLink(gameConf, currentReleases);
            return downloadConsent(api, gameConf)
                .then(() => startDownload(api, gameConf, downloadLink));
        }))
            .catch(err => {
            const suppressibleError = [vortex_api_1.util.UserCanceled, vortex_api_1.util.ProcessCanceled].reduce((a, c) => a || err instanceof c, false);
            if (!suppressibleError) {
                api.showErrorNotification('Unable to download/install BepInEx - do it manually', err, { allowReport: false });
                vortex_api_1.util.opn(BIX_RELEASES).catch(() => null);
            }
            return Promise.resolve();
        });
    });
}
exports.downloadFromGithub = downloadFromGithub;


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
const path = __importStar(__webpack_require__(/*! path */ "path"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const AttribDashlet_1 = __importDefault(__webpack_require__(/*! ./AttribDashlet */ "./src/AttribDashlet.tsx"));
const bepInExDownloader_1 = __webpack_require__(/*! ./bepInExDownloader */ "./src/bepInExDownloader.ts");
const common_1 = __webpack_require__(/*! ./common */ "./src/common.ts");
const installers_1 = __webpack_require__(/*! ./installers */ "./src/installers.ts");
const types_1 = __webpack_require__(/*! ./types */ "./src/types.ts");
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
function showAttrib(state) {
    const gameMode = vortex_api_1.selectors.activeGameId(state);
    return (0, common_1.getSupportMap)()[gameMode] !== undefined;
}
function isSupported(gameId) {
    const isGameSupported = !['valheim'].includes(gameId);
    const isRegistered = (0, common_1.getSupportMap)()[gameId] !== undefined;
    return isGameSupported && isRegistered;
}
function onCheckModVersion(api, gameId, mods) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const gameConf = (0, common_1.getSupportMap)()[gameId];
        if (gameConf === undefined) {
            return;
        }
        let state = api.getState();
        const profileId = vortex_api_1.selectors.lastActiveProfileForGame(state, gameId);
        if (profileId === undefined) {
            return;
        }
        const profile = vortex_api_1.selectors.profileById(state, profileId);
        if (profile === undefined) {
            return;
        }
        const injectorModIds = Object.keys(mods).filter(id => { var _a; return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === common_1.MODTYPE_BIX_INJECTOR; });
        const enabledId = injectorModIds.find(id => vortex_api_1.util.getSafe(profile, ['modState', id, 'enabled'], false));
        if (enabledId === undefined) {
            return;
        }
        const injectorMod = mods[enabledId];
        if (injectorMod === undefined) {
            return;
        }
        if (gameConf.bepinexVersion && gameConf.bepinexVersion === ((_a = injectorMod.attributes) === null || _a === void 0 ? void 0 : _a.version)) {
            return;
        }
        const forceUpdate = (dwnl) => (0, bepInExDownloader_1.ensureBepInExPack)(api, gameId, true)
            .catch(err => {
            return (err instanceof types_1.NotPremiumError)
                ? Promise.resolve()
                : api.showErrorNotification('Failed to update BepInEx', err);
        })
            .finally(() => {
            if (dwnl === undefined) {
                return Promise.resolve();
            }
            state = api.getState();
            const newMods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', gameId], undefined);
            const newInjector = Object.keys(newMods)
                .find(id => { var _a; return ((_a = newMods[id].attributes) === null || _a === void 0 ? void 0 : _a.fileId) === dwnl.fileId; });
            const batched = [
                vortex_api_1.actions.setModEnabled(profile.id, enabledId, false),
                vortex_api_1.actions.setModEnabled(profile.id, newInjector, true)
            ];
            vortex_api_1.util.batchDispatch(api.store, batched);
        });
        if (gameConf.customPackDownloader !== undefined) {
            const res = yield gameConf.customPackDownloader(vortex_api_1.util.getVortexPath('temp'));
            if (typeof (res) === 'string') {
                if (path.basename(res, path.extname(res)) !== injectorMod.id) {
                    return forceUpdate();
                }
            }
            else if (res !== undefined) {
                const nexDownload = res;
                if (nexDownload.fileId !== ((_b = injectorMod.attributes) === null || _b === void 0 ? void 0 : _b.fileId)) {
                    return forceUpdate(nexDownload);
                }
            }
        }
        else if (gameConf.forceGithubDownload !== true) {
            const download = (0, common_1.getDownload)(gameConf);
            if (((_c = injectorMod.attributes) === null || _c === void 0 ? void 0 : _c.fileId) !== +download.fileId) {
                return forceUpdate(download);
            }
        }
        else {
            yield (0, bepInExDownloader_1.ensureBepInExPack)(api, gameConf.gameId, false, true);
        }
    });
}
function init(context) {
    const getPath = (game) => {
        const state = context.api.getState();
        const gameConf = (0, common_1.getSupportMap)()[game.id];
        const discovery = state.settings.gameMode.discovered[game.id];
        if (gameConf !== undefined && (discovery === null || discovery === void 0 ? void 0 : discovery.path) !== undefined) {
            return (gameConf.installRelPath !== undefined)
                ? path.join(discovery.path, gameConf.installRelPath)
                : discovery.path;
        }
        else {
            return undefined;
        }
    };
    const genTestProps = (gameId) => {
        const state = context.api.getState();
        const activeGameId = (gameId === undefined)
            ? vortex_api_1.selectors.activeGameId(state)
            : gameId;
        const gameConf = (0, common_1.getSupportMap)()[activeGameId];
        const game = vortex_api_1.selectors.gameById(state, activeGameId);
        return { gameConf, game };
    };
    const modTypeTest = (0, util_1.toBlue)(() => Promise.resolve(false));
    const pluginModTypeTest = ((instructions) => __awaiter(this, void 0, void 0, function* () {
        const copyInstructions = instructions.filter(instr => (instr.type === 'copy')
            && path.extname(path.basename(instr.destination)));
        return (copyInstructions.find(instr => path.extname(instr.destination) === '.dll') !== undefined);
    }));
    const rootModTypeTest = ((instructions) => __awaiter(this, void 0, void 0, function* () {
        const bixRootFolders = ['plugins', 'patchers', 'config'];
        const isRootSegment = (seg) => (seg !== undefined)
            ? bixRootFolders.includes(seg.toLowerCase())
            : false;
        const copyInstructions = instructions.filter(instr => (instr.type === 'copy')
            && path.extname(path.basename(instr.destination)));
        for (const instr of copyInstructions) {
            const segments = instr.destination.split(path.sep);
            const rootSeg = segments.find(isRootSegment);
            if (rootSeg && segments.indexOf(rootSeg) === 0) {
                return true;
            }
        }
        return false;
    }));
    context.registerDashlet('BepInEx Support', 1, 2, 250, AttribDashlet_1.default, showAttrib, () => ({}), undefined);
    context.registerAPI('bepinexAddGame', (bepinexConf, callback) => {
        if ((bepinexConf !== undefined) || (bepinexConf === undefined)) {
            (0, common_1.addGameSupport)(bepinexConf);
        }
        else {
            callback === null || callback === void 0 ? void 0 : callback(new vortex_api_1.util.DataInvalid('failed to register bepinex game, invalid object received'));
        }
    }, { minArguments: 1 });
    context.registerModType(common_1.MODTYPE_BIX_INJECTOR, 10, isSupported, getPath, modTypeTest, {
        mergeMods: true,
        name: 'Bepis Injector Extensible',
    });
    context.registerModType('bepinex-patcher', 11, isSupported, (game) => path.join(getPath(game), 'BepInEx', 'patchers'), modTypeTest, {
        mergeMods: true,
        name: 'BepInEx (patchers)',
    });
    context.registerModType('bepinex-root', 12, isSupported, (game) => path.join(getPath(game), 'BepInEx'), (0, util_1.toBlue)(rootModTypeTest), {
        mergeMods: true,
        name: 'BepInEx (root)',
    });
    context.registerModType('bepinex-plugin', 13, isSupported, (game) => path.join(getPath(game), 'BepInEx', 'plugins'), (0, util_1.toBlue)(pluginModTypeTest), {
        mergeMods: true,
        name: 'BepInEx (plugins)',
    });
    context.registerInstaller('bepis-injector-extensible', 10, (0, util_1.toBlue)(installers_1.testSupportedBepInExInjector), (0, util_1.toBlue)(installers_1.installInjector));
    context.registerInstaller('bepinex-root', 10, (0, util_1.toBlue)(installers_1.testSupportedRootMod), (0, util_1.toBlue)(installers_1.installRootMod));
    context.registerTest('bepinex-config-test', 'gamemode-activated', (0, util_1.toBlue)(() => {
        const { game, gameConf } = genTestProps();
        return ((gameConf === null || gameConf === void 0 ? void 0 : gameConf.validateBepInExConfiguration) !== undefined)
            ? gameConf.validateBepInExConfiguration(getPath(game))
            : Promise.resolve(undefined);
    }));
    context.registerTest('doorstop-config-test', 'gamemode-activated', (0, util_1.toBlue)(() => {
        var _a;
        const { game, gameConf } = genTestProps();
        return (((_a = gameConf === null || gameConf === void 0 ? void 0 : gameConf.doorstopConfig) === null || _a === void 0 ? void 0 : _a.validateDoorStopConfig) !== undefined)
            ? gameConf.doorstopConfig.validateDoorStopConfig(getPath(game))
            : Promise.resolve(undefined);
    }));
    context.once(() => {
        context.api.events.on('did-install-mod', (gameId, archiveId, modId) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const gameConf = (0, common_1.getSupportMap)()[gameId];
            if (gameConf === undefined) {
                return;
            }
            const state = context.api.getState();
            const mod = vortex_api_1.util.getSafe(state, ['persistent', 'mods', gameId, modId], undefined);
            if ((mod === null || mod === void 0 ? void 0 : mod.type) !== common_1.MODTYPE_BIX_INJECTOR) {
                return;
            }
            const metaDataDetails = {
                gameId: 'site',
                fileName: (_a = mod.attributes) === null || _a === void 0 ? void 0 : _a.fileName,
                fileMD5: (_b = mod.attributes) === null || _b === void 0 ? void 0 : _b.fileMD5,
                fileSize: (_c = mod.attributes) === null || _c === void 0 ? void 0 : _c.fileSize,
            };
            context.api.lookupModMeta(metaDataDetails, true).then(meta => {
                var _a, _b;
                const profileId = vortex_api_1.selectors.lastActiveProfileForGame(state, gameId);
                const batched = [
                    vortex_api_1.actions.setModEnabled(profileId, modId, true),
                ];
                if (meta.length > 0 && !!((_a = meta[0].value) === null || _a === void 0 ? void 0 : _a.details)) {
                    batched.push(vortex_api_1.actions.setDownloadModInfo(archiveId, 'nexus.modInfo', meta[0].value));
                    batched.push(vortex_api_1.actions.setModAttribute(gameId, modId, 'version', meta[0].value.fileVersion));
                    batched.push(vortex_api_1.actions.setModAttribute(gameId, modId, 'modId', meta[0].value.details.modId));
                    batched.push(vortex_api_1.actions.setModAttribute(gameId, modId, 'fileId', meta[0].value.details.fileId));
                }
                else if (!!gameConf.bepinexVersion && !((_b = mod === null || mod === void 0 ? void 0 : mod.attributes) === null || _b === void 0 ? void 0 : _b.version)) {
                    batched.push(vortex_api_1.actions.setModAttribute(gameId, modId, 'version', gameConf.bepinexVersion));
                }
                else {
                    batched.push(vortex_api_1.actions.setModAttribute(gameId, modId, 'version', '0.0.0'));
                }
                vortex_api_1.util.batchDispatch(context.api.store, batched);
            });
        }));
        context.api.events.on('profile-will-change', () => {
            const state = context.api.getState();
            const oldProfileId = vortex_api_1.util.getSafe(state, ['settings', 'profiles', 'activeProfileId'], undefined);
            const profile = vortex_api_1.selectors.profileById(state, oldProfileId);
            const gameConf = (0, common_1.getSupportMap)()[profile === null || profile === void 0 ? void 0 : profile.gameId];
            if (!!gameConf) {
                (0, util_1.dismissNotifications)(context.api, oldProfileId);
            }
        });
        context.api.events.on('gamemode-activated', (gameMode) => __awaiter(this, void 0, void 0, function* () {
            var _d;
            const t = context.api.translate;
            if (!isSupported(gameMode)) {
                return;
            }
            const { gameConf } = genTestProps(gameMode);
            try {
                yield (0, util_1.createDirectories)(context.api, gameConf);
            }
            catch (err) {
                (0, vortex_api_1.log)('error', 'failed to create BepInEx directories', err);
                return;
            }
            const replace = {
                game: ((_d = vortex_api_1.util.getGame(gameMode)) === null || _d === void 0 ? void 0 : _d.name) || gameMode,
                bl: '[br][/br][br][/br]',
                bixUrl: '[url=https://github.com/BepInEx/BepInEx/releases]BepInEx Release[/url]',
            };
            const dialogContents = (gameConf.autoDownloadBepInEx)
                ? t('The "{{game}}" game extension requires a widely used 3rd party assembly '
                    + 'patching/injection library called Bepis Injector Extensible (BepInEx).{{bl}}'
                    + 'Vortex has downloaded and installed this library automatically for you, and is currently '
                    + 'available in your mods page to enable/disable just like any other regular mod. '
                    + 'Depending on the modding pattern of "{{game}}", BepInEx may be a hard requirement '
                    + 'for mods to function in-game in which case you MUST have the library enabled and deployed '
                    + 'at all times for the mods to work!{{bl}}'
                    + 'To remove the library, simply disable the mod entry for BepInEx.', { replace })
                : t('The "{{game}}" game extension requires a widely used 3rd party assembly '
                    + 'patching/injection library called Bepis Injector Extensible (BepInEx).{{bl}}'
                    + 'BepInEx may be a hard requirement for some mods to function in-game in which case you should '
                    + 'manually download and install the latest {{bixUrl}} in order for the mods to work!{{bl}}'
                    + 'Choose the "BepInEx_x64_...zip" variant - you can then drag and drop it inside the mods page\'s '
                    + '"Drop area" to have Vortex install it as any other mod.{{bl}}'
                    + 'If you installed the BepInEx package through Vortex, don\'t forget to enable it and click "Deploy Mods", '
                    + 'for the package to be linked to your game\'s directory.', { replace });
            return (0, bepInExDownloader_1.ensureBepInExPack)(context.api)
                .then(() => context.api.sendNotification({
                id: 'bepis_injector' + gameMode,
                type: 'info',
                allowSuppress: true,
                message: 'The {{game}} extension uses BepInEx',
                actions: [
                    {
                        title: 'More',
                        action: () => context.api.showDialog('info', 'Bepis Injector Extensible', {
                            bbcode: dialogContents,
                        }, [{ label: 'Close' }]),
                    },
                ],
                replace,
            }))
                .catch(err => {
                return (err instanceof types_1.NotPremiumError)
                    ? Promise.resolve()
                    : context.api.showErrorNotification('Failed to download/install BepInEx', err);
            }).finally(() => {
                const state = context.api.getState();
                const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', gameMode], {});
                const hasInjectorMod = Object.values(mods).some(mod => (mod === null || mod === void 0 ? void 0 : mod.type) === common_1.MODTYPE_BIX_INJECTOR);
                if (hasInjectorMod) {
                    (0, util_1.dismissNotifications)(context.api, vortex_api_1.selectors.lastActiveProfileForGame(context.api.getState(), gameMode));
                }
            });
        }));
        context.api.onAsync('will-deploy', (profileId) => __awaiter(this, void 0, void 0, function* () {
            const state = context.api.getState();
            const activeProfile = vortex_api_1.selectors.activeProfile(state);
            const profile = vortex_api_1.selectors.profileById(state, profileId);
            if ((profile === null || profile === void 0 ? void 0 : profile.gameId) === undefined || profile.gameId !== (activeProfile === null || activeProfile === void 0 ? void 0 : activeProfile.gameId)) {
                return;
            }
            if (!isSupported(profile.gameId)) {
                return;
            }
            return (0, bepInExDownloader_1.ensureBepInExPack)(context.api, profile.gameId)
                .catch(err => {
                return (err instanceof types_1.NotPremiumError)
                    ? Promise.resolve()
                    : context.api.showErrorNotification('Failed to download/install BepInEx', err);
            });
        }));
        context.api.events.on('check-mods-version', (gameId, mods) => onCheckModVersion(context.api, gameId, mods));
    });
    return true;
}
exports["default"] = init;


/***/ }),

/***/ "./src/installers.ts":
/*!***************************!*\
  !*** ./src/installers.ts ***!
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
exports.installRootMod = exports.testSupportedRootMod = exports.installInjector = exports.testSupportedBepInExInjector = void 0;
const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
const vortex_parse_ini_1 = __importStar(__webpack_require__(/*! vortex-parse-ini */ "vortex-parse-ini"));
const common_1 = __webpack_require__(/*! ./common */ "./src/common.ts");
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
function makeCopy(source, gameConfig, alternativeFileName, idx = -1) {
    let filePath = (alternativeFileName !== undefined)
        ? source.replace(path_1.default.basename(source), alternativeFileName)
        : source;
    let destination = (gameConfig.installRelPath !== undefined)
        ? path_1.default.join(gameConfig.installRelPath, filePath)
        : filePath;
    const segments = source.split(path_1.default.sep);
    if (idx && idx !== -1 && idx < segments.length) {
        destination = segments.slice(idx).join(path_1.default.sep);
    }
    return {
        type: 'copy',
        source,
        destination,
    };
}
function applyDoorStopConfig(config, filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const parser = new vortex_parse_ini_1.default(new vortex_parse_ini_1.WinapiFormat());
        const iniData = yield parser.read(filePath);
        iniData.data['UnityDoorstop']['enabled'] = true;
        iniData.data['UnityDoorstop']['targetAssembly'] = config.targetAssembly !== undefined
            ? config.targetAssembly : 'BepInEx\\core\\BepInEx.Preloader.dll';
        iniData.data['UnityDoorstop']['redirectOutputLog'] = config.redirectOutputLog !== undefined
            ? config.redirectOutputLog : false;
        iniData.data['UnityDoorstop']['ignoreDisableSwitch'] = config.ignoreDisableSwitch !== undefined
            ? config.ignoreDisableSwitch : true;
        iniData.data['UnityDoorstop']['dllSearchPathOverride'] = config.dllOverrideRelPath !== undefined
            ? config.dllOverrideRelPath : '';
        return parser.write(filePath, iniData);
    });
}
const MINIMUM_INJECTOR_MATCHES = 8;
function testSupportedBepInExInjector(files, gameId) {
    return __awaiter(this, void 0, void 0, function* () {
        if ((0, common_1.getSupportMap)()[gameId] === undefined) {
            return { supported: false, requiredFiles: [] };
        }
        const filesMatched = files.filter(file => common_1.INJECTOR_FILES.map(f => f.toLowerCase()).includes(path_1.default.basename(file).toLowerCase()));
        return Promise.resolve({
            supported: (filesMatched.length > MINIMUM_INJECTOR_MATCHES),
            requiredFiles: [],
        });
    });
}
exports.testSupportedBepInExInjector = testSupportedBepInExInjector;
function installInjector(files, destinationPath, gameId) {
    return __awaiter(this, void 0, void 0, function* () {
        const gameConfig = (0, common_1.getSupportMap)()[gameId];
        const idx = (() => {
            const bixFile = files.find(file => {
                const segments = file.split(path_1.default.sep);
                return segments.includes('BepInEx');
            });
            if (!bixFile) {
                return -1;
            }
            return bixFile.split(path_1.default.sep).indexOf('BepInEx');
        })();
        const doorStopConfig = gameConfig.doorstopConfig;
        const doorstopType = (doorStopConfig === null || doorStopConfig === void 0 ? void 0 : doorStopConfig.doorstopType) !== undefined
            ? doorStopConfig.doorstopType : 'default';
        const modTypeInstruction = {
            type: 'setmodtype',
            value: common_1.MODTYPE_BIX_INJECTOR,
        };
        const attribInstr = {
            type: 'attribute',
            key: 'customFileName',
            value: 'Bepis Injector Extensible',
        };
        const configData = yield (0, util_1.resolveBepInExConfiguration)(gameId);
        const configInstr = {
            type: 'generatefile',
            data: configData,
            destination: common_1.BEPINEX_CONFIG_REL_PATH,
        };
        const instructions = files.reduce((accum, file) => {
            if (!path_1.default.extname(file) || file.endsWith(path_1.default.sep)) {
                return accum;
            }
            if ((doorstopType !== 'default') && path_1.default.basename(file).toLowerCase() === common_1.DOORSTOPPER_HOOK) {
                switch (doorstopType) {
                    case 'unity3': {
                        accum.push(makeCopy(file, gameConfig, 'version.dll', idx));
                        break;
                    }
                    case 'none': {
                        return accum;
                    }
                }
            }
            else {
                accum.push(makeCopy(file, gameConfig, undefined, idx));
            }
            return accum;
        }, [modTypeInstruction, attribInstr, configInstr]);
        return Promise.resolve({ instructions });
    });
}
exports.installInjector = installInjector;
const ROOT_DIRS = ['plugins', 'config', 'patchers'];
function testSupportedRootMod(files, gameId) {
    return __awaiter(this, void 0, void 0, function* () {
        if ((0, common_1.getSupportMap)()[gameId] === undefined) {
            return { supported: false, requiredFiles: [] };
        }
        const filtered = files.filter(file => {
            const segments = file.split(path_1.default.sep);
            return ROOT_DIRS.includes(segments[0]);
        });
        return { supported: filtered.length > 0, requiredFiles: [] };
    });
}
exports.testSupportedRootMod = testSupportedRootMod;
function installRootMod(files, destinationPath, gameId) {
    return __awaiter(this, void 0, void 0, function* () {
        const gameConfig = (0, common_1.getSupportMap)()[gameId];
        const modTypeInstruction = {
            type: 'setmodtype',
            value: 'bepinex-root',
        };
        const instructions = files
            .filter(file => !file.endsWith(path_1.default.sep))
            .map(file => makeCopy(file, gameConfig));
        instructions.push(modTypeInstruction);
        return Promise.resolve({ instructions });
    });
}
exports.installRootMod = installRootMod;


/***/ }),

/***/ "./src/types.ts":
/*!**********************!*\
  !*** ./src/types.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NotPremiumError = void 0;
class NotPremiumError extends Error {
    constructor() {
        super('User is not premium');
        this.name = 'NotPremiumError';
    }
}
exports.NotPremiumError = NotPremiumError;


/***/ }),

/***/ "./src/util.ts":
/*!*********************!*\
  !*** ./src/util.ts ***!
  \*********************/
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
exports.dismissNotifications = exports.resolveBepInExConfiguration = exports.createDirectories = exports.toBlue = void 0;
const bluebird_1 = __importDefault(__webpack_require__(/*! bluebird */ "bluebird"));
const path_1 = __importDefault(__webpack_require__(/*! path */ "path"));
const toml_1 = __importDefault(__webpack_require__(/*! @iarna/toml */ "./node_modules/@iarna/toml/toml.js"));
const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
const common_1 = __webpack_require__(/*! ./common */ "./src/common.ts");
function toBlue(func) {
    return (...args) => bluebird_1.default.resolve(func(...args));
}
exports.toBlue = toBlue;
function createDirectories(api, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const state = api.getState();
        const modTypes = vortex_api_1.selectors.modPathsForGame(state, config.gameId);
        for (const id of Object.keys(modTypes)) {
            yield vortex_api_1.fs.ensureDirWritableAsync(modTypes[id]);
        }
    });
}
exports.createDirectories = createDirectories;
function resolveBepInExConfiguration(gameId) {
    return __awaiter(this, void 0, void 0, function* () {
        const gameConfig = (0, common_1.getSupportMap)()[gameId];
        const game = vortex_api_1.util.getGame(gameId);
        try {
            if (!!gameConfig.bepinexConfigObject) {
                return Buffer.from(toml_1.default.stringify(gameConfig.bepinexConfigObject), 'utf8');
            }
            const configExists = yield vortex_api_1.fs.statAsync(path_1.default.join(game.extensionPath, common_1.BEPINEX_CONFIG_FILE)).then(() => true).catch(() => false);
            if (configExists) {
                return vortex_api_1.fs.readFileAsync(path_1.default.join(game.extensionPath, common_1.BEPINEX_CONFIG_FILE), 'utf8');
            }
        }
        catch (err) {
        }
        return yield vortex_api_1.fs.readFileAsync(path_1.default.join(__dirname, 'BepInEx.cfg'), 'utf8');
    });
}
exports.resolveBepInExConfiguration = resolveBepInExConfiguration;
function dismissNotifications(api, profileId) {
    const profile = vortex_api_1.selectors.profileById(api.getState(), profileId);
    api.dismissNotification('bix-update');
    api.dismissNotification('bepis_injector' + profile.gameId);
}
exports.dismissNotifications = dismissNotifications;


/***/ }),

/***/ "bluebird":
/*!***************************!*\
  !*** external "bluebird" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("bluebird");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ "lodash":
/*!*************************!*\
  !*** external "lodash" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("lodash");

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

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

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
//# sourceMappingURL=bundledPlugins/modtype-bepinex/modtype-bepinex.js.map