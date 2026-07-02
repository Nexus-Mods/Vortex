# Shared chunk — operational edge cases

Load for modes that read a live/in-progress log: live (§A) and investigate (§B).
(The "session start scrolled out of retained logs" case lives in `shared/sessions.md`.)

- **App currently running:** the latest session has no end marker; that's "in progress",
  not a crash. Say so.
- **File doesn't exist yet** (app not started): `tail -F` still arms and emits once the
  file appears; say so rather than erroring.
- **Firehose request** (no filter): warn that high-volume monitors are auto-stopped;
  suggest a filter, or §B / reading the saved monitor output file instead.
