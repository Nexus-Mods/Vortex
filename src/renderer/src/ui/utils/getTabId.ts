/**
 * Converts a tab name into a valid HTML element ID
 * Converts to lowercase and replaces whitespace with underscores
 *
 * @example
 * getTabId('My Tab') → 'my_tab'
 * getTabId('Tab   1') → 'tab_1'
 * getTabId('A tab name\n  on multiple lines') → 'a_tab_name_on_multiple_lines'
 */
export function getTabId(tabName: string): string {
  return tabName.toLowerCase().replace(/\s+/g, "_");
}
