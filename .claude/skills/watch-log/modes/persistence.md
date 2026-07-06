# §C — Persistence-integrity check (duckdb / level_pivot)

Prereq: `reference.md` (core) + `shared/persistence.md`. Scope to one
session (default latest, per §B / investigate.md). Confirm current message strings /
threshold against `AGENTS-DEBUGGING.md` and `src/main/src/store/LevelPersist.ts`.

1. **Activity:** count `Received persist:diff` (with hive + operationCount) over the
   window to show persist load.
2. **Slow writes:** collect `[WARN] [MAIN] level_pivot slow Write`; report the
   count, the worst `elapsedMs`, and a breakdown by `method` (e.g. `bulkRemoveItem`).
   Note the 250 ms `SLOW_WRITE_THRESHOLD_MS`.
3. **Never-confirmed / wedged writes:** if `VORTEX_TRACE_DB_WRITES=1` was on, pair
   `level_pivot Write enter` ↔ `Write exit` by order; any trailing `enter` with no
   matching `exit` is a wedged / unconfirmed write — highlight it (classic shutdown
   hang). If tracing was off, say so and fall back to: a persist burst immediately
   followed by an error or by no further persist/shutdown progress.
4. **Failures:** any `[ERRO] [MAIN]` on the persist / level_pivot / duckdb-singleton
   path.
5. **Verdict per session:** **clean** (writes present, none slow, no unmatched
   enter, no error) vs **issues** (enumerate them). If the user asked about a
   specific action/time, pair that `persist:diff` with the outcome in its immediate
   window.
