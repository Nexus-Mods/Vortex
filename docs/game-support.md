# Game Support in Vortex

How a game comes to be supported: the routes that produce a game extension, how
those extensions reach a user's machine, and what marks one as official rather
than community. For someone who knows the codebase but has not worked on game
extensions before. For where game art comes from and which image wins on each
surface, see [game-art-assets.md](game-art-assets.md).

## Four routes, one load contract

Four different things produce game support, and Vortex cannot tell them apart.
Whatever the route, what it ends up loading is a directory containing:

- `index.cjs` or `index.js`, the entry point, and
- `info.json`, which must parse.

That is the whole contract. `src/renderer/src/ExtensionManager.ts` looks for the
first matching entry filename (`mExtensionFormats`), reads `info.json` beside it,
and gives up on the directory if either is missing. No `main` field is honoured,
so the entry point has to carry one of those two names.

```
  hand-written extension    --+
  extensions/games/game-*/    |
                              |
  stub, then a download     --+
  extensions/games/game-*/    |    a directory holding
                              +--> index.js and info.json,
  GDL-built game            --+    which Vortex loads
  gdl-games repo              |
                              |
  community extension       --+
  published to the site
```

The first two ship inside the installer. The last two arrive as a zip uploaded
to a Nexus mod page and downloaded on demand, which is also how a stub gets
filled in.

There are 86 folders in `extensions/games/`. Nine of them are stubs; the rest are
real extensions built from source in this repo.

## Bundled extensions

A bundled game extension is a workspace package under `extensions/games/game-*`.
It builds its entry point and assets into `dist/`, and generates `dist/info.json`
from its `package.json` via `pnpm extractInfo`, a bin provided by
`packages/vortex-api` (`bin/extractInfo.mjs`). The build output ships inside the
installer, so a change to one of these only reaches users in a Vortex release.

**Prefer GDL for new games.** Hand-written bundled extensions are the historical
default, not the current one. See the GDL section below.

> In flight: GDL is also being adopted _in place_ in this repo, replacing a
> game's `src/index.*` with a `game.yaml` in the same `extensions/games/game-*`
> folder. That work is on `origin/halgari/pathfinder-to-gdl` and is not on
> `master`: there is no `game.yaml` under `extensions/games/` here yet. Expect
> this section to need revisiting when it lands.

## Stubs

A stub is a bundled extension that exists only to say "this game is supported,
fetch the real thing when someone wants it". It is a real extension directory,
not a metadata-only placeholder: it has a small entry point that calls
`registerGameStub`. `extensions/games/game-palworld/src/index.js` is the whole of
one:

```js
context.registerGameStub(
    {
        id: "palworld",
        name: "Palworld",
        executable: null,
        mergeMods: false,
        queryModPath: () => ".",
        requiredFiles: [],
    },
    { name: "Game: Palworld", modId: 770 },
);
```

The first argument is a minimal `IGame`, enough to render a row on the Games page.
The second is an `IExtensionDownloadInfo` (`name`, `modId`, and optionally
`fileId`), which is where Vortex fetches the real extension from. With no
`fileId`, it takes the current file on that mod page.

Why stubs exist: the real extension is distributed through the site and updated
independently of Vortex releases. The nine stubs are the biggest and most
actively maintained titles, several of which have their own repositories
(`Nexus-Mods/game-cyberpunk2077`, `Nexus-Mods/game-starfield`). Shipping them as
stubs means a fix for one of those games does not have to wait for a Vortex
release.

Handling lives in `src/renderer/src/extensions/gamemode_management/`:

- `index.ts` registers the stub into `$.extensionStubs`. If a full extension has
  already registered that game id, the stub is skipped, so the real extension
  always wins over its own placeholder.
- `util/getGame.ts` falls back to `$.extensionStubs` when a game id is not among
  the loaded extensions, which is what lets a stubbed game resolve at all.
- `removeDisappearedGames` is passed the stub map so a game whose extension has
  gone missing can be offered for reinstall rather than silently vanishing.

## GDL

GDL (Game Description Language) is a build-time toolchain: a declarative
`game.yaml`, a `gameart.webp`, and an optional `src/hooks.ts` for logic that YAML
cannot express, compiled into an ordinary bundled Vortex extension. Nothing at
runtime knows a game came from YAML.

It lives in two repositories, both of which document themselves properly:

- [`Nexus-Mods/game-description-language`](https://github.com/Nexus-Mods/game-description-language)
  is the toolchain and the `game.yaml` reference: game registration, stores, mod
  types, installer routing, discovery, lifecycle hooks, diagnostics and release
  metadata. Read this for the YAML surface.
- [`Nexus-Mods/gdl-games`](https://github.com/Nexus-Mods/gdl-games) is the
  monorepo of games built from it, one `games/<id>/` folder each, sharing a single
  copy of the toolchain as a submodule. Nx infers a project per `game.yaml`, so
  there is no per-game config. Read this to add or maintain a game.

Deliberately not duplicated here. Those READMEs are maintained and detailed, and
a second copy of the YAML reference in this repo would be wrong within a release.

## Art

[game-art-assets.md](game-art-assets.md) is the reference for art: the five
sources, which image wins on each surface, how the numeric Nexus id is resolved,
and caching. Two things it is worth knowing alongside this doc.

**The local logo filename is a convention, not a requirement.** `IGame.logo` is
an extension-relative path, resolved as `path.join(game.extensionPath, game.logo)`
in `GameRow.tsx` and `GameThumbnail.tsx`. Any filename works.
`game-art-assets.md` describes it as `gameart.jpg` because that is what almost
every bundled extension uses (165 of them), but `gameart.png` and `gameart.webp`
both appear in `extensions/games/` too, and GDL games use `gameart.webp`.

**The local logo is the floor, not the ceiling.** It ships inside the extension,
so it works offline and covers games with no numeric Nexus id, which in practice
means community games. The Nexus tile and thumbnail are preferred where they can
be resolved.

## Publishing and pickup

This is the path for anything not shipped in the installer: GDL-built games,
community extensions, and the real extensions behind the stubs. Themes and
translations use the same path.

1. **Publish.** Upload the packaged zip to a Nexus mod page. GDL's `gdl package`
   produces `out/<id>-vortex-v<version>.zip` for this.
2. **Listing.** Vortex fetches `GET /v3/vortex/extensions`.
   `src/renderer/src/extensions/extension_manager/availableExtensions.ts` is the
   only module that touches the wire types; everything downstream works with
   `IAvailableExtension`. Each asset carries `mod_id`, `file_id`, `version`,
   `author_name` and `uploaded_at`, grouped by type (`game`, `translation`,
   `theme`).
3. **Install.** `installExtension.ts` unpacks it, `reducers.ts` holds the state,
   and `BrowseExtensions.tsx` is the Extensions page UI.

Publishing is not fully automatic on the site side. An uploaded file can sit
blocked pending content preview and need releasing by hand before the download
works. The same trap applies to Vortex's own installer; see the announcing
section of [releasing.md](releasing.md).

## Official versus community

An extension is classified from the `author` field of its `info.json`, parsed by
`parseExtensionInfo` in
`src/renderer/src/extensions/extension_manager/extensionInfo.ts` and judged by
`isContributed` in `src/renderer/src/util/isContributed.ts`:

```ts
const OFFICIAL_AUTHORS = [COMPANY_ID, NEXUSMODS_EXT_ID];
export function isContributed(author: string | undefined): boolean {
    return !!author && !OFFICIAL_AUTHORS.includes(author);
}
```

`COMPANY_ID` is `"Black Tree Gaming Ltd."` and `NEXUSMODS_EXT_ID` is
`"Nexus Mods"` (`src/renderer/src/util/constants.ts`). An exact match on either,
or an empty author, counts as official. Anything else is community. The result
becomes `IGame.contributed`, set in
`src/renderer/src/extensions/gamemode_management/index.ts`, which holds the
contributor's name for a community game and is undefined for an official one.

**This is not just a badge.** The classification decides whether a crash is
reportable to us:

- `resolveAllowReport` in `src/renderer/src/util/errorHandling.ts` returns
  `!isContributed(error.extension)`, so a crash attributed to a community
  extension is not offered for reporting.
- `errorHandler` in `src/renderer/src/extensions/file_based_loadorder/util.ts`
  gates its error notifications the same way.
- `src/renderer/src/extensions/mod_management/eventHandlers.ts` sets the
  `extension_type` error context to `community` or `official`.

So a wrong `author` silently changes error-reporting behaviour, which is why it
is worth getting right rather than treating as cosmetic. It has been wrong in
production before: commit `8a3160027` fixed the Cyberpunk 2077 community
extension showing as official. Because the comparison is an exact string match,
a near miss (a trailing full stop, "Nexus Mods Ltd", a personal account name on a
first-party extension) misclassifies silently. GDL emits this field from
`game.author`.

## Key Files

| Path                                                                   | Purpose                                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/renderer/src/ExtensionManager.ts`                                 | Finds, loads and initialises extensions; owns the `index.cjs`/`index.js` plus `info.json` contract |
| `src/renderer/src/extensions/gamemode_management/index.ts`             | `registerGame`, `registerGameStub`, sets `IGame.contributed`                                       |
| `src/renderer/src/extensions/gamemode_management/util/getGame.ts`      | Resolves a game id, falling back to registered stubs                                               |
| `src/renderer/src/extensions/extension_manager/availableExtensions.ts` | Boundary to `GET /v3/vortex/extensions`; wire types stop here                                      |
| `src/renderer/src/extensions/extension_manager/installExtension.ts`    | Installs a downloaded extension                                                                    |
| `src/renderer/src/extensions/extension_manager/extensionInfo.ts`       | Parses `info.json`                                                                                 |
| `src/renderer/src/util/isContributed.ts`                               | Official versus community, from the author string                                                  |
| `src/renderer/src/types/IGame.ts`                                      | The `IGame` interface a game extension registers                                                   |
| `extensions/games/game-palworld/src/index.js`                          | A stub, in full                                                                                    |
| `packages/vortex-api/bin/extractInfo.mjs`                              | Generates `info.json` from `package.json` at build time                                            |

## Related

- [game-art-assets.md](game-art-assets.md) for art sources and precedence
- [releasing.md](releasing.md) for how Vortex itself is built, signed and shipped
- [../RELEASES.md](../RELEASES.md) for `vortex-api` deprecation windows and how
  extension authors are notified of breaking changes
