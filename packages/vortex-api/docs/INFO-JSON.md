# `info.json` Reference

Every Vortex extension has an `info.json` at the top level of its folder. It tells Vortex what the extension is and, through `contributes`, which games it supports, without running any of the extension's code.

Vortex never reads your `package.json`. That file belongs to npm and your build. If you build your extension with a tool that generates `info.json` from `package.json`, the generated file is the one Vortex reads, and it only contains what the tool wrote.

## Editor completion

The package ships a JSON Schema for `info.json`. Point your file at it to get completion and field documentation in editors that support JSON Schema, such as VS Code:

```json
{
    "$schema": "https://unpkg.com/@nexusmods/vortex-api/schemas/info.schema.json",
    "name": "My Game Support",
    "version": "1.0.0"
}
```

If you have the package installed you can also reference the file from `node_modules/@nexusmods/vortex-api/schemas/info.schema.json`. Vortex ignores the `$schema` key.

The schema describes the shape of the file: types, required keys and structure. It doesn't enforce every rule, so a file that passes the schema can still be invalid. The rules for values are listed below and in each field's description. Unknown keys are allowed everywhere, at the top level and inside `contributes`.

## Fields

| Field         | Required | Meaning                                                                                                         |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `name`        | yes      | Display name of the extension.                                                                                  |
| `version`     | yes      | Version of the extension, as a semver string.                                                                   |
| `author`      | no       | Display name of the author. Shown as `<unknown>` when missing.                                                  |
| `description` | no       | Short description of what the extension does. Shown as `<missing>` when missing.                                |
| `id`          | no       | Stable identifier, used by other extensions that call `requireExtension`. Pick one and keep it across versions. |
| `namespace`   | no       | i18next namespace for the extension's translations.                                                             |
| `contributes` | no       | What the extension contributes. See below.                                                                      |
| `gameId`      | no       | Deprecated. See [`gameId`](#gameid-deprecated).                                                                 |

Vortex also writes a `modId` key when it installs an extension. You don't write it, and it isn't part of the schema.

## `contributes`

`contributes` declares what your extension contributes in a form Vortex, Nexus Mods and other tools can read without loading it. Every field in it is optional.

An extension without `contributes` keeps working exactly as it does today. Vortex treats it as a legacy extension and never rejects it. Older Vortex versions ignore the key, so you can add it now.

If `contributes` is invalid, the extension loads as if it had none and Vortex logs a warning naming your extension and what failed. One invalid field makes all of `contributes` invalid, so fix the warning rather than relying on the fallback.

### `contributes.games`

The games your extension registers, keyed by the id you pass to `registerGame`. The typical extension supports one game that has its own page on Nexus Mods, and needs only this:

```json
{
    "name": "Stardew Valley Support",
    "version": "1.0.0",
    "contributes": {
        "games": {
            "stardewvalley": { "nexusGameId": 1303, "name": "Stardew Valley" }
        }
    }
}
```

The key `stardewvalley` is the `id` the extension passes to `registerGame`. `nexusGameId` is the game's id on Nexus Mods, and `name` is how listings that can't run the extension show it.

Rules for the keys: each is a non-empty string and none starts with `tier-0-`, which Vortex reserves. Registering an id that isn't listed is an error. A game may be an empty object, which declares the game and nothing else.

Each game can set these fields:

- `nexusGameId`: the Nexus Mods game this game's mods are published on, as a positive integer. Leave it out if the game has no page on Nexus Mods. It can't be `null`. Several games can declare the same one, as Skyrim Special Edition and Skyrim VR both do with 1704.
- `gameUid`: the game's id in the Nexus Mods game catalogue, a non-empty string. Vortex doesn't check its structure, because catalogue ids are opaque. Write it in any case, Vortex lowercases it.
- `name`: a non-empty listing name, for places that can't run your extension. Vortex itself shows the name you pass to `registerGame`.

#### Supporting two games

An extension that registers several games lists each under the id it passes to `registerGame`. Here, one extension supports a game and its sequel, and each has its own page on Nexus Mods, so neither needs a `gameUid`. The ids are made up:

```json
{
    "name": "My Game Support",
    "version": "1.0.0",
    "contributes": {
        "games": {
            "mygame": { "nexusGameId": 1111, "name": "My Game" },
            "mygame2": { "nexusGameId": 2222, "name": "My Game 2" }
        }
    }
}
```

#### When `gameUid` is required

A game resolves to the declared `gameUid` if there is one, otherwise to the game its `nexusGameId` belongs to, otherwise to nothing. So declare `gameUid` when your game is not the one its `nexusGameId` belongs to, or when it isn't on Nexus Mods at all.

Skyrim VR is the first case: its mods are published on the Skyrim Special Edition page (1704), so `nexusGameId` alone would resolve to Skyrim Special Edition. Give it its own `gameUid`. Skyrim Special Edition is the game 1704 belongs to, so it doesn't need one:

```json
{
    "name": "Skyrim Support",
    "version": "1.0.0",
    "contributes": {
        "games": {
            "skyrimse": { "nexusGameId": 1704, "name": "Skyrim Special Edition" },
            "skyrimvr": {
                "nexusGameId": 1704,
                "gameUid": "d88c5de7-353b-5d60-87be-bec5caa6244a",
                "name": "Skyrim VR"
            }
        }
    }
}
```

A game that isn't on Nexus Mods at all has no `nexusGameId` to fall back on, so `gameUid` is the only thing that identifies it:

```json
{
    "name": "My Unlisted Game Support",
    "version": "1.0.0",
    "contributes": {
        "games": {
            "myunlistedgame": {
                "gameUid": "00000000-0000-0000-0000-000000000000",
                "name": "My Unlisted Game"
            }
        }
    }
}
```

The `gameUid` above is a placeholder. Look up the real one as described next.

#### Finding a game's ids

Look the game up on [NexusDB](https://nexusdb.nexusmods.com), the catalogue's own site. It lists the `gameUid` of every game, including those whose mods are published on another game's page. A developer dialog on Nexus Mods game pages that shows `game_id` and `game_uid` is planned, and this page will link it once it exists.

### `contributes.gameEnhancements`

For games your extension is relevant to without registering them, such as a tool, a mod type or an installer that works with games other extensions provide. This is advisory.

Each entry sets exactly one of `gameUid` and `nexusGameId`. Setting both, or neither, makes `contributes` invalid.

- `gameUid` targets one game.
- `nexusGameId` targets every game whose mods are published on that Nexus Mods game.

An extension that enhances every game published on Fallout New Vegas (130):

```json
{
    "name": "Fallout New Vegas Sanity Checks",
    "version": "1.0.0",
    "contributes": {
        "gameEnhancements": [{ "nexusGameId": 130 }]
    }
}
```

## `gameId` (deprecated)

`gameId` is superseded by `contributes.games`. Vortex doesn't read it, but the Nexus Mods data platform still does, so leave it in place if your extension already has it.

- A number, or a string of digits, is the Nexus Mods game id: `2304` or `"2304"`.
- Any other string without whitespace is the game's domain on Nexus Mods: `"skyrimspecialedition"`.
- Anything else is ignored: an empty string, `0`, a negative number, a display name such as `"Game: My Game"`, a list or an object.
