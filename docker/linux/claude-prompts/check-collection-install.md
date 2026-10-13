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
   stop: the collection flow needs a logged-in Vortex (log in first with
   the `check-mod-install` prompt's step 1b).

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
     and stop (the website login is handled by the `check-mod-install`
     prompt).

4. **Add the collection to Vortex.** Click the `Add collection` button
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
   - Compute `installed required mods / total required mods` from what
     the page shows. The collection is **fully installed** only if every
     required mod is installed with none failed.
   - Open the Stardew Valley `Mods` view and confirm it lists the
     collection's mods as `Enabled` (spot-check at least 5, including
     SMAPI if the collection includes it).
   - Look for a deployment banner (`Deploy Mods`, `Changes Pending`). If
     one is shown, note it but do not click it.

10. **Report.** Summarise in 12-18 lines:
    - Vortex logged in, Stardew Valley active (and whether you had to add
      it).
    - Collection name, revision, mod count on the website vs in Vortex.
    - Whether the account was Premium. If free, say BLOCKED and stop the
      report there.
    - How the nxm:// handoff behaved (prompt shown or not).
    - Install start dialogs and what you chose.
    - Total time from clicking install to the final state.
    - The final counts: installed / failed / skipped, and the names of any
      failed required mods.
    - The fully-installed verdict (yes / no) and the spot-checked mods.
    - Any UX or behaviour that looked wrong (a button missing, a dialog
      that should not appear, a list that does not update, errors, big
      slowdowns): list each as a flag with where you saw it.
    - **Outcome: PASS, PASS WITH FLAGS or FAIL.** Missing required mods or
      failed downloads are always FAIL. UX oddities alone are PASS WITH
      FLAGS. BLOCKED (free account) is reported as BLOCKED, not as PASS.

## Guidance

- Snapshot before acting and after, in Vortex and Chrome.
- Do not change settings, activate other games, or launch the game.
- Do not confirm any purge / cleanup / overwrite prompt: always pick the
  cancel / abort option.
- The Nexus Mods password is never needed in this prompt. If a login form
  appears, report it and stop.
- If an unrelated modal blocks the UI, describe it and stop. Do not
  dismiss it without instructions.
