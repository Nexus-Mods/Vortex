/**
 * Shared utility functions for web team components
 * Adapted from web team's "next" project
 */

/**
 * XOr type - ensures only one of two types can be used
 */
export type XOr<T, U> = T | U extends object
  ? (T & Partial<Record<keyof U, never>>) | (U & Partial<Record<keyof T, never>>)
  : T | U;

/**
 * Joins class names, filtering out falsy values
 * Supports conditional classes via object syntax
 */
export function joinClasses(
  classes: (string | string[] | Record<string, boolean | undefined>)[],
  conditionalClasses?: Record<string, boolean | undefined>
): string {
  const classArray: string[] = [];

  // Process main classes
  classes.forEach((item) => {
    if (typeof item === 'string') {
      classArray.push(item);
    } else if (Array.isArray(item)) {
      classArray.push(...item);
    } else if (typeof item === 'object') {
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

  return classArray.filter(Boolean).join(' ');
}

/**
 * Responsive screen sizes for Tailwind
 */
export type ResponsiveScreenSizes = 'default' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
