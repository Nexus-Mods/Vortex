// `typescript` in this workspace is TypeScript 7, so `tsc` and our own code use
// TS 7 without any package opting in. TS 7's JS API is incompatible with TS 6's,
// so every installed package that has a peer dependency on `typescript`
// (ts-loader, fork-ts-checker-webpack-plugin, typescript-eslint, tsdown,
// rolldown-plugin-dts, ...) gets TS 6 as a private dependency instead.
// See docs/typescript.md.
const TS6 = "npm:@typescript/typescript6@6.0.2";

function readPackage(pkg) {
    // Only a peer dependency is redirected. Workspace packages and anything that
    // depends on `typescript` directly keep the catalog's TS 7.
    if (pkg.peerDependencies?.typescript !== undefined) {
        delete pkg.peerDependencies.typescript;
        if (pkg.peerDependenciesMeta?.typescript !== undefined) {
            delete pkg.peerDependenciesMeta.typescript;
        }
        pkg.dependencies = { ...pkg.dependencies, typescript: TS6 };
    }
    return pkg;
}

module.exports = { hooks: { readPackage } };
