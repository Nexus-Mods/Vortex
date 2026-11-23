# Linting

How oxlint is set up across the workspace, why the main app projects have two
lint configs, and how to make the lint stricter over time. Formatting is a
separate tool (oxfmt) and isn't covered here.

## Commands

| Script         | Runs                               | Used by                                   |
| -------------- | ---------------------------------- | ----------------------------------------- |
| `lint`         | `oxlint --quiet` (errors only)     | `pnpm run lint`, `build`, `verify`, CI    |
| `lint:verbose` | `oxlint` (errors and warnings)     | Developers looking at the warning backlog |
| `lint:strict`  | `scripts/strict-lint.mjs` (errors) | The nightly `lint-metrics` workflow       |

`pnpm run lint` at the root runs every project's `lint` target through nx.
Extensions only have `lint:strict`, so they feed the nightly metrics but don't
gate anything.

Lint is type-aware (`typeAware` and `typeCheck` in the base config), so a
project's workspace dependencies must be built first. nx does this through
`dependsOn: ["^build"]`. Running `oxlint` by hand after pulling can report
`TS2305`-style errors from stale `dist` folders; build the dependencies and run
it again.

## Key Files

- `oxlint.base.config.json` - Plugins, categories and options every project
  extends. The `correctness` and `suspicious` categories are errors; the rules
  listed under `rules` are warnings everywhere.
- `oxlint.strict.config.json` - The same rules as the base config's `rules`
  list, at error. Extended by the strict configs below.
- `src/main/.oxlintrc.strict.json`, `src/renderer/.oxlintrc.strict.json`,
  `packages/e2e/.oxlintrc.strict.json` - The full rule set for each project.
  `lint:strict` runs these.
- `src/main/.oxlintrc.json`, `src/renderer/.oxlintrc.json`,
  `packages/e2e/.oxlintrc.json` - What `lint` runs. Each extends its strict
  config and turns rules that still have violations down to `warn`.
- Every other project's `.oxlintrc.json` - A single config for `lint` and
  `lint:strict`.
- `scripts/strict-lint.mjs` - Runs `lint:strict` and writes
  `.lint-results.json` in CI for the metrics upload.

## Two configs: gating and strict

`src/main`, `src/renderer` and `packages/e2e` were the last projects on ESLint.
Their oxlint configs are split in two so the move didn't change what fails the
build, didn't require fixing thousands of existing violations, and didn't move
the nightly lint metrics:

- The **strict** config (`.oxlintrc.strict.json`) holds every rule the project
  should meet. The nightly metrics count its errors.
- The **gating** config (`.oxlintrc.json`) extends the strict config and lists,
  under `rules`, every rule that still has violations, at `warn`. `lint` only
  reports errors, so those rules don't fail the build, but any rule not on the
  list does.

Rules on a warn list that only fail outside `src/**/*.{ts,tsx}` (build scripts,
test setup) are downgraded in an `overrides` block for just those files. ESLint
never type-checked those files, and this keeps `src/` at full strength.

The warn lists only shrink. To promote a rule, fix its remaining violations
(`pnpm exec oxlint -c .oxlintrc.strict.json` in the project shows them), then
delete its line from the gating config. Don't add new rules to a warn list to
get a change through; fix the code or use a disable comment with a reason.

`oxlint.base.config.json` lists the rules ESLint used to enforce in these
projects (`eslint:recommended`, typescript-eslint's `recommendedTypeChecked`,
`consistent-type-imports`) at `warn`. Most other projects have thousands of
violations of them, mainly the `no-unsafe-*` family in game extensions, so they
show up in `lint:verbose` as the backlog for raising every project to the same
standard.

## Restricted imports

`no-restricted-imports` blocks a few imports in the renderer:

- `clipboard` from `electron`, which doesn't work in the renderer. Use
  `window.api.clipboard`.
- `util/opn`, which only backs the deprecated `util.opn` extension API. Use
  `window.api.shell.openUrl` or `window.api.shell.openFile`.
- Value imports of `react-markdown`. Use `Markdown` from
  `ui/components/prose/markdown`, or `ReactMarkdown` from `util/react_markdown`
  for older call sites. The rule doesn't see `import()` or `require()`, so those
  rely on review.
- `bluebird`, in every project. Bluebird is being removed, and the rule keeps it
  from coming back. Renderer files that still use it are listed in the
  `overrides` block of `src/renderer/.oxlintrc.strict.json`. When a file stops
  importing Bluebird, remove it from that list.

## Disable comments

Use oxlint's directives, name the rule, and give a reason after `--`:

```ts
// oxlint-disable-next-line no-control-regex -- strips ANSI escape codes
const ansiRegex = /\x1b\[[0-9;]*m/g;
```

- `reportUnusedDisableDirectives` is an error, so a directive that no longer
  suppresses anything fails `lint`. Delete it.
- `eslint-disable` comments are ignored (`respectEslintDisableDirectives` is
  `false`), so one pasted from elsewhere does nothing.
- `react/exhaustive-deps` reports at the first use of a missing dependency
  inside the hook body, not at the dependency array. Wrap the hook in
  `// oxlint-disable react/exhaustive-deps -- reason` and
  `// oxlint-enable react/exhaustive-deps` instead of using `-next-line`.

## Known noise

The renderer's `tsconfig.json` has `strictNullChecks` off. The
`typescript/no-unnecessary-boolean-literal-compare` and
`typescript/no-useless-default-assignment` rules need it, so they report a
notice at `1:1` in every renderer file. These are warnings in the gating config
and show up in `lint:verbose`.

## Editor

`.vscode/extensions.json` recommends the oxc extension (`oxc.oxc-vscode`), which
shows oxlint diagnostics and fixes on save (`source.fixAll.oxc` in
`.vscode/settings.json`).
