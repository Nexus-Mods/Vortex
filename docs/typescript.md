# TypeScript

Which TypeScript compiler each part of the build uses, and why there are two.
This covers the type-checker, the tools that call TypeScript as a library, and
editor setup.

## Two compilers, side by side

The repo installs two TypeScript versions from the pnpm catalog in
`pnpm-workspace.yaml`:

| Catalog entry        | Resolves to                      | Provides                                      |
| -------------------- | -------------------------------- | --------------------------------------------- |
| `@typescript/native` | `typescript@7.x` (the Go port)   | the `tsc` command                             |
| `typescript`         | `@typescript/typescript6` (TS 6) | the `typescript` JS API, and a `tsc6` command |

TypeScript 7 is a rewrite in Go. It type-checks several times faster than TS 6,
but its JavaScript API is new and incompatible with the TS 6 API (`ts.createProgram`,
`getTypeChecker` and so on). Tools that import `typescript` as a library haven't
moved to the new API yet, so they keep getting TS 6 through the npm alias. Anything
that only runs the `tsc` command gets TS 7.

## What uses which

TS 7, through the `tsc` command:

- Every project's `typecheck` target (`pnpm run typecheck`, and the typecheck step
  of `pnpm run build` and `pnpm run verify`).
- The first step of the `vortex-api` declaration build, `tsc -p tsconfig.api.json`
  in `src/renderer`'s `api:dts` script.

TS 6, through the `typescript` JS API:

- `ts-loader` and `fork-ts-checker-webpack-plugin` in `src/renderer/webpack.config.cjs`.
  These go away with the move from webpack to rolldown/vite (APP-565).
- typescript-eslint's type-aware rules and the custom rule in
  `eslint-rules/no-bluebird-resolve-promiselike.mjs`. These go away with the move
  from ESLint to oxlint.
- Declaration (`.d.ts`) bundling: tsdown's `dts` option in each package's
  `tsdown.config.ts`, and `rolldown-plugin-dts` in `src/renderer/api-build.mjs`.

### Upstream TS 7 support

TS 6 can go once every tool above works on TS 7. As of November 2026:

| Tool                           | TS 7 status                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typescript-eslint              | No release supports TS 7. Its TS 7 backend is experimental. Tracked in [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940). This is the blocker.                                                                                                                                   |
| fork-ts-checker-webpack-plugin | Not released. In progress in [fork-ts-checker-webpack-plugin#899](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/pull/899).                                                                                                                                                                                     |
| ts-loader                      | `10.0.0-beta.0` targets TS 7.1 only. It's a rewrite with breaking changes ([release notes](https://github.com/TypeStrong/ts-loader/releases/tag/v10.0.0-beta.0), [ts-loader#1671](https://github.com/TypeStrong/ts-loader/issues/1671)). Not worth adopting before APP-565 removes webpack.                                   |
| rolldown-plugin-dts, tsdown    | Support TS 7.1 through the `tsgo` generator from rolldown-plugin-dts 0.29 ([release notes](https://github.com/sxzz/rolldown-plugin-dts/releases/tag/v0.29.0)). The repo is on 0.28, and the upgrade has breaking option changes. The `tsgo` generator loads TS from the `typescript` package unless you set `tsgo.moduleUrl`. |

## Adding `tsc` to a package

A package that only runs `tsc` needs nothing extra: pnpm puts the workspace
root's `node_modules/.bin` on the path, and the root depends on
`@typescript/native`.

A package that lists `typescript` in its own dependencies must also list
`@typescript/native`. If it doesn't, the `tsc` it finds may come from TS 6. The
same happens if a dependency of the package has a peer dependency on
`typescript` that pnpm installs automatically: `src/renderer` gets a TS 6 `tsc`
from `rolldown-plugin-dts` that way, which is why it lists `@typescript/native`
directly. To check which compiler a package gets, run `pnpm tsc --version` in its
directory.

## Editor setup

`.vscode/settings.json` points VS Code's built-in TypeScript support at
`node_modules/typescript/lib`, which is TS 6. That keeps working unchanged. To get
TS 7 in the editor, install the `TypeScriptTeam.native-preview` extension, which
replaces the built-in TypeScript language server. Its "Disable TypeScript 7
Language Server" command switches back.

## Removing TS 6

Once nothing in the repo imports the `typescript` JS API, delete the
`typescript` alias from the catalog and from each `package.json`, then rename
`@typescript/native` back to `typescript`. To find what still needs TS 6, run
`pnpm why typescript`.
