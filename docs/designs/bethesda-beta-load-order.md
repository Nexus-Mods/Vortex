# Opt-in Beta load order for Bethesda plugins

Status: Approved

## Overview

Add the shared drag-and-drop Load order page as a per-profile opt-in for games that use Vortex’s Bethesda Plugins page. Classic remains the default. Users can switch views from either toolbar, keeping their saved order and automatic sorting preference.

## Acceptance criteria

1. A profile with no Beta preference opens the existing Plugins page. The Load order page is absent, and existing LOOT actions and automatic sorting behave as they did on the base build.
2. **Switch to beta view** opens Load order and removes Plugins from the sidebar. A different profile without an opt-in continues to show Plugins.
3. In Beta, dragging an enabled plugin to a valid position updates Vortex’s order and the game’s persisted order without changing deployed plugin bytes. Moving a dependent ahead of its master is rejected and leaves the persisted order intact.
4. Beta preserves the Classic automatic sorting preference, suppresses automatic sorts, and still runs an explicit **Sort via LOOT**.
5. **Switch to classic view** returns to Plugins and preserves both the persisted order and the existing automatic sorting preference. Restarting with either preference restores that profile’s chosen view.

## Scope

The new page reuses the shared load-order UI and the existing Bethesda plugin writer. Switching is scoped to supported Classic profiles.
