# Evidence for reviewers

A reviewer should be able to see the change working without checking out the branch. Capture
that while running the scenarios, not afterwards from memory.

## Screenshot or video

Pick per scenario, by what the reviewer has to see:

| The change is about                                               | Use                                    |
| ----------------------------------------------------------------- | -------------------------------------- |
| A state: a layout, a dialog, an error message, an empty state     | Screenshots, base and change as a pair |
| A sequence: a flow across pages, progress, a transition, ordering | Video                                  |
| Timing: something that flickers, jumps, or shows too early        | Video                                  |
| Nothing visible (state, files, log lines)                         | Neither: quote the state or log lines  |

Screenshots are the default. They load in the PR without a click, sit side by side, and can be
read on a phone. Reach for video when a still would need the caption "then it does X".

A change with nothing to see still gets evidence, as text: the before/after table from the
scenarios and the log line or state that shows the difference.

## Before capturing

- **Size the window.** A capture is as big as the window, so set it first:
  `() => window.__vortexLive.resize(1280, 800)`. That size reads well at a PR's inline width, and
  using it every time keeps before and after comparable. (The DevTools `resize_page` tool doesn't
  work on Electron windows.)
- **Clear the stage.** Dismiss notifications and dialogs that aren't part of the scenario, and
  navigate to where the scenario starts.
- **Everything captured is public.** Screenshots and video go on a public PR. The Nexus Mods
  account name and avatar in the title bar are public already and can stay. What to keep out of
  frame is anything from the machine or the account that isn't: local paths with the OS user name
  in them (Settings, some error dialogs), and mods or collections in the list that aren't
  published. Pick a page or an element (`take_screenshot` with the element's `uid`) that doesn't
  show them, rather than cropping afterwards.

## Screenshots

`take_screenshot` with a `filePath` (or `screenshot:<file>` in `scripts/mcp-call.mjs`; use
`screenshot:<file>@@<element>` to capture one element by name). Read each one back before using
it: check it shows the point, and that no leftover dialog covers it.

- Take the pair from the same place at the same size: `<scenario>-before.png` on the base,
  `<scenario>-after.png` on the change.
- Capture at the moment the point is on screen. Wait on the app (the `until:` step, or
  `waitFor`), not a fixed delay.
- One point per screenshot. If it needs an arrow to find, capture the element instead of the
  window.

## Video

The chrome-devtools server records the window: `screencast_start` with a `filePath`, the steps,
`screencast_stop`. Start, steps and stop have to share one server session, so from the shell
they go in one call. Write the take as a steps file, one step per line: it needs no shell
quoting, and the same file films the base and the change.

```text
# .live-test/LAZ-1526/re-add-collection.steps
record:.live-test/LAZ-1526/re-add-collection-after.mp4
wait:1500
click:Add collection@@image "SVE + Grandpa's Farm"
until:() => document.body.innerText.includes('collection added')
wait:2500
screenshot:.live-test/LAZ-1526/re-add-collection-after-1-added.png
click:button "Install Now"
wait:3000
?click:button "Continue"
until:() => document.body.innerText.includes('Collection installation complete')
wait:2500
stop
```

```sh
node .claude/skills/live-test/scripts/mcp-call.mjs "steps:.live-test/LAZ-1526/re-add-collection.steps"
```

A recording is only written when it is stopped. The script stops it if a step fails, but a
call that ends without `stop`, or that the shell tool kills at its timeout, leaves an empty
file: run a take that waits on an install in the background (see "Waits" in the skill). Take the
screenshots inside the same take: they then show exactly what the video shows.

- **Script it, then film it.** Run the steps once without recording until they pass, then film a
  clean take from a reset state. A take with a failed click or a stray dialog is retaken, not
  explained.
- **Keep it short**: one scenario per file, under a minute. Leave a second or two before the
  first step and after the last, so the start and end states are readable.
- **Slow enough to follow.** A `wait` between steps of one to two seconds; a viewer can't follow
  clicks at script speed.
- **Check it** before handing it over: it exists, it is not a few kilobytes, and where `ffmpeg`
  is installed pull a frame from the middle (`ffmpeg -ss 5 -i x.mp4 -frames:v 1 frame.png`) and
  look at it.
- **Codec.** The recording is AV1 in an MP4. If it won't play where it is going, re-encode:
  `ffmpeg -i in.mp4 -c:v libx264 -crf 18 -pix_fmt yuv420p out.mp4`.

This is a recording of a real run, which is what a PR needs. For a polished video (captions,
title cards, frame-exact capture, music), the NexusDB team has a kit and a skill built on
Playwright and ffmpeg. Read them before building anything similar here, and reuse their rules
for what to film and how to review a take rather than writing new ones:

- Skill: <https://github.com/Nexus-Mods/data/tree/main/.claude/skills/nexusdb-video>
- Kit and its README: <https://github.com/Nexus-Mods/data/tree/main/discover/video>

Their review rule applies to every video made here too: the user should never be the first to
see a broken frame.

## Handing it over

Everything goes in one folder per change, at the repo root: `.live-test/<issue or branch>/`
(`.live-test/LAZ-1526/`). The folder is git-ignored: evidence is attached to the PR, not
committed.

```text
.live-test/LAZ-1526/
  README.md                               the commits compared, and one line per file
  re-add-collection-before.png            <scenario>-before / -after, numbered when a flow has steps
  re-add-collection-before.mp4
  re-add-collection-after-1-added.png
  re-add-collection-after-2-installed.png
  re-add-collection-after.mp4
```

Write the `README.md` last, and keep it to an index: the base and change commits compared, and
one line per file saying what it shows. The before/after table is written once, in the PR's
Testing section below; don't repeat it in the README.

GitHub only takes images and video in a PR through the web editor, so the user attaches them:
select a placeholder line in the PR description and paste or drop the file over it. Write the
Testing section for them as a template that is ready to paste into, in the order a reviewer
should look. It is also what you show the user in your report, in a fenced block so they can
copy it as it is:

```markdown
### Testing

Tested live in a dev build:

| Scenario                            | release/v2.11                   | This PR                   |
| ----------------------------------- | ------------------------------- | ------------------------- |
| Re-add a collection already on disk | "File already downloaded" error | Installs from the archive |

---

<details>
  <summary>Re-add Collection Before</summary>

<!-- paste: re-add-collection-before.png -->

<!-- paste: re-add-collection-before.mp4 -->

</details>
<details>
  <summary>Re-add Collection After</summary>

Added

<!-- paste: re-add-collection-after-1-added.png -->

Installed

<!-- paste: re-add-collection-after-2-installed.png -->

<!-- paste: re-add-collection-after.mp4 -->

</details>

---
```

The rules the template follows:

- The table's middle column is headed with the base branch the run compared against (see step 7
  of the skill), not always `master`.
- One Before and one After `<details>` block per scenario, in that order, with a `---` between
  scenarios. The summary is the scenario's name in title case plus "Before" or "After".
- One `<!-- paste: <file> -->` line per file in the evidence folder, named exactly as the file
  is, so the user can match them without opening anything. Every file gets a line, and no line
  names a file that isn't there.
- When a block holds more than one screenshot, put a one-word caption on its own line above
  each (the step's name from the file name: "Added", "Installed").
- Keep the blank lines around every placeholder and after `<summary>`. GitHub only renders a
  pasted video link as a player, and Markdown inside `<details>` at all, when it is set off by
  blank lines.
- Nothing else goes inside the blocks. GitHub strips scripts and styles from a PR description,
  so a before/after slider or any other interactive comparison can't work there.
