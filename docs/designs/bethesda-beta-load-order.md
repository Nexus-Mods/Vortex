# Opt-in Beta load order for Bethesda plugins

Status: Approved

## Overview

Add the shared drag-and-drop Load order page as a per-profile opt-in for games that use Vortex’s Bethesda Plugins page. Classic remains the default. A confirmation explains the effect of switching views before Vortex changes the profile. Both switches use the Mods table’s flask icon and its title-and-description tooltip pattern. Collections authored in Beta can carry the curator’s manual plugin order.

## Acceptance criteria

1. A profile with no Beta preference opens the existing Plugins page. The Load order page is absent, and existing LOOT actions and automatic sorting behave as they did on the base build.
2. **Switch to beta view** explains that the current order is kept and automatic LOOT sorting pauses. Confirming opens Load order and removes Plugins from the sidebar. Cancelling leaves the view and order in place. A different profile without an opt-in continues to show Plugins.
3. In Beta, dragging an enabled plugin to a valid position updates Vortex’s order and the game’s persisted order without changing deployed plugin bytes. Moving a dependent ahead of its master is rejected and leaves the persisted order intact.
4. Beta preserves the Classic automatic sorting preference, suppresses automatic sorts, and still runs an explicit **Sort via LOOT**.
5. **Switch to classic view** warns that the next LOOT sort may change the order. Confirming returns to Plugins and preserves the persisted order and automatic sorting preference. Cancelling keeps Beta active. Restarting with either preference restores the profile’s chosen view.
6. Hovering or focusing **Switch to beta view** shows “Try the new load order view. Some features aren't supported yet.” Hovering or focusing **Switch to classic view** shows “Return to the original Plugins view.”
7. In Workshop, a Beta curator can preview and export the collection's plugin sequence and enabled states. Changing the order changes the preview and the exported entries. Exporting from Classic carries no manual sequence.
8. Installing a collection with a saved order into a new profile opens that profile in Beta and applies that order. An ordinary collection leaves a new profile in Classic.
9. An existing profile gets a choice before installation. **Use Saved Order** enables Beta and applies the order to installed collection plugins. **Keep Current Sorting** installs using the profile's current method without applying the manual order. **Cancel** returns to the install prompt without starting installation.
10. The saved order skips absent optional members, keeps unrelated plugins in their relative order and respects master dependencies. Optional members selected from the same installation review follow their saved positions and enabled states once they deploy. If the merged order is invalid, Vortex warns the user and keeps the deployed plugin order. The collection remains installed and the profile stays in Beta.
11. After a pause or a restart, resuming the same collection install on the same profile remembers **Use Saved Order** or **Keep Current Sorting**. If the recipient previously selected **Use Saved Order** and the profile now uses Classic, resuming asks again before Vortex can switch it back to Beta. **Keep Current Sorting** resumes in Classic. **Cancel** leaves the install paused. A different profile or a fresh install after completion or cancellation gets its own choice.
12. Collections installed in Beta leave automatic LOOT sorting paused. Completing an install in Beta discards that collection
13. When a new collection is imported during or after a profile switch, its install prompt opens on the current profile for that game once the switch finishes.
14. **Load Order Export** writes a JSON snapshot of the order and enabled states of all deployed, non-ghosted plugins for that profile. **Load Order Import** restores a snapshot whose plugin set matches those plugins and whose order satisfies current validation. Cancelling, malformed JSON, or a rejected snapshot leaves the game files unchanged.
15. Searching filters the visible rows. **Refresh List** reloads the committed order. **Sort by Deploy Order** applies mod deployment rules through the same validation and preserves plugin enabled states.
16. Switching views preserves existing Classic plugin index locks. Beta rejects a manual edit while an index lock exists and leaves the game files unchanged. Clearing the lock allows Beta edits. Ghosted plugins stay out of the Beta list, and Beta edits leave their files alone.

## Collections compatibility

Workshop carries the Beta sequence in the existing file-based collection format, under the named Bethesda order. The regular Bethesda plugin and LOOT rules metadata still provides a fallback for Classic recipients and older Vortex versions.

When a collection carries a saved order, a new profile created by the installer uses Beta. On an existing profile, the recipient chooses whether to apply the order before installation starts. The user can activate a selected profile as part of choosing the saved order. Vortex matches saved entries against deployed plugins owned by enabled collection members and validates the resulting order before writing it. Beta keeps automatic sorting paused. Classic runs the usual collection LOOT sort if the user keeps Classic.

## Scope

The new page reuses the shared load-order UI and the existing Bethesda plugin writer. The opt-in applies to games that use the shared Bethesda Plugins page. Games with their own manual load order experience keep that entry point. The Beta writer uses the game's existing persistence format, including file timestamps where that format requires them.
