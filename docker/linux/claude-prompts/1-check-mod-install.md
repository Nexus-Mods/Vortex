# Install a mod with Vortex and start the game

You are driving the Vortex desktop application and Google Chrome through
Playwright, connected to each app's DevTools port. Three tool sets are
available:

- `vortex` (Playwright, CDP on localhost:9222): the Vortex Electron app.
  Before the first action, call its `browser_tabs` tool and select the
  page whose URL ends in `index.html` (the main window).
- `chrome` (Playwright, CDP on localhost:9223): Google Chrome. It only
  connects once Vortex has opened Chrome; if a call fails because Chrome
  is not running yet, do the Vortex action that opens it first. Use
  `browser_tabs` to pick the tab you need.
- `vnc` (screenshots + clicks on the whole desktop): only for Stardew
  Valley, which draws its own UI, and for anything Playwright cannot see
  (native OS dialogs). Coordinates are in the desktop's pixel space.

In Vortex and Chrome, read the page with `browser_snapshot` and act on
element refs from it (`browser_click`, `browser_type`). Only take a
Playwright or VNC screenshot when the snapshot can't tell you what you
need.

## Task

1. **Confirm Vortex is running.** Snapshot the Vortex main window and
   check it:
   - The window title or in-app branding should say "Vortex".
   - The left-hand navigation column should contain entries such as
     `Dashboard` and `Games`.
   - If you only see a loading splash, wait for the text `Dashboard`
     (retry up to 3 times before giving up).
   - If Vortex is not running, report that clearly and stop (BLOCKED) —
     do not try to launch it yourself.

2. **Log in to Vortex.** Installed games that are not managed yet are
   only listed (under `Games detected`) once Vortex is logged in, so
   Stardew Valley cannot be found on the Games page until this is done.
   - If the Vortex header (top-right) already shows an avatar / username
     instead of a `Log in` button, skip to step 3.
   - Click `Log in` in the Vortex header. Vortex hands a Nexus Mods
     OAuth URL to Chrome; switch focus to Chrome (Guidance focus rule).
   - If a cookie banner shows, click `Allow all`.
   - If Chrome shows the Nexus Mods sign-in form or a Cloudflare check
     instead of the authorisation page, stop (BLOCKED).
   - On the authorisation page, click `Authorise` (or `Allow`). The next
     page (`oauth/success`, "Authorisation successful!") has a `CONTINUE`
     button: click it. That click is what delivers the login to Vortex;
     without it Vortex stays logged out.
   - Switch focus back to Vortex. The header should now show a logged-in
     state (avatar / username, no `Log in` button).
   - If any part of this fails, report what you see and stop.

3. **Open the Games tab.** Click the `Games` entry in the left-hand
   sidebar. It is one scrolling page with the sections `Games detected`,
   `Added games` and `All supported games`, and a search input at the
   top right.

4. **Search for Stardew Valley.**
   - Click the search input at the top right of the Games page and type
     `Stardew`. Detected games may take a few seconds to appear after
     login; if nothing shows, wait for the text `Stardew Valley`.
   - Note which section the Stardew Valley tile appeared under (Games
     detected / Added games / All supported games). Scroll the page if
     needed.
   - If no Stardew Valley tile is found in any section, report that and
     stop.

5. **Add Stardew Valley as a managed game.**
   - Hover over the Stardew Valley tile and click the `Add game` button
     (the action may also be available via a right-click context menu;
     wording may be `Add game`, `Manage`, or `Activate`).
   - Vortex may show a confirmation dialog or briefly switch into a
     setup state for the game.

6. **Handle the purge prompt — choose Cancel.** If a dialog appears
   asking whether to purge existing files (wording will be along the
   lines of "purge existing mod files", "remove existing deployment",
   or "clean up files from previous deployment"):
   - Click the **`Cancel`** button (NOT `Confirm`, `OK`, `Purge`, or
     `Proceed`), and check the dialog dismissed and no purge ran.
   - If no such dialog appears, skip this step and note that in your
     report.

7. **Verify the game is now managed.**
   - Snapshot the Games page and confirm Stardew Valley now appears
     under the `Added games` section (clear the search if needed).
   - The active-game indicator (top-left status / breadcrumb / banner)
     should also reflect that Stardew Valley is the current game.

8. **Open the Mods view.** Click the `Stardew Valley` tab in the top
   bar, then `Mods`.
   - Note whether the mod list is empty (typical message: "You don't
     have any installed mods") or already contains entries.

9. **Follow the "I know a place" link (only if no mods are installed).**
   When the Mods page is empty, Vortex shows a help link directing users
   to Nexus Mods to find mods — wording is along the lines of
   `I know a place` or `Get Stardew Valley mods`.
   - Click the link. Vortex will hand the URL to the system browser
     (Google Chrome) via xdg-open.
   - If the Mods page is NOT empty, skip steps 9–17 entirely, note that
     in the report, and proceed to step 18 (Install SMAPI).

10. **Check the Nexus Mods page.** Switch to `chrome` and pick the tab
    Vortex opened.
    - If a cookie consent banner shows, click `Allow all` (wording may
      vary slightly — `Accept all`, `Allow all cookies`, `Agree`). Do
      not click `Reject`, `Manage preferences`, or similar.
    - The page should show a logged-in state (avatar / username in the
      top bar). If it shows a sign-in form or a Cloudflare check
      instead, stop (BLOCKED).

11. **Search for "CJB Item Spawner" from the Stardew Valley page.** The
    page Vortex opened in step 9 has a URL ending in
    `/games/stardewvalley`. The search input on that page is scoped to
    Stardew Valley mods, which is the right scope here.
    - Locate the search input in the top navigation bar (usually a
      magnifying-glass icon that expands into a text field, or a
      visible search box).
    - Click the search input and type `CJB Item Spawner` exactly.
    - Submit the search — press Enter, or click the search submit
      button / icon. Search results may appear as a dropdown
      autocomplete list and / or a full results page.
    - If you've been redirected away from the Stardew Valley context
      (e.g. to the site-wide home page), navigate to
      `https://www.nexusmods.com/games/stardewvalley` via the address
      bar and retry the search there.

12. **Open the CJB Item Spawner mod page.**
    - In the results, find the entry titled "CJB Item Spawner" for
      Stardew Valley (game label should read "Stardew Valley").
    - Click that result. The page banner should show the mod title
      "CJB Item Spawner", an author, and the Stardew Valley game tag.
    - If the search returned no matching result, or only an unrelated
      mod, report that and stop.

13. **Open the Files section.**
    - Click the `Files` tab in the page-level navigation (`Description`,
      `Files`, `Images`, ...). Scroll down if it is not visible.
    - Wait for the text `Main Files`. You should see a list of file
      rows, each with `Mod Manager Download` and `Manual Download`
      buttons.

14. **Start the Mod Manager Download for the main file.**
    - Identify the main mod file: in the `Main Files` section, the
      first / primary file row (usually only one). Do not pick files
      from `Optional Files`, `Old Files`, or `Archived Files`.
    - Click the **`Mod Manager Download`** button (NOT
      `Manual Download`) on that row.
    - Chrome hands the resulting `nxm://` URL to Vortex via the
      registered protocol handler.
    - Nexus Mods may first show a `Download mod file` requirements dialog
      (listing e.g. SMAPI): click the `Download` link for CJB Item
      Spawner only, not the requirements. A free account then lands on a
      download page: click `Slow download` (never the premium
      `Fast download`) and wait out the short countdown.
    - Chrome is pre-set to allow `nxm://` from nexusmods.com, so no
      "Open Vortex?" prompt should appear. If one does, click `Open
      Vortex` (tick `Always allow` first); that prompt is native, so use
      a `vnc` screenshot for it.

15. **Wait for the download to finish and the mod to install.** The file
    is tiny: the download and the install can finish within a couple of
    seconds, and Vortex installs it automatically with no dialog.
    - Do NOT rely on the default Downloads list: it can be empty even
      though the download finished. Instead go straight to the
      `Stardew Valley` tab → `Mods` and wait for the text
      `CJB Item Spawner` (retry for up to ~30 seconds). If it is not
      there yet, open Downloads → `View All Downloads` to check the
      row's state.
    - Do not click `Install` on a finished download if the mod is already
      in the Mods list: that only produces a "replace?" prompt.
    - Do not look at container logs or other files; judge from the UI.
    - If the download shows a failure that does not recover, report what
      you see and stop.

16. **Handle the install / fomod dialog if shown.** When the download
    completes, Vortex may pop a modal asking how to install the mod
    (e.g. a fomod installer, "Choose Mod Type", a "this mod's contents
    don't look like a standard layout" prompt, or simple
    `Install` / `Cancel` buttons):
    - Accept the default options. Click the primary positive action —
      `Install`, `OK`, `Continue`, `Finish`. Do **not** click `Cancel`.
    - If the modal lists multiple mod-type variants or component
      options, pick the default / recommended / first selection without
      changing anything else, then confirm.
    - If no dialog appears, the mod installed automatically — note
      that and continue.

17. **Confirm CJB Item Spawner appears under Mods.**
    - In the `Stardew Valley` tab → `Mods`, snapshot the `CJB Item
      Spawner` row. Its status column should read `Installed` or
      `Enabled` (not `Downloaded` only, and not `Disabled`).
    - If the mod is `Disabled`, enable it: right-click the row →
      `Enable`, or toggle the enable checkbox in the row, and check the
      status moved to `Enabled`.
    - If the mod is not in the list at all, report and stop.

18. **Install SMAPI.** CJB Item Spawner only runs in the game through
    SMAPI. Vortex showed a `SMAPI is not installed` notification when the
    game was added; if it is no longer on screen, open the notifications
    panel.
    - Click the notification's `Get SMAPI` button. Vortex downloads SMAPI
      from Nexus Mods, installs it and deploys it. A Premium account needs
      no browser step.
    - In the `Stardew Valley` tab → `Mods`, wait for the text `SMAPI` and
      check its row shows `Enabled`.
    - If SMAPI is already in the Mods list, skip this step and note that.
      If there is no `Get SMAPI` notification and SMAPI is not listed,
      report that and stop (FAIL).

19. **Deploy (only if not deployed automatically).**
    - Look for a deployment banner at the top of the Vortex window
      (typically yellow / orange) reading along the lines of
      `Deploy Mods`, `Changes Pending`, or `Mods need to be deployed`.
    - If shown, click `Deploy` and wait for completion (a progress
      indicator followed by a success notification).
    - Acknowledge any post-deployment dialog by clicking `Close` / `OK`.
    - If no deployment banner ever appears, deployment is automatic;
      note that and continue.

20. **Launch the game through SMAPI.** Once SMAPI is deployed, Vortex
    makes it the primary tool, so the main `Play` / `Launch` action
    starts the game through SMAPI.
    - Look for the main `Launch` / `Play` action. This is typically a
      large button on the active-game banner / dashboard, or the primary
      action on the Stardew Valley tile in the `Added games` section.
      Wording may be `Launch`, `Play`, `Start`, `SMAPI`, or just a play
      (▶) icon.
    - Click the launch action, then take a `vnc` screenshot to capture
      any tool-selection or warning dialog. If Vortex shows a "select
      tool to launch" picker, choose SMAPI.
    - SMAPI may open a console window next to the game. Leave it open.

21. **Wait for the game to start.** Stardew Valley with SMAPI can take
    10–45 seconds to launch from cold:
    - Take screenshots at roughly 5-second intervals (up to ~60 seconds
      total) and look for the Stardew Valley window appearing in the VNC
      session. Signs it has launched: a new top-level window with farm /
      pixel-art content, the ConcernedApe splash, or an opening movie.
    - If after ~60 seconds nothing has appeared, report the timeout and
      describe what is on screen (Vortex still focused? error dialog?
      SMAPI console showing an error? blank desktop?). Don't keep
      retrying.

22. **Confirm the Stardew Valley main menu.** Once the game window is up
    and past any intro splash / opening animation, confirm the title
    screen:
    - Screenshot the main menu.
    - The title text on the screen should read **"Stardew Valley"** (the
      game's logo, usually in a hand-drawn font).
    - There should be menu options to start a new game and to load an
      existing save. Exact wording varies by version but is typically
      `New`, `Load`, and `Co-op` (plus `Exit`). Both `New` and `Load`
      must be present and look interactable (not greyed out).
    - If the menu shown does not say "Stardew Valley" or is missing the
      new / load options, screenshot it and report what you see instead.
    - Do not click anything inside the game.

23. **Check the SMAPI log.** SMAPI writes which mods it loaded before the
    main menu appears.
    - In Vortex, open the `Stardew Valley` tab → `Mods` and click
      `SMAPI Log` in the toolbar (it may sit in an overflow `...` menu).
      A `SMAPI Log` dialog shows the log text.
    - Confirm the log lists CJB Item Spawner among the loaded mods (a
      `Loaded N mods:` section with a `CJB Item Spawner` line). Quote
      that line in the report.
    - Flag any `ERROR` or `WARN` lines that mention CJB Item Spawner or
      SMAPI itself.
    - The result is FAIL if Vortex says `No SMAPI logs found`, the log
      shows SMAPI crashed, or CJB Item Spawner is not listed as loaded.
    - Close the dialog with `Close`. Do not click `Copy & Share log`: it
      opens an external site.
    - Quit the game so the next check starts clean. It runs fullscreen
      with no title bar, so it closes with Alt+F4, which closes whichever
      window is in front. Take a `vnc` screenshot first and press Alt+F4
      with the `vnc` key tool only if the game fills the screen. If
      Vortex, Chrome or anything else is in front, leave the game open
      and report it as a flag. Take another `vnc` screenshot to confirm
      the game closed. Close the SMAPI console window the same way if it
      stays open.

24. **Report.** Summarise in 14-20 lines:
    - Whether Vortex was already running, and whether the Vortex login
      (step 2) succeeded or was already in place.
    - That the Games tab opened successfully and which section Stardew
      Valley was found under.
    - Whether adding the game triggered a purge prompt, its exact
      wording, and that it was cancelled (no purge ran).
    - That Stardew Valley now shows as managed and is the active game.
    - The state of the Mods view (empty vs. populated) and whether the
      `I know a place` link was followed.
    - Whether a cookie banner appeared on Nexus Mods and was dismissed,
      and that the website was logged in (do **not** include the
      username — just say "logged in as the configured user").
    - That the search for "CJB Item Spawner" (run from the Stardew
      Valley game page Vortex opened) returned a matching result, and
      the mod page and Files tab loaded.
    - That `Mod Manager Download` was clicked on the main file and that
      Vortex picked up the nxm:// handoff.
    - That the download completed (approximate time) and whether an
      install / fomod dialog appeared (and what was clicked).
    - That CJB Item Spawner appears under the Mods view with an
      `Installed` / `Enabled` status.
    - Whether `Get SMAPI` installed SMAPI and it shows `Enabled`, and
      whether deployment was automatic or required a manual `Deploy`
      click.
    - That the game launched through SMAPI (and roughly how long it took
      to reach the main menu).
    - That the main menu title says "Stardew Valley" and that both the
      new-game and load-save options are present and interactable.
    - The SMAPI log line showing CJB Item Spawner loaded, and any SMAPI
      errors or warnings about it.
    - If anything failed, the precise step it failed at and a brief
      description of what was on screen at that point.
    - Any flags (see the field notes).

    End the report with exactly one of these as its last line, with
    nothing after it:
    - `RESULT: PASS`: every step worked and nothing looked wrong.
    - `RESULT: PASS_WITH_FLAGS`: every step worked, with flags raised.
    - `RESULT: FAIL`: a step failed, or you could not confirm a result
      the task asks for.
    - `RESULT: BLOCKED`: the run could not get going (Vortex not
      running, or the website showed a sign-in form or Cloudflare
      check).

## Guidance

- In Vortex and Chrome, act on element refs, never guessed coordinates.
- Stardew Valley is only watched through `vnc` screenshots. Nothing in
  this check clicks inside the game window.
- Playwright drives Vortex and Chrome without either window being in
  front, so "switch focus" in the steps means switching tool set. Only
  raise a window (click its title bar, or the fluxbox taskbar) when you
  need it visible in a VNC screenshot.
- Do **not** confirm any purge / cleanup / overwrite prompt — always
  pick the cancel/abort option on such dialogs.
- Do not change any other settings or activate any other game.
- If a login prompt or unrelated modal blocks the UI (other than the
  Vortex login flow in step 2 and the "Open Vortex?" protocol-handler
  prompt in step 14), describe it and stop. Do not dismiss it without
  instructions.
