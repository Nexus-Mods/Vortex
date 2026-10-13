# Field notes for the Vortex QA run

These are lessons from earlier runs. They are prepended to every prompt.
Where a prompt step disagrees with a note, the prompt step wins.

## Driving the apps

- Vortex and Chrome: use Playwright snapshots and element refs. Actions
  such as clicks and typing return a fresh snapshot, so do not take
  another one just to check the action landed. That snapshot can be a
  moment stale: if the action looks like it did not land, wait a second
  and snapshot again before concluding it failed.
- To wait for something to appear, use `browser_wait_for` with the text
  you expect, not a fixed number of seconds.
- Never type the same text twice because the first attempt "did not show".
  Snapshot again first; typing into a search box can render late and you
  would end up with it doubled ("StardewStardew"). If it did double, select
  all, clear, and type once.
- Do not pass a `filename` to `browser_snapshot` or save snapshots to
  files: they land in the repo. Read the snapshot in the reply.
- Before clicking on a Chrome page, make its tab the active one with
  `browser_tabs` (`action: select`). In a background tab, clicks time out
  on Playwright's "stable" check.
- If a Playwright click still keeps timing out on "stable" (animated
  page), say so in the report as a flag before falling back to a DOM
  click. Never DOM-click `Add collection`, `Continue (requires Vortex)`
  or any other link that hands an `nxm://` URL to Vortex: Chrome only
  passes it on from a real click. If a real click on one of those keeps
  failing, report it and stop (FAIL).
- Playwright cannot see inside embedded frames or native OS dialogs. Use a
  `vnc` screenshot for those.
- VNC tools: `write_string` takes the parameter `string`. Screenshots can
  be a frame behind.

## Logging in

- Vortex login: click `Log in` in Vortex, then in Chrome click
  `Authorise`, then click `CONTINUE` on the "Authorisation successful!"
  page. The `CONTINUE` click is what delivers the login to Vortex. Stopping
  after `Authorise` leaves Vortex logged out.
- The Nexus Mods website session normally survives between runs, so the
  login form and its Cloudflare check do not appear. If you do see the
  sign-in form, or "Captcha challenge failed", do not try to get past it:
  stop and report BLOCKED at login.

## Vortex notifications

- After login Vortex shows a `Help us improve your modding experience`
  notification. Click its `More` button, then `No, don't share data`
  (test runs must not count as real users). It is not a flag.

## Where things are in Vortex (master)

- The game's `Mods` view is under the game's own tab in the top bar
  (e.g. `Stardew Valley`), not in the left sidebar.
- Games that are installed but not added are listed under `New games
  detected` and only once Vortex is logged in. `Add game` adds one.
- The default Downloads list can be empty even after a download finished
  and installed. Check the game's `Mods` view or `View All Downloads`.
- Small mods install by themselves. Do not click `Install` on a download
  whose mod is already in the Mods list: it only asks to replace it.
- Vortex deploys automatically after installs. The `Deploy` button in
  the toolbar is always there for a manual redeploy; it is not a sign of
  pending changes and not a flag.
- The Mods view lists a collection as a row of its own, next to its
  mods, and keeps mods installed by earlier checks (CJB Item Spawner
  shows `Disabled` in a collection's new profile). With the mod check
  run first, Stardew Valley VERY Expanded gives 103 rows: its 101 mods,
  the collection row and CJB Item Spawner. That is expected, not a flag.
- Stardew Valley VERY Expanded's 101 mods are 100 downloaded from Nexus
  Mods and 1 bundled with the collection, so the install progress
  counter reads "of 100". That is expected, not a flag.

## Nexus Mods website

- Mod Manager Download first shows a `Download mod file` requirements
  dialog. Download the mod itself, not its requirements (e.g. SMAPI).
- A Premium account goes straight to the download. A free account sees a
  `Slow download` page with a countdown.
- `Add collection` shows a web modal, "Vortex required". Click
  `Continue (requires Vortex)`: that link is the real handoff to Vortex.
- Chrome is set to open `nxm://` links from nexusmods.com without a prompt.

## Stardew Valley

- Clicks inside the game must use `docker exec vortex-vnc game-click X Y`,
  with X and Y read off a VNC screenshot. Normal VNC clicks are too short
  for the game to see. Optional extra arguments:
  `game-click X Y [HOLD_SECONDS] [BUTTON] [CLICKS]` (`3` as BUTTON for a
  right-click, `2` as CLICKS for a double-click).
- When a menu has just appeared it is still animating. Wait ~2 seconds
  before the first click, check the result, and click again if it did not
  register.
- Typing into the game's text fields works once the field is focused.
- In the SMAPI log, ignore the `OpenAL device could not be initialized`
  (`NoAudioHardwareException`) error, because the container has no sound
  card, the "Steam achievements won't work because Steam isn't loaded"
  error, because the game is not launched through Steam, and Save
  Backup's warning about console access. None of these is a flag.

## Always report as flags (even when the run passes)

Anything that looks like a regression or a rough edge, with where you saw
it. Known examples from earlier runs, to keep reporting while they last:

- "failed to patch" error notifications right after a collection install.
- "Game version mismatch" dialog with an empty "Your game version".
- "SMAPI is not installed" warning when SMAPI is installed or in the
  collection.
- Dialogs stacking over each other, or a dialog that cannot be dismissed.
- The Downloads list not showing a finished download.

Missing required mods or failed downloads are always a FAIL.
