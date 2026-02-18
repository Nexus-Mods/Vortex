/**
 * Tabs Component System
 * Adapted from web team's "next" project for Vortex
 *
 * A complete tabbed interface system with:
 * - Context-based state management
 * - Primary and secondary tab styles
 * - Full keyboard navigation (Arrow keys, Home, End)
 * - ARIA accessibility support
 * - Optional count badges
 */

export { getTabId } from "../utils";
export { TabBar } from "./tab-bar";
export { TabButton } from "./tab";
export type { TabButtonProps } from "./tab";
export { TabPanel } from "./tab-panel";
export { TabProvider, useTabContext } from "./tabs.context";
export type { TabProviderProps, TabsState } from "./tabs.context";
