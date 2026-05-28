# Verify Vortex is running and open Settings

You are driving the Vortex desktop application through a VNC MCP server.
The VNC session shows the Vortex Electron window (or its loading splash).
Coordinates returned by screenshot tools are in the desktop's pixel space.

## Task

1. **Confirm Vortex is running.** Take a screenshot of the VNC session and
   look for the Vortex main window:
   - The window title or in-app branding should say "Vortex".
   - The left-hand navigation column should contain entries such as
     `Dashboard`, `Mods`, `Downloads`, `Profiles`, etc.
   - If you only see a loading splash, wait ~5 seconds and screenshot again
     (retry up to 6 times before giving up).
   - If Vortex is not running, report that clearly and stop — do not try
     to launch it yourself.

2. **Navigate to the Settings menu.** Settings lives in the lower portion
   of the left-hand navigation sidebar, typically below the main entries.
   - Click the `Settings` entry (gear icon).
   - Wait briefly, then screenshot to confirm the Settings page is showing
     (you should see tabs like `General`, `Mods`, `Download`, `Interface`,
     `Vortex`, `Advanced`).

3. **Report.** Summarise in 3-5 lines:
   - Whether Vortex was already running.
   - That the Settings page is now visible.
   - Which Settings tab is currently selected.

## Guidance

- Always screenshot before clicking, and screenshot again after to verify.
- Prefer clicking on the centre of UI elements; the noVNC canvas does not
  expose accessible names.
- Don't change any settings — only navigate.
- If a modal dialog blocks the UI (e.g. a login prompt), describe it and
  stop. Do not dismiss it without instructions.
