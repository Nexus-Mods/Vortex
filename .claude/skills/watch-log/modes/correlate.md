# §D — Correlate a specific log entry to source

Prereq: `reference.md` (core; the logging-call convention lives there).

Input: a specific log line (quoted text and/or a timestamp). Depth is configurable
(default **4**; accept a `--depth N` style arg). The static walk is **bidirectional**
to depth N in **both** directions, and the time-window correlation looks **both
before and after** the entry — the user wants to know both what led up to the entry
and what happened next.

Correlation runs against **current code** (the local checkout as-is, or `master`) by
default — logs often come from older releases, and triage's first question is whether
the problem still exists in current code. Pin the walk to the log's own version
**only when asked** (`--pin`, "against 2.4", "what did the user's build do"): the
session start anchor `[INFO] [MAIN] Vortex Version "…"` names the version, and
release tags are `v` + that exact string (`2.4.2` → `v2.4.2`, betas too). When
pinned, read at the ref — `git grep -n "<text>" <ref>`, `git show <ref>:<path>` —
never switch the working copy's branch.

0. **Resolve the code root** (where to grep):
    - A **local Vortex checkout** (a git repo whose origin points at
      `github.com/Nexus-Mods/Vortex`) → use it as-is.
    - **No checkout** (e.g. the skill running in a sandboxed claude.ai chat) → clone
      once into a scratch dir and reuse it for the whole conversation:
      `git clone --filter=blob:none https://github.com/Nexus-Mods/Vortex`
      (full history and tags; file contents fetched on demand).
    - **Cloning impossible** → fetch individual files from
      `https://raw.githubusercontent.com/Nexus-Mods/Vortex/master/<path>` — degraded
      (no grep, no history): say so and keep the walk shallow.

1. **Locate the call site:** extract the literal message text from the line and grep
   the code root for it (`log('warn'|'error'|…, '<message>'`). Resolve the emitting
   function. If several match, use the `[SOURCE]` (`MAIN`/`RENDERER`) and context to
   disambiguate; list candidates if still ambiguous.
   **If the message does not grep on current code**, the entry predates a change:
   confirm it existed at the log's version (`git grep -n "<text>" v<version>`), list
   the commits that touched the emitting file since
   (`git log --oneline v<version>..master -- <file>`) as candidate fixes, and report
   "log line no longer exists on current code — possibly already fixed; reproduce on
   a current build before filing". Continue the full walk at the pinned tag only if
   the user asks.
2. **Walk backward (callers, up to depth N):** find callers of the emitting
   function, then their callers, up to N levels. At each level note any **other**
   `log(...)` statements reachable on the path **leading into** the target — the
   breadcrumbs expected to fire _before_ the entry.
3. **Walk forward (continuation + callees, up to depth N):** from the emitting call
   site, follow what executes **after** the log statement — the rest of that
   function, then the functions it calls, and their callees, up to N levels. Note
   the `log(...)` statements reachable on that downstream path — the breadcrumbs
   expected to fire _after_ the entry. Cover branches (success vs error/early-return)
   so the "what should happen next" set includes the failure continuations, not just
   the happy path.
4. **Time-window correlation (both sides):** take the target entry's timestamp and
   pull actual log lines in a window **before and after** it (default a few seconds
   each side, widen if sparse). Present them as a **before / entry / after**
   timeline, **highlight every `[WARN]` / `[ERRO]`** on both sides, and map lines to
   the backward (step 2) and forward (step 3) log statements where possible. Flag
   **expected-but-missing** forward breadcrumbs (a downstream log statement that
   should have followed but didn't appear) — that gap pinpoints where the flow
   diverged or wedged.
5. **Output:** the resolved call site (`file:line`); the backward call-stack chain
   and the forward continuation/callee chain, each with their log statements; and the
   before/entry/after log timeline with warnings/errors highlighted and any
   missing-after breadcrumbs called out — so the user sees both the static code path
   (in and out) and what actually fired around the entry on both sides. State which
   ref was scanned (current code, or a pinned tag), and when the log's version is
   older than current code, say so — the correlated path shows today's behaviour,
   which may already differ from the build that wrote the log.
