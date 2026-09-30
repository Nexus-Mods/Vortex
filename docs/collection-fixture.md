# Collection Fixture

How to get a Vortex with a large collection already installed, without downloading or installing
anything, so deploy and UI behaviour on a big library can be tested and timed in minutes.

## Why

Reproducing a large-library performance report means installing a real collection from a clean
state, which takes hours of downloading before the interesting part starts. Most of what needs
checking afterwards (deploying, the Mods page, the conflict editor, the collection page) only
needs the _result_ of that install: the records in state and the files in staging. The fixture
generates both from synthetic data and Vortex imports them at startup through its existing
`--merge` switch.

The generator writes nothing into the regular Vortex profile. Everything lives under one output
directory with its own user-data, so a fixture can be thrown away or regenerated freely.

## What it generates

`scripts/collection-fixture/generate.ts` builds, under the output directory:

| Path                       | Content                                                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state.json`               | The state backup Vortex merges: `app.instanceId`, the managed game with a manual path, the active profile, the collection mod with its member rules, every member and library mod, their finished downloads, categories |
| `game/<Game>/`             | A fake game install that passes the game extension's discovery check                                                                                                                                                    |
| `staging/<gameId>/<mod>/`  | One folder per mod with real files for deployment to link: a plugin plus loose assets for Bethesda games, a SMAPI mod folder with a `manifest.json` for Stardew Valley                                                  |
| `downloads/<gameId>/*.zip` | One small archive per mod; its md5 is what the collection rule and the download record carry                                                                                                                            |
| `fixture.json`             | The spec, the resolved paths and a summary, read by the launcher                                                                                                                                                        |

The records follow what a real install writes, as modelled by the renderer's test builders in
`src/renderer/src/test-utils/builders.ts`:

- The collection is a mod of type `collection`. Each member is named by a `requires` or
  `recommends` rule carrying a reference tag, the pinned md5 and Nexus repo ids, and a phase.
- Each member is an installed mod with `referenceTag` and `installedAsDependency`, the
  attributes the Mods page sorts and filters on (name, version, author, category, install time,
  size), and a matching finished download.
- A share of members carry `before` or `after` rules against earlier members, in the
  `{ id, idHint, archiveId }` form `postprocessCollection` writes, and the same rules appear
  as `modRules` in the collection's `collection.json`.
- A share of members ship the same asset path, so deployment reports genuine file conflicts and
  the conflict editor has work to do.
- Library mods model what the user installed outside the collection.
- The profile leaves a share of mods disabled, so enabled/disabled sorting has both kinds.
  Library mods are disabled first, then optional members, then required ones, since a user is
  likelier to switch off something they added than a collection member.

The collection carries no Nexus ids (`collectionId`, `revisionId`, `collectionSlug`,
`revisionNumber`). Every collection view guards its revision fetch on those, so the fixture stays
offline and the collection behaves like one authored locally.

## Sizes

Fixture sizes come from the "Representative Vortex User Setup" benchmark specification, built
from 30 days of Vortex load-order reports to 29 Sep 2026. Skyrim Special Edition is the most
managed game and its setups run about four times larger than the median across games, so it is
the default game and the tiers are its percentiles:

| Tier      | Percentile | Mods  | Enabled | Role                  |
| --------- | ---------- | ----- | ------- | --------------------- |
| `light`   | p25        | 47    | 33      | New or casual user    |
| `typical` | p50        | 150   | 117     | Average user, default |
| `heavy`   | p75        | 570   | 555     | Required variant      |
| `power`   | p90        | 1,594 | 1,221   | Required variant      |
| `stress`  | p99        | 2,685 | 2,336   | Optional upper limit  |

About a third of Skyrim SE setups have 500 or more mods, and those users are the likeliest to
notice slow deploys, so benchmark `heavy` and `power` as well as `typical`.

The mod and enabled counts are separate percentiles in the source, so the difference between them
is only an approximate disabled count. The source has no enabled figure at p99, so `stress` uses
the observed average of 87% enabled. The table lives in `scripts/collection-fixture/tiers.ts`;
update it when the specification is refreshed.

The telemetry cannot say how many of a user's mods came from a collection. By default 80% of a
tier's mods are collection members and the rest are library mods. That split is a judgement
call: pass `--collection-share 1` to put the whole tier in the collection, or set `--members`
and `--library` directly.

## Generate

From the repo root:

```
pnpm run fixture:collection -- --tier power --out C:\fixtures\sse-power
```

With no size flags the fixture is Skyrim SE at the `typical` tier. Options, all optional:

| Flag                 | Default                             | Meaning                                                  |
| -------------------- | ----------------------------------- | -------------------------------------------------------- |
| `--tier <id>`        | `typical`, unless `--members` given | Size from the table above                                |
| `--collection-share` | 0.8                                 | Share of the tier's mods that belong to the collection   |
| `--members <n>`      | from the tier                       | Collection members; overrides the tier's split           |
| `--library <n>`      | from the tier                       | Mods outside the collection; overrides the tier's split  |
| `--enabled <n>`      | the tier's figure, or 87% of mods   | Mods enabled in the profile                              |
| `--out <dir>`        | `<tmp>/vortex-collection-fixture`   | Output directory                                         |
| `--game <id>`        | `skyrimse`                          | `skyrimse`, `fallout4` or `stardewvalley`                |
| `--phases <n>`       | 4                                   | Install phases the members are spread over               |
| `--optional`         | 0.1                                 | Share of members that are optional                       |
| `--overlap`          | 0.1                                 | Share of members sharing a file with others              |
| `--seed <n>`         | 1                                   | Same spec and seed reproduce the fixture byte for byte   |
| `--name <text>`      | `Fixture Collection <game> <tier>`  | Collection name                                          |
| `--auto-deploy`      | off                                 | Leave auto-deploy on; off makes deploys manual, timeable |
| `--force`            |                                     | Replace an existing output directory, user-data included |

The fake game and the staging folder are both under the output directory, so they are always on
the same drive and the hardlink deployment method always applies.

## Launch

```
pnpm run build
pnpm run fixture:collection:launch -- --out C:\fixtures\sse-power
```

The launcher starts the development build with `--user-data <out>/user-data`. On the first
launch it adds `--merge <out>/state.json`, which `Application.importBackup` applies before
hydration; later launches reuse the persisted state, so a session can be resumed. `--reset`
deletes the user-data and imports again. `--debug` adds the Node inspector on 9229; the renderer
debugging port (9222) is on for every development launch, so the chrome-devtools MCP attaches
without it.

The launcher also keeps game settings inside the fixture. Bethesda games keep plugins.txt under
`%LOCALAPPDATA%\<Game>\` and their ini files under `Documents\My Games\<Game>\`, and deployment
rewrites both. The launcher points `LOCALAPPDATA` at `<out>/local-app-data` and sets
`VORTEX_DOCUMENTS_PATH` to `<out>/documents`, which `src/main/src/main.ts` applies as the
documents folder. Windows resolves the documents folder through the shell rather than the
environment, so that override is the only way to move it. A real Skyrim SE or Fallout 4 install
on the same machine is left alone.

In a VS Code terminal the build can fail with "Failed to process project graph". VS Code leaks
`ELECTRON_RUN_AS_NODE` into its terminals; clearing it exposes a stale nx daemon. Build with
`Remove-Item Env:ELECTRON_RUN_AS_NODE; $env:NX_DAEMON='false'; pnpm run build`, or run
`pnpm nx reset` once from a terminal VS Code didn't open. A build that stops with "Access is
denied" means a Vortex launched against a fixture is still running from `src/main/build`; close
it first.

Coming from an older checkout, delete the build output of extensions master has since removed
or moved into the renderer (`gamebryo-plugin-management` and the `gamestore-*` family among
them). Git leaves their untracked `dist` and `node_modules` behind, the build still bundles
them, and the old plugin manager then crashes the Plugins and Mods pages with
"(masterlist.groups || []).map is not a function". A two-copies symptom is "Plugins" appearing
twice in the menu. This PowerShell lists every extension folder git no longer tracks:

```
Get-ChildItem extensions, extensions\games -Directory | Where-Object { -not (git ls-files $_.FullName) } | Select-Object -ExpandProperty Name
```

Delete each listed folder, and the folder of the same name under `src/main/build/bundledPlugins`,
then rebuild.

The build step is needed because the launcher runs Electron directly against `src/main/build`.
It does not go through `pnpm run dev`, which owns that directory while it runs, so close a dev
session first. The development build has its own instance lock, so an installed release of
Vortex can stay open; a second development instance cannot.

Log in or not as usual; the fixture does not touch the account hive.

## What to test on it

The fixture is aimed at the checks that were manual for LAZ-1122:

- Deploy from the Mods page and time it. Auto-deploy is off by default so nothing deploys on
  startup.
- Scroll, sort and filter the Mods page, toggle enabled and disabled, with a few thousand rows.
- Open the conflict editor: the overlapping members give it real conflicts.
- Open the collection page and its item rows.
- Profile the renderer while doing any of the above; see the performance section of
  [DEBUGGING-GUIDE.md](DEBUGGING-GUIDE.md).

## Benchmark

The same checks run unattended with:

```
pnpm run fixture:collection:bench -- --out C:\fixtures\sse-power --label master
```

`packages/e2e/src/benchmark/collectionBenchmark.ts` launches the development build against the
fixture through Playwright, the way the E2E suite does, and drives the Mods page itself. It
lives in the E2E package for Playwright, but it is not part of the E2E suite and needs no login.

It re-imports the fixture's state first (`--keep-state` skips that) so every run starts from the
same place. It then measures, in order:

- startup, to the Mods page showing rows
- five seconds idle on the Mods page
- scrolling the list to the bottom and back
- sorting by status and by name, grouping by status (the "three-line icon"), typing and clearing
  a name filter, and toggling a mod's status
- switching to the Plugins page, five seconds idle there, and switching back. It also counts the
  table rows the hidden Mods page still holds, the rendering LAZ-1122 was about.
- `--deploys` purge-and-deploy cycles (default 3), then one deploy with nothing to change

Each action is timed in the page with the browser's performance APIs, so Playwright's own round
trips do not count:

| Metric            | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| Settled after     | Time until the page stopped changing after the action                 |
| Worst input delay | Longest time from a click or key press to the next paint              |
| UI blocked        | Total time the main thread ran tasks over 50 ms and could not respond |
| Worst frame       | Longest gap between two painted frames                                |
| Stutters          | Frames over 50 ms                                                     |

Deploy time runs from the click to the "Mods deployed" notification. The per-step breakdown
comes from the deployment progress lines in the fixture's `vortex.log`.

The report goes to `<out>/reports/` as Markdown, for a ticket or PR, and as JSON, for comparing
runs. `--label` tags both with, say, the branch under test.

Compare builds on the same machine, fixture and tier, and treat a single run as noisy: run each
build two or three times. The window stays visible, because Chromium stops producing frames for
a hidden one. `--headless` hides it, but then only the deploy timings mean anything.

An action reported as "did not settle" kept changing the page for 20 seconds. The JSON report
lists, under `stillChanging`, the elements that kept changing. Setting `VORTEX_BENCH_DEBUG=1`
prints why a settle check failed.

The benchmark skips Vortex's single-instance lock, so it can run while another Vortex is open. It
gives Electron its own profile folder under the fixture (`electron-user-data`) for that reason:
Vortex opens a database in that folder before switching to `--user-data`, and a shared one would
leave the second instance waiting on the first's lock.

## Caveats

- **Nexus lookups fail for the fake ids.** Members carry `source: "nexus"` with generated mod
  and file ids so the Mods page columns look real. An update check or endorsement for them
  gets an error from the site. Use a logged-out session if that noise gets in the way.
- **Settings isolation needs the launcher.** Starting Vortex against the fixture any other way,
  for example with `--merge` by hand, writes plugins.txt and the ini files to the real folders.
- **The first deploy warns that the ini files are missing.** The fixture's documents folder
  starts empty, and the first deploy creates them.
- **Stardew Valley reports SMAPI as missing.** The fake install has no SMAPI, so the extension's
  usual notification shows. It does not stop deployment.
- **The install itself is not exercised.** The fixture starts _after_ the install, so it says
  nothing about install-time performance or the phased installer. A pre-install variant of the
  same data (downloads present, members not yet installed) would drive the real installer
  against tiny archives, but `gatherDependencies` looks every rule up on Nexus, so that needs a
  stub for the lookup first.

## Key files

- `scripts/collection-fixture/generate.ts` - CLI: parses the spec, writes the fixture
- `scripts/collection-fixture/buildFixture.ts` - Builds the state and file list in memory; the
  place to change what a member or the collection looks like
- `scripts/collection-fixture/tiers.ts` - Benchmark tier sizes from the setup specification
- `scripts/collection-fixture/games.ts` - Per-game fake install and staging layout
- `scripts/collection-fixture/zip.ts` - Dependency-free stored zip writer for the archives
- `scripts/collection-fixture/plugin.ts` - Minimal well-formed Bethesda plugin
- `scripts/collection-fixture/launch.ts` - Starts Electron against the fixture's user-data, with game settings redirected into it
- `src/main/src/main.ts` - Applies `VORTEX_DOCUMENTS_PATH`
- `packages/e2e/src/benchmark/collectionBenchmark.ts` - The unattended benchmark
- `packages/e2e/src/benchmark/probe.ts` - The in-page timing probe and what it records
- `src/main/src/Application.ts` - `importBackup`, what `--merge` and `--restore` run
- `src/main/src/store/flattenState.ts` - How a backup's hives become persisted leaves

## See also

- [testing.md](testing.md) - Unit, component and E2E tests
- [mod-management/collections.md](mod-management/collections.md) - How a collection installs, for
  the part the fixture skips
