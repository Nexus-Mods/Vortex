/******/ (() => { // webpackBootstrap
/******/ 	const __webpack_modules__ = ({

/***/ "./node_modules/isexe/index.js":
/*!*************************************!*\
  !*** ./node_modules/isexe/index.js ***!
  \*************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      const fs = __webpack_require__(/*! fs */ "fs")
      let core
      if (process.platform === 'win32' || global.TESTING_WINDOWS) {
        core = __webpack_require__(/*! ./windows.js */ "./node_modules/isexe/windows.js")
      } else {
        core = __webpack_require__(/*! ./mode.js */ "./node_modules/isexe/mode.js")
      }

      module.exports = isexe
      isexe.sync = sync

      function isexe (path, options, cb) {
        if (typeof options === 'function') {
          cb = options
          options = {}
        }

        if (!cb) {
          if (typeof Promise !== 'function') {
            throw new TypeError('callback not provided')
          }

          return new Promise(function (resolve, reject) {
            isexe(path, options || {}, function (er, is) {
              if (er) {
                reject(er)
              } else {
                resolve(is)
              }
            })
          })
        }

        core(path, options || {}, function (er, is) {
    // ignore EACCES because that just means we aren't allowed to run it
          if (er) {
            if (er.code === 'EACCES' || options && options.ignoreErrors) {
              er = null
              is = false
            }
          }
          cb(er, is)
        })
      }

      function sync (path, options) {
  // my kingdom for a filtered catch
        try {
          return core.sync(path, options || {})
        } catch (er) {
          if (options && options.ignoreErrors || er.code === 'EACCES') {
            return false
          } else {
            throw er
          }
        }
      }


/***/ }),

/***/ "./node_modules/isexe/mode.js":
/*!************************************!*\
  !*** ./node_modules/isexe/mode.js ***!
  \************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      module.exports = isexe
      isexe.sync = sync

      const fs = __webpack_require__(/*! fs */ "fs")

      function isexe (path, options, cb) {
        fs.stat(path, function (er, stat) {
          cb(er, er ? false : checkStat(stat, options))
        })
      }

      function sync (path, options) {
        return checkStat(fs.statSync(path), options)
      }

      function checkStat (stat, options) {
        return stat.isFile() && checkMode(stat, options)
      }

      function checkMode (stat, options) {
        const mod = stat.mode
        const uid = stat.uid
        const gid = stat.gid

        const myUid = options.uid !== undefined ?
          options.uid : process.getuid && process.getuid()
        const myGid = options.gid !== undefined ?
          options.gid : process.getgid && process.getgid()

        const u = parseInt('100', 8)
        const g = parseInt('010', 8)
        const o = parseInt('001', 8)
        const ug = u | g

        const ret = (mod & o) ||
    (mod & g) && gid === myGid ||
    (mod & u) && uid === myUid ||
    (mod & ug) && myUid === 0

        return ret
      }


/***/ }),

/***/ "./node_modules/isexe/windows.js":
/*!***************************************!*\
  !*** ./node_modules/isexe/windows.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      module.exports = isexe
      isexe.sync = sync

      const fs = __webpack_require__(/*! fs */ "fs")

      function checkPathExt (path, options) {
        let pathext = options.pathExt !== undefined ?
          options.pathExt : process.env.PATHEXT

        if (!pathext) {
          return true
        }

        pathext = pathext.split(';')
        if (pathext.indexOf('') !== -1) {
          return true
        }
        for (let i = 0; i < pathext.length; i++) {
          const p = pathext[i].toLowerCase()
          if (p && path.substr(-p.length).toLowerCase() === p) {
            return true
          }
        }
        return false
      }

      function checkStat (stat, path, options) {
        if (!stat.isSymbolicLink() && !stat.isFile()) {
          return false
        }
        return checkPathExt(path, options)
      }

      function isexe (path, options, cb) {
        fs.stat(path, function (er, stat) {
          cb(er, er ? false : checkStat(stat, path, options))
        })
      }

      function sync (path, options) {
        return checkStat(fs.statSync(path), path, options)
      }


/***/ }),

/***/ "./node_modules/which/which.js":
/*!*************************************!*\
  !*** ./node_modules/which/which.js ***!
  \*************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

      module.exports = which
      which.sync = whichSync

      const isWindows = process.platform === 'win32' ||
    process.env.OSTYPE === 'cygwin' ||
    process.env.OSTYPE === 'msys'

      const path = __webpack_require__(/*! path */ "path")
      const COLON = isWindows ? ';' : ':'
      const isexe = __webpack_require__(/*! isexe */ "./node_modules/isexe/index.js")

      function getNotFoundError (cmd) {
        const er = new Error('not found: ' + cmd)
        er.code = 'ENOENT'

        return er
      }

      function getPathInfo (cmd, opt) {
        const colon = opt.colon || COLON
        let pathEnv = opt.path || process.env.PATH || ''
        let pathExt = ['']

        pathEnv = pathEnv.split(colon)

        let pathExtExe = ''
        if (isWindows) {
          pathEnv.unshift(process.cwd())
          pathExtExe = (opt.pathExt || process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
          pathExt = pathExtExe.split(colon)


    // Always test the cmd itself first.  isexe will check to make sure
    // it's found in the pathExt set.
          if (cmd.indexOf('.') !== -1 && pathExt[0] !== '')
            pathExt.unshift('')
        }

  // If it has a slash, then we don't bother searching the pathenv.
  // just check the file itself, and that's it.
        if (cmd.match(/\//) || isWindows && cmd.match(/\\/))
          pathEnv = ['']

        return {
          env: pathEnv,
          ext: pathExt,
          extExe: pathExtExe
        }
      }

      function which (cmd, opt, cb) {
        if (typeof opt === 'function') {
          cb = opt
          opt = {}
        }

        const info = getPathInfo(cmd, opt)
        const pathEnv = info.env
        const pathExt = info.ext
        const pathExtExe = info.extExe
        const found = []

  ;(function F (i, l) {
          if (i === l) {
            if (opt.all && found.length)
              return cb(null, found)
            else
              return cb(getNotFoundError(cmd))
          }

          let pathPart = pathEnv[i]
          if (pathPart.charAt(0) === '"' && pathPart.slice(-1) === '"')
            pathPart = pathPart.slice(1, -1)

          let p = path.join(pathPart, cmd)
          if (!pathPart && (/^\.[\\\/]/).test(cmd)) {
            p = cmd.slice(0, 2) + p
          }
          (function E (ii, ll) {
            if (ii === ll) return F(i + 1, l)
            const ext = pathExt[ii]
            isexe(p + ext, { pathExt: pathExtExe }, function (er, is) {
              if (!er && is) {
                if (opt.all)
                  found.push(p + ext)
                else
                  return cb(null, p + ext)
              }
              return E(ii + 1, ll)
            })
          })(0, pathExt.length)
        })(0, pathEnv.length)
      }

      function whichSync (cmd, opt) {
        opt = opt || {}

        const info = getPathInfo(cmd, opt)
        const pathEnv = info.env
        const pathExt = info.ext
        const pathExtExe = info.extExe
        const found = []

        for (let i = 0, l = pathEnv.length; i < l; i ++) {
          let pathPart = pathEnv[i]
          if (pathPart.charAt(0) === '"' && pathPart.slice(-1) === '"')
            pathPart = pathPart.slice(1, -1)

          let p = path.join(pathPart, cmd)
          if (!pathPart && /^\.[\\\/]/.test(cmd)) {
            p = cmd.slice(0, 2) + p
          }
          for (let j = 0, ll = pathExt.length; j < ll; j ++) {
            const cur = p + pathExt[j]
            var is
            try {
              is = isexe.sync(cur, { pathExt: pathExtExe })
              if (is) {
                if (opt.all)
                  found.push(cur)
                else
                  return cur
              }
            } catch (ex) {}
          }
        }

        if (opt.all && found.length)
          return found

        if (opt.nothrow)
          return null

        throw getNotFoundError(cmd)
      }


/***/ }),

/***/ "./src/platform.ts":
/*!*************************!*\
  !*** ./src/platform.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

      "use strict";

      Object.defineProperty(exports, "__esModule", ({ value: true }));
      exports.normalizePath = exports.platformSwitch = exports.getWineDriveCPath = exports.getLineEnding = exports.getPathSeparator = exports.getExecutableExtension = exports.isUnixLike = exports.isLinux = exports.isMacOS = exports.isWindows = exports.getPlatform = void 0;
      const os = __webpack_require__(/*! os */ "os");
      const path = __webpack_require__(/*! path */ "path");
      function getPlatform() {
        return process.platform;
      }
      exports.getPlatform = getPlatform;
      function isWindows() {
        return process.platform === 'win32';
      }
      exports.isWindows = isWindows;
      function isMacOS() {
        return process.platform === 'darwin';
      }
      exports.isMacOS = isMacOS;
      function isLinux() {
        return process.platform === 'linux';
      }
      exports.isLinux = isLinux;
      function isUnixLike() {
        return process.platform !== 'win32';
      }
      exports.isUnixLike = isUnixLike;
      function getExecutableExtension() {
        return isWindows() ? '.exe' : '';
      }
      exports.getExecutableExtension = getExecutableExtension;
      function getPathSeparator() {
        return isWindows() ? '\\' : '/';
      }
      exports.getPathSeparator = getPathSeparator;
      function getLineEnding() {
        return isWindows() ? '\r\n' : '\n';
      }
      exports.getLineEnding = getLineEnding;
      function getWineDriveCPath() {
        return path.join(os.homedir(), '.wine', 'drive_c');
      }
      exports.getWineDriveCPath = getWineDriveCPath;
      function platformSwitch(cases) {
        if (isWindows() && cases.windows !== undefined)
          return cases.windows;
        if (isMacOS() && cases.macos !== undefined)
          return cases.macos;
        if (isLinux() && cases.linux !== undefined)
          return cases.linux;
        if (cases.default !== undefined)
          return cases.default;
        throw new Error('No matching platform case and no default provided');
      }
      exports.platformSwitch = platformSwitch;
      function normalizePath(inputPath) {
        return path.normalize(inputPath).replace(/\\/g, '/');
      }
      exports.normalizePath = normalizePath;


/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

      "use strict";
      module.exports = require("fs");

/***/ }),

/***/ "os":
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
/***/ ((module) => {

      "use strict";
      module.exports = require("os");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

      "use strict";
      module.exports = require("path");

/***/ }),

/***/ "process":
/*!**************************!*\
  !*** external "process" ***!
  \**************************/
/***/ ((module) => {

      "use strict";
      module.exports = require("process");

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
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
  const __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
  (() => {
    "use strict";
    const exports = __webpack_exports__;
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/

    Object.defineProperty(exports, "__esModule", ({ value: true }));
    const path = __webpack_require__(/*! path */ "path");
    const process = __webpack_require__(/*! process */ "process");
    const vortex_api_1 = __webpack_require__(/*! vortex-api */ "vortex-api");
    const which = __webpack_require__(/*! which */ "./node_modules/which/which.js");
    const platform_1 = __webpack_require__(/*! ./platform */ "./src/platform.ts");
    const platformSwitch = (cases) => {
      if ((0, platform_1.isWindows)() && cases.windows !== undefined)
        return cases.windows;
      if ((0, platform_1.isMacOS)() && cases.macos !== undefined)
        return cases.macos;
      if ((0, platform_1.isLinux)() && cases.linux !== undefined)
        return cases.linux;
      return cases.default;
    };
    function exeExtension() {
      return (0, platform_1.isWindows)() ? '.exe' : '';
    }
    function findJava() {
      if (process.env.JAVA_HOME === undefined) {
        return undefined;
      }
      const fileName = 'java' + exeExtension();
      return path.join(process.env.JAVA_HOME, 'bin', fileName);
    }
    function findPython() {
      try {
        return which.sync('python');
      }
      catch (err) {
        (0, vortex_api_1.log)('info', 'python not found', err.message);
        return undefined;
      }
    }
    const javaPath = findJava();
    const pythonPath = findPython();
    function init(context) {
      context.registerInterpreter('.jar', (input) => {
        if (javaPath === undefined) {
          throw new vortex_api_1.util.MissingInterpreter('Java isn\'t installed', 'https://www.java.com/de/download/');
        }
        return {
          executable: javaPath,
          args: ['-jar', input.executable].concat(input.args),
          options: input.options,
        };
      });
      context.registerInterpreter('.vbs', (input) => {
        return {
          executable: path.join(process.env.windir, 'system32', 'cscript.exe'),
          args: [input.executable].concat(input.args),
          options: input.options,
        };
      });
      context.registerInterpreter('.py', (input) => {
        if (pythonPath === undefined) {
          throw new vortex_api_1.util.MissingInterpreter('Python isn\'t installed', 'https://www.python.org/downloads/');
        }
        return {
          executable: pythonPath,
          args: [input.executable].concat(input.args),
          options: input.options,
        };
      });
      if (process.platform === 'win32') {
        context.registerInterpreter('.cmd', (input) => {
          return {
            executable: 'cmd.exe',
            args: ['/K', `"${input.executable}"`].concat(input.args),
            options: input.options,
          };
        });
        context.registerInterpreter('.bat', (input) => {
          return {
            executable: 'cmd.exe',
            args: ['/K', `"${input.executable}"`].concat(input.args),
            options: Object.assign(Object.assign({}, input.options), { shell: true }),
          };
        });
      }
      return true;
    }
    exports["default"] = init;

  })();

  module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=bundledPlugins/common-interpreters/common-interpreters.js.map