// Design tokens exports
export { colorTokens } from './colors';
export type { ColorVariant } from './colors';

export { semanticColors, semanticColorTokens, getSemanticColor } from './semanticColors';
export type { SemanticColorToken } from './semanticColors';

export { spacingScale, spacingTokens, radiusTokens, shadowTokens } from './spacing';
export type { SpacingScale, SizeVariant, RadiusVariant, ShadowVariant } from './spacing';

export { transitionTokens, animationTokens } from './motion';
export type { TransitionVariant, AnimationVariant } from './motion';

export { typographyTokens } from './typography';
export type { FontWeight, LineHeight, LetterSpacing, TextSize, TextTransform } from './typography';

export { textStyles, textColors, getTextStyle } from './textStyles';
export type { BodySize, BodyWeight, TitleSize, HeadingSize, TextColor } from './textStyles';

export { baseComponents } from './base';
export type { BaseComponent } from './base';

// Import for combined object
import { colorTokens } from './colors';
import { semanticColorTokens } from './semanticColors';
import { spacingScale, spacingTokens, radiusTokens, shadowTokens } from './spacing';
import { transitionTokens, animationTokens } from './motion';
import { typographyTokens } from './typography';
import { textStyles, textColors } from './textStyles';
import { baseComponents } from './base';

// Combined tokens object for convenience
export const tokens = {
  colors: colorTokens,
  semanticColors: semanticColorTokens,
  spacingScale: spacingScale,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadows: shadowTokens,
  transitions: transitionTokens,
  animations: animationTokens,
  typography: typographyTokens,
  textStyles: textStyles,
  textColors: textColors,
  base: baseComponents
} as const;