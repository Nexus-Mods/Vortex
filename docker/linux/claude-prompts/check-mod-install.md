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

7. **Launch the game.** With Stardew Valley set as the active managed
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

8. **Wait for the game to start.** Stardew Valley can take 10–30 seconds
   to launch from cold:
   - Take screenshots at roughly 5-second intervals (up to ~45 seconds
     total) and look for the Stardew Valley window appearing in the VNC
     session. Signs it has launched: a new top-level window with farm /
     pixel-art content, the ConcernedApe splash, or an opening movie.
   - If after ~45 seconds nothing has appeared, report the timeout and
     describe what is on screen (Vortex still focused? error dialog?
     blank desktop?). Don't keep retrying.

9. **Confirm the Stardew Valley main menu.** Once the game window is up
   and past any intro splash / opening animation, confirm the title
   screen:
   - Screenshot the main menu.
   - The title text on the screen should read **"Stardew Valley"** (the
     game's logo, usually in a hand-drawn font).
   - There should be menu options to start a new game and to load an
     existing save. Exact wording varies by version but is typically
     `New`, `Load`, and `Co-op` (plus `Exit`). Both `New` and `Load`
     must be present and look interactable (not greyed out).
   - Do **not** click `New`, `Load`, or any of the menu entries — only
     observe.
   - If the menu shown does not say "Stardew Valley" or is missing the
     new / load options, screenshot it and report what you see instead.

10. **Report.** Summarise in 7-10 lines:
    - Whether Vortex was already running.
    - That the Games tab opened successfully and which tab Stardew Valley
      was found under.
    - Whether the `Manage` action triggered a purge prompt, and the exact
      wording the prompt used.
    - That the prompt was cancelled (no purge ran), if it appeared.
    - That Stardew Valley now shows as managed and is the active game.
    - That the game launched successfully (and roughly how long it took
      to reach the main menu).
    - That the main menu title says "Stardew Valley" and that both the
      new-game and load-save options are present and interactable.
    - If anything failed, the precise step it failed at and a brief
      description of what was on screen at that point.

## Guidance

- Always screenshot before clicking, and screenshot again after to
  verify the click landed where you expected.
- Prefer clicking on the centre of UI elements; the noVNC canvas does
  not expose accessible names.
- Do **not** confirm any purge / cleanup / overwrite prompt — always
  pick the cancel/abort option on such dialogs.
- Do not change any other settings or activate any other game.
- If a login prompt or unrelated modal blocks the UI, describe it and
  stop. Do not dismiss it without instructions.
