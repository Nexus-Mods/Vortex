// The bundler rewrites require() calls it can see into its own module loader.
// Code that loads a module from a path only known at runtime (extensions, the
// loot binding) needs Node's own require instead, so it goes through here.
declare const __non_webpack_require__: NodeJS.Require;

export function nodeRequire(id: string): ReturnType<NodeJS.Require> {
  return __non_webpack_require__(id);
}

/**
 * Get the real Node.js module resolution paths for a given directory.
 * Inside a bundle, `module.paths` and `__dirname` are synthetic values
 * that don't reflect the actual filesystem. This uses the real Node.js Module
 * API to compute correct resolution paths.
 */
export function getRealNodeModulePaths(baseDir: string): string[] {
  const Module = __non_webpack_require__("module") as {
    _nodeModulePaths: (dir: string) => string[];
  };
  return Module._nodeModulePaths(baseDir);
}
