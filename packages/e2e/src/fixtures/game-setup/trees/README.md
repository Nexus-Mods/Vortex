# Mock game tree fixtures

Each game fixture is a folder:

```text
trees/<fixture>/
  config.json
  tree.txt
  tree.windows.txt
  tree.linux.txt
  tree.macos.txt
  files/
  files.windows/
  files.linux/
  files.macos/
    <optional raw payload files>
```

`config.json` declares game metadata. Fixture folders are auto-discovered from
`trees/*/config.json`; folder name is the game id.

`tree.txt` is common to all platforms. `tree.<platform>.txt` files are optional
overlays for `windows`, `linux`, and `macos`. Matching `files.<platform>/`
payload folders are copied after `files/`, so platform payloads override common
payloads for the active OS.

Tree files are tab-separated:

```text
d<TAB>relative/directory
f<TAB>relative/file.txt
```

- `d` creates an empty directory.
- `f` creates an empty file.
- Paths are relative to the fake game root and must not escape it.
- Matching files under `files/` or `files.<platform>/` are copied over the empty
  files after tree creation.
- Payload files must have matching `f` entries in the merged active tree.

Use raw payloads only when content matters, e.g. `steam_appid.txt`, BG3
`modsettings.lsx`, or version files. Executables listed in the tree are rewritten
by `setupFakeGame()` with tiny fake PE headers after the tree is created.

Export a real install tree:

```bash
pnpm --filter @vortex/e2e run fixture:export-tree -- \
  "/path/to/game" \
  packages/e2e/src/fixtures/game-setup/trees/<fixture> \
  --payload steam_appid.txt \
  --payload G1R/Version/version.txt \
  --file synthetic-required.exe \
  --dir synthetic-target-dir
```

The exporter writes `tree.txt`, replaces `files/`, and copies each `--payload`
into `files/`. Use `--file`/`--dir` for synthetic entries that are not present in
the source tree but still needed by Vortex or a game extension. Other fixture
subfolders, such as `localAppData/`, are preserved.

Export platform-specific trees from multiple real installs:

```bash
pnpm --filter @vortex/e2e run fixture:export-platform-trees -- \
  --out packages/e2e/src/fixtures/game-setup/trees/<fixture> \
  --platform windows="/path/to/windows/game" \
  --platform linux="/path/to/linux/game" \
  --payload steam_appid.txt
```

The platform exporter writes shared entries to `tree.txt`, differing or
platform-only entries to `tree.<platform>.txt`, shared payloads to `files/`, and
platform-different payloads to `files.<platform>/`. Existing `config.json` and
subfixtures are preserved.
