# §B — Investigate mode (session-scoped report)

Prereq: `reference.md` (core) + `shared/sessions.md` + `shared/edge-cases.md`
(+ `shared/multi-file.md` when handling multiple / foreign files).

1. **Find the scoped session.** Default scope is the **latest** session, which lives
   at the **tail of the current `vortex.log`**: scan `vortex.log` backward for the
   last start anchor (`[INFO] [MAIN] Vortex Version`); that anchor → EOF is the
   latest session. Only reach into `vortex1.log` (then `vortex2.log`, …) when the
   start anchor is **not** in `vortex.log` (the session began before the last roll)
   so the session is contiguous, or when the user wants older / all sessions — then
   assemble files oldest→newest per Shared. Honor explicit scope: a session index, a
   date/time, or "all sessions".
2. **Record per session:** start ts, end ts, **duration**, which file(s) it spans,
   the **termination state** (clean / killed-during-exit / hard-crash / in-progress,
   per the 4-state classification in `shared/sessions.md`), the **app version** (the quoted
   `Vortex Version` value), the **instanceId** (from the `startup instance` line),
   and the **`[ERRO]` and `[WARN]` counts** (used for ranking in step 4).
3. **Report for the scoped session:**
    - Termination state (+ window timestamps & files), calling out a **hard crash**
      prominently and noting killed-during-exit as the milder dev-stop signal.
    - `[ERRO]` lines (grouped by normalized signature with counts).
    - Warnings — `[WARN]` lines, split by source: `[WARN] [RENDERER]` (renderer/UI)
      and `[WARN] [MAIN]`. Do NOT grep a bare `React` token — it false-matches words
      like "Reactions"; rely on the `[WARN]` level token.
    - No-level crash signatures (`Unhandled` / `uncaught` / `Traceback` / `FATAL`)
      that may appear outside the structured logger.
4. **Cross-session signals** (compute across the retained sessions, chronological):
    - **Most error/warning-prone session:** rank the retained sessions by `[ERRO]` +
      `[WARN]` count (show the top one with its window and counts). If the most prone
      session is **not** the scoped/latest one, **highlight it prominently** and offer
      to scope the report to it — it is often more relevant than the latest (e.g. when
      the latest is a brief launch-and-quit and the real activity is in an earlier
      session). Weight `[ERRO]` above `[WARN]`, and call out any session containing a
      **hard crash** regardless of total count.
    - **Regression / potentially-fixed** (the days-apart case): normalize each
      error/warning into a signature (strip timestamps, paths, ids, numbers). A
      signature present in older session(s) but **absent from the
      latest** → highlight as **"potentially fixed — last seen `<ts>`, not in latest
      session"**. A signature new in the latest session → flag as newly introduced.
        - **Short-session caveat:** if the scoped/latest session is very short or barely
          exercised (e.g. a sub-few-minute launch-and-quit, or its `[ERRO]`+`[WARN]`
          count is a small fraction of the most-prone session's), **downgrade
          "potentially fixed" to "not reproduced (session too short)"** — an absent
          signature almost certainly means _not exercised this run_, not _fixed_. Say so
          explicitly and point the user at the most-prone session for a real comparison.
    - **Re-installs (prod only):** when the `instanceId` **changes** from one session
      to the next, highlight it as a **re-install / fresh install** at that boundary
      (prod instanceId is otherwise stable across restarts). **Skip this on dev** —
      the dev instanceId churns per test run, so changes there are not re-installs.
    - **Version downgrade:** track the app version per session. If a chronologically
      later session runs a **lower** semver than an earlier one, highlight the
      downgrade (`from <hi> down to <lo> at <ts>`). Surface this prominently when
      **more than 2 distinct versions** appear across the retained sessions and the
      sequence includes a downgrade. Plain forward upgrades are not flagged.
5. **Reporting rule:** every report states which single session it covers and the
   exact window; never silently mix sessions. Only widen when the user says "all" or
   names a range — and then label each finding with its session. (Most-prone-session,
   re-install, downgrade, and regression signals are inherently cross-session —
   present them in a short "across sessions" addendum, distinct from the scoped
   session report.)
