# A fake game folder for any game

Vortex never runs the game during a test. It only needs a folder that looks like an install, so a
handful of empty files stands in for any game, on any machine, without owning it.

## What makes a folder "the game"

A game extension registers an `IGame` (`src/renderer/src/types/IGame.ts`, on top of `ITool` in
`src/renderer/src/types/ITool.ts`). These fields decide what the folder needs:

| Field                 | What Vortex does with it                                                   | What the fake folder needs               |
| --------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| `requiredFiles`       | A folder is accepted as the game only if every entry exists (file or dir). | Every entry. This is the only hard rule. |
| `executable()`        | Launching, and reading the game's version.                                 | The file, so the game isn't "missing".   |
| `queryModPath()`      | Where mods are deployed, relative to the game folder.                      | Nothing: deployment creates it.          |
| `setup()`             | Runs each time the game is activated; usually creates its mod folders.     | Nothing, unless it reads a real file.    |
| `supportedTools`      | Tools are listed when their executable exists.                             | Only for a test about that tool.         |
| `details`             | Hints for other extensions (`hashFiles`, store ids, ...).                  | Only for a test that depends on one.     |
| `queryPath/queryArgs` | Finding the real install through Steam, GOG, ...                           | Nothing: the fake path is set by hand.   |

The running app holds the stored form of each registered `IGame`
(`state.session.gameMode.known`), so nothing has to be parsed out of the extension:

```js
() => window.__vortexLive.games("goose"); // ["untitledgoosegame: Untitled Goose Game"]
() => window.__vortexLive.gameInfo("untitledgoosegame"); // requiredFiles, executable, tools, details
```

## Create it and point Vortex at it

```js
() => window.__vortexLive.fakeGame("untitledgoosegame");
```

`fakeGame` (in `scripts/attach.js`) does two things:

1. **Creates the folder** under `<temp>/vortex-live-test/games/<Game Name>`: each `requiredFiles`
   entry and the executable. A `.exe` gets a minimal PE header, everything else is empty. Pass
   `{ extra: ["Data/", "Data/Skyrim.esm", { path: "steam_appid.txt", content: "489830" }] }` for
   more, and `{ root }` for another place. It also leaves a `.vortex-live-test` file in the
   folder, which marks it as fake, and refuses a folder that already exists without one.
2. **Records it as the game's location**, the way picking the folder by hand does once it passed
   the `requiredFiles` check. This skips the folder picker, which is a native dialog the page
   can't reach, and the "which store is this from" question that follows it.

**A game the dev profile already manages with a real install** is refused. Stop managing the
real one first, the way a user would, so Vortex purges its mods out of the real folder, then
call `fakeGame` again:

```js
() => window.__vortexLive.unmanage("stardewvalley"); // then click "Delete profiles"
() => window.__vortexLive.fakeGame("stardewvalley"); // once its profiles are gone
```

That deletes the user's profiles and mods for the game, so name it in what you tell them before
the run, or pick a game the profile doesn't manage. A game that is only detected, not managed,
needs none of this: `fakeGame` replaces its location, and the result's `replaced` says what it
was. Vortex finds the real install again on its next game scan after the fake one is removed.

Keep the folder on the same drive as the dev profile. The default deployment method uses hard
links, which can't cross drives; the temp folder and the profile normally share one.

## Manage it

The game now shows on the Games page under **New games detected**. Add it as a user would:

```sh
node .claude/skills/live-test/scripts/mcp-call.mjs "click:Home" 'click:button "Games"' \
  "click:Add game@@Untitled Goose Game" \
  "until:() => window.__vortexLive.summary().activeGame === 'untitledgoosegame'" \
  "js:() => window.__vortexLive.summary()"
```

Each click waits for its element, and the `until:` step waits for the game to become active, so
no fixed pauses are needed. `summary()` should show it as the active game with a new `Default`
profile. A game that already has a profile only needs `activateGame(id)`.

From here the fake game behaves like a real one, which is the point: mods and collections
download for real and are installed and deployed into the fake folder. Use it for any scenario
that installs something, rather than a real game install. Some extensions start straight away:
Untitled Goose Game's downloads, installs and deploys BepInEx as soon as the game is managed.

## When a game needs more

Empty files satisfy discovery, not every code path. If managing or activating the game shows an
error, read the game's extension (`extensions/games/game-<name>/src/`) for what it opens:

- **`setup()` or a load-order page that parses a real file** (an ini in Documents, a `.pak`, a
  save folder): add a file with believable content through `extra`.
- **`getGameVersion()` or a version check**: a fake `.exe` has no version resource. Give it the
  file the extension reads instead (often a text or JSON file next to the executable).
- **Store-specific layouts** (`requiresLauncher`, Xbox or Epic folders): add what that store's
  layout has, e.g. `steam_appid.txt`.

The E2E suite keeps richer fixtures for two games
(`packages/e2e/src/fixtures/game-setup/fake-game.ts`: Stardew Valley and Skyrim SE). Reuse its
file lists for those, and add what you learn about another game there rather than here, so the
Playwright tests get it too.

## Remove it

Order matters: Vortex purges the deployed mods out of the game folder when it stops managing the
game, so the folder has to outlive that step.

```js
() => window.__vortexLive.unmanage("untitledgoosegame"); // then click "Delete profiles"
() =>
    window.__vortexLive.waitFor(
        (s) => !Object.values(s.persistent.profiles).some((p) => p.gameId === "untitledgoosegame"),
    );
() => window.__vortexLive.forgetFakeGame("untitledgoosegame"); // location, the test's downloads, folders
```

`forgetFakeGame` removes the game's downloads that were added since `baseline()`. Downloads the
profile already had at the baseline are the user's and stay, and when no baseline was taken it
removes none, because it can't tell them apart. It refuses a game whose folder it didn't create
(the folder has no `.vortex-live-test` file), and a game with no location at all (a mistyped id,
or a second call), so it never removes downloads without a fake game to go with them. It also
removes the game's staging folder (`<profile>/<gameId>/`) and downloads folder
(`<profile>/downloads/<gameId>/`) from the dev profile, once nothing but empty folders is left
in them. Read what it returns: `stagingFolder` and `downloadsFolder` say "removed" or "absent"
when there is nothing left to do, `downloadsKept` counts the downloads it left alone (the
downloads folder is then "kept: still has files", which is right), and `downloadsLeft` lists
downloads Vortex didn't remove in time. Anything else is yours to look at and delete by hand.

Three things that go wrong here:

- **"Failed to purge"** on stop-managing. Vortex stores a game's deployment method when the game
  is first activated, but only if a method is usable at that moment. It isn't when one of the
  game's mod folders doesn't exist yet (a BepInEx game without BepInEx: `BepInEx/patchers` is
  created just after), and then nothing stores it until the game is activated again. The purge
  refuses to run without a stored method. `unmanage()` stores the default one first. The dialog
  hides the reason, so if it still shows, look at what `purgeMods` rejects with
  (`src/renderer/src/extensions/mod_management/util/deploy.ts`).
- **"Mod Staging Folder missing!"** when managing the same fake game a second time in one session.
  Removing a game's mods leaves `state.persistent.mods[gameId]` as `{}` in memory rather than
  `undefined`, and once `forgetFakeGame` has deleted the staging folder, the next manage sees a
  defined `mods[gameId]` with no folder and asks what to do. Click **Reinitialize**. (Step 7's
  base/change comparison doesn't need to unmanage the fake game between the two runs; keep it
  managed and remove it once in step 8.)
- **Deleting the folder first** leaves Vortex managing a game that isn't there. Recreate it, then
  remove in the order above.
