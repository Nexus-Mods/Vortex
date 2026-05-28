# Verify the Dashboard's getting-started guide can play its video

You are driving the Vortex desktop application through a VNC MCP server.
The VNC session shows the Vortex Electron window (or its loading splash).
Coordinates returned by screenshot tools are in the desktop's pixel space.

## Task

1. **Confirm Vortex is running.** Take a screenshot of the VNC session and
   look for the Vortex main window:
   - The window title or in-app branding should say "Vortex".
   - The left-hand navigation column should contain entries such as
     `Dashboard`, `Mods`, `Downloads`, `Profiles`, etc.
   - If you only see a loading splash, wait ~5 seconds and screenshot
     again (retry up to 6 times before giving up).
   - If Vortex is not running, report that clearly and stop.

2. **Navigate to the Dashboard.** It's usually the topmost entry in the
   left-hand sidebar (often the default view when Vortex first opens).
   - Click the `Dashboard` entry.
   - Wait briefly, then screenshot to confirm the Dashboard is showing.
     You should see one or more dashlets/widgets such as
     `Recently Managed`, `Tools`, `Announcements`, and a getting-started
     guide widget.

3. **Find the getting-started guide for browsing and installing mods.**
   Look for a dashlet whose heading mentions getting started, browsing,
   or installing mods (wording may vary slightly between Vortex versions
   — examples: "Getting Started", "How to install mods", "Browse and
   install mods").
   - Identify which dashlet contains it and screenshot it.
   - The widget should embed (or link to) a tutorial video — typically
     shown as a video player or a thumbnail with a play button overlay.
   - If no such widget is visible, scroll the Dashboard view (mouse wheel
     or page-down) and screenshot again; report what you find.

4. **Start the video.** Click the play button or the video thumbnail in
   the getting-started widget.
   - Wait ~2 seconds, screenshot, and verify the video has started
     playing. Signs it's playing: the play button has changed to a pause
     icon, the playhead/progress bar has moved, or the thumbnail has been
     replaced by playing video frames.
   - If clicking the play button instead opened an external browser, a
     YouTube tab, or a modal player, report that — it still counts as
     the video starting, but note the indirection.
   - Do not unmute or change volume.

5. **Report.** Summarise in 4-6 lines:
   - Whether Vortex was already running.
   - That the Dashboard is visible and which dashlets are on it.
   - The exact title of the getting-started guide widget you found.
   - Whether the video started playing, and where (in-app player vs.
     external browser vs. modal).
   - If anything failed, the precise step it failed at.

## Guidance

- Always screenshot before clicking, and screenshot again after to
  verify the click landed where you expected.
- Prefer clicking on the centre of UI elements; the noVNC canvas does
  not expose accessible names.
- Don't dismiss, configure, or customise the Dashboard layout — only
  observe and interact with the getting-started widget.
- If a modal dialog blocks the UI (e.g. a login prompt or "what's new"
  popup), describe it and stop. Do not click through without
  instructions.
