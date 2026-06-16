# Mock game tree fixtures

Each game fixture is a folder:

```text
trees/<fixture>/
  tree.txt
  files/
    <optional raw payload files>
```

`tree.txt` is tab-separated:

```text
d<TAB>relative/directory
f<TAB>relative/file.txt
```

- `d` creates an empty directory.
- `f` creates an empty file.
- Paths are relative to the fake game root and must not escape it.
- Matching files under `files/` are copied over the empty files after tree creation.
- Payload files must have matching `f` entries in `tree.txt`.

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
