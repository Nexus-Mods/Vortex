# Writing Documentation

Conventions for adding to `docs/`. Read this before writing a new doc, whether
you are writing it yourself or asking a model to write it.

## Where docs go

All project and coding documentation goes in `docs/`. That includes
architecture, subsystem deep dives, conventions, workflows and runbooks,
regardless of whether a human or an agent is the expected reader. The two
audiences want the same things: what this is, how it works, where the code is.

Do not put project or coding documentation in `AGENTS.md` or `CLAUDE.md`.
`AGENTS.md` covers only how to operate as an agent in this repo: tool
preferences, MCP servers, skills, and which doc to load for a task. If you find
yourself writing "the renderer is structured as..." into `AGENTS.md`, it belongs
in `docs/`.

One home, one audience-neutral voice, and the docs get maintained.

These files stay at the repo root by convention: `README.md`,
`CONTRIBUTING.md`, `CODESTYLE.md`, `CHANGELOG.md`, `RELEASES.md`,
`SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md`.

## Add it to the index

Every new doc gets a line in [README.md](README.md) under the right heading,
with a one-line description of the question it answers. A doc nobody can find is
a doc nobody reads.

## Naming

- Kebab-case, lowercase: `repo-layout.md`, `cherry-pick-workflow.md`.
- Name the topic, not the document type: `frontend.md`, not `frontend-guide.md`.
- A subdirectory groups one subsystem and gets its own `README.md` index once it
  holds three or more files. [error-reporting/](error-reporting/README.md) is the
  model.
- Some older files use other styles (`DEBUGGING-GUIDE.md`, `I18N_STATUS.md`,
  `EXTERNAL-CHANGES.md`). Those names are grandfathered. Don't copy the style,
  and don't rename them as a drive-by in an unrelated change.

## Structure

- `# Title` on the first line, then one or two sentences saying what question
  the doc answers and who it's for.
- `##` for sections. Go to `###` only when a section genuinely has sub-parts.
- Cite source paths from the repo root in backticks:
  `src/main/src/store/LevelPersist.ts`. Paths are how readers get from a doc to
  the code, so prefer a real path over a vague description of where something
  lives.
- A `## Key Files` list of path plus one-line purpose is the highest-value
  section in most subsystem docs.
- ASCII flow diagrams beat prose for control flow, and they diff cleanly.
- Don't hand-maintain a table of contents unless the doc is long enough to need
  one. GitHub renders heading navigation itself, and a manual list goes stale.

## Tone

Write for someone who knows the codebase but not this corner of it.

Keep it audience-neutral. No "you are an agent", no "read this file when working
on X" preambles: routing is the job of `AGENTS.md` and the index, and a doc that
opens by addressing one reader reads wrong to the other.

State the reasoning behind non-obvious rules. The _why_ is what stops a rule
being quietly undone in six months, and it's usually the part that can't be
rederived from the code.

Don't sign notes or leave personal TODOs in a doc. Use Linear.

## Admonitions

GitHub renders these only in uppercase:

> [!NOTE]
> Uppercase renders as a styled callout.

Lowercase (`> [!note]`) silently degrades to a plain blockquote and loses the
styling. Use `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`.

## Don't duplicate

Link, don't copy. When two docs need the same facts, one owns them and the other
links to it.

Copies drift, and the drift is invisible until it bites: the packaging
version-injection block lived in two files for months with two different version
numbers in it.

## Formatting is not yours to control

A pre-commit hook runs `oxfmt` over every staged file, markdown included, so
tables get reflowed and wrapping normalised. Write the content and let the
formatter settle the layout. Running `pnpm run format` before you commit shows
you what it will look like.
