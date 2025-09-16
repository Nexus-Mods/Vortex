// Figma text styles converted to Tailwind design system
export const textStyles = {
  // Body text styles
  body: {
    sm: {
      normal: 'tw:text-xs tw:font-normal tw:leading-none tw:tracking-tight',
      semibold: 'tw:text-xs tw:font-semibold tw:leading-none tw:tracking-tight'
    },
    md: {
      normal: 'tw:text-sm tw:font-normal tw:leading-tight',
      semibold: 'tw:text-sm tw:font-semibold tw:leading-tight'
    },
    lg: {
      normal: 'tw:text-base tw:font-normal tw:leading-normal',
      semibold: 'tw:text-base tw:font-semibold tw:leading-normal'
    },
    xl: {
      normal: 'tw:text-lg tw:font-normal tw:leading-relaxed',
      semibold: 'tw:text-lg tw:font-semibold tw:leading-relaxed'
    },
    xxl: {
      normal: 'tw:text-xl tw:font-normal tw:leading-loose',
      semibold: 'tw:text-xl tw:font-semibold tw:leading-loose'
    }
  },

  // Title text styles (uppercase, wide tracking)
  title: {
    xs: {
      semi: 'tw:text-[10px] tw:font-semibold tw:uppercase tw:leading-none tw:tracking-wide'
    },
    sm: {
      semi: 'tw:text-xs tw:font-semibold tw:uppercase tw:leading-none tw:tracking-wider'
    },
    md: {
      semi: 'tw:text-sm tw:font-semibold tw:uppercase tw:leading-tight tw:tracking-wider'
    }
  },

  // Heading text styles
  heading: {
    xs: {
      semi: 'tw:text-lg tw:font-semibold tw:leading-snug'
    },
    sm: {
      semi: 'tw:text-2xl tw:font-semibold tw:leading-loose'
    },
    md: {
      semi: 'tw:text-3xl tw:font-semibold tw:leading-9'
    },
    lg: {
      semi: 'tw:text-4xl tw:font-semibold tw:leading-10'
    },
    xl: {
      semi: 'tw:text-5xl tw:font-semibold tw:leading-[57.60px]'
    },
    '2xl': {
      semi: 'tw:text-6xl tw:font-semibold tw:leading-[72px]'
    }
  }
} as const;

// Type definitions for text styles
export type BodySize = keyof typeof textStyles.body;
export type BodyWeight = keyof typeof textStyles.body.sm;
export type TitleSize = keyof typeof textStyles.title;
export type HeadingSize = keyof typeof textStyles.heading;

// Utility function to get text style classes
export function getTextStyle(
  category: 'body' | 'title' | 'heading',
  size: string,
  weight?: string
): string {
  const styles = textStyles[category];
  if (!styles || !styles[size]) {
    return '';
  }

  if (weight && styles[size][weight]) {
    return styles[size][weight];
  }

  // Fallback to first available weight if weight not specified
  const firstWeight = Object.keys(styles[size])[0];
  return styles[size][firstWeight] || '';
}

// Color utilities using semantic color system
export const textColors = {
  neutralStrong: 'tw:text-[#1d1d21] tw:dark:text-[#f4f4f5]',
  neutralMedium: 'tw:text-[#3e3e47] tw:dark:text-[#d4d4d8]',
  neutralWeak: 'tw:text-[#71717a]',
  neutralSubdued: 'tw:text-[#52525b] tw:dark:text-[#a1a1aa]'
} as const;

export type TextColor = keyof typeof textColors;