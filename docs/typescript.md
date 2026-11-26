# TypeScript

Which TypeScript compiler each part of the build uses, why TS 6 is still
installed, and editor setup.

## TS 7 by default, TS 6 for library users

The `typescript` entry in the pnpm catalog (`pnpm-workspace.yaml`) is
TypeScript 7, the rewrite in Go. Every workspace package that depends on
`typescript` gets TS 7, and so does every `tsc` command.

TS 7 type-checks several times faster than TS 6, but its JavaScript API is new
and incompatible with the TS 6 API (`ts.createProgram`, `getTypeChecker` and so
on). Third-party tools that import `typescript` as a library haven't moved to the
new API yet. `.pnpmfile.cjs` handles them with a `readPackage` hook that runs at
install time: any installed package with a peer dependency on `typescript` has
that peer dependency removed and gets TS 6 (`@typescript/typescript6`) as a
private dependency instead.

The hook only touches peer dependencies. A package that depends on `typescript`
directly keeps TS 7.

## What uses which

TS 7:

- Every project's `typecheck` target (`pnpm run typecheck`, and the typecheck step
  of `pnpm run build` and `pnpm run verify`).
- The first step of the `vortex-api` declaration build, `tsc -p tsconfig.api.json`
  in `src/renderer`'s `api:dts` script.
- Our own code. Nothing in the workspace imports the `typescript` JS API at
  runtime; the custom ESLint rule only uses its types in JSDoc.

TS 6, through the hook:

- typescript-eslint's type-aware rules. These go away with the move from ESLint
  to oxlint.
- Declaration (`.d.ts`) bundling: tsdown's `dts` option in each package's
  `tsdown.config.ts`, and `rolldown-plugin-dts` in `src/renderer/api-build.mjs`.

To check which TypeScript a tool gets, resolve it from the tool's own folder. Run
this in the package that depends on the tool (here the repo root, for tsdown):

```sh
node -e "const r=require('module').createRequire(require.resolve('tsdown/package.json'));console.log(r('typescript/package.json').version)"
```

`6.0.x` is TS 6 (the version of the `@typescript/typescript6` package);
`7.x` is TS 7. Run `pnpm tsc --version` in a package's folder to see which `tsc`
it gets.

### When a tool breaks on TS 7

The hook only catches tools that declare `typescript` as a peer dependency. A
tool that imports `typescript` without declaring it, or lists it as a direct
dependency, gets TS 7. If it uses the old API, it fails, usually with
`ts.createProgram is not a function` or a missing `ts.sys`. Fix it by adding a case for that package to the hook in `.pnpmfile.cjs` that
gives it TS 6, with a comment saying why.

### Upstream TS 7 support

TS 6 and the hook can go once every tool above works on TS 7. As of November 2026:

| Tool                        | TS 7 status                                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typescript-eslint           | No release supports TS 7. Its TS 7 backend is experimental. Tracked in [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940). This is the blocker.                                      |
| rolldown-plugin-dts, tsdown | Support TS 7.1 through the `tsgo` generator from rolldown-plugin-dts 0.29 ([release notes](https://github.com/sxzz/rolldown-plugin-dts/releases/tag/v0.29.0)). The repo is on 0.28, and the upgrade has breaking option changes. |

## Editor setup

VS Code's built-in TypeScript support can't load TS 7, so the repo no longer
points `typescript.tsdk` at `node_modules/typescript`. Install the recommended
`TypeScriptTeam.native-preview` extension to get TS 7 in the editor. Without it,
VS Code falls back to its bundled TypeScript, which may report slightly
different errors from `pnpm run typecheck`.

## Removing TS 6

Once no installed tool needs the TS 6 API, delete `.pnpmfile.cjs` and run
`pnpm install`. To see which tools still have TS 6 as a private dependency, run
`pnpm why @typescript/typescript6`.
