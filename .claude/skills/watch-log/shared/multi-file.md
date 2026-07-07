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
- **Treat each file as an independent log** (its own sessions, version, instanceId,
  timeline). Analyze and report per file.
- **Do NOT cross-correlate across files** — no rotation reassembly, no
  regression/potentially-fixed diff, no re-install/downgrade comparison **between**
  files. Those signals assume one install's history; they are invalid across unrelated
  copies.
- Only relate files to each other if the user **explicitly says** they belong together
  (e.g. "these three are the same user's rotation, oldest to newest"). Then treat them
  as one ordered set in the stated order.
- Cross-session signals are still valid **within** a single file (a file may contain
  several sessions from the same install).
- Use mtime / `Vortex Version` / instanceId per file only to **describe** it, never to
  infer a relationship to another file.
