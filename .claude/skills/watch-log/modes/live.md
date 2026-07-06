# §A — Live mode (no-timeout watch)

Prereq: `reference.md` (core) + `shared/edge-cases.md`.

1. Target the **current** `vortex.log` (live == newest file), per the shared resolver.
2. Build the filter. Default (all errors + warnings + no-level crash signatures):

    ```
    \[(ERRO|WARN)\]|Unhandled|uncaught|Traceback|FATAL
    ```

    `[(ERRO|WARN)]` catches every levelled error/warning; the rest catch raw crash
    output printed outside the structured logger. Don't add a bare `React` token — it
    false-matches "Reactions" etc.

    If the user gave a pattern, OR-in the crash signatures so silence can't hide a
    crash: `<user-pattern>|Unhandled|uncaught|FATAL`. State the final pattern back.

3. Launch the **Monitor** tool:
    - `persistent: true` (no timeout — this is the whole point; do NOT use a
      `timeout_ms`-bounded watch or a one-shot `Bash run_in_background` here).
    - `command:`
      `tail -n 0 -F "<vortex.log>" | grep -E --line-buffered "<pattern>"`
        - `-F` (capital) re-follows across the ~11 MB rollover (vortex.log is
          recreated). `-n 0` starts from "now". `--line-buffered` flushes per line.
    - `description:` specific, e.g. `errors/warnings in vortex dev log` (it shows on
      every notification).
4. Tell the user: matching lines now arrive as chat notifications as they're
   written; the watch runs for the whole session; stop early with TaskStop. If it's
   auto-stopped for volume, restart with a tighter filter. Lines written in the
   brief roll gap land in `vortex1.log`; for gapless history use §B (investigate).
5. **One-shot exception:** if the user only wants "tell me once when X appears / when
   the run finishes", use `Bash` with `run_in_background` and an `until` loop
   (`until grep -q "X" "<log>"; do sleep 0.5; done`) instead of a persistent
   Monitor — that gives a single completion notification.
