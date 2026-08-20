# Shared chunk — multiple / foreign log files

Load when given more than one explicit file, or files outside a live log dir (e.g.
browser-downloaded copies). The `vortexN.log` rotation ordering (see the resolver in
`reference.md`) is trustworthy **only** for the actual dev/prod log dirs. Arbitrary
copies — e.g. `vortex (2) (1).log`, `vortex1 (1) (1).log` — do **not** obey it: the
numbers are copy markers, not rotation order, and different files may come from
**different users, installs, or sessions**.

When given multiple explicit files that are not a live log dir:

- **Dedup first:** byte-identical copies are common (browser re-downloads). Run
  `cmp -s a b` across the set and collapse duplicates — report each unique log once,
  noting which paths are identical.
- **Rotation match by instanceId:** before locking files as independent, collect each
  file's instanceId(s) (`startup instance {"instanceId":"…"}`, per `shared/sessions.md`).
  Two **differently named** files sharing an instanceId are **potentially the same
  install's rolled set** (e.g. `vortex (2).log` + `vortex1 (1).log` = one user attaching
  their rotation). Confirm with the time ranges: if the files' session windows are
  disjoint and chain plausibly (one file's last activity precedes the other's first,
  versions continuous), order them oldest→newest by timestamp and treat them as **one
  ordered rotation set** — rotation reassembly and the cross-file signals below become
  valid within that set. State the inferred order (and that it was instanceId-inferred)
  in the report. Byte-identical duplicates (dedup step) are copies, not a rotation.
- **A non-match proves nothing:** a fresh re/install of Vortex mints a new instanceId
  (and dev ids churn per run), so files **without** a shared instanceId simply stay
  independent — conclude "no rotation link established", never "different user/install".
- **Treat each file as an independent log** (its own sessions, version, instanceId,
  timeline) unless an instanceId match (above) or the user linked them. Analyze and
  report per file.
- **Do NOT cross-correlate across independent files** — no rotation reassembly, no
  regression/potentially-fixed diff, no re-install/downgrade comparison **between**
  files. Those signals assume one install's history; they are invalid across unrelated
  copies.
- Also relate files to each other if the user **explicitly says** they belong together
  (e.g. "these three are the same user's rotation, oldest to newest"). Then treat them
  as one ordered set in the stated order.
- Cross-session signals are still valid **within** a single file (a file may contain
  several sessions from the same install).
- Use mtime / `Vortex Version` per file only to **describe** it; the only relationship
  signal between files is a shared instanceId (or the user's say-so).
