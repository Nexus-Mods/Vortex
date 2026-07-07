# watch-log — core reference

Always loaded by the router. The universal facts (how to find and read a Vortex log)
plus an index of the on-demand chunks. Verified against real Vortex logs.

## Reference facts

**Log line format:** `TIMESTAMP [LEVEL] [SOURCE] message {json}`

- Levels are 4-char tokens: `[DEBG] [INFO] [WARN] [ERRO]` — error is `[ERRO]`, NOT
  `[ERROR]`.
- Source is `[MAIN]` or `[RENDERER]`.

**Directories:**

- Dev (`@vortex/main`, the working build): `$APPDATA/@vortex/main/`
- Prod: `$APPDATA/Vortex/`
- Each dir also has a separate `network.log` (exclude it from log-set assembly).

**Rotation & write order:** entries append in **iterative (chronological) order**, so
the **tail of any file is its most recent activity** — the latest session lives at the
bottom of the current `vortex.log`. Files roll at ~11 MB: `vortex.log` = current/newest;
`vortex1.log` … `vortexN.log` = older, where **ascending number == older**. You only
need older files when a session began before the last roll or the user wants history.

## Resolve the log set (rotation-aware, dev/prod-aware)

Determine the target, in priority order:

1. **Explicit file path** in `$ARGUMENTS` → use it verbatim (single file; only pull in
   rolled siblings if the user asks for history). If **multiple** files or files outside
   a live log dir are given, also load `shared/multi-file.md`.
2. **`prod` keyword** → the prod dir `$APPDATA/Vortex/`.
3. **Default → DEV** dir `$APPDATA/@vortex/main/` (the working build; scan dev unless
   told otherwise).

State which dir/file was chosen. Quote all paths (`@vortex` and spaces). If the chosen
dir has no `vortex.log`, say so and offer the other dir rather than silently switching.

When you need rotation history (a session that spans a roll, or "all sessions"), build
the oldest→newest ordered list for a dir in the Bash tool:

```bash
D="$APPDATA/@vortex/main"   # or "$APPDATA/Vortex", or the dir of an explicit path
{ ls "$D"/vortex[0-9]*.log 2>/dev/null \
    | sed -E 's/.*vortex([0-9]+)\.log/\1 &/' | sort -rn | cut -d' ' -f2- ; \
  echo "$D/vortex.log" ; }
```

This prints numbered files by suffix descending (older first), then `vortex.log` last.
`network.log` is excluded by the `vortex[0-9]*` / `vortex.log` globs.

## On-demand chunks (load only what the selected mode needs)

| chunk                   | holds                                                              | loaded by                         |
| ----------------------- | ------------------------------------------------------------------ | --------------------------------- |
| `shared/sessions.md`    | session boundary markers, 4-state termination, instanceId, scoping | §B, §E, §F                        |
| `shared/lifecycle.md`   | download / install / collection / deploy markers + thread keys     | §E, §F                            |
| `shared/persistence.md` | persist:diff / slow-write / wedged-write markers                   | §C                                |
| `shared/multi-file.md`  | multiple / foreign-file handling (dedup, no cross-correlate)       | any mode given >1 / foreign files |
| `shared/edge-cases.md`  | operational edge cases (app running, file-not-yet, firehose)       | §A, §B                            |

Each mode file names its required chunks in its own "Prereq" line. Read this core once;
load each chunk at most once even when running several modes.

## Logging call convention (for code correlation)

Source emits logs as `log('debug'|'info'|'warn'|'error', '<message>', {…})`. The literal
`<message>` text in a log line is greppable in the codebase to find the emitting call
site. (Primarily used by §D correlate.)
