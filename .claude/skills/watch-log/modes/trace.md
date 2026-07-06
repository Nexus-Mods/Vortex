# §E — Trace a workflow lifecycle (top-to-bottom)

Prereq: `reference.md` (core) + `shared/lifecycle.md` + `shared/sessions.md`.

Trace one **download / install / collection / deployment** from its first to its last
log entry. Scope to one session (default latest, per §B / investigate.md); say which.

1. **Identify the entity and its thread key** from `$ARGUMENTS`:
    - a **mod id / archive name** (e.g. `Atomic Lust-31853-2-7b-…`) → install thread,
      key = `modId` / `archivePath`.
    - an **nxm url** or **downloadId** / **collationId** → download thread.
    - a **collection name / id** → collection thread (and its member installs).
    - the word **deployment / deploy / purge** (optionally a game) → deploy thread.
      If ambiguous, grep the chosen log for the term and list the candidate entities
      (with their ids) for the user to pick.
2. **Pull the ordered slice:** grep every line carrying the thread key (and the
   related keys it fans out to — e.g. a download's nxm url → the resulting
   `archivePath` → the install's `modId`), then sort by timestamp into a single
   top-to-bottom timeline. Bridge stages by the shared field: nxm url/`downloadId`
   (download) → `archivePath` (hand-off) → `modId` (install) → membership in the next
   `deployment` summary.
3. **Map to expected phases** (from the lifecycle markers in `shared/lifecycle.md`) and render
   the timeline as **phase → timestamp → Δ since previous phase**, so slow steps are
   visible (e.g. extract vs install vs deploy time). Compute total duration; for an
   install prefer the logged `duration` from `Installation completed successfully`.
4. **Outcome & gaps:** classify as **completed** (terminal success marker present —
   `finish mod install {outcome:"success"}` / `Installation completed successfully` /
   `download completed` / final `deployment {…}` / `postprocess collection`),
   **failed** (an `[ERRO]` on the thread, or `outcome` != success), or **incomplete /
   stuck** (a start phase with **no** terminal phase before session end — the last
   phase reached pinpoints where it wedged, same expected-but-missing logic as §D).
5. **Interleaved problems:** list any `[ERRO]`/`[WARN]` whose payload references the
   thread key within the entity's time window (e.g. a `Buggy installer` error, a
   `failed to parse esp`, a slow `level_pivot` write during the install).
6. **For collections:** report the collection-level envelope (`starting install of
collection {totalMods, missing}` → `postprocess collection`) and a **per-member
   roll-up** (each member's modId, outcome, duration), flagging members that failed
   or never reached a terminal phase. Note the `collationId` linking the members'
   downloads.
7. **Output:** the phase timeline with Δs, the outcome verdict, total/longest-step
   timing, interleaved errors/warnings, and (collections) the per-member table.
