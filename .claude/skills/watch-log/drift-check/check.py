#!/usr/bin/env python3
"""Drift-check for the watch-log skill.

Verifies that every log-message marker the skill greps for still exists in the Vortex
source (catches renamed/removed logs), and flags warn/error log call sites in the code
that the skill does not yet reference (candidates to capture). Markers are SOURCE
literals; the emitted log line can differ (a logger wrapper may add a prefix), so a
clean run here still warrants a sanity check against a real log.

Usage:  python check.py            # report
        python check.py --quiet    # only print problems
Exit code is non-zero if any marker is MISSING. Uses `git grep` (no extra deps).
"""

import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "markers.json"


def find_repo_root(start: Path) -> Path:
    for p in [start, *start.parents]:
        if (p / ".git").exists():
            return p
    return start.parents[3]  # .claude/skills/watch-log/drift-check -> repo root


REPO = find_repo_root(HERE)

# Inclusive root + excludes (skill text, tests, docs) so the skill's own marker text
# and test-only logs don't count as matches. git pathspec needs an inclusive entry.
PATHSPEC = [
    ".",
    ":(exclude,glob).claude/**",
    ":(exclude,glob)**/*.test.*",
    ":(exclude,glob)**/*.spec.*",
    ":(exclude,glob)**/*.md",
]


def git_grep(extra_opts, pattern):
    res = subprocess.run(
        ["git", "grep", "-I", "--untracked", *extra_opts, "-e", pattern, "--", *PATHSPEC],
        cwd=REPO, capture_output=True, text=True,
    )
    if res.returncode not in (0, 1):  # 1 = no matches (fine); other = error
        sys.exit(f"git grep failed: {res.stderr.strip()}")
    return res.stdout


def marker_exists(marker: str) -> bool:
    return bool(git_grep(["-l", "-F"], marker).strip())


def load_manifest():
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    groups = {k: v for k, v in data.items() if not k.startswith("_")}
    seen = {}
    for group, markers in groups.items():
        for m in markers:
            seen.setdefault(m, group)
    return groups, seen


# matches a warn/error log call on one line and captures the message literal
LOG_LINE = re.compile(r"""log\(\s*['"](?:warn|error)['"]\s*,\s*['"]([^'"]{4,})['"]""")


def find_uncaptured(manifest_markers):
    lines = git_grep(["-h", "-E"], r"log\([[:space:]]*['\"](warn|error)['\"]").splitlines()
    literals = set()
    for ln in lines:
        m = LOG_LINE.search(ln)
        if m:
            literals.add(m.group(1).strip())

    def captured(lit: str) -> bool:
        return any(mk in lit or lit in mk for mk in manifest_markers)

    return sorted(l for l in literals if not captured(l))


def main():
    quiet = "--quiet" in sys.argv
    _, seen = load_manifest()

    missing, ok = [], 0
    for marker, group in seen.items():
        if marker_exists(marker):
            ok += 1
        else:
            missing.append((marker, group))

    print(f"watch-log drift-check  (repo: {REPO})")
    print(f"markers checked: {len(seen)}   present: {ok}   MISSING: {len(missing)}\n")

    if missing:
        print("== MISSING (referenced by skill, not found in code) ==")
        for marker, group in sorted(missing, key=lambda x: x[1]):
            print(f"  [{group}] {marker!r}")
        print("  -> update the skill/manifest, or the log was renamed/removed.\n")
    elif not quiet:
        print("All markers present in code.\n")

    uncaptured = find_uncaptured(list(seen.keys()))
    if uncaptured and not quiet:
        print(f"== UNCAPTURED warn/error logs ({len(uncaptured)}) - review, not all are skill-relevant ==")
        for lit in uncaptured[:40]:
            print(f"  {lit!r}")
        if len(uncaptured) > 40:
            print(f"  ... and {len(uncaptured) - 40} more")
        print("  -> add to a mode/manifest if it is a signal the skill should surface.\n")

    print("NOTE: markers are source literals; emitted lines may add a prefix. "
          "Cross-check a real log when in doubt.")
    sys.exit(1 if missing else 0)


if __name__ == "__main__":
    main()
