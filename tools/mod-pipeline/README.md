# Mod pipeline tools

Tools for developing and live-testing the mod pipeline (resolve, plan, Apply).

## fake-skyrimse.mjs

Builds a throwaway Skyrim SE: a fake game folder, a staging folder of small mods
built around deployment edge cases (conflicts, file overrides, backups, tampered
files, deep folders, case and non-ASCII names, a second mod type, plugins) and a
dev Vortex with its own user data that manages them through three profiles. The
"Edge cases" profile deploys cleanly; "Taken backup" holds the one mod that
fails to deploy.

Needs a build (`pnpm run build`).

```
node tools/mod-pipeline/fake-skyrimse.mjs
node tools/mod-pipeline/fake-skyrimse.mjs tamper
node tools/mod-pipeline/fake-skyrimse.mjs rollback
```

The first sets everything up and starts Vortex; deploy from the UI. `tamper`
changes deployed files behind Vortex's back. `rollback` runs a profile's plan
through Apply with one disk call made to fail, then checks that the game and
staging folders are as they were. The file's header lists the mods, the options
and the warnings to expect.
