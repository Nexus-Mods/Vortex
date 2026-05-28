# Launch Stardew Valley and start a new game

You are driving the Vortex desktop application through a VNC MCP server.
The VNC session shows the Vortex Electron window (or its loading splash).
Coordinates returned by screenshot tools are in the desktop's pixel space.

This prompt checks only the game-startup path: that Vortex can launch
Stardew Valley and that a fresh game can be created. It does not install
or deploy any mods. It assumes Stardew Valley has already been added as a
managed game in a previous run; if it has not, this prompt will add it.

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

2. **Make sure Stardew Valley is the active managed game.**
   - Screenshot and check the active-game indicator (top-left status /
     breadcrumb / banner). If it already shows Stardew Valley, skip to
     step 3.
   - Otherwise click the `Games` entry in the left-hand sidebar, then the
     `Managed` tab, and look for the Stardew Valley tile.
     - If it appears under `Managed`, click it (or its `Activate` /
       `Manage` action) to make it the active game.
     - If it is NOT under `Managed`, search for `Stardew` (use the
       `Discovered` / `Supported` tabs or the filter box), then click
       `Manage` on the Stardew Valley tile to add it. If a purge prompt
       appears (wording along the lines of "purge existing mod files" or
       "files from a different instance"), click **`Cancel`** — never
       confirm a purge.
   - Screenshot to confirm Stardew Valley is now the active game before
     continuing. If it cannot be made active, report what you see and
     stop.

3. **Launch the game.** With Stardew Valley set as the active managed
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

4. **Wait for the game to start.** Stardew Valley can take 10–30 seconds
   to launch from cold:
   - Take screenshots at roughly 5-second intervals (up to ~45 seconds
     total) and look for the Stardew Valley window appearing in the VNC
     session. Signs it has launched: a new top-level window with farm /
     pixel-art content, the ConcernedApe splash, or an opening movie.
   - If after ~45 seconds nothing has appeared, report the timeout and
     describe what is on screen (Vortex still focused? error dialog?
     blank desktop?). Don't keep retrying.

5. **Confirm the Stardew Valley main menu.** Once the game window is up
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

6. **Start character creation.** From the main menu, click the `New`
   button (use the held in-game click — see Guidance).
   - Wait briefly, then screenshot to confirm the character / farm
     creation screen is showing. You should see input fields for the
     farm name, the farmer's name, and a "Favorite Thing", plus
     controls for gender, pet, farm type, etc.

7. **Fill in the character creation fields.** Use these exact test
   values so screenshots and logs are reproducible across runs:
   - Farm name: `VortexTest`
   - Farmer name: `Tester`
   - Favorite Thing: `Mods`

   For each field: click the input (held in-game click), clear any
   placeholder text, type the value, then screenshot to verify the field
   shows what you typed. Leave gender, farm type, pet, etc. at their
   defaults — do not change anything else.

8. **Enable the "Skip Intro" option.** Locate the Skip Intro control —
   typically a checkbox or toggle near the bottom of the character
   creation screen (wording is usually `Skip Intro` or
   `Skip intro cutscene`; in some versions it lives inside an
   `Advanced Options` panel that has to be expanded first).
   - Screenshot before clicking so the un-checked state is captured.
   - Click the option to enable it (held in-game click).
   - Screenshot again and confirm the checkbox / toggle is now in the
     enabled state.
   - If the option cannot be found, report that and stop — do not
     proceed to start a new game without skip-intro enabled.

9. **Start the new game and confirm gameplay loads.** Click the
   primary `OK` / `Confirm` / `Start` button to begin (held in-game
   click).
   - Wait for the load. Take screenshots at roughly 5-second intervals
     (up to ~30 seconds total) and watch for the game to transition from
     character creation → loading → in-game view.
   - With Skip Intro enabled the bus / arrival cutscene should be
     skipped; the first scene visible should be the player character
     inside the farmhouse or on the farm at the start of Day 1.
   - Screenshot once the player character is on screen and the HUD
     (clock, energy bar, etc.) is visible. That confirms the new game
     started cleanly.
   - If the game gets stuck on a loading screen for more than ~30
     seconds, or shows an error, report what you see and stop.

10. **Report.** Summarise in 8-12 lines:
    - Whether Vortex was already running.
    - Whether Stardew Valley was already the active managed game, or had
      to be activated / added (and whether a purge prompt appeared and
      was cancelled).
    - That the game launched successfully (and roughly how long it took
      to reach the main menu), and whether a tool-picker appeared.
    - That the main menu title says "Stardew Valley" and that both the
      new-game and load-save options are present and interactable.
    - That character creation was reached, the test values
      (`VortexTest` / `Tester` / `Mods`) were entered, and Skip Intro
      was enabled.
    - That the new game loaded into in-game play (player character
      visible with HUD).
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
  from step 5 onward — issue a *held* click via the Bash tool instead of
  the MCP click tool:

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
  - Typing into game text fields (the names in step 7) still works
    through the MCP type/key tools once the field is focused — only the
    *click* to focus the field needs `game-click`.
- To switch focus to Vortex, always screenshot first. If any part of
  the Vortex window is visible (a title bar, an edge poking out behind
  another window), click its title bar / window header to raise it.
  Only fall back to the fluxbox taskbar / window list when no part of
  Vortex is on screen.
- Do **not** confirm any purge / cleanup / overwrite prompt — always
  pick the cancel/abort option on such dialogs.
- Do not change any other settings or activate any other game.
