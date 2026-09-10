/**
 * Joins class names, filtering out falsy values
 * Supports conditional classes via object syntax
 *
 * @example
 * joinClasses("foo", { bar: true }) // "foo bar"
 * joinClasses(["foo", "bar"], { baz: true }) // "foo bar baz"
 * joinClasses(["foo", { bar: true }]) // "foo bar"
 */

type ClassItem = string | string[] | Record<string, boolean | undefined>;

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
