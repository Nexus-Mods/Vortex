# §D — Correlate a specific log entry to source

Prereq: `reference.md` (core; the logging-call convention lives there).

Input: a specific log line (quoted text and/or a timestamp). Depth is configurable
(default **4**; accept a `--depth N` style arg). The static walk is **bidirectional**
to depth N in **both** directions, and the time-window correlation looks **both
before and after** the entry — the user wants to know both what led up to the entry
and what happened next.

1. **Locate the call site:** extract the literal message text from the line and grep
   the codebase for it (`log('warn'|'error'|…, '<message>'`). Resolve the emitting
   function. If several match, use the `[SOURCE]` (`MAIN`/`RENDERER`) and context to
   disambiguate; list candidates if still ambiguous.
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
   (in and out) and what actually fired around the entry on both sides.
