// Utility functions for Tailwind design system

/**
 * Combines class names, filtering out falsy values
 */
export function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Creates a function to get variant classes with base styles
 */
export function createVariantClasses<T extends Record<string, any>>(
  base: string,
  variants: T
): (variant: keyof T) => string {
  return (variant) => {
    const variantConfig = variants[variant];
    if (typeof variantConfig === 'string') {
      return clsx(base, variantConfig);
    }

    if (typeof variantConfig === 'object' && variantConfig !== null) {
      return clsx(
        base,
        variantConfig.base,
        variantConfig.hover,
        variantConfig.focus,
        variantConfig.disabled
      );
    }

    return base;
  };
}

/**
 * Merges props with defaults
 */
export function withDefaults<T>(
  props: Partial<T>,
  defaults: T
): T {
  return { ...defaults, ...props };
}

/**
 * Creates responsive class variants
 */
export function responsive(
  base: string,
  variants: Partial<Record<'sm' | 'md' | 'lg' | 'xl', string>>
): string {
  const classes = [base];

  if (variants.sm) classes.push(`sm:${variants.sm}`);
  if (variants.md) classes.push(`md:${variants.md}`);
  if (variants.lg) classes.push(`lg:${variants.lg}`);
  if (variants.xl) classes.push(`xl:${variants.xl}`);

  return classes.join(' ');
}

/**
 * Conditional class application
 */
export function conditionalClass(
  condition: boolean,
  trueClass: string,
  falseClass: string = ''
): string {
  return condition ? trueClass : falseClass;
}