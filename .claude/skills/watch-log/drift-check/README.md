# watch-log drift-check

Keeps the skill's log-message markers honest against the Vortex code.

- **`markers.json`** - the markers (source literals) the skill greps for, grouped by
  chunk/mode. This is the skill's code-dependency contract; edit it when you add or
  rename a marker in a mode.
- **`check.py`** - run it to:
    1. **MISSING**: assert every manifest marker still exists in the source (catches a
       renamed/removed log the skill would silently stop matching).
    2. **UNCAPTURED**: list `warn`/`error` `log(...)` call sites in the code the skill
       does not reference yet (candidates to surface when you need more data).

```bash
python .claude/skills/watch-log/drift-check/check.py          # full report
python .claude/skills/watch-log/drift-check/check.py --quiet  # only problems
```

Exit code is non-zero if any marker is MISSING (so it can gate later if the skill is
ever shared). Uses `git grep` (no extra deps); searches tracked + untracked files,
excludes the skill itself, tests, and docs.

**Caveat:** markers are matched as **source literals**. The emitted log line can differ
(a logger wrapper may add a prefix, e.g. the collection logs). A clean drift-check still
warrants a sanity check against a real `vortex.log` for the emitted format.
