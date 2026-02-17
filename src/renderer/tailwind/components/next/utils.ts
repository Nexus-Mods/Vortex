/**
 * Shared utility functions for web team components
 * Adapted from web team's "next" project
 */

/**
 * XOr type - ensures only one of two types can be used
 */
export type XOr<T, U> = T | U extends object
  ?
      | (T & Partial<Record<keyof U, never>>)
      | (U & Partial<Record<keyof T, never>>)
  : T | U;

type ClassItem = string | string[] | Record<string, boolean | undefined>;

/**
 * Joins class names, filtering out falsy values
 * Supports conditional classes via object syntax
 *
 * @example
 * joinClasses("foo", { bar: true }) // "foo bar"
 * joinClasses(["foo", "bar"], { baz: true }) // "foo bar baz"
 * joinClasses(["foo", { bar: true }]) // "foo bar"
 */
export function joinClasses(
  classes: ClassItem | ClassItem[],
  conditionalClasses?: Record<string, boolean | undefined>,
): string {
  const classArray: string[] = [];

  // Normalize to array - wrap non-array inputs
  const classItems: ClassItem[] = Array.isArray(classes) ? classes : [classes];

  // Process main classes
  classItems.forEach((item) => {
    if (typeof item === "string") {
      classArray.push(item);
    } else if (Array.isArray(item)) {
      classArray.push(...item);
    } else if (typeof item === "object") {
      Object.entries(item).forEach(([key, value]) => {
        if (value) {
          classArray.push(key);
        }
      });
    }
  });

  // Process conditional classes
  if (conditionalClasses) {
    Object.entries(conditionalClasses).forEach(([key, value]) => {
      if (value) {
        classArray.push(key);
      }
    });
  }

  return classArray.filter(Boolean).join(" ");
}

/**
 * Responsive screen sizes for Tailwind
 */
export type ResponsiveScreenSizes =
  | "default"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl";

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
