// Code that loads a module from a path only known at runtime (extensions, the
// loot binding) goes through here. The bundler only bundles require() calls
// with a literal string it can resolve, so a require() with a runtime id is
// left alone and reaches Node's own loader. Keeping those calls in one place
// gives tests a single seam to mock and makes the intent explicit.

export function nodeRequire(id: string): ReturnType<NodeJS.Require> {
  return require(id);
}

/**
 * Get the real Node.js module resolution paths for a given directory.
 * Inside a bundle, `module.paths` reflects the bundle's location rather than
 * the caller's. This uses the real Node.js Module API to compute correct
 * resolution paths.
 */
export function getRealNodeModulePaths(baseDir: string): string[] {
  const Module = require("module") as {
    _nodeModulePaths: (dir: string) => string[];
  };
  return Module._nodeModulePaths(baseDir);
}
