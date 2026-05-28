# Add Stardew Valley as a managed game

You are driving the Vortex desktop application through a VNC MCP server.
The VNC session shows the Vortex Electron window (or its loading splash).
Coordinates returned by screenshot tools are in the desktop's pixel space.

This prompt is the first step of a wider mod-installation flow: managing
the target game so a mod can later be installed against it.

## Task

1. **Confirm Vortex is running.** Take a screenshot of the VNC session and
   look for the Vortex main window:
   - The window title or in-app branding should say "Vortex".
   - The left-hand navigation column should contain entries such as
     `Dashboard`, `Mods`, `Downloads`, `Profiles`, etc.
   - If you only see a loading splash, wait ~5 seconds and screenshot
     again (retry up to 6 times before giving up).
   - If Vortex is not running, report that clearly and stop — do not try
     to launch it yourself.

2. **Open the Games tab.** Click the `Games` entry in the left-hand
   sidebar (typically near the top of the navigation list, often with a
   gamepad / controller icon).
   - Wait briefly, then screenshot to confirm the Games page is showing.
     You should see a tabbed view with filters such as `Managed`,
     `Discovered`, `Supported`, and a grid of game tiles.

3. **Search for Stardew Valley.**
   - If a search / filter input is present at the top of the page, click
     it and type `Stardew`. Otherwise switch through the available tabs
     (`Discovered` first, then `Supported`) and scroll until you find
     the Stardew Valley tile.
   - Screenshot once the Stardew Valley tile is visible. Note which tab
     it appeared under (Managed / Discovered / Supported).
   - If no Stardew Valley tile is found in any tab, report that and
     stop.

4. **Add Stardew Valley as a managed game.**
   - Hover over the Stardew Valley tile and click the `Manage` button
     (the action may also be available via a right-click context menu;
     wording may be `Manage`, `Activate`, or `Add to Managed`).
   - Wait briefly and screenshot. Vortex may show a confirmation dialog
     or briefly switch into a setup state for the game.

5. **Handle the purge prompt — choose Cancel.** If a dialog appears
   asking whether to purge existing files (wording will be along the
   lines of "purge existing mod files", "remove existing deployment",
   or "clean up files from previous deployment"):
   - Click the **`Cancel`** button (NOT `Confirm`, `OK`, `Purge`, or
     `Proceed`).
   - Screenshot to confirm the dialog dismissed and no purge ran.
   - If no such dialog appears, skip this step and note that in your
     report.

6. **Verify the game is now managed.**
   - Screenshot the Games page and confirm Stardew Valley now appears
     under the `Managed` tab (switch to that tab if needed).
   - The active-game indicator (top-left status / breadcrumb / banner)
     should also reflect that Stardew Valley is the current game.

7. **Open the Mods view.** With Stardew Valley as the active game, click
   the `Mods` entry in the left-hand sidebar.
   - Wait briefly, then screenshot to confirm the Mods page is showing.
   - Note whether the mod list is empty (typical message: "You don't
     have any mods" or similar) or already contains entries.

8. **Follow the "I know a place" link (only if no mods are installed).**
   When the Mods page is empty, Vortex shows a help link directing users
   to Nexus Mods to find mods — wording is along the lines of
   `I know a place` or `Where can I find mods?`.
   - Locate the link and screenshot it.
   - Click the link. Vortex will hand the URL to the system browser
     (Google Chrome) via xdg-open.
   - If the Mods page is NOT empty, skip steps 8–20 entirely, note that
     in the report, and proceed to step 21 (Launch the game).

9. **Handle the Chrome first-run welcome (only if shown).** If this is
   Chrome's first launch in the container, it will display a welcome /
   setup flow before navigating anywhere:
   - Screenshot the welcome screen.
   - Click the primary continue control — wording may be `OK`, `Get
     started`, `Continue`, or similar.
   - On the "make Chrome your own" / sign-in step, choose the
     decline option — wording may be `Don't sign in`, `Skip`, `No
     thanks`, or `Continue without an account`. Do **not** sign into a
     Google account.
   - Step through any remaining welcome cards using the same
     skip / continue / no-thanks pattern until Chrome navigates to the
     Nexus Mods URL Vortex requested.
   - If no welcome appears (Chrome has been launched before), skip
     ahead to step 10.

10. **Accept cookies on Nexus Mods.** Once the Nexus Mods page has
    loaded, a cookie consent banner is usually shown.
    - Screenshot the banner.
    - Click the `Allow all` button (wording may vary slightly —
      `Accept all`, `Allow all cookies`, `Agree`). Do not click
      `Reject`, `Manage preferences`, or similar.
    - Screenshot to confirm the banner has dismissed.
    - If no banner is shown, note that and continue.

11. **Log into Nexus Mods.** Credentials live in two files in the home
    directory on the host where this Claude session is running.
    Read them via the Read tool — do **not** echo their contents back in
    your reply or in any screenshot description:
    - Username: `~/nexusmodsuser` (single line, trim trailing newline).
    - Password: `~/nexusmodspassword` (single line, trim trailing
      newline).

    Then on the Nexus Mods page in Chrome:
    - Click `Log in` / `Sign in` (typically top-right of the page).
    - When the login form appears, click the username/email field and
      type the username read from `~/nexusmodsuser`.
    - Click the password field and type the password read from
      `~/nexusmodspassword`. Do not paste the password into a screenshot
      annotation or include it in any tool argument outside the typing
      action itself.
    - Submit the form (click the `Sign in` / `Log in` button).
    - Wait briefly, then screenshot to confirm the page now shows a
      logged-in state (typically: avatar / username in the top bar, or
      a redirect away from the login form). If login fails (wrong
      credentials banner, CAPTCHA challenge, or 2FA prompt), report
      what you see and stop — do not retry.

12. **Search for "CJB Item Spawner" from the Stardew Valley page.** After
    login completes, the page should return you to the Stardew Valley
    game page Vortex opened in step 8 (URL ends in
    `/games/stardewvalley`). The search input on that page is typically
    scoped to Stardew Valley mods, which is the right scope here.
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
    - Wait briefly, then screenshot the results.

13. **Open the CJB Item Spawner mod page.**
    - In the results, find the entry titled "CJB Item Spawner" for
      Stardew Valley (game label should read "Stardew Valley").
    - Click that result. The mod page should load — confirm with a
      screenshot. The page banner should show the mod title
      "CJB Item Spawner", an author, and the Stardew Valley game tag.
    - If the search returned no matching result, or only an unrelated
      mod, report that and stop.

14. **Open the Files section.**
    - Scroll down the mod page until you can see the page-level
      navigation tabs (typically `Description`, `Files`, `Images`,
      `Videos`, `Posts`, `Bugs`, `Logs`, `Stats`). The tabs may also
      remain pinned near the top of the page as you scroll.
    - Click the `Files` tab.
    - Wait for the file listing to load, then screenshot. You should
      see at least one section heading (commonly `Main Files`) and a
      list of file rows, each with `Mod Manager Download` and
      `Manual Download` buttons.

15. **Start the Mod Manager Download for the main file.**
    - Identify the main mod file: in the `Main Files` section, the
      first / primary file row (usually only one). Do not pick files
      from `Optional Files`, `Old Files`, or `Archived Files`.
    - Click the **`Mod Manager Download`** button (NOT
      `Manual Download`) on that row.
    - Chrome will hand the resulting `nxm://` URL to Vortex via the
      registered protocol handler. Chrome may show a confirmation
      dialog along the lines of "Open Vortex?" — if it does, click
      `Open Vortex` (and, if available, tick `Always allow ...` first
      so subsequent downloads don't re-prompt).
    - Wait ~3 seconds, then screenshot. Confirm that Vortex (visible
      behind / alongside Chrome) shows a new entry under `Downloads`
      or a notification indicating the download has started. If the
      download appears to be stuck or failed (red error indicator,
      "login required", etc.), report what you see and stop.

16. **Switch back to Vortex and wait for the download to finish.**
    - Bring Vortex to focus (see the focus-rule in Guidance below):
      screenshot first, and if any part of the Vortex window is
      already visible behind / alongside Chrome, click its title bar
      to raise it; otherwise click its entry in the fluxbox taskbar /
      window list.
    - Click the `Downloads` entry in the left-hand sidebar.
    - Locate the CJB Item Spawner download row. It should show a
      progress bar / percentage advancing toward 100%.
    - Take screenshots every ~5 seconds (max ~90 seconds total) until
      the row's state reads `Finished`, `Installed`, or `Complete`.
    - If the download fails (red error icon, "failed" / "paused" state
      that does not recover), report what you see and stop.

17. **Handle the Vortex API login prompt (only if shown).** When the
    nxm:// handoff reaches Vortex, the API token needed to actually
    download may not be present yet (the website login in step 11
    covers nexusmods.com, not the Vortex API token). Vortex will
    typically show a dialog or banner asking the user to sign in —
    wording is along the lines of `Log in`, `Sign in to Nexus Mods`,
    or `You need to log in to download mods`.
    - Screenshot the prompt.
    - Click the `Log in` button in Vortex. Vortex will hand off to
      Chrome with a Nexus Mods OAuth URL.
    - Switch focus to Chrome (follow the Guidance focus rule). You
      should land on a Nexus Mods authorisation page asking to
      authorise Vortex. Because the website session from step 11 is
      still active, the page should not re-prompt for credentials —
      only for consent. Click the `Authorise` (or `Allow`) button.
    - Screenshot the resulting page. It may say "you can close this
      tab" or redirect automatically.
    - Switch focus back to Vortex (Guidance focus rule). Screenshot.
      The login prompt / banner should be gone, and Vortex's header
      should now reflect a logged-in state (avatar / username
      visible). The download started in step 15 should resume / begin
      from where it was waiting.
    - If the authorise page fails (404, "session expired", spinner
      that never resolves), report what you see and stop — do not
      attempt to re-log in via the website.
    - If no login prompt appeared in Vortex at all, note that in the
      report and continue to step 18.

18. **Handle the install / fomod dialog if shown.** When the download
    completes, Vortex may pop a modal asking how to install the mod
    (e.g. a fomod installer, "Choose Mod Type", a "this mod's contents
    don't look like a standard layout" prompt, or simple
    `Install` / `Cancel` buttons):
    - Screenshot the modal.
    - Accept the default options. Click the primary positive action —
      `Install`, `OK`, `Continue`, `Finish`. Do **not** click `Cancel`.
    - If the modal lists multiple mod-type variants or component
      options, pick the default / recommended / first selection without
      changing anything else, then confirm.
    - If no dialog appears, the mod installed automatically — note
      that and continue.

19. **Confirm CJB Item Spawner appears under Mods.**
    - Click `Mods` in the left-hand sidebar.
    - Locate the `CJB Item Spawner` row in the mod list and screenshot
      it. Its status column should read `Installed` or `Enabled`
      (not `Downloaded` only, and not `Disabled`).
    - If the mod is `Disabled`, enable it: right-click the row →
      `Enable`, or toggle the enable checkbox in the row. Screenshot
      again to confirm the status moved to `Enabled`.
    - If the mod is not in the list at all, report and stop.

20. **Deploy the mod (only if not deployed automatically).**
    - Look for a deployment banner at the top of the Vortex window
      (typically yellow / orange) reading along the lines of
      `Deploy Mods`, `Changes Pending`, or `Mods need to be deployed`.
    - If shown, click `Deploy` and wait for completion (a progress
      indicator followed by a success notification). Screenshot once
      the deployment has finished.
    - Acknowledge any post-deployment dialog (e.g. a SMAPI / "missing
      dependency" warning) by clicking `Close` / `OK`. CJB Item
      Spawner depends on SMAPI to actually run in-game, but the
      deployment itself can complete without SMAPI being installed —
      that's acceptable for this test.
    - If no deployment banner ever appears, deployment is automatic;
      note that and continue.

21. **Launch the game.** With Stardew Valley set as the active managed
   game, start it through Vortex:
   - Look for the main `Launch` / `Play` action. This is typically a
     large button on the active-game banner / dashboard, or the primary
     action on the Stardew Valley tile in the `Managed` tab. Wording may
     be `Launch`, `Play`, `Start`, or just a play (▶) icon.
   - Screenshot before clicking, click the launch action, and screenshot
     again immediately after to capture any tool-selection or warning
     dialog. If Vortex shows a "select tool to launch" picker, choose
     the default Stardew Valley entry (not SMAPI or anything else,
     unless that is the only option).

22. **Wait for the game to start.** Stardew Valley can take 10–30 seconds
   to launch from cold:
   - Take screenshots at roughly 5-second intervals (up to ~45 seconds
     total) and look for the Stardew Valley window appearing in the VNC
     session. Signs it has launched: a new top-level window with farm /
     pixel-art content, the ConcernedApe splash, or an opening movie.
   - If after ~45 seconds nothing has appeared, report the timeout and
     describe what is on screen (Vortex still focused? error dialog?
     blank desktop?). Don't keep retrying.

23. **Confirm the Stardew Valley main menu.** Once the game window is up
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

24. **Start character creation.** From the main menu, click the `New`
    button.
    - Wait briefly, then screenshot to confirm the character / farm
      creation screen is showing. You should see input fields for the
      farm name, the farmer's name, and a "Favorite Thing", plus
      controls for gender, pet, farm type, etc.

25. **Fill in the character creation fields.** Use these exact test
    values so screenshots and logs are reproducible across runs:
    - Farm name: `VortexTest`
    - Farmer name: `Tester`
    - Favorite Thing: `Mods`

    For each field: click the input, clear any placeholder text, type
    the value, then screenshot to verify the field shows what you
    typed. Leave gender, farm type, pet, etc. at their defaults — do
    not change anything else.

26. **Enable the "Skip Intro" option.** Locate the Skip Intro control —
    typically a checkbox or toggle near the bottom of the character
    creation screen (wording is usually `Skip Intro` or
    `Skip intro cutscene`; in some versions it lives inside an
    `Advanced Options` panel that has to be expanded first).
    - Screenshot before clicking so the un-checked state is captured.
    - Click the option to enable it.
    - Screenshot again and confirm the checkbox / toggle is now in the
      enabled state.
    - If the option cannot be found, report that and stop — do not
      proceed to start a new game without skip-intro enabled.

27. **Start the new game and confirm gameplay loads.** Click the
    primary `OK` / `Confirm` / `Start` button to begin.
    - Wait for the load. Take screenshots at roughly 5-second
      intervals (up to ~30 seconds total) and watch for the game to
      transition from character creation → loading → in-game view.
    - With Skip Intro enabled the bus / arrival cutscene should be
      skipped; the first scene visible should be the player character
      inside the farmhouse or on the farm at the start of Day 1.
    - Screenshot once the player character is on screen and the HUD
      (clock, energy bar, etc.) is visible. That confirms the new
      game started cleanly.
    - If the game gets stuck on a loading screen for more than ~30
      seconds, or shows an error, report what you see and stop.

28. **Report.** Summarise in 16-23 lines:
    - Whether Vortex was already running.
    - That the Games tab opened successfully and which tab Stardew Valley
      was found under.
    - Whether the `Manage` action triggered a purge prompt, and the exact
      wording the prompt used.
    - That the prompt was cancelled (no purge ran), if it appeared.
    - That Stardew Valley now shows as managed and is the active game.
    - The state of the Mods view (empty vs. populated) and whether the
      `I know a place` link was followed.
    - Whether Chrome was on its first run (welcome flow handled) or
      reused (skipped welcome).
    - Whether a cookie banner appeared on Nexus Mods and was dismissed.
    - That login completed successfully (do **not** include the username
      or password in the report — just say "logged in as the configured
      user").
    - That the search for "CJB Item Spawner" (run from the Stardew
      Valley game page Vortex opened) returned a matching result.
    - That the CJB Item Spawner mod page loaded and the Files tab was
      opened.
    - That `Mod Manager Download` was clicked on the main file and that
      Vortex picked up the nxm:// handoff (download visible in Vortex's
      Downloads / notifications).
    - Whether Vortex prompted for a Nexus Mods API login after the
      nxm:// handoff, and (if so) that the OAuth `Authorise` flow
      completed and Vortex returned to a logged-in state.
    - That the download completed (approximate time) and whether an
      install / fomod dialog appeared (and what was clicked).
    - That CJB Item Spawner appears under the Mods view with an
      `Installed` / `Enabled` status.
    - Whether deployment was automatic or required a manual `Deploy`
      click, and whether any SMAPI / dependency warnings appeared.
    - That the game launched successfully (and roughly how long it took
      to reach the main menu).
    - That the main menu title says "Stardew Valley" and that both the
      new-game and load-save options are present and interactable.
    - That character creation was reached, the test values
      (`VortexTest` / `Tester` / `Mods`) were entered, Skip Intro was
      enabled, and the new game loaded into in-game play (player
      character visible with HUD).
    - If anything failed, the precise step it failed at and a brief
      description of what was on screen at that point.

## Guidance

- Always screenshot before clicking, and screenshot again after to
  verify the click landed where you expected.
- Prefer clicking on the centre of UI elements; the noVNC canvas does
  not expose accessible names.
- **Clicking inside Stardew Valley uses a different mechanism.** The
  game (MonoGame) polls the mouse once per frame and only registers a
  click if it observes the button held down across a frame. The VNC MCP
  click is instantaneous (button down + up with no hold), so it falls
  between frames and the game never sees it — MCP clicks, including
  double-clicks, simply do not register inside the game. For every click
  on a control inside the Stardew Valley window (main menu, character
  creation, in-game menus, HUD) — i.e. all Stardew Valley interactions
  from step 23 onward — issue a *held* click via the Bash tool instead
  of the MCP click tool:

      docker exec vortex-vnc game-click X Y

  where `X` and `Y` are the same pixel coordinates you read off the MCP
  screenshot (the X server and the MCP framebuffer share one coordinate
  space). `game-click` moves the pointer, holds the button ~0.12s, then
  releases — long enough for the game to sample it. Optional args:
  `game-click X Y [HOLD_SECONDS] [BUTTON] [CLICKS]` (e.g. append `2` as
  the 5th arg for a double-click, or `3` as the 4th for right-click).
  Still screenshot before and after to confirm the click landed.
  - This applies ONLY to clicks inside the game render surface. Keep
    using the normal MCP click tool for Vortex, Chrome, and fluxbox /
    window-manager controls — those are event-driven and register the
    instantaneous MCP click fine.
  - Container name: the helper runs in the Vortex VNC container, named
    `vortex-vnc` by default. If a screenshot or earlier step shows a
    different container name, substitute it.
  - Typing into game text fields (farm / farmer / favourite-thing names
    in step 25) still works through the MCP type/key tools once the
    field is focused — only the *click* to focus the field needs
    `game-click`.
- To switch focus to Vortex, always screenshot first. If any part of
  the Vortex window is visible (a title bar, an edge poking out
  behind another window), click its title bar / window header to
  raise it. Only fall back to the fluxbox taskbar / window list when
  no part of Vortex is on screen.
- Do **not** confirm any purge / cleanup / overwrite prompt — always
  pick the cancel/abort option on such dialogs.
- Do not change any other settings or activate any other game.
- The Nexus Mods password is sensitive. Read it from disk only when
  about to type it into the login form, type it via a single typing
  action, and never include it in your textual reply, in any
  screenshot description, or in any other tool argument.
- If a login prompt or unrelated modal blocks the UI (other than the
  expected Nexus Mods login flow in steps 9–11 and the "Open Vortex?"
  protocol-handler prompt in step 15), describe it and stop. Do not
  dismiss it without instructions.
