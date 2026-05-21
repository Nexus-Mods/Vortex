# VS Code Debugging

- **F5** - Debug both main and renderer processes
- **Build first** - Always run `pnpm run build` before debugging
- Main process breakpoints: main entry and app directory
- Renderer breakpoints: renderer entry and views directory

> sewer note: This will be replaced with better .vscode config down the road.
> am just keeping this as a leftover note for now.

## Diagnostic environment variables

- `VORTEX_TRACE_DB_WRITES=1` - turns on per-write breadcrumb logging in
  `LevelPersist`. Every persistence write (`setItem`, `removeItem`,
  `bulkSetItem`, `bulkRemoveItem`) emits a `level_pivot Write enter`
  line at debug level before the call and a `level_pivot Write exit`
  line after, with `method`, `alias`, `count`, and `elapsedMs`. Useful
  for diagnosing indefinite shutdown hangs in the persist queue (the
  last enter line with no matching exit pinpoints the wedged call).
  Off by default. With the env var unset, the same code path still
  emits a `level_pivot slow Write` warning when a single write exceeded
  250 ms (`SLOW_WRITE_THRESHOLD_MS` in `LevelPersist.ts`).
