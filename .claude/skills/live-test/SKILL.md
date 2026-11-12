---
name: live-test
description: Test a change in the running Vortex app and collect screenshots or video for the PR's reviewers. Starts the dev app, drives it through the chrome-devtools MCP, sets up a fake game folder for any game so no real install is needed, compares the change against its base, and leaves visual evidence a reviewer can check.
when_to_use: When a change has behaviour a user can see or trigger and the user wants it tested live, wants a PR tested before review, wants a fake game folder for testing, or wants screenshots or a video of a change for a PR. Not for writing a Playwright spec (use /e2e-test).
user-invocable: true
---

# Live test

Unit tests show the code does what the test says. A live test shows the app does what the PR
says, and gives the reviewer something to look at. It is worth offering for every PR whose
change a user can see or trigger. It takes a while and writes to the user's dev profile, so run
it when the user asked for it or accepted the offer, not on your own.

Three files carry the detail. Read the one for the step you are on:

- [fake-game.md](fake-game.md): a fake game folder for any game, and how to remove it again.
- [evidence.md](evidence.md): screenshots and video for reviewers.
- `scripts/attach.js` and `scripts/mcp-call.mjs`: the helpers the steps below use.
- `scripts/drift-check.mjs`: checks the helpers against the Vortex source. Run it when a helper
  does nothing where it should have done something.

The commands below run as written in bash and in PowerShell 7. Where `node` isn't on `PATH`, use
`pnpm exec node`.

## 1. Decide what to show

Write the scenarios down before starting the app, as "do X, see Y", one per behaviour the PR
changes, plus one for the neighbouring behaviour it must not change. Each scenario is run twice:
first on the base (where a bug fix should fail the way the issue says), then on the change.

Tell the user in a few lines what you will run, what it does to their dev profile (anything
installed, downloaded or deleted), and that step 7 puts the base version of the changed files in
their working tree for a while, so they shouldn't edit those files during the run. Then carry on.

## 2. Start the app

**Check for a running app first.** If `http://127.0.0.1:9222/json/list` answers, a dev session
is already up (the user's, or one you started earlier): use it, and don't start a second one on
top of it. If the page it lists isn't from this checkout, ask the user before going on.

```powershell
(Invoke-RestMethod http://127.0.0.1:9222/json/list).url   # PowerShell
```

```sh
curl -s http://127.0.0.1:9222/json/list                   # bash
```

Otherwise run `pnpm run dev` from the repo root, in the background. It serves the renderer with
HMR and listens for DevTools on `127.0.0.1:9222`. Don't run `pnpm run verify` while it is up (see
`AGENTS.md`).

An agent's shell often needs three fixes first, in the shell that starts the app:

- **`ELECTRON_RUN_AS_NODE`** is inherited from the editor and makes Electron start as plain Node
  ("Not running in an Electron environment"). Unset it.
- **In a git worktree**, set `NX_WORKSPACE_ROOT_PATH` to the worktree and `NX_DAEMON=false`, or nx
  reports projects defined in two locations.
- **`node` missing from `PATH`**: prepend the repo's `node_modules/.bin`.

```powershell
# PowerShell, from the repo (or worktree) root
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:NX_WORKSPACE_ROOT_PATH = (Get-Location).Path; $env:NX_DAEMON = "false"   # worktree only
$env:PATH = "$((Get-Location).Path)\node_modules\.bin;$env:PATH"              # node missing only
pnpm run dev
```

```sh
# bash, from the repo (or worktree) root
unset ELECTRON_RUN_AS_NODE
export NX_WORKSPACE_ROOT_PATH="$PWD" NX_DAEMON=false   # worktree only
export PATH="$PWD/node_modules/.bin:$PATH"             # node missing only
pnpm run dev
```

The app is ready when the list above has a page whose url ends in `index.html`. The splash
screen is listed first, so don't stop at the first page. To wait for it and attach in one go:

```sh
node .claude/skills/live-test/scripts/mcp-call.mjs --wait-for-app "until:.claude/skills/live-test/scripts/attach.js"
```

The dev app has its own profile, apart from an installed Vortex. `summary().userData` is its
folder, as the running app reports it (`%APPDATA%\@vortex\main` on Windows unless the app was
started with `--user-data`). `vortex.log` is there, and so are the downloads and staging folders.

## 3. Connect

Use the chrome-devtools MCP tools when the session has them (`list_pages`, then pass the
`index.html` page's `pageId` to every call). They may be listed as deferred tools: search for
`chrome-devtools` before deciding they are missing. The server connects to Vortex on each call,
so it doesn't matter whether Vortex was running when the session started.

In a session without that server, drive it from the shell instead:

```sh
node .claude/skills/live-test/scripts/mcp-call.mjs "eval:.claude/skills/live-test/scripts/attach.js" snapshot
```

Its header lists the steps (`eval`, `js`, `snapshot`, `click`, `hover`, `fill`, `key`,
`screenshot`, `record`, `stop`, `wait`, `until`, and `?` for an optional step). One invocation is
one server session, so put steps that belong together in one call. Put steps with quotes or
apostrophes in a file, one per line, and pass `steps:<file>`: nothing in a file needs shell
quoting.

## 4. Attach

Vortex has no global for its Redux store or extension api. Evaluate `scripts/attach.js` once: it
finds both and installs `window.__vortexLive`, and returns who is logged in, the active game, the
games Vortex has a folder for, and any open dialogs. After that, calls are one-liners:

| Call                                             | Does                                                       |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `summary()`                                      | The state above. Run it after every step.                  |
| `state()`, `store`, `api`                        | The Redux state, the store, the extension api.             |
| `games(filter)`, `gameInfo(id)`                  | Games this Vortex supports, and what one's extension asks. |
| `fakeGame(id)`, `unmanage(id)`, `forgetFakeGame` | See [fake-game.md](fake-game.md).                          |
| `activateGame(id)`                               | Switch to a game that has a profile.                       |
| `baseline()`, `changes()`                        | Record the profile's contents, and what changed since.     |
| `waitFor(state => ...)`                          | Wait on the app's state instead of the clock.              |
| `resize(1280, 800)`                              | Size the window before capturing.                          |

A reload drops the handle. Not every code change reloads the window: HMR applies most component
edits in place and only reloads when it can't. So don't wait for the handle to go; step 7 reloads
on purpose.

## 5. Set the stage

- **A baseline.** Call `baseline()` once, before anything else touches the profile. It records
  the mods, downloads, profiles and game locations in a file, so it survives reloads.
- **A game.** Use a fake folder ([fake-game.md](fake-game.md)) unless the test needs the real
  game's files. Nothing in a live test launches the game.
- **A login**, when the scenario touches Nexus Mods (downloads by `nxm://` link, collections,
  Browse). It is an OAuth flow in the user's browser: ask them to log in in the dev window, then
  check `summary().user`. The dev profile keeps the login between runs.

## 6. Drive and observe

Do what a user does where the scenario is about the UI: `take_snapshot` to find the control by
its role and name, `click` it, snapshot again. Use the api (`api.events.emit(...)`) for the parts
that aren't the point of the scenario, copying the arguments from the code that normally emits
the event.

**Make sure a click hits what you mean.** A list repeats the same button on every row ("Add
collection", "Add game"), and the row you want may show a different one ("Added"). Anchor the
click to the row (`click:Add collection@@image "SVE + Grandpa's Farm"`), read the line the script
prints for what it clicked, and snapshot the row first when its state could be stale. A tile in
Browse only re-checks whether its collection is installed when hovered. A click one row off
installs someone else's 200-mod collection into the profile.

Two guards back this up. The script refuses a click when several elements of the same kind
carry the name, and lists them. An anchored click only looks inside the anchor's own row or card:
when that row doesn't have the control, the step fails rather than taking the next row's. And `changes()` shows what the profile gained since the
baseline: call it after every step that installs or downloads something. An entry the scenario
didn't mean to add is a stray click. Stop there, cancel what is still running, remove it, and
tell the user, before going on.

**Waits.** `click`, `hover` and `fill` wait up to 5 seconds for their element, so steps can
follow each other without a pause. Anything longer goes in an `until:` step, which polls for up
to 10 minutes. A single `evaluate_script` is cut off after about half a minute, well before a
collection finishes installing. Keep `wait:<ms>` for pacing a video.

A shell tool usually gives up before an `until:` does (two minutes by default), and a call
killed that way loses its recording. Run any call that waits on an install or a download in the
background and read its output when it exits; it prints a line every 30 seconds meanwhile. Where
the tool can't run in the background, give the call a timeout of more than 10 minutes.

After each step read three things: `summary()` (state and dialogs), the tail of `vortex.log`, and
a screenshot when the result is visual.

**Dialogs.** The user can see the window. A modal you leave open looks like a hang to them and
blocks your next click. Answer every dialog you cause, and say which ones came from your test
steps rather than from the change.

**Swallow side effects you don't want.** To show that an install _would_ start without installing
anything, wrap `api.events.emit` for the test, record the `start-install-download` call, and
restore the original afterwards.

## 7. Compare with the base

Run the base first and the change second. The change is every file that differs from the base,
committed or not, and the files it adds that git doesn't track yet. All of them have to go back
to the base, not only the ones under `src/renderer`: a base run with half the change still in
place proves nothing.

**Find the base branch first.** It is the branch the PR targets, which isn't always `master`: a
fix for a release goes to its release branch (`release/v2.11`), and comparing that against
`master` tests the wrong "before". Ask GitHub when the branch has a PR. When it has none yet, ask
the user which branch it will target; don't assume.

```sh
gh pr view --json baseRefName --jq .baseRefName    # <base branch>; fails when there is no PR yet
git fetch origin <base branch>
```

```sh
git merge-base origin/<base branch> HEAD           # <base>
git diff --no-renames --name-only <base> HEAD      # <committed>: files the commits changed
git status --short                                 # <uncommitted>: modified and untracked files of the change
git stash push --include-untracked -m live-test-<branch> -- <uncommitted>   # skip when there are none
git restore --staged --worktree --source=<base> -- <committed>        # skip when there are none
# the tree is now the base: run the scenarios ("before")
git restore --staged --worktree --source=HEAD -- <committed>          # skip when there are none
git stash list                                     # find the entry named live-test-<branch>
git stash pop --index "stash@{<n>}"                # that entry only, and only if you pushed one
# the tree is the change again: run the scenarios ("after")
```

Name the files in the stash. A bare `git stash push --include-untracked` also takes work that
isn't part of the change, this skill's own files among it when they are untracked.

Name the stash too, and pop it by that name. The user may have stashes of their own, and a bare
`git stash pop` takes whichever is on top: when you skipped the push, or it said "No local
changes to save", that is their work, applied onto the tree. So never pop without the
`stash@{<n>}` of the `live-test-<branch>` entry, and skip the pop when no such entry is listed.
`--index` puts back what was staged as staged. If git refuses it, pop the same entry without
`--index` and tell the user their staging was lost.

Use `git restore --staged --worktree` with `git diff --no-renames`, not `git show <base>:file >
file`: a shell redirect re-encodes the file and changes its line endings (PowerShell does both),
and the result is no longer the base. `--no-renames` lists both the old and new path of a renamed
file so the old path is restored on the base and removed again on `HEAD`, and `--staged
--worktree` keeps a file the branch deleted in the index during the base run so the second
`git restore` still knows its pathspec and removes it cleanly.

Between the stash and the pop, the tree is on the base and part of the change exists only in the
stash. If a run is cut short there, the first thing to do on picking it up is `git stash list`,
then the restore to `HEAD` and the pop of the `live-test-<branch>` entry, if there is one. Don't
start a second run on top.

How the app picks up each swap depends on what the change touches:

- **Only files under `src/renderer`:** leave the app running. Give the watcher time to rebuild
  (the dev output prints `[vortex-hmr] finished`; allow ten seconds when you can't see it), then
  reload the window yourself and attach again. HMR alone isn't enough: it applies most edits in
  place, which keeps state from the other version and never drops the handle.

    ```sh
    node .claude/skills/live-test/scripts/mcp-call.mjs "js:() => { window.location.reload(); return true; }" \
      "wait:3000" "until:.claude/skills/live-test/scripts/attach.js"
    ```

- **Anything else** (`src/main`, `src/shared`, `extensions/`, `packages/`): stop the app and start
  it again on each version.

Both runs have to start from the same state. For each scenario, write down what has to be true
at the start (the collection not installed, the download absent, the game active) and check it
before the base run and again before the change run. Remove what the base run installed or
downloaded before the second run, unless the scenario is about that leftover state.

A result only counts with both halves: the base failing as the issue describes, and the change
passing the same steps.

## 8. Clean up and report

- Remove what the test added to the dev profile: test downloads, fake games, mods you installed.
  `changes()` lists what was added or removed; it should come back empty, or hold only what you
  report as left behind. It doesn't see changes to things that were already there, so report
  those yourself (a game location you replaced, a setting you switched).
- `git status` and `git stash list`: the changed files must be back to the change, with no
  `live-test-<branch>` entry left in the stash and the user's own entries all still there. The dev build may rewrite `etc/vortex.api.md`: ignore that file.
  Don't revert it, and don't count it as part of the change or of what the test left behind.
- Stop the dev app if you started it and the user isn't using it. Stopping the background task
  can leave Electron and the watchers running, on Windows especially, so end the whole process
  tree (`taskkill /PID <pid> /T /F` on Windows, with the pid of the `pnpm run dev` you started)
  and check that `http://127.0.0.1:9222/json/list` no longer answers.

Finish the evidence folder (`.live-test/<issue or branch>/`, see [evidence.md](evidence.md)),
then report with the PR's Testing section, which holds the before/after table, followed by: the
folder, what was left in the dev profile, and what the test did not cover.
If it found a problem outside the change, say so separately.
