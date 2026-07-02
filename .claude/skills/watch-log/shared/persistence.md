# Shared chunk — persistence markers (duckdb / level_pivot)

Load for the persistence mode (§C). See `AGENTS-DEBUGGING.md` and
`src/main/src/store/LevelPersist.ts`. (For write-latency _attribution_ — the
`VORTEX_TRACE_DB_WRITES=1` stage timing + `[lp-trace]` scan/commit markers — use the
sibling `watch-persistence-trace` skill, not this chunk.)

- **Persist call:** `[DEBG] [MAIN] Received persist:diff {"hive":…,"operationCount":N}`.
- **Slow write (default):** `[WARN] [MAIN] level_pivot slow Write
{"method":…,"alias":…,"count":N,"elapsedMs":NNN}` — fires when one write exceeds
  `SLOW_WRITE_THRESHOLD_MS` (250 ms).
- **Breadcrumb pairs** (only with `VORTEX_TRACE_DB_WRITES=1`): `level_pivot Write enter`
  / `level_pivot Write exit`. A trailing `enter` with no matching `exit` = wedged /
  never-confirmed write (shutdown hang).
- **Failure (main, `mainPersistence.ts`):** `Could not read persisted value` /
  `Could not write persisted value` / `Could not get persisted hives` (all `[WARN]`),
  and `DuckDBSingleton not initialized, skipping query system` (`[WARN]`, query system
  unavailable). Plus any `[ERRO] [MAIN]` from the persist / level_pivot / duckdb-singleton
  path.
- **Extension persistor failure (renderer, `ExtensionManager.ts`):**
  `Extension persistor removeItem failed` (`[ERRO]`) — a per-extension hive write
  failure (e.g. the `loadOrder` hive), distinct from the core `db` persistor.
