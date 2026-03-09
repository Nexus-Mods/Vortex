// NOTE: Hack for dynamically requiring modules at runtime.
// Webpack normally rewrites all requires to __webpack_require__,
// but __non_webpack_require__ is left as the raw Node.js require.
declare const __non_webpack_require__: NodeJS.Require;

export function webpackRequireHack(id: string): ReturnType<NodeJS.Require> {
  return __non_webpack_require__(id);
}

/**
 * Get the real Node.js module resolution paths for a given directory.
 * Inside a webpack bundle, `module.paths` and `__dirname` are synthetic values
 * that don't reflect the actual filesystem. This uses the real Node.js Module
 * API to compute correct resolution paths.
 */
export function getRealNodeModulePaths(baseDir: string): string[] {
  const Module = __non_webpack_require__("module") as {
    _nodeModulePaths: (dir: string) => string[];
  };
  return Module._nodeModulePaths(baseDir);
}
