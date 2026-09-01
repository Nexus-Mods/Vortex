# Contributing

Thanks for wanting to work on Vortex. Before you start, there's one thing we
need to be upfront about.

> [!IMPORTANT]
> **We can only take small pull requests at the moment.**
>
> Vortex is going through large foundational changes, and we don't have the
> review capacity to take on big contributions alongside that work. If you
> send us a large PR right now, it will most likely sit unreviewed until it
> no longer applies to the code underneath it, and we'd have to close it.
> You'd have spent real time on something we couldn't merge, which is why
> we'd rather tell you here than in a closed PR later.
>
> This is about our capacity, not about the quality of what you're offering.
> We are hiring, and it will change.

## What counts as small

As a rough guide, a PR we can review without a conversation first is under
**400 changed lines** across **10 files or fewer**, ignoring lockfiles,
generated files, and mass renames.

Those aren't hard limits. A 500-line change that's one self-contained fix with
tests is fine. A 200-line change touching six extensions probably isn't, because
the review cost is in the blast radius, not the line count.

If your change is bigger than that, or spans several extensions, open a feature
request or ask on Discord **before you write it** and wait for a maintainer to
agree on the approach. A short conversation up front saves you from writing
something we can't merge.

## Pull requests

- One logical change per PR. If the description needs the word "and", it's
  probably two PRs.
- Link the issue it fixes.
- Say what you tested and on which platform.
- Run `pnpm run verify` before you open it. That covers formatting, lint,
  typecheck, build and tests.

Pull requests that conflict with work already planned or in progress, that
don't fit the architecture, or that are too big for us to review, get closed.
That's not a judgement on the code.

## AI-assisted contributions

Use whatever tools you like. The requirement is the same either way: **you are
the author, and you need to understand every line you submit.**

In practice that means you can explain why the change is written the way it is,
you've run it, and you've read the diff. If a reviewer asks about a decision in
your PR, "that's what the model produced" isn't an answer.

We close large machine-generated PRs without detailed review. We don't have the
capacity to audit thousands of lines nobody on either side has read, and the
size rule above applies regardless of how the code was written.

Recommended editor: [VS Code] with workspace extensions.
You will be prompted to install them when you first open the repo.

## Requirements

Before you start, make sure you have:

- A [GitHub account] for creating pull requests,
- The `git` [CLI] or a [GUI client] such as [GitHub Desktop],
- An editor with TypeScript support such as [VS Code download], [WebStorm] or [Neovim].

## Setup

1. Install distro-specific prerequisites:
    - [Windows setup]
    - Linux:
        - [Arch-based setup] (Arch, CachyOS, Manjaro)
        - [Debian-based setup] (Debian, Ubuntu, Pop!\_OS, Linux Mint)
        - [Fedora setup]
        - [NixOS setup]
    - If your distribution is not listed, try [Generic Installation Instructions].

2. Continue with [Shared Setup].

## Developing

After you have finished the setup steps:

1. `pnpm run build`
2. `pnpm run start`

A pre-commit hook runs `oxfmt` over every staged file, markdown included, so
expect your formatting to be rewritten. Running `pnpm run format` first makes the
hook a no-op. The hook can also trigger a dependency install mid-commit, so a
commit sometimes takes about 30 seconds and prints install output.

### Hot reload (`pnpm run dev`)

For iterating on renderer (UI) code, `pnpm run dev` starts Vortex with hot
module replacement instead of the build/start cycle:

- Component (`.tsx`) edits hot-swap in place via react-refresh — React and
  Redux state are preserved, no reload.
- Edits that can't be hot-applied (reducers, utils, extension `index.ts` init
  code) automatically trigger a clean window reload.
- Tailwind class changes rebuild `tailwind-v4.css` and swap the stylesheet in
  place, without a reload.
- **Not covered:** main-process (`src/main`), preload, and `@vortex/shared`
  changes still need a restart of `pnpm run dev`; the dynamic extensions in
  `extensions/` and `extensions/games/` still require an app relaunch.

## Debugging

### VS Code

- **F5** debugs both main and renderer processes
- **Build first** by running `pnpm run build` before debugging

See [docs/DEBUGGING-GUIDE.md] for detailed debugging
instructions.

## Packaging

To build a Windows installer locally (unsigned, for testing production
behavior), run `pnpm package:nosign` from the repo root; the output lands in
`dist/`. Signed installers are produced by CI only.

- [Windows packaging]: commands, the version placeholder, what the pipeline
  does, and the traps
- [Flatpak packaging]

## FAQ

### When will my changes be added to the stable release?

See [docs/branching-and-release-strategy.md] for more
information.

## Further Reading

- [All documentation] - indexed by topic
- [Debugging]
- [Docker Dev Containers]

[All documentation]: ./docs/README.md
[Arch-based setup]: ./docs/install-instructions/archlinux.md
[CLI]: https://git-scm.com/
[Debian-based setup]: ./docs/install-instructions/debian-based.md
[Debugging]: ./docs/DEBUGGING-GUIDE.md
[Docker Dev Containers]: ./docker
[docs/DEBUGGING-GUIDE.md]: ./docs/DEBUGGING-GUIDE.md
[docs/branching-and-release-strategy.md]: ./docs/branching-and-release-strategy.md
[Fedora setup]: ./docs/install-instructions/fedora.md
[Flatpak packaging]: ./docs/packaging/flatpak.md
[GUI client]: https://git-scm.com/tools/guis
[Generic Installation Instructions]: ./docs/install-instructions/generic.md
[GitHub account]: https://github.com/login
[GitHub Desktop]: https://github.com/apps/desktop
[Neovim]: https://neovim.io/
[NixOS setup]: ./docs/install-instructions/nixos.md
[Shared Setup]: ./docs/install-instructions/shared.md
[VS Code]: https://code.visualstudio.com/
[VS Code download]: https://code.visualstudio.com/download
[WebStorm]: https://www.jetbrains.com/webstorm/
[Windows setup]: ./docs/install-instructions/windows.md
[Windows packaging]: ./docs/packaging/windows.md
