# Install a Nexus Mods collection

You are driving the Vortex desktop application and Google Chrome through
Playwright, connected to each app's DevTools port. Three tool sets are
available:

- `vortex` (Playwright, CDP on localhost:9222): the Vortex Electron app.
  Before the first action, call its `browser_tabs` tool and select the
  page whose URL ends in `index.html` (the main window).
- `chrome` (Playwright, CDP on localhost:9223): Google Chrome. Use
  `browser_tabs` to pick the tab you need.
- `vnc` (screenshots + clicks on the whole desktop): only for anything
  Playwright cannot see (native OS dialogs). Do not use it for Vortex or
  Chrome pages.

Snapshot (`browser_snapshot`) instead of screenshotting, and act on
element refs, never guessed coordinates. Judge everything from the UI:
do not read container logs or other files.

The target collection is **Stardew Valley VERY Expanded** (revision 113,
101 mods):
`https://www.nexusmods.com/games/stardewvalley/collections/tckf0m`

The goal is to install the whole collection through Vortex and verify
that every required mod ended up installed.

## Task

1. **Confirm Vortex is running and logged in.** Snapshot the Vortex main
   window. The header should show an avatar / username, not a `Log in`
   button. If Vortex is not running, or shows `Log in`, report that and
   stop (BLOCKED): the collection flow needs a logged-in Vortex (log in
   first with the `1-check-mod-install` prompt's step 2).

2. **Make sure Stardew Valley is the managed, active game.** Open the
   `Games` page. If Stardew Valley is under `Added games` and is the
   active game in the header, continue. If it is under `New games
   detected`, click `Add game` on it (a purge prompt, if one appears,
   gets `Cancel`). If it is not found anywhere, report that and stop.

3. **Open the collection in Chrome.** Using `chrome`, open
   `https://www.nexusmods.com/games/stardewvalley/collections/tckf0m` in a
   tab. Accept the cookie banner with `Allow all` if one shows. Snapshot
   and check:
   - the title is "Stardew Valley VERY Expanded" and a revision number is
     shown (note it);
   - the `Mods` tab count (expected 101 for revision 113; note the actual
     number, it changes between revisions);
   - whether the page says "Go premium to unlock one-click collections".
     Note this: it means the account is free.
   - If the page shows a login prompt instead of an avatar, report that
     and stop (BLOCKED).

4. **Add the collection to Vortex.** First select the collection's tab
   with `browser_tabs` (`action: select`) so it is in front. Click the
   `Add collection` button
   (not `Add collection (Desktop only)`; use whichever is visible and
   enabled). Chrome hands an `nxm://` link to Vortex, which is
   pre-approved, so no "Open Vortex?" prompt should appear. If one does,
   click `Open Vortex` (that prompt is native, so use a `vnc`
   screenshot).

5. **Open the collection in Vortex.** In `vortex`, snapshot. Vortex should
   show the collection (a "collection added" notification and/or a
   collection page titled "Stardew Valley VERY Expanded", or a new entry
   under its `Collections` area). If it does not appear within ~30
   seconds, report what you see and stop.
   - Note the mod count Vortex shows for the collection and whether it
     matches step 3.
   - Note any curator instructions / warnings the collection page shows,
     but do not act on them.

6. **Start the installation.** Click the collection's install action
   (wording is along the lines of `Install this collection to profile`,
   `Install Now`, or `Start installing`).
   - If a dialog asks where to install: accept the defaults. Leave
     `Install optional mods` unticked. Create the new profile only if
     the dialog recommends it; otherwise keep the current profile.
   - If Vortex then asks whether to switch to the new profile, answer
     `Yes`: the collection's mods are only enabled in that profile.
   - A "Game version mismatch" dialog usually follows: click `Continue`
     straight away (it is a known flag, so note it).
   - If a changelog or instructions dialog appears, read it, then
     continue with the primary positive button (`Continue`, `Install`).
   - Do NOT click anything that purges or overwrites existing files:
     always pick `Cancel` on such prompts.

7. **Check the account type before waiting.** Within ~60 seconds of
   starting, snapshot Vortex.
   - A Premium account downloads mods automatically: rows move through
     `Download pending` → `Downloading` → `Installing`.
   - A free account cannot: Vortex stalls waiting for you to download
     each mod in the browser (it opens Nexus Mods pages, or shows a
     message asking to download mods manually / go Premium). Per-mod
     clicking is out of scope for 101 mods.
   - If the account is free (step 3 said "Go premium", or Vortex is
     waiting for manual downloads), stop here and report **BLOCKED: the
     test account is not Premium**, with how many mods Vortex had
     already installed. Do not click through the per-mod browser flow.

8. **Wait for the installation to finish.** Poll the collection page
   every ~20 seconds (snapshot, not screenshot) for up to 30 minutes.
   Between polls do nothing else in the app. Track:
   - the progress counts (downloaded / installed / total);
   - any `Download failed`, `Download paused` or `Install pending` that
     does not clear after a couple of polls;
   - any modal that needs a decision. For fomod / install dialogs accept
     the defaults and continue with the primary positive action. For
     anything that purges, overwrites or replaces files: `Cancel`.
   - Stop waiting as soon as the page says `Collection installation
     complete` or `Collection installation incomplete`. If 30 minutes
     pass with neither, report a timeout and the last counts.

9. **Verify the result.** On the collection page, open the mods list and
   read the final state:
   - "Collection installation complete" with no failures is the pass
     condition. For `Collection installation incomplete`, list the
     failed mods (the "N mod could not be installed" line and the rows
     marked failed) by name.
   - Optional mods are allowed to be uninstalled (we left them off).
     Required mods are not.
   - Count every required mod's state: `installed required mods / total
     required mods`. The list draws only about 15 rows at a time, so
     filter or sort it (for example by status) and count the rows, or
     scroll through all of it; a spot-check is not a count. The
     collection is **fully installed** only if every required mod is
     installed with none failed. If you cannot count them all, say so:
     the result is FAIL.
   - Open the Stardew Valley `Mods` view and confirm it lists the
     collection's mods as `Enabled` (spot-check at least 5, including
     SMAPI if the collection includes it).
   - Look for a deployment banner (`Deploy Mods`, `Changes Pending`). If
     one is shown, note it but do not click it.

10. **Report.** Summarise in 12-18 lines:
    - Vortex logged in, Stardew Valley active (and whether you had to add
      it).
    - Collection name, revision, mod count on the website vs in Vortex.
    - Whether the account was Premium. If free, stop the report there
      and end it with `RESULT: BLOCKED`.
    - How the nxm:// handoff behaved (prompt shown or not).
    - Install start dialogs and what you chose.
    - Total time from clicking install to the final state.
    - The final counts: installed / failed / skipped, and the names of any
      failed required mods.
    - The fully-installed verdict (yes / no) and the spot-checked mods.
    - Any UX or behaviour that looked wrong (a button missing, a dialog
      that should not appear, a list that does not update, errors, big
      slowdowns): list each as a flag with where you saw it.

    End the report with exactly one of these as its last line, with
    nothing after it:
    - `RESULT: PASS`: fully installed and nothing looked wrong.
    - `RESULT: PASS_WITH_FLAGS`: fully installed, with flags raised (UX
      oddities alone are never a FAIL).
    - `RESULT: FAIL`: any required mod missing or failed, a failed
      download, a timeout, or a count you could not complete.
    - `RESULT: BLOCKED`: the run could not get going (Vortex not running
      or logged out, a free account, or the website showed a sign-in
      form).

## Guidance

- Snapshot before acting and after, in Vortex and Chrome.
- Do not change settings, activate other games, or launch the game.
- Do not confirm any purge / cleanup / overwrite prompt: always pick the
  cancel / abort option.
- If a login form appears, report it and stop (BLOCKED).
- If an unrelated modal blocks the UI, describe it and stop. Do not
  dismiss it without instructions.
