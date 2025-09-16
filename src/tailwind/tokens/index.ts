// Design tokens exports
export { colorTokens } from './colors';
export type { ColorVariant } from './colors';

export { spacingTokens, radiusTokens, shadowTokens } from './spacing';
export type { SizeVariant, RadiusVariant, ShadowVariant } from './spacing';

export { transitionTokens, animationTokens } from './motion';
export type { TransitionVariant, AnimationVariant } from './motion';

export { baseComponents } from './base';
export type { BaseComponent } from './base';

// Import for combined object
import { colorTokens } from './colors';
import { spacingTokens, radiusTokens, shadowTokens } from './spacing';
import { transitionTokens, animationTokens } from './motion';
import { baseComponents } from './base';

// Combined tokens object for convenience
export const tokens = {
  colors: colorTokens,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadows: shadowTokens,
  transitions: transitionTokens,
  animations: animationTokens,
  base: baseComponents
} as const;