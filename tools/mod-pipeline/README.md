# Mod pipeline tools

Tools for developing and live-testing the mod pipeline (resolve, plan, Apply).

## fake-skyrimse.mjs

Builds a throwaway Skyrim SE: a fake game folder, a staging folder of small mods
built around deployment edge cases (conflicts, file overrides, backups, tampered
files, deep folders, case and non-ASCII names, a second mod type, plugins) and a
dev Vortex with its own user data that manages them through four profiles. The
"Edge cases" profile deploys cleanly; "Taken backup" holds the one mod that
fails to deploy, and "Shared by types" two mods of different types that deploy
one path.

Needs a build (`pnpm run build`).

```
node tools/mod-pipeline/fake-skyrimse.mjs
node tools/mod-pipeline/fake-skyrimse.mjs tamper
node tools/mod-pipeline/fake-skyrimse.mjs rollback
node tools/mod-pipeline/fake-skyrimse.mjs manifests
node tools/mod-pipeline/fake-skyrimse.mjs journal
```

The first deletes what an earlier run made, sets everything up and starts
Vortex; deploy from the UI. `--reset` only deletes. `tamper`
changes deployed files behind Vortex's back. `rollback` runs a profile's plan
through Apply with one disk call made to fail, then checks that the game and
staging folders are as they were. `manifests` runs Apply to another profile and
back, then checks that the files it left and the deployment manifests it saved
are the ones today's deployment did. `journal` prints the journal of the latest
Apply run that `rollback` or `manifests` started: how the run ended, and each
operation with how far it got. Apply removes its journal when a run ends, so a
copy of each is kept under `<root>/work/journals`; a run that didn't end leaves
its journal in place, and that one comes last. The file's header lists the mods,
the options and the warnings to expect.

### Terminal screen

`tui.mjs` shows whether the setup and its Vortex are there, runs the commands
above on a key press and shows their checks and what they print. `j` shows the
journals, and `o` there opens one in VS Code. It has its own dependencies,
installed once in this folder:

```
pnpm install --ignore-workspace
node tools/mod-pipeline/tui.mjs
```

It takes `--root` and `--port` and passes them to every command. In a terminal
that can't read single keys it draws the screen once and ends; the commands work
without it.
