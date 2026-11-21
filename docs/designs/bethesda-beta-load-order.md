# Opt-in Beta load order for Bethesda plugins

Status: Approved

## Overview

Add the shared drag-and-drop Load order page as a per-profile opt-in for games that use Vortex’s Bethesda Plugins page. Classic remains the default. Users can switch views from either toolbar, keeping their saved order and automatic sorting preference. Both switches use the Mods table’s flask icon and its title-and-description tooltip pattern.

## Acceptance criteria

1. A profile with no Beta preference opens the existing Plugins page. The Load order page is absent, and existing LOOT actions and automatic sorting behave as they did on the base build.
2. **Switch to beta view** opens Load order and removes Plugins from the sidebar. A different profile without an opt-in continues to show Plugins.
3. In Beta, dragging an enabled plugin to a valid position updates Vortex’s order and the game’s persisted order without changing deployed plugin bytes. Moving a dependent ahead of its master is rejected and leaves the persisted order intact.
4. Beta preserves the Classic automatic sorting preference, suppresses automatic sorts, and still runs an explicit **Sort via LOOT**.
5. **Switch to classic view** returns to Plugins and preserves both the persisted order and the existing automatic sorting preference. Restarting with either preference restores that profile’s chosen view.
6. Hovering or focusing **Switch to beta view** shows “Try the new load order view. Some features aren't supported yet.” Hovering or focusing **Switch to classic view** shows “Return to the original Plugins view.”

## Collections compatibility

The view is a local profile preference. A collection neither records the curator's choice nor switches the recipient's profile to that view.

| Collection and recipient                                                    | Result                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A collection with LOOT rules installed in Classic                           | Vortex imports the rules unless skipped and runs the usual post-install LOOT sort, including when the profile has autosort turned off.                                                  |
| A collection with LOOT rules installed in Beta                              | Vortex imports the rules unless skipped. Beta keeps automatic sorting paused and leaves the post-install sort pending. The user can apply the rules with **Sort via LOOT**.             |
| A collection authored with a manual Beta order and installed in either view | The recipient cannot replay the curator's exact sequence from the collection. Classic uses the ordinary LOOT flow. A Beta recipient can sort with LOOT or arrange the plugins manually. |

Workshop upload in Beta uses the existing Bethesda exporter. It lists enabled member plugins in the current order and includes LOOT rules unless the curator excludes them. Collection installation uses that list for enabled-state handling and does not replay its sequence. Since the existing exporter omits disabled entries and the installer enables unlisted member plugins by default, curators should not assume disabled entries will stay disabled after installation.

Portable manual ordering needs its own collection data and install behavior in both views. That work should validate dependencies, handle missing or optional members and preserve the recipient’s local preference. A Workshop warning about the current export limit is a separate follow-up.

## Scope

The new page reuses the shared load-order UI and the existing Bethesda plugin writer. Switching is scoped to supported Classic profiles.
