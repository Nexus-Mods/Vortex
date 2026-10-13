# Field notes for the Vortex QA run

These are lessons from earlier runs. They are prepended to every prompt.
Where a prompt step disagrees with a note, the prompt step wins.

## Driving the apps

- Vortex and Chrome: use Playwright snapshots and element refs. A snapshot
  can be a moment stale after an action: wait a second and snapshot again
  before concluding an action did not land.
- Never type the same text twice because the first attempt "did not show".
  Snapshot again first; typing into a search box can render late and you
  would end up with it doubled ("StardewStardew"). If it did double, select
  all, clear, and type once.
- Do not pass a `filename` to `browser_snapshot` or save snapshots to
  files: they land in the repo. Read the snapshot in the reply.
- If a Playwright click keeps timing out on "stable" (animated page),
  say so in the report as a flag before falling back to a DOM click.
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

## Where things are in Vortex (master)

- The game's `Mods` view is under the game's own tab in the top bar
  (e.g. `Stardew Valley`), not in the left sidebar.
- Games that are installed but not added are listed under `New games
  detected` and only once Vortex is logged in. `Add game` adds one.
- The default Downloads list can be empty even after a download finished
  and installed. Check the game's `Mods` view or `View All Downloads`.
- Small mods install by themselves. Do not click `Install` on a download
  whose mod is already in the Mods list: it only asks to replace it.

## Nexus Mods website

- Mod Manager Download first shows a `Download mod file` requirements
  dialog. Download the mod itself, not its requirements (e.g. SMAPI).
- A Premium account goes straight to the download. A free account sees a
  `Slow download` page with a countdown.
- `Add collection` shows a web modal, "Vortex required". Click
  `Continue (requires Vortex)`: that link is the real handoff to Vortex.
- Chrome is set to open `nxm://` links from nexusmods.com without a prompt.

## Stardew Valley

- Clicks inside the game must use `docker exec vortex-vnc game-click X Y`.
  Normal VNC clicks are too short for the game to see.
- When a menu has just appeared it is still animating. Wait ~2 seconds
  before the first click, check the result, and click again if it did not
  register.
- Typing into the game's text fields works once the field is focused.

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
