// Typography tokens
export const typographyTokens = {
  fontWeight: {
    normal: 'tw:font-normal',
    medium: 'tw:font-medium',
    semibold: 'tw:font-semibold',
    bold: 'tw:font-bold'
  },

  lineHeight: {
    none: 'tw:leading-none',
    tight: 'tw:leading-tight',
    snug: 'tw:leading-snug',
    normal: 'tw:leading-normal',
    relaxed: 'tw:leading-relaxed',
    loose: 'tw:leading-loose'
  },

  letterSpacing: {
    tighter: 'tw:tracking-tighter',
    tight: 'tw:tracking-tight',
    normal: 'tw:tracking-normal',
    wide: 'tw:tracking-wide',
    wider: 'tw:tracking-wider'
  },

  textSize: {
    xs: 'tw:text-xs',
    sm: 'tw:text-sm',
    base: 'tw:text-base',
    lg: 'tw:text-lg',
    xl: 'tw:text-xl',
    '2xl': 'tw:text-2xl',
    '3xl': 'tw:text-3xl',
    '4xl': 'tw:text-4xl',
    '5xl': 'tw:text-5xl',
    '6xl': 'tw:text-6xl'
  },

  textTransform: {
    uppercase: 'tw:uppercase',
    lowercase: 'tw:lowercase',
    capitalize: 'tw:capitalize',
    normal: 'tw:normal-case'
  }
} as const;

export type FontWeight = keyof typeof typographyTokens.fontWeight;
export type LineHeight = keyof typeof typographyTokens.lineHeight;
export type LetterSpacing = keyof typeof typographyTokens.letterSpacing;
export type TextSize = keyof typeof typographyTokens.textSize;
export type TextTransform = keyof typeof typographyTokens.textTransform;