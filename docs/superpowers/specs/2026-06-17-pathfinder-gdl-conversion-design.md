# Pathfinder extensions to GDL: design

Date: 2026-06-17
Branch: `halgari/pathfinder-to-gdl` (off `halgari/games-to-gdl-1`)

## Goal

Convert the two Owlcat Pathfinder game extensions to the Game Description
Language (GDL), the same declarative toolchain the X Rebirth extension now uses.

- `extensions/games/game-pathfinderkingmaker` (currently `src/index.js`)
- `extensions/games/game-pathfinderwrathoftherighteous` (currently `src/index.ts`)

Both become pure `game.yaml` with no `src/hooks.ts`. One new GDL feature is
added in the `game-description-language` submodule to cover the only behaviour
that GDL cannot express today.

## What the two extensions do today

|                                   | Kingmaker                                                              | Wrath of the Righteous                                                               |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Stores                            | Steam `640820`                                                         | Steam `1184370`, GOG `1207187357`                                                    |
| Mods path                         | `Mods/`                                                                | `Mods/`                                                                              |
| `requireExtension("modtype-umm")` | yes                                                                    | yes                                                                                  |
| UMM registration                  | none; setup shows a manual "install UMM" dialog after a registry probe | `context.once(() => api.ext.ummAddGame({ gameId, autoDownloadUMM: true }))`          |
| getGameVersion                    | none                                                                   | reads `Wrath_Data/StreamingAssets/Version.info`, takes the 4th space-delimited token |
| Installers / modTypes             | none                                                                   | none                                                                                 |

Neither game registers a custom installer or mod type. Game mods deploy to the
`Mods/` folder through Vortex's default path. The `umm` mod type (UMM the tool)
comes from the separate `modtype-umm` extension and only activates for a game
once that game has called `ummAddGame`. Kingmaker never calls it, so the `umm`
mod type is inert for Kingmaker today.

## Key decisions

These were settled during brainstorming.

1. **Unify both games on a file-check plus download prompt.** Drop the
   `modtype-umm` integration from both games. WotR loses its `ummAddGame`
   auto-download and `umm` mod-type activation. This is an accepted behaviour
   regression for WotR in exchange for both games becoming self-contained
   declarative extensions. Game mods continue to deploy to `Mods/` exactly as
   before; the change only affects how the UMM tool itself is obtained (a prompt
   instead of auto-download).

2. **`requireExtension("modtype-umm")` is dropped from both.** Once neither game
   calls `ummAddGame`, the dependency is inert (the `umm` mod type never matches
   either game), so it carries no behaviour. GDL therefore needs no
   `requireExtension` support and no general init hook.

3. **The file lookup is purely path based.** No registry reads. GDL deliberately
   removed all `winapi` access and we keep it that way. For UMM this shifts the
   meaning of the check from "is the UMM tool installed anywhere on the system"
   (the old registry probe) to "is UMM set up in this game's folder." Accepted.

4. **The prompt's download target opens a page, it does not silently install.**
   The target is either a Nexus mod reference (`domain` + `modId`) that opens
   `https://www.nexusmods.com/<domain>/mods/<modId>`, or a plain `url`. Both
   resolve to a single `util.opn(...)` call. A true one-click install would
   require pinning a `fileId` per release, which is maintenance churn we avoid.

## New GDL feature: `setup.requireFiles`

GDL's `setup:` block today supports only `ensureDirs`. We extend it with an
optional `requireFiles` step that runs during the game's `setup` lifecycle,
right after `ensureDirs`.

### YAML shape

```yaml
setup:
    ensureDirs:
        - ${installPath}/Mods
    requireFiles:
        files:
            - ${installPath}/UnityModManager/UnityModManager.dll
        prompt:
            title: Action required
            message: You must install Unity Mod Manager to use mods with this game.
            link:
                label: Go to the Unity Mod Manager page
                mod: { domain: site, modId: 21 } # or: url: https://example.com/...
```

### Field rules

- `requireFiles` is optional inside `setup`.
- `files` is a non-empty list of path templates, interpolated against the
  runtime context (`${installPath}`, etc.). The validator rejects an empty list.
- `prompt.title` and `prompt.message` are required when `requireFiles` is present.
- `prompt.link` is optional.
    - `link.label` is the button text (required when `link` is present).
    - Exactly one of `link.mod` or `link.url` must be set.
    - `link.mod` is `{ domain: <nexus-domain-slug>, modId: <number> }`.
    - `link.url` is a string.

### Runtime semantics

Implemented in the runtime shim's generated `game.setup`, after `ensureDirs`:

1. Resolve every `files` template against the resolved context and `fs.statAsync`
   each one.
2. If all exist, do nothing.
3. If any are missing, call `api.showDialog`:
    - Type `info`, title `prompt.title`, body text `prompt.message`.
    - Buttons: a `Cancel`/`Close` button, plus (when `link` is present) a button
      labelled `link.label` whose action calls `util.opn(targetUrl)`, where
      `targetUrl` is `link.url` or `https://www.nexusmods.com/<domain>/mods/<modId>`
      built from `link.mod`.
4. The step is informational. It does not reject `setup`.

The original Kingmaker code rejected `setup` with `UserCanceled` after the
dialog. We drop that quirk; a passive prompt that lets management proceed is
cleaner. This is the one intentional behaviour change beyond the registry to
path shift.

### Where it lives in the toolchain

The feature is implemented in the `game-description-language` submodule (its own
repo, `Nexus-Mods/game-description-language`, currently on `main`), touching:

- `src/parser/ast.ts`: add `requireFiles?` to `SetupNode`, plus the supporting
  node types for `files`, `prompt`, and `link`.
- `src/parser/index.ts`: parse the new keys under `setup`.
- `src/schema/validator.ts`: enforce the field rules above.
- `src/codegen/emit.ts` and `src/codegen/lifecycle-emit.ts`: thread the parsed
  `requireFiles` data into the generated extension and `game.setup`.
- `src/runtime/vortex-shim.ts`: extend the generated `game.setup` to run the
  stat-and-prompt logic.
- Tests in the GDL repo: parser, validator, codegen, and a runtime test that the
  generated `setup` stats the listed files and fires the dialog when one is
  missing.

The Vortex branch then bumps the submodule pointer, matching the existing
pattern (the X Rebirth conversion landed GDL features as PR #2 in that repo,
followed by "bump game-description-language submodule" commits here).

### Alternatives considered

- **A new top-level `prerequisites:` block** instead of nesting under `setup`.
  More general, but the only consumer right now is setup-time, so the extra
  schema surface is not justified (YAGNI). Rejected.
- **A diagnostic / health check** using GDL's existing `diagnostics:` block. A
  health check is a passive warning surface, so it cannot present the actionable
  "go get UMM" button the original behaviour has. Rejected.
- **A registry-based lookup option** for faithful UMM detection. Rejected to
  keep GDL free of `winapi` (decision 3).
- **One-click install via `nexus-download` / `nxm://` URL.** Requires a pinned
  `fileId` per release. Rejected for the maintenance churn (decision 4).

## Converted extensions

Neither game needs a `src/hooks.ts`. Both become a single `game.yaml` plus the
GDL plumbing files (`package.json`, `build.mjs`, `tsconfig.json`,
`vitest.config.ts`), mirroring `game-xrebirth`. The `gameart.jpg` logos convert
to `gameart.webp`.

### Kingmaker `game.yaml` (shape)

```yaml
gdl: 1
version: <from package.json>

game:
  id: pathfinderkingmaker
  name: "Pathfinder: Kingmaker"
  executable: Kingmaker.exe
  requiredFiles: [Kingmaker.exe]
  logo: gameart.webp
  nexusDomain: pathfinderkingmaker
  queryModPath: Mods

stores:
  steam: "640820"

setup:
  ensureDirs:
    - ${installPath}/Mods
  requireFiles:
    files:
      - ${installPath}/UnityModManager/UnityModManager.dll
    prompt:
      title: Action required
      message: You must install Unity Mod Manager to use mods with Pathfinder: Kingmaker.
      link:
        label: Go to the Unity Mod Manager page
        mod: { domain: site, modId: 21 }

tests:
  corpus: nexus
```

`environment.SteamAPPId` and `details.steamAppId` auto-derive from `stores.steam`,
so they are not set explicitly. Dropped from the original: the registry helpers,
Bluebird, the `process.platform` guard, and `requireExtension`.

### WotR `game.yaml` (shape)

Same as Kingmaker, with these differences:

```yaml
game:
    id: pathfinderwrathoftherighteous
    name: "Pathfinder: Wrath of the Righteous"
    executable: Wrath.exe
    requiredFiles: [Wrath.exe]
    nexusDomain: pathfinderwrathoftherighteous
    queryModPath: Mods

stores:
    steam: "1184370"
    gog: "1207187357"

discovery:
    version:
        file: ${installPath}/Wrath_Data/StreamingAssets/Version.info
        regex: '^(?:\S+\s+){3}(\S+)' # 4th space-delimited token, == old split(" ")[3]

setup:
    ensureDirs:
        - ${installPath}/Mods
    requireFiles:
        # same UMM check as Kingmaker
```

Dropped from the original: `requireExtension`, the `ummAddGame` registration
(decision 1), and the imperative `getGameVersion` (now declarative via
`discovery.version`).

## Testing

- The new GDL feature is unit tested in the GDL repo (parser, validator,
  codegen, runtime), including a runtime case that proves the dialog fires when a
  required file is absent and stays silent when all are present.
- Each game opts into `tests: { corpus: nexus }` so the installer and deploy path
  runs against real Nexus mod manifests, the same harness X Rebirth uses. The
  corpus does not exercise `requireFiles`, which is setup-time only.

## Open items to confirm during implementation

- The exact UMM marker file path under the game directory. The `game.yaml` value
  is trivially tunable; verify it against a real UMM-patched Pathfinder layout.
- Whether `version` should be sourced from each `package.json` (as X Rebirth
  does) or pinned in `game.yaml`.
